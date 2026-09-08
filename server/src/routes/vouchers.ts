import { calculateOrderPricing } from '../services/pricing';
import { Router, Request, Response } from 'express';
import { DiscountType, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';

const router = Router();

// ── POST /api/v1/vouchers/verify (Authoritative Promo Code Calculation)
router.post('/verify', authenticateJWT, requireTenantIsolation, async (req: Request, res: Response) => {
  try {
    const { code, items, branchId, orderMode } = req.body;
    if (!code) throw new Error('Voucher code is required');
    const pricing = await calculateOrderPricing(req.tenant!.id, items, branchId, orderMode, code);
    res.json({ success: true, data: { valid: true, ...pricing.voucher, total: pricing.total, message: 'Voucher applied' } });
  } catch (err: any) { res.status(400).json({ success: false, error: { message: err.message } }); }
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
