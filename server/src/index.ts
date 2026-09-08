import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============================================================================
// WEBSOCKETS (REAL-TIME ORDER SYNC BETWEEN CUSTOMER & KITCHEN/ADMIN)
// ============================================================================
io.on('connection', (socket) => {
  console.log(`🔌 Client connected to WebSockets: ${socket.id}`);

  // Join order-specific room for live customer tracking
  socket.on('join:order', (orderId: string) => {
    socket.join(`order:${orderId}`);
    console.log(`Socket ${socket.id} joined tracking room: order:${orderId}`);
  });

  // Admin / Kitchen joins kitchen channel
  socket.on('join:kitchen', () => {
    socket.join('kitchen_room');
    console.log(`Kitchen staff connected: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const productCount = await prisma.product.count();
    const orderCount = await prisma.order.count();
    res.json({
      status: 'healthy',
      database: 'connected',
      productCount,
      orderCount,
      timestamp: new Date(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// ============================================================================
// CATEGORIES (CRUD)
// ============================================================================
app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', async (req: Request, res: Response) => {
  try {
    const { name, image } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const category = await prisma.category.create({
      data: { name, image, slug },
    });
    res.status(201).json(category);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PRODUCTS (110% DYNAMIC CRUD FOR CUSTOMERS & ADMIN)
// ============================================================================
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const { categoryId, search, inStockOnly } = req.query;

    const where: any = {};
    if (categoryId && categoryId !== 'all') {
      where.categoryId = String(categoryId);
    }
    if (inStockOnly === 'true') {
      where.inStock = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const { name, description, price, discountedPrice, image, categoryId, isBestSeller, isDeal } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Product name and price are required' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || '',
        price: Number(price),
        discountedPrice: discountedPrice ? Number(discountedPrice) : null,
        image: image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
        categoryId: categoryId || null,
        isBestSeller: Boolean(isBestSeller),
        isDeal: Boolean(isDeal),
        inStock: true,
      },
      include: { category: true },
    });

    // Notify all clients of new product addition
    io.emit('product:added', product);

    res.status(201).json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price, inStock, isBestSeller, isDeal } = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(inStock !== undefined && { inStock: Boolean(inStock) }),
        ...(isBestSeller !== undefined && { isBestSeller: Boolean(isBestSeller) }),
        ...(isDeal !== undefined && { isDeal: Boolean(isDeal) }),
      },
    });

    io.emit('product:updated', updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    io.emit('product:deleted', id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// BRANCHES (61 LOCATIONS)
// ============================================================================
app.get('/api/branches', async (req: Request, res: Response) => {
  try {
    const { city } = req.query;
    const where: any = {};
    if (city) where.city = String(city);

    const branches = await prisma.branch.findMany({
      where,
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });
    res.json(branches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/branches/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });

    const updated = await prisma.branch.update({
      where: { id },
      data: { isOpen: !branch.isOpen },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ORDERS (LIVE PLACEMENT & TRACKING WITH WEBSOCKETS)
// ============================================================================
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      landmark,
      notes,
      orderMode,
      branchId,
      paymentMethod,
      items,
      subtotal,
      deliveryFee,
      discount,
      total,
    } = req.body;

    if (!customerName || !customerPhone || !items || !items.length) {
      return res.status(400).json({ error: 'Customer name, phone, and items are required' });
    }

    const orderNumber = 'CHZ-' + Math.floor(100000 + Math.random() * 900000);

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName,
        customerPhone,
        deliveryAddress: deliveryAddress || null,
        landmark: landmark || null,
        notes: notes || null,
        orderMode: orderMode || 'DELIVERY',
        branchId: branchId || null,
        paymentMethod: paymentMethod || 'COD',
        status: 'PENDING',
        subtotal: Number(subtotal) || 0,
        deliveryFee: Number(deliveryFee) || 0,
        discount: Number(discount) || 0,
        total: Number(total) || 0,
        items: {
          create: items.map((i: any) => ({
            productId: i.productId || null,
            productName: i.name,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            size: i.size || null,
            crust: i.crust || null,
            flavor: i.flavor || null,
            drink: i.drink || null,
            addons: Array.isArray(i.addons) ? i.addons.map((a: any) => a.name).join(', ') : (i.addons || null),
            instructions: i.instructions || null,
          })),
        },
      },
      include: {
        items: true,
        branch: true,
      },
    });

    // ⚡ REAL-TIME: Notify Admin & Kitchen screen instantly!
    io.to('kitchen_room').emit('order:new', order);
    io.emit('order:created', order);

    res.status(201).json(order);
  } catch (err: any) {
    console.error('Order creation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status && status !== 'ALL') where.status = String(status);

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        items: true,
        branch: true,
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true, branch: true },
    });

    // ⚡ REAL-TIME: Notify the specific customer tracking this order
    io.to(`order:${updated.id}`).emit('order:status_updated', updated);
    io.to(`order:${updated.orderNumber}`).emit('order:status_updated', updated);
    
    // Also notify the kitchen dashboard
    io.to('kitchen_room').emit('order:status_updated', updated);
    io.emit('order:status_updated', updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// VOUCHERS / PROMO CODES
// ============================================================================
app.post('/api/vouchers/verify', async (req: Request, res: Response) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const voucher = await prisma.voucher.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!voucher || !voucher.active) {
      return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code' });
    }

    if (subtotal && subtotal < voucher.minOrder) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order of Rs. ${voucher.minOrder} required for this coupon`,
      });
    }

    let discountAmount = 0;
    if (voucher.discountType === 'PERCENT') {
      discountAmount = Math.round(((subtotal || 0) * voucher.discountValue) / 100);
    } else {
      discountAmount = voucher.discountValue;
    }

    res.json({
      valid: true,
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      discountAmount,
      message: `Promo code ${voucher.code} applied successfully!`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ANALYTICS & BUSINESS STATS FOR ADMIN
// ============================================================================
app.get('/api/analytics/stats', async (req: Request, res: Response) => {
  try {
    const totalOrders = await prisma.order.count();
    const pendingOrders = await prisma.order.count({ where: { status: 'PENDING' } });
    const kitchenOrders = await prisma.order.count({ where: { status: 'PREPARING' } });
    const deliveredOrders = await prisma.order.count({ where: { status: 'DELIVERED' } });
    
    const revenueAgg = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: 'CANCELLED' } },
    });

    res.json({
      totalOrders,
      pendingOrders,
      kitchenOrders,
      deliveredOrders,
      totalRevenue: revenueAgg._sum.total || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================
server.listen(PORT, () => {
  console.log(`🚀 Cheezious Backend Server running on http://localhost:${PORT}`);
  console.log(`⚡ Real-time WebSockets initialized`);
});
