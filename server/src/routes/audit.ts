import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { requirePermission } from '../services/permissions';

const router = Router();
router.use(authenticateJWT, requireTenantIsolation, requirePermission('audit.view'));

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const where: any = { tenantId: req.tenant!.id };
    if (!req.user!.roles.some(role => ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(role))) where.branchId = { in: req.user!.branchIds };
    if (req.query.actorId) where.userId = String(req.query.actorId);
    if (req.query.role) where.actorRole = { contains: String(req.query.role), mode: 'insensitive' };
    if (req.query.branchId) {
      const branchId = String(req.query.branchId);
      if (!req.user!.roles.some(role => ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(role)) && !req.user!.branchIds.includes(branchId)) return res.status(403).json({ success: false, error: { message: 'Branch access denied' } });
      where.branchId = branchId;
    }
    if (req.query.action) where.action = { contains: String(req.query.action), mode: 'insensitive' };
    if (req.query.entity) where.entity = { equals: String(req.query.entity), mode: 'insensitive' };
    if (req.query.entityId) where.entityId = String(req.query.entityId);
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return res.status(400).json({ success: false, error: { message: 'Invalid audit date range' } });
    if (from || to) where.timestamp = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const [records, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, email: true } }, branch: { select: { id: true, name: true } } }, orderBy: { timestamp: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, data: { records, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error: any) { res.status(400).json({ success: false, error: { message: error.message } }); }
});

export default router;
