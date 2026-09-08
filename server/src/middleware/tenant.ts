import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Resolve tenant identifier from headers, query, or hostname
    let slug = (req.headers['x-tenant-slug'] as string) || (req.query.tenant as string);
    let id = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);

    // 2. Subdomain check (e.g., savour.localhost or savour.yourdomain.com)
    if (!slug && !id && req.hostname) {
      const parts = req.hostname.split('.');
      if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www') {
        slug = parts[0];
      }
    }

    // 3. Fallback to default tenant (cheezious)
    if (!slug && !id) {
      slug = 'cheezious';
    }

    const tenant = await prisma.tenant.findFirst({
      where: id ? { id } : { slug: slug.toLowerCase() },
      include: {
        branding: true,
        settings: true,
      },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: `Tenant "${id || slug}" not found or inactive`,
        },
      });
    }

    req.tenant = tenant;
    next();
  } catch (err: any) {
    console.error('Tenant resolver error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Tenant resolution failed' },
    });
  }
}

// Enforce tenant isolation for authenticated requests
export function requireTenantIsolation(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  // Super admins have platform-wide access
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if (!req.tenant || req.user.tenantId !== req.tenant.id) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Tenant isolation violation: You do not have access to this restaurant data',
      },
    });
  }

  next();
}
