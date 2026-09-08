import React, { useState, useEffect } from 'react';
import { api } from './api';
import { Order } from './types';
import { AuthUser } from './LoginPage';

interface RiderDashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

export const RiderDashboard: React.FC<RiderDashboardProps> = ({ user, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'delivered'>('active');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const all = await api.getOrders();
      setOrders(Array.isArray(all) ? all : []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); const t = setInterval(fetchOrders, 15000); return () => clearInterval(t); }, []);

  const updateStatus = async (orderId: string, status: string) => {
    await api.updateOrderStatus(orderId, status);
    fetchOrders();
  };

  const activeOrders = orders.filter(o => ['PREPARING', 'ON_THE_WAY'].includes(o.status));
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  const shown = activeTab === 'active' ? activeOrders : deliveredOrders;

  const statusColor: Record<string, string> = {
    PENDING: '#F59E0B', PREPARING: '#0284C7', ON_THE_WAY: '#8B5CF6', DELIVERED: '#10B981', CANCELLED: '#EF4444',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', fontFamily: "'Inter','Segoe UI',sans-serif", color: '#fff' }}>

      {/* Header */}
      <header style={{ background: '#1a1a1a', borderBottom: '2px solid #FFE600', padding: '0 20px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>🛵</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#FFE600' }}>Rider Dashboard</div>
            <div style={{ fontSize: '0.72rem', color: '#888' }}>Welcome, {user.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700 }}>● ON DUTY</div>
            <div style={{ fontSize: '0.7rem', color: '#666' }}>{user.email}</div>
          </div>
          <button onClick={onLogout} style={{ background: '#E8131E', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '20px', background: '#141414', borderBottom: '1px solid #222' }}>
        {[
          { label: 'Active Deliveries', value: activeOrders.length, color: '#8B5CF6', emoji: '📦' },
          { label: 'On The Way', value: orders.filter(o => o.status === 'ON_THE_WAY').length, color: '#F59E0B', emoji: '🛵' },
          { label: 'Delivered Today', value: deliveredOrders.length, color: '#10B981', emoji: '✅' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '16px', textAlign: 'center', border: `1px solid ${s.color}33` }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{s.emoji}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '16px 20px 0', gap: '8px' }}>
        {(['active', 'delivered'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', borderRadius: '10px 10px 0 0', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.85rem',
            background: activeTab === tab ? '#FFE600' : '#1a1a1a',
            color: activeTab === tab ? '#1a1a1a' : '#888',
          }}>
            {tab === 'active' ? `📦 Active (${activeOrders.length})` : `✅ Delivered (${deliveredOrders.length})`}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div style={{ padding: '0 20px 30px', marginTop: '-1px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>Loading orders...</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛵</div>
            <div style={{ fontWeight: 600 }}>No {activeTab} deliveries right now</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px' }}>
            {shown.map(order => (
              <div key={order.id} style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px', border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#FFE600' }}>{order.orderNumber}</span>
                    <span style={{ marginLeft: '10px', background: `${statusColor[order.status] || '#666'}22`, color: statusColor[order.status] || '#666', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${statusColor[order.status] || '#666'}44` }}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, color: '#10B981', fontSize: '1.1rem' }}>Rs. {order.total?.toLocaleString()}</div>
                </div>

                {/* Customer Info */}
                <div style={{ background: '#111', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px' }}>CUSTOMER</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{order.customerName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px' }}>PHONE</div>
                      <a href={`tel:${order.customerPhone}`} style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFE600', textDecoration: 'none' }}>
                        📞 {order.customerPhone}
                      </a>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px' }}>DELIVERY ADDRESS</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ccc' }}>📍 {order.deliveryAddress || 'Pickup'}</div>
                    </div>
                    {order.landmark && (
                      <div style={{ gridColumn: '1/-1' }}>
                        <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px' }}>LANDMARK</div>
                        <div style={{ fontSize: '0.85rem', color: '#aaa' }}>{order.landmark}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '8px', fontWeight: 700 }}>ORDER ITEMS</div>
                  {order.items?.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #222', fontSize: '0.85rem' }}>
                      <span style={{ color: '#ccc' }}>x{item.quantity} {item.productName}</span>
                      <span style={{ color: '#888' }}>Rs. {(item.unitPrice * item.quantity)?.toLocaleString()}</span>
                    </div>
                  ))}
                  {(order.items?.length || 0) > 3 && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>+{order.items!.length - 3} more items</div>}
                </div>

                {/* Action Buttons */}
                {order.status === 'PREPARING' && (
                  <button onClick={() => updateStatus(order.id, 'ON_THE_WAY')} style={{ width: '100%', padding: '12px', background: '#8B5CF6', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
                    🛵 Picked Up — On The Way!
                  </button>
                )}
                {order.status === 'ON_THE_WAY' && (
                  <button onClick={() => updateStatus(order.id, 'DELIVERED')} style={{ width: '100%', padding: '12px', background: '#10B981', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
                    ✅ Mark as Delivered
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
