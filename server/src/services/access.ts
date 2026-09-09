import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../prisma';

export type Actor = { id: string; role: UserRole; roles?: UserRole[]; branchIds?: string[]; tenantId: string | null };
export const staffRoles: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'DISPATCHER', 'SUPPORT_STAFF'];
export const adminRoles: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'];
export const publicUser = { id: true, name: true, phone: true } as const;
export const orderInclude = {
  items: true, branch: true,
  delivery: { include: { rider: { include: { user: { select: publicUser } } } } },
  statusHistory: { orderBy: { timestamp: 'asc' as const } },
};

export async function orderScope(user: Actor, tenantId: string): Promise<Prisma.OrderWhereInput> {
  const roles = user.roles || [user.role];
  if (!roles.includes('SUPER_ADMIN') && user.tenantId !== tenantId) return { id: { in: [] } };
  if (roles.includes('SUPER_ADMIN') || roles.includes('TENANT_ADMIN')) return { tenantId };
  if (roles.some(role => staffRoles.includes(role))) {
    if (user.branchIds) return { tenantId, branchId: { in: user.branchIds } };
    const staff = await prisma.branchStaff.findMany({ where: { userId: user.id, branch: { tenantId } }, select: { branchId: true } });
    return { tenantId, branchId: { in: staff.map(s => s.branchId) } };
  }
  if (roles.includes('RIDER')) return { tenantId, delivery: { rider: { userId: user.id } } };
  if (roles.includes('CUSTOMER')) return { tenantId, customerId: user.id };
  return { id: { in: [] } };
}

export const orderTransitions: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'PREPARING', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
};
export function canTransitionOrder(oldStatus: string, status: string, mode: string, role: UserRole | UserRole[]) {
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.some(value => staffRoles.includes(value) && value !== 'DISPATCHER' && value !== 'SUPPORT_STAFF') || !orderTransitions[oldStatus]?.includes(status)) return false;
  if (status === 'DELIVERED' && mode === 'DELIVERY') return false;
  if (status === 'CANCELLED' && !roles.some(value => adminRoles.includes(value) && value !== 'DISPATCHER')) return false;
  return true;
}

export const deliveryTransitions: Record<string, string[]> = {
  ASSIGNED: ['ACCEPTED'], ACCEPTED: ['PICKED_UP'], PICKED_UP: ['ON_THE_WAY'], ON_THE_WAY: ['DELIVERED'],
};
