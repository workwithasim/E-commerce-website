import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { adminRoles, orderScope, orderInclude, publicUser, deliveryTransitions } from '../services/access';
import { emitOrder } from '../services/events';
import { getIO } from '../socket';
const router = Router();
router.use(authenticateJWT, requireTenantIsolation);

router.get('/riders', requireRole(adminRoles), async (req, res) => {
  try {
    const where: any = { tenantId: req.tenant!.id };
    if (req.user!.role === 'BRANCH_MANAGER') {
      const staff = await prisma.branchStaff.findMany({ where: { userId: req.user!.id } });
      where.branchId = { in: staff.map(s => s.branchId) };
    }
    const riders = await prisma.rider.findMany({ where, include: { user: { select: publicUser }, branch: true } });
    res.json({ success: true, data: riders });
  } catch { res.status(500).json({ success: false, error: { message: 'Unable to load riders' } }); }
});
router.patch('/riders/availability', requireRole(['RIDER']), async (req, res) => {
  try {
    if (typeof req.body.isAvailable !== 'boolean') throw new Error('Availability must be true or false');
    const rider = await prisma.rider.update({ where: { userId: req.user!.id }, data: { isAvailable: req.body.isAvailable, status: req.body.isAvailable ? 'AVAILABLE' : 'OFFLINE' } });
    res.json({ success: true, data: rider });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
});
router.post('/assign', requireRole(adminRoles), async (req, res) => {
  try {
    const { orderId, riderId } = req.body;
    if (typeof orderId !== 'string' || typeof riderId !== 'string') throw new Error('Order and rider are required');
    const scope = await orderScope(req.user!, req.tenant!.id);
    const order = await prisma.order.findFirst({ where: { AND: [scope, { id: orderId, status: 'READY', orderMode: 'DELIVERY' }] } });
    if (!order) throw new Error('A ready delivery order is required');
    const rider = await prisma.rider.findFirst({ where: { id: riderId, tenantId: req.tenant!.id, isAvailable: true, user: { isActive: true }, OR: [{ branchId: null }, { branchId: order.branchId }] } });
    if (!rider) throw new Error('Rider is unavailable for this branch');
    const result = await prisma.$transaction(async tx => {
      const changed = await tx.order.updateMany({ where: { id: orderId, status: 'READY' }, data: { status: 'RIDER_ASSIGNED' } });
      if (!changed.count) throw new Error('Order already assigned');
      await tx.delivery.update({ where: { orderId }, data: { riderId, status: 'ASSIGNED', assignedAt: new Date() } });
      await tx.orderStatusHistory.create({ data: { orderId, oldStatus: 'READY', newStatus: 'RIDER_ASSIGNED', changedBy: req.user!.id } });
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, action: 'ASSIGN', entity: 'Order', entityId: orderId, newValue: riderId } });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    });
    emitOrder('order:status_updated', result);
    getIO().to(`rider:${riderId}`).emit('delivery:assigned', result.delivery);
    res.json({ success: true, data: result.delivery });
  } catch (err: any) { res.status(409).json({ success: false, error: { message: err.message } }); }
});
router.get('/assigned', requireRole(['RIDER']), async (req, res) => {
  try {
    const deliveries = await prisma.delivery.findMany({ where: { tenantId: req.tenant!.id, rider: { userId: req.user!.id } }, include: { order: { include: orderInclude } }, orderBy: { assignedAt: 'desc' }, take: 100 });
    res.json({ success: true, data: deliveries });
  } catch { res.status(500).json({ success: false, error: { message: 'Unable to load assignments' } }); }
});
router.patch('/:id/status', requireRole(['RIDER']), async (req, res) => {
  try {
    const delivery = await prisma.delivery.findFirst({ where: { id: req.params.id, tenantId: req.tenant!.id, rider: { userId: req.user!.id } }, include: { order: true } });
    if (!delivery) return res.status(404).json({ success: false, error: { message: 'Assignment not found' } });
    const status = req.body.status;
    if (!deliveryTransitions[delivery.status]?.includes(status) || ['CANCELLED', 'DELIVERED'].includes(delivery.order.status)) throw new Error('Invalid delivery transition');
    const orderStatus = status === 'ACCEPTED' ? 'RIDER_ASSIGNED' : status;
    const timestamp = status === 'ACCEPTED' ? { acceptedAt: new Date() } : status === 'PICKED_UP' ? { pickedUpAt: new Date() } : status === 'DELIVERED' ? { deliveredAt: new Date() } : {};
    const order = await prisma.$transaction(async tx => {
      const changed = await tx.delivery.updateMany({ where: { id: delivery.id, status: delivery.status }, data: { status, ...timestamp } });
      if (!changed.count) throw new Error('Delivery changed; refresh and retry');
      const updated = await tx.order.updateMany({ where: { id: delivery.orderId, status: delivery.order.status }, data: { status: orderStatus } });
      if (!updated.count) throw new Error('Order changed; refresh and retry');
      if (orderStatus !== delivery.order.status) await tx.orderStatusHistory.create({ data: { orderId: delivery.orderId, oldStatus: delivery.order.status, newStatus: orderStatus, changedBy: req.user!.id } });
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, action: 'STATUS', entity: 'Delivery', entityId: delivery.id, oldValue: delivery.status, newValue: status } });
      return tx.order.findUniqueOrThrow({ where: { id: delivery.orderId }, include: orderInclude });
    });
    emitOrder('order:status_updated', order);
    getIO().to(`rider:${delivery.riderId}`).emit('delivery:status_updated', order.delivery);
    res.json({ success: true, data: order.delivery });
  } catch (err: any) { res.status(409).json({ success: false, error: { message: err.message } }); }
});
router.post('/:id/location', requireRole(['RIDER']), async (req, res) => {
  try {
    if (req.tenant!.settings?.riderTrackingEnabled === false) throw new Error('Tracking is disabled');
    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Invalid coordinates');
    const delivery = await prisma.delivery.findFirst({ where: { id: req.params.id, tenantId: req.tenant!.id, rider: { userId: req.user!.id }, status: { in: ['PICKED_UP', 'ON_THE_WAY'] }, order: { status: { in: ['PICKED_UP', 'ON_THE_WAY'] } } } });
    if (!delivery?.riderId) return res.status(404).json({ success: false, error: { message: 'Active assignment not found' } });
    const location = await prisma.riderLocation.create({ data: { riderId: delivery.riderId, latitude, longitude } });
    getIO().to(`order:${delivery.orderId}`).emit('delivery:location_updated', { orderId: delivery.orderId, deliveryId: delivery.id, latitude, longitude, timestamp: location.timestamp });
    res.json({ success: true, data: location });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
});
export default router;
