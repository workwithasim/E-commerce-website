import { Tenant, TenantBranding, TenantSettings, UserRole } from '@prisma/client';
import { Permission } from './services/permissions';

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
        roles: UserRole[];
        permissions: Permission[];
        branchIds: string[];
      };
    }
  }
}
