import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

// ── GET /api/v1/analytics/stats (Tenant Specific Analytics) ─────────
router.get('/stats', authenticateJWT, requireRole([UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { branchId } = req.query;

    const where: any = { tenantId };
    if (branchId && branchId !== 'ALL') {
      where.branchId = String(branchId);
    }

    const totalOrders = await prisma.order.count({ where });
    const pendingOrders = await prisma.order.count({ where: { ...where, status: 'PENDING' } });
    const kitchenOrders = await prisma.order.count({ where: { ...where, status: 'PREPARING' } });
    const readyOrders = await prisma.order.count({ where: { ...where, status: 'READY' } });
    const onTheWayOrders = await prisma.order.count({ where: { ...where, status: 'ON_THE_WAY' } });
    const deliveredOrders = await prisma.order.count({ where: { ...where, status: 'DELIVERED' } });

    const revenueAgg = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        ...where,
        status: { not: 'CANCELLED' },
      },
    });

    const activeRiders = await prisma.rider.count({
      where: { tenantId, isAvailable: true },
    });

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        kitchenOrders,
        readyOrders,
        onTheWayOrders,
        deliveredOrders,
        activeRiders,
        totalRevenue: revenueAgg._sum.total || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_STATS_FAILED', message: err.message },
    });
  }
});

// ── GET /api/v1/analytics/superadmin (Platform-Wide Analytics) ───────
router.get('/superadmin', authenticateJWT, requireRole([UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const totalTenants = await prisma.tenant.count();
    const activeTenants = await prisma.tenant.count({ where: { status: 'ACTIVE' } });
    const totalBranches = await prisma.branch.count();
    const totalOrders = await prisma.order.count();
    const totalRevenueAgg = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: 'CANCELLED' } },
    });

    const tenants = await prisma.tenant.findMany({
      include: {
        _count: { select: { orders: true, branches: true, products: true, users: true } },
        branding: { select: { primaryColor: true, logo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        totalBranches,
        totalOrders,
        totalPlatformRevenue: totalRevenueAgg._sum.total || 0,
        tenants,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_SUPERADMIN_STATS_FAILED', message: err.message },
    });
  }
});

export default router;
