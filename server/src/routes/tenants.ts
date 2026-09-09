import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../services/permissions';

const router = Router();

// ── GET /api/v1/tenants (List All Active Tenants - For Storefront Switcher) ──
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      include: {
        branding: true,
        settings: true,
        _count: { select: { branches: true, products: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: tenants,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_TENANTS_FAILED', message: err.message },
    });
  }
});

// ── GET /api/v1/tenants/:slug/public (Storefront Init) ──────────────────────
router.get('/:slug/public', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        branding: true,
        settings: true,
        branches: { where: { isOpen: true } },
        banners: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        error: { code: 'TENANT_NOT_FOUND', message: `Tenant "${slug}" not found` },
      });
    }

    res.json({
      success: true,
      data: tenant,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_TENANT_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/tenants (Super Admin Onboarding Wizard) ────────────────────
router.post('/', authenticateJWT, requirePermission('platform.manage'), async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      primaryColor,
      secondaryColor,
      logo,
      currency,
      branchName,
      branchCity,
      branchAddress,
      branchPhone,
      adminName,
      adminEmail,
      adminPassword,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Tenant name and slug are required' },
      });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existing = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'SLUG_EXISTS', message: 'A restaurant with this slug already exists' },
      });
    }

    // Create tenant transactionally with branding, settings, initial branch, and admin
    const newTenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug: cleanSlug,
          currency: currency || 'PKR',
          branding: {
            create: {
              primaryColor: primaryColor || '#D80032',
              secondaryColor: secondaryColor || '#FFE600',
              logo: logo || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
            },
          },
          settings: {
            create: {
              currency: currency || 'PKR',
              currencySymbol: ({ USD: '$', PKR: 'Rs.', AED: 'AED' } as Record<string, string>)[currency || 'PKR'] || currency,
              minimumOrder: 500,
              deliveryFee: 100,
              freeDeliveryThreshold: 2000,
            },
          },
        },
        include: { branding: true, settings: true },
      });

      // Initial branch
      if (branchName && branchCity) {
        await tx.branch.create({
          data: {
            tenantId: tenant.id,
            name: branchName,
            city: branchCity,
            address: branchAddress || branchName,
            phone: branchPhone || '051-111-222-333',
            isOpen: true,
          },
        });
      }

      // Initial Tenant Admin
      if (adminEmail && adminPassword) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: adminName || `${name} Admin`,
            email: adminEmail,
            password: hashedPassword,
            role: UserRole.TENANT_ADMIN,
          },
        });
        await tx.roleAssignment.create({ data: { userId: admin.id, tenantId: tenant.id, role: UserRole.TENANT_ADMIN } });
      }

      return tenant;
    });

    res.status(201).json({
      success: true,
      data: newTenant,
    });
  } catch (err: any) {
    console.error('Create tenant error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_TENANT_FAILED', message: err.message },
    });
  }
});

// ── PUT /api/v1/tenants/:id/branding (Visual Branding Editor) ──────────────
router.put('/:id/branding', authenticateJWT, requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      logo,
      logoDark,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      surfaceColor,
      textColor,
      buttonRadius,
      cardRadius,
      headingFont,
      bodyFont,
    } = req.body;

    // Verify tenant ownership for TENANT_ADMIN
    if (!req.user!.roles.includes(UserRole.SUPER_ADMIN) && req.user!.tenantId !== id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only update your own restaurant branding' },
      });
    }

    const branding = await prisma.tenantBranding.upsert({
      where: { tenantId: id },
      update: {
        ...(logo && { logo }),
        ...(logoDark !== undefined && { logoDark }),
        ...(primaryColor && { primaryColor }),
        ...(secondaryColor && { secondaryColor }),
        ...(accentColor && { accentColor }),
        ...(backgroundColor && { backgroundColor }),
        ...(surfaceColor && { surfaceColor }),
        ...(textColor && { textColor }),
        ...(buttonRadius && { buttonRadius }),
        ...(cardRadius && { cardRadius }),
        ...(headingFont && { headingFont }),
        ...(bodyFont && { bodyFont }),
      },
      create: {
        tenantId: id,
        logo: logo || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
        primaryColor: primaryColor || '#D80032',
        secondaryColor: secondaryColor || '#FFE600',
      },
    });

    res.json({
      success: true,
      data: branding,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_BRANDING_FAILED', message: err.message },
    });
  }
});

// ── PUT /api/v1/tenants/:id/settings (Business Settings & Flags) ────────────
router.put('/:id/settings', authenticateJWT, requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user!.roles.includes(UserRole.SUPER_ADMIN) && req.user!.tenantId !== id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only update your own restaurant settings' },
      });
    }

    const allowed = ['currency', 'currencySymbol', 'country', 'timezone', 'minimumOrder', 'deliveryFee', 'freeDeliveryThreshold', 'taxEnabled', 'taxRate', 'takeawayEnabled', 'deliveryEnabled', 'cashOnDeliveryEnabled', 'customerRegistrationEnabled', 'reviewsEnabled', 'riderTrackingEnabled', 'phone', 'hotline', 'whatsapp', 'email', 'website', 'supportEmail', 'socialFacebook', 'socialInstagram', 'socialYoutube', 'socialTiktok', 'socialX'];
    const values = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    for (const key of ['minimumOrder', 'deliveryFee', 'freeDeliveryThreshold', 'taxRate']) {
      if (key in values && (typeof values[key] !== 'number' || !Number.isFinite(values[key]) || (values[key] as number) < 0)) return res.status(400).json({ success: false, error: { message: 'Invalid numeric setting' } });
    }
    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId: id },
      update: values,
      create: { tenantId: id, ...values },
    });

    res.json({
      success: true,
      data: settings,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_SETTINGS_FAILED', message: err.message },
    });
  }
});

export default router;
