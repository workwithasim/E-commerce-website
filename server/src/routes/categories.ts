import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';

const router = Router();

// ── GET /api/v1/categories (Tenant-Aware List) ───────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const categories = await prisma.category.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: { products: { where: { isAvailable: true } } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_CATEGORIES_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/categories (Tenant Admin Create) ────────────────────
router.post('/', authenticateJWT, requireTenantIsolation, requireRole([UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { name, image, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Category name is required' },
      });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const category = await prisma.category.create({
      data: {
        tenantId,
        name,
        slug,
        image: image || null,
        description: description || null,
      },
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_CATEGORY_FAILED', message: err.message },
    });
  }
});

// ── PUT /api/v1/categories/:id ──────────────────────────────────────
router.put('/:id', authenticateJWT, requireTenantIsolation, requireRole([UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;
    const { name, image, description, isActive } = req.body;

    const existing = await prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found in your restaurant' },
      });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }),
        ...(image !== undefined && { image }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_CATEGORY_FAILED', message: err.message },
    });
  }
});

// ── DELETE /api/v1/categories/:id ───────────────────────────────────
router.delete('/:id', authenticateJWT, requireTenantIsolation, requireRole([UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;

    const existing = await prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' },
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'Category deleted successfully' },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_CATEGORY_FAILED', message: err.message },
    });
  }
});

export default router;
