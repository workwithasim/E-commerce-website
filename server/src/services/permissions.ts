import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';

export const PERMISSIONS = [
  'orders.view', 'orders.internal_view', 'orders.manage', 'orders.cancel', 'orders.override',
  'customers.view', 'customers.manage',
  'staff.view', 'staff.create', 'staff.edit', 'staff.disable',
  'branches.view', 'branches.manage',
  'kitchen.view', 'kitchen.process', 'kitchen.manage',
  'riders.view', 'riders.manage', 'riders.assign',
  'delivery.view', 'delivery.manage',
  'payments.view', 'payments.manage', 'payments.refund',
  'communications.view', 'communications.respond',
  'reports.view', 'settings.manage', 'audit.view',
  'menu.manage', 'promotions.manage', 'platform.manage',
] as const;

export type Permission = typeof PERMISSIONS[number];

const all = [...PERMISSIONS];
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: all,
  TENANT_ADMIN: all.filter(permission => permission !== 'platform.manage'),
  BRANCH_MANAGER: [
    'orders.view', 'orders.internal_view', 'orders.manage', 'orders.cancel', 'customers.view',
    'staff.view', 'staff.create', 'staff.edit', 'branches.view', 'branches.manage',
    'kitchen.view', 'kitchen.process', 'kitchen.manage', 'riders.view', 'riders.assign',
    'delivery.view', 'delivery.manage', 'payments.view', 'communications.view',
    'communications.respond', 'reports.view',
  ],
  KITCHEN_MANAGER: ['orders.view', 'orders.manage', 'kitchen.view', 'kitchen.process', 'kitchen.manage'],
  KITCHEN_STAFF: ['orders.view', 'orders.manage', 'kitchen.view', 'kitchen.process'],
  DISPATCHER: ['orders.view', 'orders.internal_view', 'riders.view', 'riders.assign', 'delivery.view', 'delivery.manage', 'communications.view', 'communications.respond'],
  SUPPORT_STAFF: ['orders.view', 'orders.internal_view', 'customers.view', 'communications.view', 'communications.respond'],
  RIDER: ['orders.view', 'delivery.view', 'communications.view', 'communications.respond'],
  CUSTOMER: ['orders.view', 'communications.view', 'communications.respond'],
};

export type AuthorizationContext = {
  roles: UserRole[];
  permissions: Permission[];
  branchIds: string[];
};

export async function resolveAuthorization(user: { id: string; tenantId: string | null; role: UserRole }): Promise<AuthorizationContext> {
  const roles = new Set<UserRole>([user.role]);
  const branchIds = new Set<string>();

  if (user.tenantId && user.role !== 'SUPER_ADMIN') {
    // Compatibility fallback is intentional during the additive RBAC rollout.
    // Once every deployment is backfilled, a controlled migration can remove it.
    try {
      const assignments = await prisma.roleAssignment.findMany({
        where: { userId: user.id, tenantId: user.tenantId, isActive: true },
        select: { role: true, branchId: true, branch: { select: { tenantId: true } } },
      });
      for (const assignment of assignments) {
        if (assignment.branchId && assignment.branch?.tenantId !== user.tenantId) continue;
        if (ROLE_PERMISSIONS[assignment.role]) roles.add(assignment.role);
        if (assignment.branchId) branchIds.add(assignment.branchId);
      }
    } catch {
      // Allows existing installations to start before the additive table is applied.
    }

    const memberships = await prisma.branchStaff.findMany({
      where: { userId: user.id, branch: { tenantId: user.tenantId } },
      select: { role: true, branchId: true },
    });
    for (const membership of memberships) {
      if (ROLE_PERMISSIONS[membership.role]) roles.add(membership.role);
      branchIds.add(membership.branchId);
    }
  }

  const roleList = [...roles];
  const permissions = new Set<Permission>();
  for (const role of roleList) for (const permission of ROLE_PERMISSIONS[role] || []) permissions.add(permission);
  return { roles: roleList, permissions: [...permissions], branchIds: [...branchIds] };
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Access denied. Required permission: ${permission}` } });
    }
    next();
  };
}

export function hasBranchAccess(user: NonNullable<Request['user']>, branchId: string) {
  return user.roles.includes('SUPER_ADMIN') || user.roles.includes('TENANT_ADMIN') || user.branchIds.includes(branchId);
}
