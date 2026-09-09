import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { getIO } from '../socket';
import { requirePermission } from '../services/permissions';

const router = Router();

// ── GET /api/v1/products (Tenant-Aware Filtered List) ─────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { categoryId, search, inStockOnly, isDeal, isBestSeller } = req.query;

    const where: any = { tenantId };

    if (categoryId && categoryId !== 'all') {
      where.categoryId = String(categoryId);
    }
    if (inStockOnly === 'true') {
      where.isAvailable = true;
    }
    if (isDeal === 'true') {
      where.isDeal = true;
    }
    if (isBestSeller === 'true') {
      where.isBestSeller = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        optionGroups: {
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: products,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_PRODUCTS_FAILED', message: err.message },
    });
  }
});

// ── GET /api/v1/products/:id (Product Detail with Customizer Options) ─
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;

    const product = await prisma.product.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { slug: id }],
      },
      include: {
        category: true,
        optionGroups: {
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found in this restaurant catalog' },
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_PRODUCT_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/products (Admin Create Product) ─────────────────────
router.post('/', authenticateJWT, requireTenantIsolation, requirePermission('menu.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const {
      name,
      description,
      basePrice,
      discountedPrice,
      image,
      categoryId,
      isBestSeller,
      isDeal,
      isFeatured,
    } = req.body;

    if (!name || basePrice === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Product name and base price are required' },
      });
    }

    if (categoryId && !await prisma.category.findFirst({ where: { id: categoryId, tenantId } })) return res.status(400).json({ success: false, error: { message: 'Invalid category' } });
    if (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 0) return res.status(400).json({ success: false, error: { message: 'Invalid price' } });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const product = await prisma.product.create({
      data: {
        tenantId,
        name,
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        description: description || '',
        basePrice: Number(basePrice),
        discountedPrice: discountedPrice ? Number(discountedPrice) : null,
        image: image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
        categoryId: categoryId || null,
        isBestSeller: Boolean(isBestSeller),
        isDeal: Boolean(isDeal),
        isFeatured: Boolean(isFeatured),
        isAvailable: true,
      },
      include: { category: true, optionGroups: { include: { options: true } } },
    });

    try {
      getIO().to(`catalog:${tenantId}`).emit('product:added', product);
    } catch (e) {
      // socket silent catch
    }

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_PRODUCT_FAILED', message: err.message },
    });
  }
});

// ── PUT /api/v1/products/:id (Admin Update Product & Stock) ──────────
router.put('/:id', authenticateJWT, requireTenantIsolation, requirePermission('menu.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;
    const {
      name,
      description,
      basePrice,
      discountedPrice,
      isAvailable,
      isBestSeller,
      isDeal,
      isFeatured,
      image,
    } = req.body;

    const existing = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found in this restaurant catalog' },
      });
    }

    for (const value of [basePrice, discountedPrice]) {
      if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return res.status(400).json({ success: false, error: { message: 'Prices must be non-negative numbers' } });
    }
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(basePrice !== undefined && { basePrice: Number(basePrice) }),
        ...(discountedPrice !== undefined && { discountedPrice: discountedPrice ? Number(discountedPrice) : null }),
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
        ...(isBestSeller !== undefined && { isBestSeller: Boolean(isBestSeller) }),
        ...(isDeal !== undefined && { isDeal: Boolean(isDeal) }),
        ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured) }),
        ...(image && { image }),
      },
      include: { category: true, optionGroups: { include: { options: true } } },
    });

    try {
      getIO().to(`catalog:${tenantId}`).emit('product:updated', updated);
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
      error: { code: 'UPDATE_PRODUCT_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/products/:id/options (Add Option Group e.g. Size/Crust)
router.post('/:id/options', authenticateJWT, requireTenantIsolation, requirePermission('menu.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;
    const { name, minSelect, maxSelect, isRequired, options } = req.body;

    if (!name || !options || !Array.isArray(options)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Option group name and options array are required' },
      });
    }

    if (!await prisma.product.findFirst({ where: { id, tenantId } })) return res.status(404).json({ success: false, error: { message: 'Product not found' } });
    const min = minSelect ?? 0, max = maxSelect ?? 1;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < Math.max(min, isRequired ? 1 : 0) || max > options.length || options.some((o: any) => !o || typeof o.name !== 'string' || !o.name.trim() || !Number.isFinite(Number(o.priceModifier ?? 0)))) return res.status(400).json({ success: false, error: { message: 'Invalid option group' } });
    const group = await prisma.productOptionGroup.create({
      data: {
        tenantId,
        productId: id,
        name,
        minSelect: minSelect ?? 0,
        maxSelect: maxSelect ?? 1,
        isRequired: Boolean(isRequired),
        options: {
          create: options.map((opt: any, idx: number) => ({
            name: opt.name,
            priceModifier: Number(opt.priceModifier) || 0,
            isDefault: Boolean(opt.isDefault),
            sortOrder: idx + 1,
          })),
        },
      },
      include: { options: true },
    });

    res.status(201).json({
      success: true,
      data: group,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_OPTION_GROUP_FAILED', message: err.message },
    });
  }
});

// ── DELETE /api/v1/products/:id ─────────────────────────────────────
router.delete('/:id', authenticateJWT, requireTenantIsolation, requirePermission('menu.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;

    const existing = await prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    await prisma.product.delete({ where: { id } });

    try {
      getIO().to(`catalog:${tenantId}`).emit('product:deleted', id);
    } catch (e) {
      // socket silent catch
    }

    res.json({
      success: true,
      data: { message: 'Product deleted successfully' },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_PRODUCT_FAILED', message: err.message },
    });
  }
});

export default router;
