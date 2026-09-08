import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { JWT_SECRET, TokenPayload } from './middleware/auth';
import { orderScope } from './services/access';

let ioInstance: SocketIOServer;
export function initSocketIO(server: HttpServer) {
  const io = new SocketIOServer(server, { cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' } });
  io.use(async (socket, next) => {
    try {
      const { token, tenantSlug } = socket.handshake.auth || {};
      const tenant = await prisma.tenant.findFirst({ where: { slug: String(tenantSlug || ''), status: 'ACTIVE' } });
      if (!tenant) throw new Error('Restaurant unavailable');
      socket.data.tenantId = tenant.id;
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user?.isActive || (user.role !== 'SUPER_ADMIN' && user.tenantId !== tenant.id)) throw new Error('Access denied');
        socket.data.user = { id: user.id, role: user.role, tenantId: user.tenantId };
        socket.data.expiresAt = (payload as any).exp * 1000;
      }
      next();
    } catch { next(new Error('Unauthorized subscription')); }
  });
  io.on('connection', async socket => {
    const tenantId = socket.data.tenantId;
    socket.join(`catalog:${tenantId}`);
    const user = socket.data.user;
    // Disconnect when the access token expires; reconnect performs authentication again.
    const expiry = user ? setTimeout(() => socket.disconnect(true), Math.min(2147483647, Math.max(0, socket.data.expiresAt - Date.now()))) : null;
    socket.on('disconnect', () => { if (expiry) clearTimeout(expiry); });
    if (user) {
      try {
        if (['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user.role)) socket.join(`ops:${tenantId}`);
        else if (['BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF'].includes(user.role)) {
          const branches = await prisma.branchStaff.findMany({ where: { userId: user.id, branch: { tenantId } } });
          for (const b of branches) socket.join(`kitchen:${b.branchId}`);
        } else if (user.role === 'RIDER') {
          const rider = await prisma.rider.findUnique({ where: { userId: user.id } });
          if (rider) socket.join(`rider:${rider.id}`);
        }
      } catch { socket.disconnect(true); }
    }
    socket.on('join:order', async (id: unknown, ack?: (result: any) => void) => {
      try {
        if (!user || typeof id !== 'string') throw new Error('Access denied');
        const active = await prisma.user.findUnique({ where: { id: user.id } });
        if (!active?.isActive) throw new Error('Access denied');
        const scope = await orderScope(active, tenantId);
        const order = await prisma.order.findFirst({ where: { AND: [scope, { OR: [{ id }, { orderNumber: id }] }] } });
        if (!order) throw new Error('Access denied');
        socket.join(`order:${order.id}`);
        if (typeof ack === 'function') ack({ success: true });
      } catch { if (typeof ack === 'function') ack({ success: false }); }
    });
    socket.on('leave:order', (id: unknown) => { if (typeof id === 'string') socket.leave(`order:${id}`); });
    // Room selection and location publication are never delegated to arbitrary client IDs.
  });
  ioInstance = io;
  return io;
}
export function getIO() { return ioInstance; }
