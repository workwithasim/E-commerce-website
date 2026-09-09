import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { adminRoles, orderScope, orderInclude, publicUser, deliveryTransitions } from '../services/access';
import { emitOrder } from '../services/events';
import { getIO } from '../socket';
import { requirePermission } from '../services/permissions';
const router = Router();
router.use(authenticateJWT, requireTenantIsolation);

router.get('/riders', requirePermission('riders.view'), async (req, res) => {
  try {
    const where: any = { tenantId: req.tenant!.id };
    if (!req.user!.roles.some(role => ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(role))) {
      where.branchId = { in: req.user!.branchIds };
    }
    const riders = await prisma.rider.findMany({ where, include: { user: { select: publicUser }, branch: true } });
    res.json({ success: true, data: riders });
  } catch { res.status(500).json({ success: false, error: { message: 'Unable to load riders' } }); }
});
router.patch('/riders/availability', requirePermission('delivery.view'), async (req, res) => {
  try {
    if (!req.user!.roles.includes('RIDER')) return res.status(403).json({ success: false, error: { message: 'Rider account required' } });
    if (typeof req.body.isAvailable !== 'boolean') throw new Error('Availability must be true or false');
    const rider = await prisma.rider.update({ where: { userId: req.user!.id }, data: { isAvailable: req.body.isAvailable, status: req.body.isAvailable ? 'AVAILABLE' : 'OFFLINE', lastActiveAt: new Date() } });
    res.json({ success: true, data: rider });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
});
router.get('/riders/:id', requirePermission('riders.view'), async (req, res) => {
  try {
    const rider = await prisma.rider.findFirst({
      where: { id: req.params.id, tenantId: req.tenant!.id, ...(!req.user!.roles.some(role => ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(role)) ? { branchId: { in: req.user!.branchIds } } : {}) },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, employeeId: true, isActive: true, createdAt: true, lastLoginAt: true } },
        branch: true,
        deliveries: { include: { order: { select: { id: true, orderNumber: true, total: true, paymentMethod: true, status: true, createdAt: true } } }, orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!rider) return res.status(404).json({ success: false, error: { message: 'Rider not found' } });
    const activity = await prisma.auditLog.findMany({ where: { tenantId: req.tenant!.id, userId: rider.userId }, orderBy: { timestamp: 'desc' }, take: 25 });
    res.json({ success: true, data: { ...rider, activity } });
  } catch (error: any) { res.status(400).json({ success: false, error: { message: error.message } }); }
});
router.patch('/riders/:id', requirePermission('riders.manage'), async (req, res) => {
  try {
    const rider = await prisma.rider.findFirst({ where: { id: req.params.id, tenantId: req.tenant!.id } });
    if (!rider) return res.status(404).json({ success: false, error: { message: 'Rider not found' } });
    const branchId = req.body.branchId === null ? null : req.body.branchId ?? rider.branchId;
    if (branchId && !await prisma.branch.findFirst({ where: { id: branchId, tenantId: req.tenant!.id } })) throw new Error('Invalid branch');
    const previous = { branchId: rider.branchId, vehicleType: rider.vehicleType, vehicleNumber: rider.vehicleNumber, deliveryZone: rider.deliveryZone };
    const updated = await prisma.$transaction(async tx => {
      const value = await tx.rider.update({ where: { id: rider.id }, data: {
        branchId,
        ...(typeof req.body.vehicleType === 'string' && req.body.vehicleType.trim() ? { vehicleType: req.body.vehicleType.trim() } : {}),
        ...(req.body.vehicleNumber !== undefined ? { vehicleNumber: req.body.vehicleNumber || null } : {}),
        ...(req.body.deliveryZone !== undefined ? { deliveryZone: req.body.deliveryZone || null } : {}),
      }, include: { user: { select: publicUser }, branch: true } });
      await tx.roleAssignment.updateMany({ where: { userId: rider.userId, tenantId: req.tenant!.id, role: 'RIDER' }, data: { branchId } });
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, actorRole: req.user!.roles.join(','), branchId, action: 'RIDER_PROFILE_CHANGED', entity: 'Rider', entityId: rider.id, oldValue: JSON.stringify(previous), newValue: JSON.stringify({ branchId, vehicleType: value.vehicleType, vehicleNumber: value.vehicleNumber, deliveryZone: value.deliveryZone }) } });
      return value;
    });
    res.json({ success: true, data: updated });
  } catch (error: any) { res.status(400).json({ success: false, error: { message: error.message } }); }
});
router.post('/assign', requirePermission('riders.assign'), async (req, res) => {
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
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, actorRole: req.user!.roles.join(','), branchId: order.branchId, action: 'ASSIGN', entity: 'Order', entityId: orderId, newValue: riderId } });
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    });
    emitOrder('order:status_updated', result);
    getIO().to(`rider:${riderId}`).emit('delivery:assigned', result.delivery);
    res.json({ success: true, data: result.delivery });
  } catch (err: any) { res.status(409).json({ success: false, error: { message: err.message } }); }
});
router.get('/assigned', requirePermission('delivery.view'), async (req, res) => {
  try {
    if (!req.user!.roles.includes('RIDER')) return res.status(403).json({ success: false, error: { message: 'Rider account required' } });
    const deliveries = await prisma.delivery.findMany({ where: { tenantId: req.tenant!.id, rider: { userId: req.user!.id } }, include: { order: { include: { ...orderInclude, codRecord: { select: { id: true, status: true, expectedAmount: true, collectedAmount: true, collectedAt: true } } } } }, orderBy: { assignedAt: 'desc' }, take: 100 });
    res.json({ success: true, data: deliveries });
  } catch { res.status(500).json({ success: false, error: { message: 'Unable to load assignments' } }); }
});
router.patch('/:id/status', requirePermission('delivery.view'), async (req, res) => {
  try {
    if (!req.user!.roles.includes('RIDER')) return res.status(403).json({ success: false, error: { message: 'Rider account required' } });
    const delivery = await prisma.delivery.findFirst({ where: { id: req.params.id, tenantId: req.tenant!.id, rider: { userId: req.user!.id } }, include: { order: true } });
    if (!delivery) return res.status(404).json({ success: false, error: { message: 'Assignment not found' } });
    const status = req.body.status;
    if (!deliveryTransitions[delivery.status]?.includes(status) || ['CANCELLED', 'DELIVERED'].includes(delivery.order.status)) throw new Error('Invalid delivery transition');
    if (status === 'DELIVERED' && delivery.order.paymentMethod === 'COD') {
      const cod = await prisma.codRecord.findUnique({ where: { orderId: delivery.orderId }, select: { status: true } });
      if (!cod || cod.status === 'PENDING_COLLECTION') throw new Error('Record COD collection before completing delivery');
    }
    const orderStatus = status === 'ACCEPTED' ? 'RIDER_ASSIGNED' : status;
    const timestamp = status === 'ACCEPTED' ? { acceptedAt: new Date() } : status === 'PICKED_UP' ? { pickedUpAt: new Date() } : status === 'DELIVERED' ? { deliveredAt: new Date() } : {};
    const order = await prisma.$transaction(async tx => {
      const changed = await tx.delivery.updateMany({ where: { id: delivery.id, status: delivery.status }, data: { status, ...timestamp } });
      if (!changed.count) throw new Error('Delivery changed; refresh and retry');
      const updated = await tx.order.updateMany({ where: { id: delivery.orderId, status: delivery.order.status }, data: { status: orderStatus } });
      if (!updated.count) throw new Error('Order changed; refresh and retry');
      if (orderStatus !== delivery.order.status) await tx.orderStatusHistory.create({ data: { orderId: delivery.orderId, oldStatus: delivery.order.status, newStatus: orderStatus, changedBy: req.user!.id } });
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, actorRole: req.user!.roles.join(','), branchId: delivery.branchId, action: 'STATUS', entity: 'Delivery', entityId: delivery.id, oldValue: delivery.status, newValue: status } });
      return tx.order.findUniqueOrThrow({ where: { id: delivery.orderId }, include: orderInclude });
    });
    emitOrder('order:status_updated', order);
    getIO().to(`rider:${delivery.riderId}`).emit('delivery:status_updated', order.delivery);
    res.json({ success: true, data: order.delivery });
  } catch (err: any) { res.status(409).json({ success: false, error: { message: err.message } }); }
});
router.post('/:id/location', requirePermission('delivery.view'), async (req, res) => {
  try {
    if (!req.user!.roles.includes('RIDER')) return res.status(403).json({ success: false, error: { message: 'Rider account required' } });
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
