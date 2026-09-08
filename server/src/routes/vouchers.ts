import { Router, Request, Response } from 'express';
import { DiscountType, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';

const router = Router();

// ── POST /api/v1/vouchers/verify (Authoritative Promo Code Calculation)
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Voucher code is required' },
      });
    }

    const voucher = await prisma.voucher.findFirst({
      where: {
        tenantId,
        code: String(code).toUpperCase(),
        isActive: true,
      },
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        data: { valid: false, message: 'Invalid or expired coupon code for this restaurant' },
      });
    }

    const orderSubtotal = Number(subtotal) || 0;
    if (orderSubtotal < voucher.minimumOrder) {
      return res.status(400).json({
        success: false,
        data: {
          valid: false,
          message: `Minimum order of Rs. ${voucher.minimumOrder} required for coupon "${voucher.code}"`,
        },
      });
    }

    let discountAmount = 0;
    if (voucher.discountType === DiscountType.PERCENT) {
      discountAmount = Math.round((orderSubtotal * voucher.discountValue) / 100);
    } else if (voucher.discountType === DiscountType.FIXED) {
      discountAmount = voucher.discountValue;
    } else if (voucher.discountType === DiscountType.FREE_DELIVERY) {
      discountAmount = req.tenant?.settings?.deliveryFee || 100;
    }

    if (voucher.maximumDiscount && discountAmount > voucher.maximumDiscount) {
      discountAmount = voucher.maximumDiscount;
    }

    discountAmount = Math.min(discountAmount, orderSubtotal);

    res.json({
      success: true,
      data: {
        valid: true,
        code: voucher.code,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        discountAmount,
        message: `Promo code "${voucher.code}" applied successfully!`,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'VERIFY_VOUCHER_FAILED', message: err.message },
    });
  }
});

// ── GET /api/v1/vouchers (Admin List) ─────────────────────────────────
router.get('/', authenticateJWT, requireTenantIsolation, requireRole([UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const vouchers = await prisma.voucher.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: vouchers,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_VOUCHERS_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/vouchers (Admin Create Voucher) ──────────────────────
router.post('/', authenticateJWT, requireTenantIsolation, requireRole([UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { code, discountType, discountValue, minimumOrder, maximumDiscount } = req.body;

    if (!code || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Voucher code and discount value are required' },
      });
    }

    const cleanCode = String(code).toUpperCase().trim();
    const voucher = await prisma.voucher.create({
      data: {
        tenantId,
        code: cleanCode,
        discountType: (discountType as DiscountType) || DiscountType.PERCENT,
        discountValue: Number(discountValue),
        minimumOrder: minimumOrder !== undefined ? Number(minimumOrder) : 0,
        maximumDiscount: maximumDiscount ? Number(maximumDiscount) : null,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      data: voucher,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_VOUCHER_FAILED', message: err.message },
    });
  }
});

export default router;
