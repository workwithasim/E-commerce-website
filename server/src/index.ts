import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './prisma';
import { initSocketIO } from './socket';
import { tenantResolver } from './middleware/tenant';

// Modular routes
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import branchRoutes from './routes/branches';
import orderRoutes from './routes/orders';
import deliveryRoutes from './routes/deliveries';
import voucherRoutes from './routes/vouchers';
import bannerRoutes from './routes/banners';
import analyticsRoutes from './routes/analytics';
import staffRoutes from './routes/staff';
import paymentRoutes from './routes/payments';
import auditRoutes from './routes/audit';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
initSocketIO(server);

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// ── HEALTH CHECK ───────────────────────────────────────────────────
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const tenantCount = await prisma.tenant.count();
    const productCount = await prisma.product.count();
    const orderCount = await prisma.order.count();
    res.json({
      status: 'healthy',
      version: '1.0.0 (White-Label Multi-Tenant)',
      database: 'connected',
      tenants: tenantCount,
      products: productCount,
      orders: orderCount,
      timestamp: new Date(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// ── TENANT RESOLVER MIDDLEWARE ─────────────────────────────────────
// Applies to all /api routes except tenant creation/listing & health
app.use((req, res, next) => {
  if (
    req.path.endsWith('/auth/login') || req.path.endsWith('/auth/me') ||
    req.path.endsWith('/auth/refresh') || req.path.endsWith('/auth/logout') ||
    req.path === '/api/health' ||
    req.path === '/api/v1/health' ||
    (req.path === '/api/v1/tenants' && req.method === 'GET') ||
    (req.path === '/api/v1/tenants' && req.method === 'POST') ||
    req.path.startsWith('/api/v1/tenants/')
  ) {
    return next();
  }
  return tenantResolver(req, res, next);
});

// ── V1 API ROUTES ──────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/api/v1/vouchers', voucherRoutes);
app.use('/api/v1/banners', bannerRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/audit', auditRoutes);

// ── BACKWARDS COMPATIBILITY ALIASES ────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/audit', auditRoutes);

// ── CENTRALIZED ERROR HANDLER  ──────────────────────
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
});

// ── START SERVER ───────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(`🚀 White-Label Multi-Tenant Restaurant Platform API Server`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`⚡ Isolated Socket.io WebSockets Engine Online`);
  console.log(`🛡️  Tenant Data Isolation & Authoritative Server Pricing Active`);
  console.log(`================================================================\n`);
});

export { app, server };
