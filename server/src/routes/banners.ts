import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { requirePermission } from '../services/permissions';

const router = Router();

// ── GET /api/v1/banners (Tenant Active Banners) ──────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const banners = await prisma.banner.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: banners,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_BANNERS_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/banners (Admin Add Banner) ──────────────────────────
router.post('/', authenticateJWT, requireTenantIsolation, requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { title, subtitle, desktopImage, mobileImage, buttonText, buttonUrl, sortOrder } = req.body;

    if (!title || !desktopImage) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Title and desktop image are required' },
      });
    }

    const banner = await prisma.banner.create({
      data: {
        tenantId,
        title,
        subtitle: subtitle || null,
        desktopImage,
        mobileImage: mobileImage || null,
        buttonText: buttonText || null,
        buttonUrl: buttonUrl || null,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      data: banner,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_BANNER_FAILED', message: err.message },
    });
  }
});

export default router;
