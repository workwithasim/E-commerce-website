import { getIO } from '../socket';

export function emitOrder(event: string, order: any) {
  // Public catalog rooms never receive customer or operational data.
  getIO().to(`order:${order.id}`).to(`ops:${order.tenantId}`)
    .to(`kitchen:${order.branchId}`).emit(event, order);
}
