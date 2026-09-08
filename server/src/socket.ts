import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

let ioInstance: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket: Socket) => {
    // 1. Join Tenant Room
    socket.on('join:tenant', (tenantId: string) => {
      if (tenantId) {
        socket.join(`tenant:${tenantId}`);
      }
    });

    // 2. Join Branch Room
    socket.on('join:branch', ({ tenantId, branchId }: { tenantId: string; branchId: string }) => {
      if (tenantId && branchId) {
        socket.join(`branch:${branchId}`);
      }
    });

    // 3. Join Kitchen Room (for KDS dashboard)
    socket.on('join:kitchen', ({ tenantId, branchId }: { tenantId?: string; branchId?: string }) => {
      if (branchId) {
        socket.join(`kitchen:${branchId}`);
      }
      if (tenantId) {
        socket.join(`kitchen:tenant:${tenantId}`);
      }
      socket.join('kitchen_global');
    });

    // 4. Join Order Room (Customer live order tracker)
    socket.on('join:order', (orderId: string) => {
      if (orderId) {
        socket.join(`order:${orderId}`);
      }
    });

    // 5. Join Delivery Room (Rider & Customer live GPS tracker)
    socket.on('join:delivery', (deliveryId: string) => {
      if (deliveryId) {
        socket.join(`delivery:${deliveryId}`);
      }
    });

    // 6. Join Rider Private Room
    socket.on('join:rider', (riderId: string) => {
      if (riderId) {
        socket.join(`rider:${riderId}`);
      }
    });

    // Rider live location stream
    socket.on('rider:location_ping', (data: { deliveryId?: string; orderId?: string; riderId: string; latitude: number; longitude: number; heading?: number; speed?: number }) => {
      if (data.deliveryId) {
        io.to(`delivery:${data.deliveryId}`).emit('delivery:location_updated', data);
      }
      if (data.orderId) {
        io.to(`order:${data.orderId}`).emit('delivery:location_updated', data);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized');
  }
  return ioInstance;
}
