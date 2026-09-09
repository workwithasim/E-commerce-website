import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { getIO } from '../socket';
import { hasBranchAccess, requirePermission } from '../services/permissions';

const router = Router();

// ── GET /api/v1/branches (Tenant Branches) ───────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { city } = req.query;

    const where: any = { tenantId };
    if (city) {
      where.city = { equals: String(city), mode: 'insensitive' };
    }

    const branches = await prisma.branch.findMany({
      where,
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });

    res.json({
      success: true,
      data: branches,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_BRANCHES_FAILED', message: err.message },
    });
  }
});

// ── PATCH /api/v1/branches/:id/toggle (Toggle Open/Closed) ───────────
router.patch('/:id/toggle', authenticateJWT, requireTenantIsolation, requirePermission('branches.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found' },
      });
    }

    if (!hasBranchAccess(req.user!, id)) return res.status(403).json({ success: false, error: { message: 'Branch access denied' } });
    const updated = await prisma.branch.update({
      where: { id },
      data: { isOpen: !branch.isOpen },
    });

    try {
      getIO().to(`branch:${id}`).emit('branch:status_updated', updated);
      getIO().to(`catalog:${tenantId}`).emit('branch:status_updated', updated);
    } catch (e) {
      // socket silent catch
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'TOGGLE_BRANCH_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/branches (Admin Add Branch) ─────────────────────────
router.post('/', authenticateJWT, requireTenantIsolation, requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { name, city, address, phone, openingHours, deliveryFee, minimumOrder, latitude, longitude } = req.body;

    if (!name || !city || !address) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Branch name, city, and address are required' },
      });
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId,
        name,
        city,
        address,
        phone: phone || '051-111-222-333',
        openingHours: openingHours || '11:00 AM - 03:00 AM',
        deliveryFee: deliveryFee !== undefined ? Number(deliveryFee) : 100,
        minimumOrder: minimumOrder !== undefined ? Number(minimumOrder) : 500,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        isOpen: true,
      },
    });

    res.status(201).json({
      success: true,
      data: branch,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_BRANCH_FAILED', message: err.message },
    });
  }
});

export default router;
