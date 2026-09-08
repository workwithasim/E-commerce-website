import React, { useState, useEffect } from 'react';
import { api, socket } from './api';
import { Order } from './types';
import { AuthUser } from './LoginPage';
import { useTenant } from './theme/ThemeProvider';

interface RiderDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

export const RiderDashboard: React.FC<RiderDashboardProps> = ({ user, onLogout }) => {
  const { tenant } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'delivered'>('active');
  const [isAvailable, setIsAvailable] = useState(true);
  const [gpsSimulating, setGpsSimulating] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const all = await api.getOrders();
      setOrders(Array.isArray(all) ? all : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    socket.emit('join:rider', user.id);

    socket.on('delivery:assigned', () => {
      fetchOrders();
    });

    socket.on('order:status_updated', () => {
      fetchOrders();
    });

    return () => {
      socket.off('delivery:assigned');
      socket.off('order:status_updated');
    };
  }, [user.id]);

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await api.updateOrderStatus(orderId, status);
      fetchOrders();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // Simulate moving GPS broadcaster towards customer address (PRD Section 28 & 82)
  const simulateLiveGPS = (order: Order) => {
    if (gpsSimulating === order.id) {
      setGpsSimulating(null);
      return;
    }

    setGpsSimulating(order.id);
    let step = 0;
    const startLat = 33.6844; // Islamabad center
    const startLng = 73.0479;

    const interval = setInterval(() => {
      step++;
      const currentLat = startLat + step * 0.001;
      const currentLng = startLng + step * 0.0015;

      // Broadcast via socket
      socket.emit('rider:location_ping', {
        orderId: order.id,
        deliveryId: order.delivery?.id,
        riderId: user.id,
        latitude: currentLat,
        longitude: currentLng,
        heading: 45,
        speed: 35,
      });

      if (step >= 8) {
        clearInterval(interval);
        setGpsSimulating(null);
      }
    }, 2000);
  };

  const activeOrders = orders.filter((o) =>
    ['READY', 'RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'PREPARING'].includes(o.status)
  );
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED');
  const shown = activeTab === 'active' ? activeOrders : deliveredOrders;

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', fontFamily: "'Inter', sans-serif", color: '#F1F5F9' }}>
      {/* Header */}
      <header
        style={{
          background: '#1E293B',
          borderBottom: '2px solid var(--color-primary, #E32726)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>🛵</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-secondary, #FEDC00)' }}>
              {tenant?.name?.toUpperCase() || 'RESTAURANT'} RIDER PORTAL
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Rider: {user.name} ({user.email})</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => setIsAvailable(!isAvailable)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.75rem',
              cursor: 'pointer',
              backgroundColor: isAvailable ? '#DCFCE7' : '#FEE2E2',
              color: isAvailable ? '#16A34A' : '#DC2626',
            }}
          >
            {isAvailable ? '● AVAILABLE FOR DISPATCH' : '○ OFFLINE'}
          </button>

          <button
            onClick={onLogout}
            style={{
              background: '#EF4444',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* KPI Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          padding: '20px',
          background: '#111827',
          borderBottom: '1px solid #1F2937',
        }}
      >
        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem' }}>📦</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38BDF8' }}>{activeOrders.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Active Deliveries</div>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem' }}>🛵</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FBBF24' }}>
            {orders.filter((o) => o.status === 'ON_THE_WAY').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>On The Way</div>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem' }}>✅</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#34D399' }}>{deliveredOrders.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Delivered Today</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '16px 20px 0', gap: '8px' }}>
        {(['active', 'delivered'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '10px 10px 0 0',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: activeTab === tab ? 'var(--color-primary, #E32726)' : '#1E293B',
              color: '#FFFFFF',
            }}
          >
            {tab === 'active' ? `📦 Active Orders (${activeOrders.length})` : `✅ Completed (${deliveredOrders.length})`}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>Loading assignments...</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🛵</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>No {activeTab} deliveries right now</div>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px' }}>
              Keep your status ON DUTY to receive incoming orders from the kitchen.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {shown.map((order) => {
              const isSimulating = gpsSimulating === order.id;

              return (
                <div
                  key={order.id}
                  style={{
                    background: '#1E293B',
                    borderRadius: '14px',
                    border: '1px solid #334155',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary, #FEDC00)' }}>
                        #{order.orderNumber}
                      </span>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor:
                            order.status === 'DELIVERED'
                              ? '#065F46'
                              : order.status === 'ON_THE_WAY'
                              ? '#5B21B6'
                              : '#854D0E',
                          color: '#FFFFFF',
                        }}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: '#F1F5F9', marginBottom: '8px' }}>
                      👤 <strong>{order.customerName}</strong> (📞 {order.customerPhone})
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '12px' }}>
                      📍 <strong>Delivery Address:</strong> {order.deliveryAddress || 'Takeaway pickup'}
                      {order.landmark && <span style={{ display: 'block', color: '#64748B' }}>Landmark: {order.landmark}</span>}
                    </div>

                    <div style={{ background: '#0F172A', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '4px' }}>Items to Deliver:</div>
                      {order.items.map((it, i) => (
                        <div key={i} style={{ fontSize: '0.85rem', color: '#E2E8F0' }}>
                          • {it.quantity}x {it.productName}
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid #1E293B', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                        <span style={{ color: '#94A3B8' }}>Collect COD:</span>
                        <span style={{ color: '#34D399' }}>Rs. {order.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rider Workflow Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {order.status !== 'PICKED_UP' && order.status !== 'ON_THE_WAY' && order.status !== 'DELIVERED' && (
                      <button
                        onClick={() => updateStatus(order.id, 'PICKED_UP')}
                        style={{
                          padding: '10px',
                          background: '#F59E0B',
                          color: '#0F172A',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        📦 Picked Up from Kitchen
                      </button>
                    )}

                    {order.status !== 'ON_THE_WAY' && order.status !== 'DELIVERED' && (
                      <button
                        onClick={() => updateStatus(order.id, 'ON_THE_WAY')}
                        style={{
                          padding: '10px',
                          background: '#8B5CF6',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        🛵 On The Way
                      </button>
                    )}

                    {order.status === 'ON_THE_WAY' && (
                      <button
                        onClick={() => simulateLiveGPS(order)}
                        style={{
                          padding: '10px',
                          background: isSimulating ? '#DC2626' : '#2563EB',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          gridColumn: '1 / -1',
                        }}
                      >
                        {isSimulating ? '📡 Broadcasting Live GPS...' : '📍 Broadcast Live GPS to Customer Map'}
                      </button>
                    )}

                    {order.status !== 'DELIVERED' && (
                      <button
                        onClick={() => updateStatus(order.id, 'DELIVERED')}
                        style={{
                          padding: '10px',
                          background: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          gridColumn: order.status === 'ON_THE_WAY' ? '1 / -1' : 'auto',
                        }}
                      >
                        ✅ Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
