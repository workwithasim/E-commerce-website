import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../prisma';
import { orderScope } from '../services/access';
import { requirePermission, resolveAuthorization, ROLE_PERMISSIONS } from '../services/permissions';

before(() => {
  (prisma.roleAssignment.findMany as any) = async ({ where }: any) => {
    if (where.userId === 'multi-role') return [
      { role: 'SUPPORT_STAFF', branchId: 'branch-1', branch: { tenantId: 'tenant-1' } },
      { role: 'KITCHEN_STAFF', branchId: 'branch-2', branch: { tenantId: 'tenant-1' } },
      { role: 'TENANT_ADMIN', branchId: 'foreign', branch: { tenantId: 'tenant-2' } },
    ];
    if (where.userId === 'promoted') return [
      { role: 'TENANT_ADMIN', branchId: null, branch: null },
    ];
    return [];
  };
  (prisma.branchStaff.findMany as any) = async () => [];
});

after(() => prisma.$disconnect());

test('multiple active roles combine permissions but reject cross-tenant branch assignments', async () => {
  const context = await resolveAuthorization({ id: 'multi-role', tenantId: 'tenant-1', role: 'CUSTOMER' });
  assert.deepEqual(new Set(context.roles), new Set(['CUSTOMER', 'SUPPORT_STAFF', 'KITCHEN_STAFF']));
  assert.deepEqual(new Set(context.branchIds), new Set(['branch-1', 'branch-2']));
  assert.ok(context.permissions.includes('communications.respond'));
  assert.ok(context.permissions.includes('kitchen.process'));
  assert.equal(context.permissions.includes('payments.manage'), false);
});

test('a normalized tenant-admin assignment can extend a legacy customer identity', async () => {
  const context = await resolveAuthorization({ id: 'promoted', tenantId: 'tenant-1', role: 'CUSTOMER' });
  assert.ok(context.roles.includes('TENANT_ADMIN'));
  assert.ok(context.permissions.includes('staff.create'));
  assert.deepEqual(await orderScope({ id: 'promoted', tenantId: 'tenant-1', role: 'CUSTOMER', ...context }, 'tenant-1'), { tenantId: 'tenant-1' });
});

test('branch-scoped operational roles cannot query unassigned branches', async () => {
  const scope = await orderScope({
    id: 'manager', tenantId: 'tenant-1', role: 'BRANCH_MANAGER',
    roles: ['BRANCH_MANAGER'], branchIds: ['branch-1'],
  }, 'tenant-1');
  assert.deepEqual(scope, { tenantId: 'tenant-1', branchId: { in: ['branch-1'] } });
});

test('support staff communication access does not imply payment-management access', () => {
  assert.ok(ROLE_PERMISSIONS.SUPPORT_STAFF.includes('communications.respond'));
  assert.equal(ROLE_PERMISSIONS.SUPPORT_STAFF.includes('payments.manage'), false);

  const req: any = { user: { permissions: ROLE_PERMISSIONS.SUPPORT_STAFF } };
  let status = 200;
  const res: any = { status(value: number) { status = value; return this; }, json() { return this; } };
  let allowed = false;
  requirePermission('payments.manage')(req, res, () => { allowed = true; });
  assert.equal(status, 403); assert.equal(allowed, false);
  requirePermission('communications.respond')(req, res, () => { allowed = true; });
  assert.equal(allowed, true);
});
