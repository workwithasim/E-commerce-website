import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../prisma';
import { calculateOrderPricing } from '../services/pricing';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { orderScope, orderInclude, staffRoles, canTransitionOrder } from '../services/access';
import { emitOrder } from '../services/events';
import { requirePermission } from '../services/permissions';

const router = Router();
router.use(authenticateJWT, requireTenantIsolation);

router.post('/quote', async (req, res) => {
  try {
    const { items, branchId, orderMode, voucherCode } = req.body;
    res.json({ success: true, data: await calculateOrderPricing(req.tenant!.id, items, branchId, orderMode, voucherCode) });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
});

router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const { customerName, customerPhone, deliveryAddress, landmark, notes, items, branchId, voucherCode } = req.body;
    const orderMode = req.body.orderMode || 'DELIVERY';
    const paymentMethod = req.body.paymentMethod || 'COD';
    if (typeof customerName !== 'string' || !customerName.trim() || typeof customerPhone !== 'string' || !customerPhone.trim()) throw new Error('Name and phone are required');
    if (orderMode === 'DELIVERY' && (typeof deliveryAddress !== 'string' || !deliveryAddress.trim())) throw new Error('Delivery address is required');
    // Only advertise and accept a payment method that this application can process.
    if (paymentMethod !== 'COD' || req.tenant!.settings?.cashOnDeliveryEnabled === false) throw new Error('Cash on delivery is currently unavailable');
    const order = await prisma.$transaction(async tx => {
      const pricing = await calculateOrderPricing(tenantId, items, branchId, orderMode, voucherCode, tx);
      const created = await tx.order.create({
        data: {
          tenantId, orderNumber: `ORD-${randomUUID()}`, customerId: req.user!.id,
          branchId, orderMode, paymentMethod, status: 'PENDING', paymentStatus: 'PENDING',
          customerName: customerName.trim(), customerPhone: customerPhone.trim(),
          deliveryAddress: orderMode === 'DELIVERY' ? deliveryAddress.trim() : null,
          landmark, notes, subtotal: pricing.subtotal, discount: pricing.discount,
          tax: pricing.tax, deliveryFee: pricing.deliveryFee, total: pricing.total,
          items: { create: pricing.items },
          statusHistory: { create: { newStatus: 'PENDING', changedBy: req.user!.id } },
          ...(orderMode === 'DELIVERY' ? { delivery: { create: { tenantId, branchId, deliveryAddress } } } : {}),
        }, include: orderInclude,
      });
      await tx.auditLog.create({ data: { tenantId, userId: req.user!.id, action: 'CREATE', entity: 'Order', entityId: created.id } });
      return created;
    });
    emitOrder('order:new', order);
    res.status(201).json({ success: true, data: order });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
});

router.get('/', async (req, res) => {
  try {
    const scope = await orderScope(req.user!, req.tenant!.id);
    const filters: any = {};
    if (req.query.status && req.query.status !== 'ALL') filters.status = String(req.query.status);
    if (req.query.branchId && req.query.branchId !== 'ALL') filters.branchId = String(req.query.branchId);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const orders = await prisma.order.findMany({ where: { AND: [scope, filters] }, include: orderInclude, orderBy: { createdAt: 'desc' }, take: Math.floor(limit) });
    res.json({ success: true, data: orders });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
});

router.get('/admin/:id', requirePermission('orders.internal_view'), async (req, res) => {
  try {
    const scope = await orderScope(req.user!, req.tenant!.id);
    const id = req.params.id;
    const order = await prisma.order.findFirst({
      where: { AND: [scope, { OR: [{ id }, { orderNumber: id }] }] },
      include: {
        items: true, branch: true,
        customer: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        delivery: { include: { rider: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } } } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
      },
    });
    if (!order) return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    const auditEntityIds = [order.id, ...(order.delivery ? [order.delivery.id] : [])];
    const audits = await prisma.auditLog.findMany({ where: { tenantId: req.tenant!.id, entityId: { in: auditEntityIds } }, orderBy: { timestamp: 'asc' } });
    const actorIds = [...new Set([...order.statusHistory.map(event => event.changedBy), ...audits.map(event => event.userId)].filter((value): value is string => Boolean(value)))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds }, tenantId: req.tenant!.id }, select: { id: true, name: true, role: true } }) : [];
    const actorMap = new Map(actors.map(actor => [actor.id, actor]));
    const history = order.statusHistory.map(event => ({
      id: event.id, type: 'ORDER_STATUS', action: event.newStatus, previous: event.oldStatus,
      timestamp: event.timestamp, actor: event.changedBy ? actorMap.get(event.changedBy) || { id: event.changedBy, name: 'Historical user', role: null } : null,
      metadata: event.metadata,
    }));
    const auditTimeline = audits.filter(event => event.entity !== 'Order' || event.action !== 'STATUS').map(event => ({
      id: event.id, type: 'AUDIT', action: event.action, entity: event.entity, previous: event.oldValue, next: event.newValue,
      timestamp: event.timestamp, actor: event.userId ? actorMap.get(event.userId) || { id: event.userId, name: 'Historical user', role: null } : null,
    }));
    const timeline = [...history, ...auditTimeline].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const previousOrderCount = order.customerId ? await prisma.order.count({ where: { tenantId: req.tenant!.id, customerId: order.customerId, createdAt: { lt: order.createdAt } } }) : 0;
    const statusEvent = (status: string) => history.find(event => event.action === status);
    const paidAmount = order.paymentStatus === 'PAID' ? order.total : 0;
    res.json({ success: true, data: {
      ...order, previousOrderCount,
      financial: { subtotal: order.subtotal, discount: order.discount, tax: order.tax, deliveryFee: order.deliveryFee, total: order.total, currency: req.tenant!.currency, paidAmount, outstandingAmount: Math.max(0, order.total - paidAmount), refundAmount: order.paymentStatus === 'REFUNDED' ? order.total : 0 },
      kitchen: { receivedAt: order.createdAt, confirmed: statusEvent('CONFIRMED') || null, preparationStarted: statusEvent('PREPARING') || null, ready: statusEvent('READY') || null, preparationDurationMs: statusEvent('PREPARING') && statusEvent('READY') ? new Date(statusEvent('READY')!.timestamp).getTime() - new Date(statusEvent('PREPARING')!.timestamp).getTime() : null },
      deliveryDetail: order.delivery ? { rider: order.delivery.rider, assignedAt: order.delivery.assignedAt, acceptedAt: order.delivery.acceptedAt, pickedUpAt: order.delivery.pickedUpAt, deliveredAt: order.delivery.deliveredAt, status: order.delivery.status } : null,
      timeline,
    } });
  } catch (error: any) { res.status(400).json({ success: false, error: { message: error.message } }); }
});

router.get('/:id', async (req, res) => {
  try {
    const scope = await orderScope(req.user!, req.tenant!.id);
    const id = req.params.id;
    const order = await prisma.order.findFirst({ where: { AND: [scope, { OR: [{ id }, { orderNumber: id }] }] }, include: orderInclude });
    if (!order) return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    res.json({ success: true, data: order });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
});

router.patch('/:id/status', requirePermission('orders.manage'), async (req, res) => {
  try {
    const scope = await orderScope(req.user!, req.tenant!.id);
    const current = await prisma.order.findFirst({ where: { AND: [scope, { id: req.params.id }] } });
    if (!current) return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    const { status } = req.body;
    if (!canTransitionOrder(current.status, status, current.orderMode, req.user!.roles)) return res.status(409).json({ success: false, error: { message: 'This order transition is not allowed' } });
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.order.updateMany({ where: { id: current.id, status: current.status }, data: { status } });
      if (!changed.count) throw new Error('Order changed; refresh and retry');
      if (status === 'CANCELLED') await tx.delivery.updateMany({ where: { orderId: current.id }, data: { status: 'CANCELLED' } });
      await tx.orderStatusHistory.create({ data: { orderId: current.id, oldStatus: current.status, newStatus: status, changedBy: req.user!.id } });
      await tx.auditLog.create({ data: { tenantId: current.tenantId, userId: req.user!.id, action: 'STATUS', entity: 'Order', entityId: current.id, oldValue: current.status, newValue: status } });
      return tx.order.findUniqueOrThrow({ where: { id: current.id }, include: orderInclude });
    });
    emitOrder('order:status_updated', updated);
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(409).json({ success: false, error: { message: err.message } }); }
});
export default router;
