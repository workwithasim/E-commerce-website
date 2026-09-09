import { randomBytes } from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { requireTenantIsolation } from '../middleware/tenant';
import { hashRefreshToken } from '../services/sessions';
import { hasBranchAccess, requirePermission } from '../services/permissions';

const router = Router();
export const MANAGED_STAFF_ROLES: UserRole[] = [
  'TENANT_ADMIN', 'BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF',
  'DISPATCHER', 'SUPPORT_STAFF', 'RIDER',
];
const BRANCH_SCOPED_ROLES: UserRole[] = [
  'BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'DISPATCHER', 'SUPPORT_STAFF', 'RIDER',
];

function normalizedEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function validateBranches(tenantId: string, user: NonNullable<Express.Request['user']>, role: UserRole, input: unknown) {
  const branchIds = [...new Set(Array.isArray(input) ? input.filter((id): id is string => typeof id === 'string' && Boolean(id)) : [])];
  if (BRANCH_SCOPED_ROLES.includes(role) && branchIds.length === 0) throw new Error('At least one branch assignment is required for this role');
  if (branchIds.some(id => !hasBranchAccess(user, id))) throw new Error('One or more branches are outside your access scope');
  if (branchIds.length) {
    const count = await prisma.branch.count({ where: { tenantId, id: { in: branchIds } } });
    if (count !== branchIds.length) throw new Error('One or more branches are invalid');
  }
  return branchIds;
}

function canAssign(actor: NonNullable<Express.Request['user']>, role: UserRole) {
  if (!MANAGED_STAFF_ROLES.includes(role)) return false;
  if (actor.roles.includes('TENANT_ADMIN') || actor.roles.includes('SUPER_ADMIN')) return true;
  return role !== 'TENANT_ADMIN' && role !== 'BRANCH_MANAGER';
}

router.post('/accept-invitation', async (req, res) => {
  try {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: { message: 'A valid invitation and password of at least 8 characters are required' } });
    }
    const invitation = await prisma.staffInvitation.findFirst({
      where: { tokenHash: hashRefreshToken(token), tenantId: req.tenant!.id, status: 'PENDING' }, include: { user: true },
    });
    if (!invitation || invitation.expiresAt <= new Date()) {
      if (invitation) await prisma.staffInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      return res.status(400).json({ success: false, error: { message: 'Invitation is invalid or expired' } });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: invitation.userId }, data: { password: hashedPassword, isActive: true } });
      await tx.staffInvitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await tx.auditLog.create({ data: { tenantId: invitation.tenantId, userId: invitation.userId, actorRole: invitation.user.role, action: 'STAFF_INVITATION_ACCEPTED', entity: 'User', entityId: invitation.userId } });
    });
    return res.json({ success: true, data: { activated: true } });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: { message: error.message } });
  }
});

router.use(authenticateJWT, requireTenantIsolation);

router.get('/', requirePermission('staff.view'), async (req, res) => {
  const tenantId = req.tenant!.id;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = typeof req.query.role === 'string' && MANAGED_STAFF_ROLES.includes(req.query.role as UserRole) ? req.query.role as UserRole : undefined;
  const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
  const active = req.query.status === 'active' ? true : req.query.status === 'inactive' ? false : undefined;
  const branchScope = req.user!.roles.some(value => ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(value)) ? undefined : req.user!.branchIds;
  const users = await prisma.user.findMany({
    where: {
      tenantId, role: { in: MANAGED_STAFF_ROLES }, ...(active === undefined ? {} : { isActive: active }),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { employeeId: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(role ? { roleAssignments: { some: { role, isActive: true } } } : {}),
      ...((branchId || branchScope) ? { roleAssignments: { some: { branchId: branchId || { in: branchScope }, isActive: true, ...(role ? { role } : {}) } } } : {}),
    },
    select: {
      id: true, name: true, email: true, phone: true, employeeId: true, role: true, isActive: true, createdAt: true, lastLoginAt: true,
      roleAssignments: { where: { isActive: true }, select: { id: true, role: true, branchId: true, branch: { select: { id: true, name: true } } } },
      riderProfile: { select: { id: true, vehicleType: true, vehicleNumber: true, status: true, isAvailable: true, branchId: true } },
      staffInvitation: { select: { status: true, expiresAt: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' }, take: 200,
  });
  res.json({ success: true, data: users });
});

router.get('/:id', requirePermission('staff.view'), async (req, res) => {
  const staff = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id, role: { in: MANAGED_STAFF_ROLES } },
    select: {
      id: true, name: true, email: true, phone: true, employeeId: true, role: true, isActive: true, createdAt: true, lastLoginAt: true,
      roleAssignments: { where: { isActive: true }, include: { branch: { select: { id: true, name: true } } } },
      riderProfile: true,
      auditLogs: { select: { id: true, action: true, entity: true, entityId: true, timestamp: true }, orderBy: { timestamp: 'desc' }, take: 25 },
      staffInvitation: { select: { status: true, expiresAt: true, createdAt: true } },
    },
  });
  if (!staff || (!req.user!.roles.some(value => ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(value)) && staff.roleAssignments.some(assignment => assignment.branchId && !req.user!.branchIds.includes(assignment.branchId)))) {
    return res.status(404).json({ success: false, error: { message: 'Staff member not found' } });
  }
  res.json({ success: true, data: staff });
});

router.post('/', requirePermission('staff.create'), async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const { name, phone, employeeId } = req.body;
    const email = normalizedEmail(req.body.email);
    const role = req.body.role as UserRole;
    if (typeof name !== 'string' || !name.trim() || !email.includes('@') || !canAssign(req.user!, role)) throw new Error('Valid name, email, and permitted role are required');
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ success: false, error: { message: 'This email is already registered' } });
    const branchIds = await validateBranches(tenantId, req.user!, role, req.body.branchIds);
    const invitationToken = randomBytes(32).toString('base64url');
    const placeholderPassword = await bcrypt.hash(randomBytes(48).toString('base64url'), 10);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const staff = await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { tenantId, name: name.trim(), email, phone, employeeId, role, password: placeholderPassword, isActive: false } });
      const scopes = branchIds.length ? branchIds : [null];
      for (const branchId of scopes) await tx.roleAssignment.create({ data: { userId: user.id, tenantId, role, branchId } });
      if (role !== 'RIDER') for (const branchId of branchIds) await tx.branchStaff.create({ data: { userId: user.id, branchId, role } });
      if (role === 'RIDER') await tx.rider.create({ data: { tenantId, userId: user.id, branchId: branchIds[0], status: 'OFFLINE', isAvailable: false } });
      await tx.staffInvitation.create({ data: { tenantId, userId: user.id, tokenHash: hashRefreshToken(invitationToken), expiresAt, createdById: req.user!.id } });
      await tx.auditLog.create({ data: { tenantId, userId: req.user!.id, actorRole: req.user!.roles.join(','), branchId: branchIds.length === 1 ? branchIds[0] : null, action: 'STAFF_CREATED', entity: 'User', entityId: user.id, newValue: JSON.stringify({ role, branchIds, status: 'INVITED' }) } });
      return user;
    });
    const invitationPath = `/staff/accept-invite?tenant=${encodeURIComponent(req.tenant!.slug)}&token=${encodeURIComponent(invitationToken)}`;
    res.status(201).json({ success: true, data: { id: staff.id, name: staff.name, email: staff.email, role, branchIds, status: 'INVITED', expiresAt, ...(process.env.NODE_ENV === 'production' ? { invitationDelivery: 'NOT_CONFIGURED' } : { developmentInvitationPath: invitationPath }) } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

router.patch('/:id', requirePermission('staff.edit'), async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const staff = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId, role: { in: MANAGED_STAFF_ROLES } },
      include: { roleAssignments: { where: { isActive: true } } },
    });
    if (!staff) return res.status(404).json({ success: false, error: { message: 'Staff member not found' } });
    const tenantWideActor = req.user!.roles.some(value => ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(value));
    if (!tenantWideActor && (['TENANT_ADMIN', 'BRANCH_MANAGER'].includes(staff.role) || staff.roleAssignments.some(assignment => !assignment.branchId || !req.user!.branchIds.includes(assignment.branchId)))) {
      return res.status(404).json({ success: false, error: { message: 'Staff member not found' } });
    }
    const role = (req.body.role || staff.role) as UserRole;
    if (!canAssign(req.user!, role)) throw new Error('You cannot assign this role');
    const existingBranchIds = staff.roleAssignments.map(assignment => assignment.branchId).filter((id): id is string => Boolean(id));
    const branchIds = await validateBranches(tenantId, req.user!, role, req.body.branchIds ?? existingBranchIds);
    const previous = { role: staff.role, branchIds: existingBranchIds };
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: staff.id }, data: {
        role,
        ...(typeof req.body.name === 'string' && req.body.name.trim() ? { name: req.body.name.trim() } : {}),
        ...(req.body.phone !== undefined ? { phone: req.body.phone || null } : {}),
        ...(req.body.employeeId !== undefined ? { employeeId: req.body.employeeId || null } : {}),
      } });
      await tx.roleAssignment.deleteMany({ where: { userId: staff.id, tenantId } });
      await tx.branchStaff.deleteMany({ where: { userId: staff.id, branch: { tenantId } } });
      for (const branchId of branchIds.length ? branchIds : [null]) await tx.roleAssignment.create({ data: { userId: staff.id, tenantId, role, branchId } });
      if (role !== 'RIDER') for (const branchId of branchIds) await tx.branchStaff.create({ data: { userId: staff.id, branchId, role } });
      if (role === 'RIDER') await tx.rider.upsert({ where: { userId: staff.id }, update: { tenantId, branchId: branchIds[0] }, create: { tenantId, userId: staff.id, branchId: branchIds[0], status: 'OFFLINE', isAvailable: false } });
      else await tx.rider.updateMany({ where: { userId: staff.id }, data: { status: 'OFFLINE', isAvailable: false } });
      await tx.refreshToken.updateMany({ where: { userId: staff.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { tenantId, userId: req.user!.id, actorRole: req.user!.roles.join(','), branchId: branchIds.length === 1 ? branchIds[0] : null, action: 'STAFF_ASSIGNMENT_CHANGED', entity: 'User', entityId: staff.id, oldValue: JSON.stringify(previous), newValue: JSON.stringify({ role, branchIds }) } });
    });
    res.json({ success: true, data: { id: staff.id, role, branchIds } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

router.patch('/:id/status', requirePermission('staff.disable'), async (req, res) => {
  try {
    if (req.params.id === req.user!.id) throw new Error('You cannot change your own status');
    if (typeof req.body.isActive !== 'boolean') throw new Error('isActive must be true or false');
    const staff = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenant!.id, role: { in: MANAGED_STAFF_ROLES } } });
    if (!staff) return res.status(404).json({ success: false, error: { message: 'Staff member not found' } });
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: staff.id }, data: { isActive: req.body.isActive } });
      if (!req.body.isActive) {
        await tx.refreshToken.updateMany({ where: { userId: staff.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.rider.updateMany({ where: { userId: staff.id }, data: { isAvailable: false, status: 'OFFLINE' } });
      }
      await tx.auditLog.create({ data: { tenantId: req.tenant!.id, userId: req.user!.id, actorRole: req.user!.roles.join(','), action: req.body.isActive ? 'STAFF_REACTIVATED' : 'STAFF_DISABLED', entity: 'User', entityId: staff.id, oldValue: String(staff.isActive), newValue: String(req.body.isActive) } });
    });
    res.json({ success: true, data: { id: staff.id, isActive: req.body.isActive } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

export default router;
