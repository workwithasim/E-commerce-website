import { Tenant, TenantBranding, TenantSettings, UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant & {
        branding?: TenantBranding | null;
        settings?: TenantSettings | null;
      };
      user?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        tenantId: string | null;
        phone?: string | null;
      };
    }
  }
}
