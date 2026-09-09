import { createHash, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { JWT_SECRET, REFRESH_SECRET } from '../middleware/auth';

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_DAYS = 30;

export type SessionUser = {
  id: string;
  role: UserRole;
  tenantId: string | null;
};

export type RefreshPayload = {
  userId: string;
  type: 'refresh';
  jti: string;
};

export function createAccessToken(user: SessionUser) {
  return jwt.sign(
    { userId: user.id, role: user.role, tenantId: user.tenantId },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

export function createRefreshToken(userId: string) {
  return jwt.sign(
    { userId, type: 'refresh', jti: randomUUID() },
    REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_DAYS}d` },
  );
}

export function verifyRefreshToken(token: string) {
  const payload = jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
  if (payload.type !== 'refresh' || !payload.userId || !payload.jti) {
    throw new Error('Invalid refresh token');
  }
  return payload;
}

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return expiresAt;
}
