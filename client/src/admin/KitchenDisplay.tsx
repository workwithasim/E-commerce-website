import React, { useState, useEffect } from 'react';
import { api, socket } from '../api';
import { Order } from '../types';
import { useTenant } from '../theme/ThemeProvider';

export const KitchenDisplay: React.FC<{ onLogout?: () => void; onClose?: () => void }> = ({
  onLogout,
  onClose,
}) => {
  const { tenant } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLane, setActiveLane] = useState<'ACTIVE' | 'READY' | 'ALL'>('ACTIVE');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // audio silent catch
    }
  };

  const loadKitchenOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKitchenOrders();

    socket.on('connect', loadKitchenOrders);

    socket.on('order:new', (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
      setAlertMessage(`🚨 NEW KITCHEN ORDER: #${newOrder.orderNumber} (${newOrder.items.length} items)`);
      playBeep();
      setTimeout(() => setAlertMessage(null), 8000);
    });

    socket.on('order:status_updated', (updated: any) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id || o.orderNumber === updated.orderNumber ? { ...o, ...updated } : o))
      );
    });

    return () => {
      socket.off('connect', loadKitchenOrders);
      socket.off('order:new');
      socket.off('order:status_updated');
    };
  }, [tenant?.id]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const updated = await api.updateOrderStatus(orderId, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err: any) {
      alert(`Status update error: ${err.message}`);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY' || o.status === 'RIDER_ASSIGNED');

  const displayedOrders =
    activeLane === 'ACTIVE'
      ? orders.filter((o) => ['PENDING', 'PREPARING'].includes(o.status))
      : activeLane === 'READY'
      ? readyOrders
      : orders;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A0E17', color: '#F1F5F9', fontFamily: "'Inter', sans-serif" }}>
      {/* KDS Header */}
      <header
        style={{
          backgroundColor: '#111827',
          borderBottom: '2px solid var(--color-primary, #E32726)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '2rem' }}>👨‍🍳</span>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0, color: 'var(--color-secondary, #FEDC00)' }}>
              {tenant?.name?.toUpperCase() || 'KITCHEN'} DISPLAY SYSTEM (KDS)
            </h1>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
              Real-time Order Queue with Audio Beep Notifications
            </span>
          </div>
        </div>

        {/* Lane Selector */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveLane('ACTIVE')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: activeLane === 'ACTIVE' ? 'var(--color-primary, #E32726)' : '#1F2937',
              color: '#FFFFFF',
              border: 'none',
            }}
          >
            🔥 Active Cooking ({pendingOrders.length + preparingOrders.length})
          </button>
          <button
            onClick={() => setActiveLane('READY')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: activeLane === 'READY' ? '#10B981' : '#1F2937',
              color: '#FFFFFF',
              border: 'none',
            }}
          >
            ✅ Ready for Dispatch ({readyOrders.length})
          </button>
          <button
            onClick={() => setActiveLane('ALL')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: activeLane === 'ALL' ? '#3B82F6' : '#1F2937',
              color: '#FFFFFF',
              border: 'none',
            }}
          >
            All Orders ({orders.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: '#1F2937',
                color: '#CBD5E1',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #374151',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Portal
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: '#374151',
                color: '#F87171',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Audio alert banner */}
      {alertMessage && (
        <div
          style={{
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            padding: '14px 24px',
            fontWeight: 800,
            fontSize: '1rem',
            textAlign: 'center',
            animation: 'pulse 1s infinite',
          }}
        >
          {alertMessage}
        </div>
      )}

      {/* Order Grid */}
      <main style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>Loading Kitchen Queue...</div>
        ) : displayedOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748B' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍽️</div>
            <h3 style={{ fontSize: '1.2rem', color: '#94A3B8', margin: 0 }}>No orders currently in this kitchen lane</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '6px' }}>
              When customers place orders, tickets will pop up automatically with sound alerts.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '20px',
            }}
          >
            {displayedOrders.map((order) => {
              const isPending = order.status === 'PENDING';
              const isPreparing = order.status === 'PREPARING';
              const isReady = order.status === 'READY' || order.status === 'RIDER_ASSIGNED';

              const cardBorder = isPending
                ? '3px solid #EF4444'
                : isPreparing
                ? '3px solid var(--color-secondary, #FEDC00)'
                : isReady
                ? '3px solid #10B981'
                : '1px solid #1F2937';

              return (
                <div
                  key={order.id}
                  style={{
                    backgroundColor: '#111827',
                    borderRadius: '16px',
                    border: cardBorder,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  <div>
                    {/* Header: Order Number & Mode */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#F8FAFC' }}>
                        #{order.orderNumber}
                      </span>
                      <span
                        style={{
                          backgroundColor: order.orderMode === 'DELIVERY' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)',
                          color: order.orderMode === 'DELIVERY' ? '#60A5FA' : '#FBBF24',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}
                      >
                        {order.orderMode}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '14px' }}>
                      🕒 {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Customer: <strong style={{ color: '#E2E8F0' }}>{order.customerName}</strong>
                    </div>

                    {/* Items List */}
                    <div style={{ borderTop: '1px solid #1F2937', paddingTop: '12px', marginBottom: '16px' }}>
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '6px 0',
                            borderBottom: '1px dashed #1E293B',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 800, color: 'var(--color-secondary, #FEDC00)', marginRight: '8px', fontSize: '1rem' }}>
                              {item.quantity}x
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F1F5F9' }}>
                              {item.productName}
                            </span>
                            {(item.size || item.variant || item.addons) && (
                              <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>
                                {[item.size, item.variant, item.addons].filter(Boolean).join(' • ')}
                              </div>
                            )}
                            {item.instructions && (
                              <div style={{ fontSize: '0.75rem', color: '#F87171', fontStyle: 'italic', marginTop: '2px' }}>
                                Note: {item.instructions}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#FCA5A5', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                        ⚠️ Order Instructions: {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Kitchen Action Controls */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginTop: '14px' }}>
                    {isPending && (
                      <button
                        onClick={() => updateStatus(order.id, 'PREPARING')}
                        style={{
                          padding: '12px',
                          backgroundColor: 'var(--color-primary, #E32726)',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        👨‍🍳 Accept & Start Cooking
                      </button>
                    )}

                    {isPreparing && (
                      <button
                        onClick={() => updateStatus(order.id, 'READY')}
                        style={{
                          padding: '12px',
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Mark Order Ready
                      </button>
                    )}

                    {isReady && order.orderMode !== 'DELIVERY' && order.status === 'READY' && (
                      <button
                        onClick={() => updateStatus(order.id, 'DELIVERED')}
                        style={{
                          padding: '10px',
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Collected by Customer
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
