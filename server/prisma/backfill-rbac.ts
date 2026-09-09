import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureAssignment(userId: string, tenantId: string, role: UserRole, branchId: string | null) {
  const existing = await prisma.roleAssignment.findFirst({ where: { userId, tenantId, role, branchId } });
  if (!existing) await prisma.roleAssignment.create({ data: { userId, tenantId, role, branchId } });
}

async function main() {
  const users = await prisma.user.findMany({
    where: { tenantId: { not: null }, role: { not: 'SUPER_ADMIN' } },
    include: { branchStaff: true },
  });

  for (const user of users) {
    const tenantId = user.tenantId!;
    if (['BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'DISPATCHER', 'SUPPORT_STAFF'].includes(user.role)) {
      for (const membership of user.branchStaff) {
        await ensureAssignment(user.id, tenantId, membership.role, membership.branchId);
      }
    } else {
      await ensureAssignment(user.id, tenantId, user.role, null);
    }
  }

  console.log(`RBAC backfill checked ${users.length} tenant users.`);
}

main().catch(error => {
  console.error('RBAC backfill failed:', error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
