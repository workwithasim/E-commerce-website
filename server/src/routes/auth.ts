import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  verifyRefreshToken,
} from '../services/sessions';
import { AuthorizationContext, resolveAuthorization } from '../services/permissions';

const router = Router();

function publicUser(user: any, tenantSlug?: string | null, tenantName?: string | null, authorization?: AuthorizationContext) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    tenantId: user.tenantId,
    tenantSlug: tenantSlug ?? user.tenant?.slug ?? null,
    tenantName: tenantName ?? user.tenant?.name ?? null,
    roles: authorization?.roles ?? user.roles ?? [user.role],
    permissions: authorization?.permissions ?? user.permissions ?? [],
    branchIds: authorization?.branchIds ?? user.branchIds ?? [],
  };
}

async function persistSession(user: { id: string; role: UserRole; tenantId: string | null }, req: Request) {
  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: { userId: user.id, token: hashRefreshToken(refreshToken), expiresAt: refreshExpiry(), userAgent: req.get('user-agent') || null, ip: req.ip },
  });
  return { token, refreshToken, authorization: await resolveAuthorization(user) };
}

// ── POST /api/v1/auth/register (Customer Registration) ─────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    if (req.tenant?.settings?.customerRegistrationEnabled === false) return res.status(403).json({ success: false, error: { message: 'Registration is disabled' } });
    if (typeof password !== 'string' || password.length < 8 || typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ success: false, error: { message: 'Valid email and password of at least 8 characters are required' } });
    const tenantId = req.tenant?.id;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Name, email and password are required' },
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'This email is already registered' },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: UserRole.CUSTOMER,
        tenantId: tenantId || null,
      },
    });

    const session = await persistSession(user, req);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return res.status(201).json({
      success: true,
      data: {
        token: session.token,
        refreshToken: session.refreshToken,
        user: publicUser(user, req.tenant?.slug, req.tenant?.name, session.authorization),
      },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/auth/login (Unified Multi-Tenant Login) ────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Email and password are required' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    if (user.tenant && user.tenant.status !== 'ACTIVE') return res.status(403).json({ success: false, error: { message: 'Restaurant is inactive' } });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const session = await persistSession(user, req);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return res.json({
      success: true,
      data: {
        token: session.token,
        refreshToken: session.refreshToken,
        user: publicUser(user, undefined, undefined, session.authorization),
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/auth/refresh (one-time refresh rotation) ──────────
router.post('/refresh', async (req: Request, res: Response) => {
  const supplied = req.body?.refreshToken;
  if (typeof supplied !== 'string' || !supplied) {
    return res.status(400).json({ success: false, error: { code: 'REFRESH_REQUIRED', message: 'Refresh token is required' } });
  }

  try {
    const payload = verifyRefreshToken(supplied);
    const storedHash = hashRefreshToken(supplied);
    const stored = await prisma.refreshToken.findUnique({ where: { token: storedHash } });
    if (!stored || stored.userId !== payload.userId || stored.revokedAt || stored.expiresAt <= new Date()) {
      return res.status(401).json({ success: false, error: { code: 'REFRESH_REVOKED', message: 'Refresh token is invalid or revoked' } });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { tenant: true } });
    if (!user?.isActive || (user.tenant && user.tenant.status !== 'ACTIVE')) {
      await prisma.refreshToken.updateMany({ where: { userId: payload.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return res.status(401).json({ success: false, error: { code: 'USER_INACTIVE', message: 'User account is disabled' } });
    }

    const nextRefreshToken = createRefreshToken(user.id);
    const rotated = await prisma.$transaction(async tx => {
      const revoked = await tx.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (revoked.count !== 1) return false;
      await tx.refreshToken.create({ data: { userId: user.id, token: hashRefreshToken(nextRefreshToken), expiresAt: refreshExpiry(), userAgent: req.get('user-agent') || null, ip: req.ip } });
      return true;
    });
    if (!rotated) return res.status(401).json({ success: false, error: { code: 'REFRESH_REUSED', message: 'Refresh token has already been used' } });

    const authorization = await resolveAuthorization(user);
    return res.json({
      success: true,
      data: { token: createAccessToken(user), refreshToken: nextRefreshToken, user: publicUser(user, undefined, undefined, authorization) },
    });
  } catch {
    return res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH', message: 'Invalid or expired refresh token' } });
  }
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const supplied = req.body?.refreshToken;
  if (typeof supplied === 'string' && supplied) {
    await prisma.refreshToken.updateMany({
      where: { token: hashRefreshToken(supplied), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return res.json({ success: true, data: { loggedOut: true } });
});

router.get('/sessions', authenticateJWT, async (req: Request, res: Response) => {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: sessions });
});

router.delete('/sessions/:id', authenticateJWT, async (req: Request, res: Response) => {
  await prisma.refreshToken.updateMany({ where: { id: req.params.id, userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.json({ success: true, data: { revoked: true } });
});

// ── GET /api/v1/auth/me ─────────────────────────────────────────────
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { tenant: true, riderProfile: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return res.json({
      success: true,
      data: {
        user: { ...publicUser({ ...user, ...req.user }), riderProfile: user.riderProfile },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_ME_FAILED', message: err.message },
    });
  }
});

export default router;
