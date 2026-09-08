import { Router, Request, Response } from 'express';
import { OrderStatus, OrderMode, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { calculateOrderPricing } from '../services/pricing';
import { optionalJWT, authenticateJWT, requireRole } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();

// ── POST /api/v1/orders (Authoritative Server-Side Pricing Order Placement)
router.post('/', optionalJWT, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const tenantSlug = req.tenant!.slug.toUpperCase().slice(0, 3);
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      landmark,
      latitude,
      longitude,
      notes,
      orderMode,
      branchId,
      paymentMethod,
      items,
      voucherCode,
    } = req.body;

    if (!customerName || !customerPhone) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Customer name and phone are required' },
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Order must contain at least one item' },
      });
    }

    // 🔒 SERVER-SIDE AUTHORITATIVE PRICING CALCULATION
    const pricing = await calculateOrderPricing(
      tenantId,
      items,
      branchId,
      orderMode || 'DELIVERY',
      voucherCode
    );

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `${tenantSlug}-${randomSuffix}`;

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          branchId: branchId || null,
          customerId: req.user?.id || null,
          orderMode: (orderMode as OrderMode) || OrderMode.DELIVERY,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.COD,
          paymentStatus: PaymentStatus.PENDING,
          status: OrderStatus.PENDING,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          tax: pricing.tax,
          deliveryFee: pricing.deliveryFee,
          total: pricing.total,
          customerName,
          customerPhone,
          deliveryAddress: deliveryAddress || null,
          landmark: landmark || null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          notes: notes || null,
          items: {
            create: pricing.items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              size: i.size || null,
              variant: i.variant || null,
              addons: i.addons || null,
              instructions: i.instructions || null,
              optionsJson: i.optionsJson,
            })),
          },
          statusHistory: {
            create: {
              newStatus: OrderStatus.PENDING,
              changedBy: req.user?.id || 'CUSTOMER',
              metadata: JSON.stringify({ message: 'Order placed by customer' }),
            },
          },
        },
        include: {
          items: true,
          branch: true,
          statusHistory: true,
        },
      });

      // Auto-create Delivery record if DELIVERY mode
      if (orderMode === 'DELIVERY' || !orderMode) {
        await tx.delivery.create({
          data: {
            tenantId,
            branchId: branchId || null,
            orderId: createdOrder.id,
            deliveryAddress: deliveryAddress || null,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
          },
        });
      }

      return createdOrder;
    });

    // ⚡ REAL-TIME: Notify Kitchen and Tenant Admins
    try {
      const io = getIO();
      if (branchId) {
        io.to(`kitchen:${branchId}`).emit('order:new', order);
      }
      io.to(`kitchen:tenant:${tenantId}`).emit('order:new', order);
      io.to(`tenant:${tenantId}`).emit('order:new', order);
      io.to('kitchen_global').emit('order:new', order);
    } catch (e) {
      // socket silent catch
    }

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err: any) {
    console.error('Order placement error:', err);
    res.status(400).json({
      success: false,
      error: { code: 'ORDER_CREATION_FAILED', message: err.message },
    });
  }
});

// ── GET /api/v1/orders (List Orders with Filtering) ─────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const { status, branchId, limit } = req.query;

    const where: any = { tenantId };
    if (status && status !== 'ALL') {
      where.status = status as OrderStatus;
    }
    if (branchId && branchId !== 'ALL') {
      where.branchId = String(branchId);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        branch: true,
        delivery: { include: { rider: { include: { user: true } } } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? Number(limit) : 50,
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ORDERS_FAILED', message: err.message },
    });
  }
});

// ── GET /api/v1/orders/:id (Order Detail & Tracking) ────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;

    const order = await prisma.order.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        items: true,
        branch: true,
        delivery: {
          include: {
            rider: {
              include: {
                user: { select: { name: true, phone: true } },
                locations: { orderBy: { timestamp: 'desc' }, take: 1 },
              },
            },
          },
        },
        statusHistory: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ORDER_FAILED', message: err.message },
    });
  }
});

// ── PATCH /api/v1/orders/:id/status (Order Workflow Status Mutation) ─
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant!.id;
    const { status, note } = req.body;

    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Valid statuses: ${validStatuses.join(', ')}` },
      });
    }

    const currentOrder = await prisma.order.findFirst({
      where: { tenantId, OR: [{ id }, { orderNumber: id }] },
    });

    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: currentOrder.id },
        data: { status },
        include: {
          items: true,
          branch: true,
          delivery: { include: { rider: { include: { user: true } } } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: currentOrder.id,
          oldStatus: currentOrder.status,
          newStatus: status,
          changedBy: req.user?.name || req.user?.role || 'SYSTEM',
          metadata: note ? JSON.stringify({ note }) : null,
        },
      });

      return order;
    });

    // ⚡ REAL-TIME: Emit to isolated customer tracking & kitchen rooms
    try {
      const io = getIO();
      io.to(`order:${updated.id}`).emit('order:status_updated', updated);
      io.to(`order:${updated.orderNumber}`).emit('order:status_updated', updated);
      if (updated.branchId) {
        io.to(`kitchen:${updated.branchId}`).emit('order:status_updated', updated);
      }
      io.to(`kitchen:tenant:${tenantId}`).emit('order:status_updated', updated);
      io.to(`tenant:${tenantId}`).emit('order:status_updated', updated);
      io.to('kitchen_global').emit('order:status_updated', updated);
    } catch (e) {
      // socket silent catch
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_STATUS_FAILED', message: err.message },
    });
  }
});

export default router;
