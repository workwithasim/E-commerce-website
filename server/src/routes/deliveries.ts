import { Router, Request, Response } from 'express';
import { DeliveryStatus, OrderStatus, RiderStatus, UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();

// ── GET /api/v1/riders (List Tenant Riders) ─────────────────────────
router.get('/riders', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant!.id;
    const riders = await prisma.rider.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        branch: true,
      },
    });

    res.json({
      success: true,
      data: riders,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_RIDERS_FAILED', message: err.message },
    });
  }
});

// ── PATCH /api/v1/riders/availability (Rider Toggle Availability) ────
router.patch('/riders/availability', authenticateJWT, requireRole([UserRole.RIDER]), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { isAvailable } = req.body;

    const rider = await prisma.rider.findUnique({ where: { userId } });
    if (!rider) {
      return res.status(404).json({
        success: false,
        error: { code: 'RIDER_PROFILE_NOT_FOUND', message: 'Rider profile not found' },
      });
    }

    const updated = await prisma.rider.update({
      where: { id: rider.id },
      data: {
        isAvailable: Boolean(isAvailable),
        status: isAvailable ? RiderStatus.AVAILABLE : RiderStatus.OFFLINE,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_AVAILABILITY_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/deliveries/assign (Assign Rider to Order) ───────────
router.post('/assign', authenticateJWT, requireRole([UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const { orderId, riderId } = req.body;
    const tenantId = req.tenant!.id;

    const delivery = await prisma.delivery.findFirst({
      where: { orderId, tenantId },
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: { code: 'DELIVERY_NOT_FOUND', message: 'Delivery record not found for this order' },
      });
    }

    const updatedDelivery = await prisma.$transaction(async (tx) => {
      const del = await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          riderId,
          status: DeliveryStatus.ASSIGNED,
          assignedAt: new Date(),
        },
        include: {
          order: true,
          rider: { include: { user: true } },
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.RIDER_ASSIGNED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          oldStatus: del.order.status,
          newStatus: OrderStatus.RIDER_ASSIGNED,
          changedBy: req.user?.name || 'ADMIN',
          metadata: JSON.stringify({ riderName: del.rider?.user.name }),
        },
      });

      return del;
    });

    try {
      const io = getIO();
      io.to(`rider:${riderId}`).emit('delivery:assigned', updatedDelivery);
      io.to(`order:${orderId}`).emit('order:status_updated', { status: OrderStatus.RIDER_ASSIGNED });
      io.to(`tenant:${tenantId}`).emit('delivery:assigned', updatedDelivery);
    } catch (e) {
      // silent
    }

    res.json({
      success: true,
      data: updatedDelivery,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'ASSIGN_RIDER_FAILED', message: err.message },
    });
  }
});

// ── GET /api/v1/deliveries/assigned (Rider View Active Deliveries) ───
router.get('/assigned', authenticateJWT, requireRole([UserRole.RIDER]), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rider = await prisma.rider.findUnique({ where: { userId } });

    if (!rider) {
      return res.status(404).json({
        success: false,
        error: { code: 'RIDER_PROFILE_NOT_FOUND', message: 'Rider profile not found' },
      });
    }

    const deliveries = await prisma.delivery.findMany({
      where: {
        riderId: rider.id,
        status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
      },
      include: {
        order: {
          include: { items: true, branch: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      success: true,
      data: deliveries,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_DELIVERIES_FAILED', message: err.message },
    });
  }
});

// ── PATCH /api/v1/deliveries/:id/status (Rider Updates Delivery Status)
router.patch('/:id/status', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // ACCEPTED, PICKED_UP, ON_THE_WAY, DELIVERED

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { order: true, rider: { include: { user: true } } },
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: { code: 'DELIVERY_NOT_FOUND', message: 'Delivery not found' },
      });
    }

    let orderStatus: OrderStatus = delivery.order.status;
    const timestampUpdates: any = {};

    if (status === DeliveryStatus.ACCEPTED) {
      timestampUpdates.acceptedAt = new Date();
    } else if (status === DeliveryStatus.PICKED_UP) {
      timestampUpdates.pickedUpAt = new Date();
      orderStatus = OrderStatus.PICKED_UP;
    } else if (status === DeliveryStatus.ON_THE_WAY) {
      orderStatus = OrderStatus.ON_THE_WAY;
    } else if (status === DeliveryStatus.DELIVERED) {
      timestampUpdates.deliveredAt = new Date();
      orderStatus = OrderStatus.DELIVERED;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const del = await tx.delivery.update({
        where: { id },
        data: {
          status: status as DeliveryStatus,
          ...timestampUpdates,
        },
        include: { order: { include: { items: true, branch: true } }, rider: { include: { user: true } } },
      });

      if (orderStatus !== delivery.order.status) {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: orderStatus },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: delivery.orderId,
            oldStatus: delivery.order.status,
            newStatus: orderStatus,
            changedBy: req.user?.name || 'RIDER',
            metadata: JSON.stringify({ deliveryStatus: status }),
          },
        });
      }

      return del;
    });

    try {
      const io = getIO();
      io.to(`delivery:${id}`).emit('delivery:status_updated', updated);
      io.to(`order:${delivery.orderId}`).emit('order:status_updated', {
        id: delivery.orderId,
        orderNumber: delivery.order.orderNumber,
        status: orderStatus,
        delivery: updated,
      });
      io.to(`tenant:${delivery.tenantId}`).emit('order:status_updated', {
        id: delivery.orderId,
        status: orderStatus,
      });
    } catch (e) {
      // silent
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_DELIVERY_STATUS_FAILED', message: err.message },
    });
  }
});

// ── POST /api/v1/deliveries/:id/location (Live GPS Location Stream) ──
router.post('/:id/location', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, heading, speed } = req.body;

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { rider: true },
    });

    if (!delivery || !delivery.riderId) {
      return res.status(404).json({
        success: false,
        error: { code: 'DELIVERY_NOT_FOUND', message: 'Delivery or assigned rider not found' },
      });
    }

    // Record location
    const location = await prisma.riderLocation.create({
      data: {
        riderId: delivery.riderId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        heading: heading ? Number(heading) : null,
        speed: speed ? Number(speed) : null,
      },
    });

    // ⚡ REAL-TIME: Stream live GPS coordinates to customer's live order map
    try {
      const io = getIO();
      const payload = {
        deliveryId: id,
        orderId: delivery.orderId,
        riderId: delivery.riderId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        heading,
        speed,
        timestamp: location.timestamp,
      };

      io.to(`order:${delivery.orderId}`).emit('delivery:location_updated', payload);
      io.to(`delivery:${id}`).emit('delivery:location_updated', payload);
    } catch (e) {
      // silent
    }

    res.json({
      success: true,
      data: location,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SAVE_LOCATION_FAILED', message: err.message },
    });
  }
});

export default router;
