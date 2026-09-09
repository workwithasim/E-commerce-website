import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { prisma } from '../prisma';
import authRoutes from '../routes/auth';
import { createAccessToken, createRefreshToken, hashRefreshToken, verifyRefreshToken } from '../services/sessions';

type StoredToken = { id: string; userId: string; token: string; expiresAt: Date; revokedAt: Date | null };
const tokens = new Map<string, StoredToken>();
const user: any = {
  id: 'session-user', name: 'Session User', email: 'session@example.test', phone: null,
  role: 'TENANT_ADMIN', tenantId: 'tenant-1', isActive: true,
  tenant: { id: 'tenant-1', slug: 'tenant-one', name: 'Tenant One', status: 'ACTIVE' },
};
let sequence = 0;
let server: http.Server;
let base: string;

before(async () => {
  (prisma.user.findUnique as any) = async ({ where }: any) => where.id === user.id ? user : null;
  (prisma.refreshToken.findUnique as any) = async ({ where }: any) => tokens.get(where.token) || null;
  (prisma.refreshToken.create as any) = async ({ data }: any) => {
    const record = { id: `rt-${++sequence}`, revokedAt: null, ...data } as StoredToken;
    tokens.set(record.token, record);
    return record;
  };
  (prisma.refreshToken.updateMany as any) = async ({ where, data }: any) => {
    let count = 0;
    for (const record of tokens.values()) {
      if (where.id && record.id !== where.id) continue;
      if (where.userId && record.userId !== where.userId) continue;
      if (where.token && record.token !== where.token) continue;
      if (where.revokedAt === null && record.revokedAt !== null) continue;
      Object.assign(record, data); count++;
    }
    return { count };
  };
  (prisma.$transaction as any) = async (callback: any) => callback(prisma);

  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

async function post(path: string, refreshToken: string) {
  return fetch(`${base}/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
  });
}

test('refresh tokens are opaque at rest and carry the expected token type', () => {
  const access: any = JSON.parse(Buffer.from(createAccessToken(user).split('.')[1], 'base64url').toString());
  assert.ok(access.exp - access.iat <= 15 * 60);
  const token = createRefreshToken(user.id);
  assert.equal(verifyRefreshToken(token).type, 'refresh');
  assert.notEqual(hashRefreshToken(token), token);
  assert.equal(hashRefreshToken(token).length, 64);
});

test('refresh rotates once and rejects reuse', async () => {
  const initial = createRefreshToken(user.id);
  await (prisma.refreshToken.create as any)({ data: { userId: user.id, token: hashRefreshToken(initial), expiresAt: new Date(Date.now() + 60_000) } });

  const first = await post('refresh', initial);
  assert.equal(first.status, 200);
  const body: any = await first.json();
  assert.ok(body.data.token);
  assert.ok(body.data.refreshToken);
  assert.notEqual(body.data.refreshToken, initial);

  const reused = await post('refresh', initial);
  assert.equal(reused.status, 401);
});

test('logout revokes a refresh token and disabled users cannot refresh', async () => {
  const logoutToken = createRefreshToken(user.id);
  await (prisma.refreshToken.create as any)({ data: { userId: user.id, token: hashRefreshToken(logoutToken), expiresAt: new Date(Date.now() + 60_000) } });
  assert.equal((await post('logout', logoutToken)).status, 200);
  assert.equal((await post('refresh', logoutToken)).status, 401);

  const disabledToken = createRefreshToken(user.id);
  await (prisma.refreshToken.create as any)({ data: { userId: user.id, token: hashRefreshToken(disabledToken), expiresAt: new Date(Date.now() + 60_000) } });
  user.isActive = false;
  assert.equal((await post('refresh', disabledToken)).status, 401);
  user.isActive = true;
});
