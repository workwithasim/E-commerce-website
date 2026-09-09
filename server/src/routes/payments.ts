import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { orderScope } from '../services/access';
import { requirePermission } from '../services/permissions';
import { getIO } from '../socket';

const router = Router();
router.use(authenticateJWT, requireTenantIsolation);

const codInclude = {
  order: { select: { id: true, orderNumber: true, branchId: true, customerName: true, total: true, paymentStatus: true, status: true } },
  collectedBy: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
} as const;

router.get('/cod', requirePermission('payments.view'), async (req, res) => {
  try {
    const scope = await orderScope(req.user!, req.tenant!.id);
    const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : undefined;
    const records = await prisma.codRecord.findMany({
      where: { tenantId: req.tenant!.id, order: scope, ...(status ? { status: status as any } : {}) },
      include: codInclude, orderBy: { updatedAt: 'desc' }, take: 200,
    });
    res.json({ success: true, data: records });
  } catch (error: any) { res.status(400).json({ success: false, error: { message: error.message } }); }
});

router.post('/cod/:orderId/collect', async (req, res) => {
  try {
    const isRider = req.user!.roles.includes('RIDER');
    const canManagePayments = req.user!.permissions.includes('payments.manage');
    if (!isRider && !canManagePayments) return res.status(403).json({ success: false, error: { message: 'COD collection permission required' } });
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, error: { message: 'A valid collected amount is required' } });
    let record;
    if (isRider) {
      record = await prisma.codRecord.findFirst({ where: {
        tenantId: req.tenant!.id, orderId: req.params.orderId,
        order: { paymentMethod: 'COD', status: { in: ['ON_THE_WAY', 'DELIVERED'] }, delivery: { rider: { userId: req.user!.id }, status: { in: ['ON_THE_WAY', 'DELIVERED'] } } },
      }, include: { order: { select: { branchId: true } } } });
    } else {
      const scope = await orderScope(req.user!, req.tenant!.id);
      const order = await prisma.order.findFirst({ where: { AND: [scope, { id: req.params.orderId, paymentMethod: 'COD', status: { in: ['READY', 'DELIVERED'] } }] }, select: { id: true } });
      if (order) record = await prisma.codRecord.findUnique({ where: { orderId: order.id }, include: { order: { select: { branchId: true } } } });
    }
    if (!record) return res.status(404).json({ success: false, error: { message: isRider ? 'Active COD assignment not found' : 'Collectible COD order not found' } });
    const collectedAmount = Math.round(amount * 100) / 100;
    const differenceAmount = Math.round((collectedAmount - record.expectedAmount) * 100) / 100;
    const nextStatus = differenceAmount !== 0 ? 'DISPUTED' : isRider ? 'COLLECTED_BY_RIDER' : 'SETTLED';
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.codRecord.updateMany({
        where: { id: record.id, status: 'PENDING_COLLECTION', collectedAt: null },
        data: {
          status: nextStatus, collectedAmount, differenceAmount, collectedById: req.user!.id, collectedAt: new Date(),
          disputeReason: differenceAmount === 0 ? null : 'Collected amount differs from expected amount',
          ...(!isRider && differenceAmount === 0 ? { receivedAmount: collectedAmount, receivedById: req.user!.id, settledAt: new Date() } : {}),
        },
      });
      if (!changed.count) throw new Error('COD collection was already recorded');
      if (differenceAmount === 0) await tx.order.update({ where: { id: record.orderId }, data: { paymentStatus: 'PAID' } });
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, actorRole: req.user!.roles.join(','), branchId: record.order.branchId, action: 'COD_COLLECTED', entity: 'CodRecord', entityId: record.id, oldValue: 'PENDING_COLLECTION', newValue: JSON.stringify({ status: nextStatus, collectedAmount, differenceAmount }) } });
      return tx.codRecord.findUniqueOrThrow({ where: { id: record.id }, include: codInclude });
    });
    getIO().to(`order:${record.orderId}`).emit('payment:updated', updated);
    res.json({ success: true, data: updated });
  } catch (error: any) { res.status(409).json({ success: false, error: { message: error.message } }); }
});

router.patch('/cod/:orderId/settlement', requirePermission('payments.manage'), async (req, res) => {
  try {
    const scope = await orderScope(req.user!, req.tenant!.id);
    const record = await prisma.codRecord.findFirst({ where: { tenantId: req.tenant!.id, orderId: req.params.orderId, order: scope }, include: { order: { select: { branchId: true } } } });
    if (!record) return res.status(404).json({ success: false, error: { message: 'COD record not found' } });
    const status = req.body.status;
    if (!['PENDING_SETTLEMENT', 'SETTLED', 'DISPUTED'].includes(status)) return res.status(400).json({ success: false, error: { message: 'Invalid COD settlement status' } });
    if (record.status === 'PENDING_COLLECTION') return res.status(409).json({ success: false, error: { message: 'Cash must be collected before settlement' } });
    const disputeReason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (status === 'DISPUTED' && !disputeReason) return res.status(400).json({ success: false, error: { message: 'A dispute reason is required' } });
    const receivedAmount = req.body.receivedAmount === undefined ? record.collectedAmount : Number(req.body.receivedAmount);
    if (receivedAmount == null || !Number.isFinite(receivedAmount) || receivedAmount < 0) return res.status(400).json({ success: false, error: { message: 'A valid received amount is required' } });
    const roundedReceived = Math.round(receivedAmount * 100) / 100;
    const differenceAmount = Math.round((roundedReceived - record.expectedAmount) * 100) / 100;
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.codRecord.updateMany({ where: { id: record.id, status: record.status }, data: {
        status, receivedAmount: roundedReceived, receivedById: req.user!.id,
        differenceAmount, disputeReason: status === 'DISPUTED' ? disputeReason : null,
        settledAt: status === 'SETTLED' ? new Date() : null,
      } });
      if (!changed.count) throw new Error('COD record changed; refresh and retry');
      if (status === 'SETTLED') await tx.order.update({ where: { id: record.orderId }, data: { paymentStatus: 'PAID' } });
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, actorRole: req.user!.roles.join(','), branchId: record.order.branchId, action: 'COD_SETTLEMENT_CHANGED', entity: 'CodRecord', entityId: record.id, oldValue: record.status, newValue: JSON.stringify({ status, receivedAmount: roundedReceived, differenceAmount, reason: disputeReason || undefined }) } });
      return tx.codRecord.findUniqueOrThrow({ where: { id: record.id }, include: codInclude });
    });
    getIO().to(`order:${record.orderId}`).emit('payment:updated', updated);
    res.json({ success: true, data: updated });
  } catch (error: any) { res.status(409).json({ success: false, error: { message: error.message } }); }
});

export default router;
