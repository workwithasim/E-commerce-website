import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../prisma';

export type Actor = { id: string; role: UserRole; tenantId: string | null };
export const staffRoles: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF'];
export const adminRoles: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'];
export const publicUser = { id: true, name: true, phone: true } as const;
export const orderInclude = {
  items: true, branch: true,
  delivery: { include: { rider: { include: { user: { select: publicUser } } } } },
  statusHistory: { orderBy: { timestamp: 'asc' as const } },
};

export async function orderScope(user: Actor, tenantId: string): Promise<Prisma.OrderWhereInput> {
  if (user.role !== 'SUPER_ADMIN' && user.tenantId !== tenantId) return { id: { in: [] } };
  if (user.role === 'CUSTOMER') return { tenantId, customerId: user.id };
  if (user.role === 'RIDER') return { tenantId, delivery: { rider: { userId: user.id } } };
  if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') return { tenantId };
  const staff = await prisma.branchStaff.findMany({ where: { userId: user.id, branch: { tenantId } }, select: { branchId: true } });
  return { tenantId, branchId: { in: staff.map(s => s.branchId) } };
}

export const orderTransitions: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'PREPARING', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
};
export function canTransitionOrder(oldStatus: string, status: string, mode: string, role: UserRole) {
  if (!staffRoles.includes(role) || !orderTransitions[oldStatus]?.includes(status)) return false;
  if (status === 'DELIVERED' && mode === 'DELIVERY') return false;
  if (status === 'CANCELLED' && !adminRoles.includes(role)) return false;
  return true;
}

export const deliveryTransitions: Record<string, string[]> = {
  ASSIGNED: ['ACCEPTED'], ACCEPTED: ['PICKED_UP'], PICKED_UP: ['ON_THE_WAY'], ON_THE_WAY: ['DELIVERED'],
};
