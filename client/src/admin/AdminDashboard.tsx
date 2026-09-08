import React, { useState, useEffect } from 'react';
import { api, socket } from '../api';
import { Product, Category, Order, AnalyticsStats } from '../types';
import { AuthUser } from '../LoginPage';

interface AdminDashboardProps {
  onBackToStore?: () => void;
  onLogout?: () => void;
  authUser?: AuthUser;
  kitchenOnly?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToStore, onLogout, authUser, kitchenOnly }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'analytics'>(kitchenOnly ? 'orders' : 'orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [orderFilter, setOrderFilter] = useState<string>('ALL');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 1200,
    categoryId: '',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
    isBestSeller: false,
    isDeal: false,
  });

  useEffect(() => {
    loadData();

    // Connect to Kitchen Room via Socket.io
    socket.emit('join:kitchen');

    // Real-time listener for incoming orders
    socket.on('order:new', (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev]);
      setNewOrderAlert(`🔔 NEW ORDER RECEIVED: #${newOrder.orderNumber} by ${newOrder.customerName} (Rs. ${newOrder.total})`);
      playBeep();
      setTimeout(() => setNewOrderAlert(null), 8000);
      loadStats();
    });

    socket.on('order:status_updated', (updated: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      loadStats();
    });

    return () => {
      socket.off('order:new');
      socket.off('order:status_updated');
    };
  }, []);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.log('AudioContext not allowed without interaction');
    }
  };

  const loadData = async () => {
    await Promise.all([loadOrders(), loadProducts(), loadCategories(), loadStats()]);
  };

  const loadOrders = async () => {
    const data = await api.getOrders(orderFilter);
    setOrders(data);
  };

  const loadProducts = async () => {
    const data = await api.getProducts();
    setProducts(data);
  };

  const loadCategories = async () => {
    const data = await api.getCategories();
    setCategories(data);
    if (data.length && !newProduct.categoryId) {
      setNewProduct((p) => ({ ...p, categoryId: data[0].id }));
    }
  };

  const loadStats = async () => {
    const data = await api.getStats();
    setStats(data);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) {
      alert('Name and price are required');
      return;
    }

    try {
      await api.createProduct(newProduct);
      setShowAddProductModal(false);
      setNewProduct({
        name: '',
        description: '',
        price: 1200,
        categoryId: categories[0]?.id || '',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
        isBestSeller: false,
        isDeal: false,
      });
      await loadProducts();
      alert('Product created dynamically in PostgreSQL database!');
    } catch (err) {
      alert('Failed to create product');
    }
  };

  const handleToggleStock = async (product: Product) => {
    try {
      await api.updateProduct(product.id, { inStock: !product.inStock });
      await loadProducts();
    } catch (err) {
      alert('Failed to toggle stock');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteProduct(id);
      await loadProducts();
    } catch (err) {
      alert('Failed to delete product');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', color: '#F8FAFC', paddingBottom: '60px' }}>
      {/* Top Bar */}
      <header style={{ background: '#1E293B', padding: '16px 32px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/assets/cheezious.svg" alt="Cheezious Logo" style={{ height: '36px', filter: 'brightness(0) invert(1)' }} />
          <span style={{ background: '#F15B25', color: '#fff', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '9999px', textTransform: 'uppercase' }}>
            Live Kitchen & Admin Portal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBackToStore}
            style={{ background: '#334155', color: '#F8FAFC', padding: '8px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem' }}
          >
            ← View Customer Storefront
          </button>
        </div>
      </header>

      {/* Live Order Alert Banner */}
      {newOrderAlert && (
        <div style={{ background: '#10B981', color: '#fff', padding: '14px 24px', textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', boxShadow: '0 4px 14px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <span>{newOrderAlert}</span>
        </div>
      )}

      {/* Main Container */}
      <div style={{ maxWidth: '1360px', margin: '24px auto', padding: '0 24px' }}>
        
        {/* Analytics Top Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>Today's Total Revenue</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981', marginTop: '6px' }}>Rs. {stats.totalRevenue.toLocaleString('en-PK')}</div>
            </div>
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Orders</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F8FAFC', marginTop: '6px' }}>{stats.totalOrders}</div>
            </div>
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>Active in Kitchen</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F15B25', marginTop: '6px' }}>{stats.kitchenOrders}</div>
            </div>
            <div style={{ background: '#1E293B', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>Delivered Orders</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38BDF8', marginTop: '6px' }}>{stats.deliveredOrders}</div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '10px 22px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '0.92rem',
              background: activeTab === 'orders' ? '#F15B25' : '#1E293B',
              color: activeTab === 'orders' ? '#FFFFFF' : '#94A3B8',
            }}
          >
            🔥 Kitchen Display & Orders ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('products')}
            style={{
              padding: '10px 22px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '0.92rem',
              background: activeTab === 'products' ? '#F15B25' : '#1E293B',
              color: activeTab === 'products' ? '#FFFFFF' : '#94A3B8',
            }}
          >
            🍕 Product Catalog ({products.length})
          </button>
        </div>

        {/* TAB 1: KITCHEN DISPLAY & ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Live Orders (Kitchen Feed)</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['ALL', 'PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => { setOrderFilter(st); api.getOrders(st).then(setOrders); }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: orderFilter === st ? '#F15B25' : '#1E293B',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {orders.length === 0 ? (
              <div style={{ background: '#1E293B', padding: '60px', borderRadius: '16px', textAlign: 'center', color: '#94A3B8' }}>
                <h3>No orders in this queue.</h3>
                <p>New customer orders will pop up here live via WebSockets!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
                {orders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      background: '#1E293B',
                      borderRadius: '14px',
                      padding: '20px',
                      border: order.status === 'PENDING' ? '2px solid #F15B25' : '1px solid #334155',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F15B25' }}>{order.orderNumber}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{new Date(order.createdAt).toLocaleTimeString()}</div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          background:
                            order.status === 'PENDING'
                              ? '#F59E0B'
                              : order.status === 'PREPARING'
                              ? '#F15B25'
                              : order.status === 'ON_THE_WAY'
                              ? '#38BDF8'
                              : '#10B981',
                          color: '#fff',
                        }}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', marginBottom: '10px' }}>
                      <strong>{order.customerName}</strong> • {order.customerPhone}
                      <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>📍 {order.deliveryAddress || 'Pick Up'}</div>
                    </div>

                    {/* Order Items List */}
                    <div style={{ background: '#0F172A', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
                      {order.items.map((item, idx) => (
                        <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                          <strong>{item.quantity}x</strong> {item.productName}
                          <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                            {[item.size, item.crust, item.flavor, item.drink, item.addons].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Total:</span>
                        <span style={{ color: '#10B981' }}>Rs. {order.total.toLocaleString('en-PK')} ({order.paymentMethod})</span>
                      </div>
                    </div>

                    {/* Action Buttons for Kitchen Status Progression */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'PREPARING')}
                          style={{ gridColumn: 'span 2', background: '#F15B25', color: '#fff', padding: '10px', borderRadius: '8px', fontWeight: 700 }}
                        >
                          👨‍🍳 Accept & Start Baking
                        </button>
                      )}
                      {order.status === 'PREPARING' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'ON_THE_WAY')}
                          style={{ gridColumn: 'span 2', background: '#38BDF8', color: '#0F172A', padding: '10px', borderRadius: '8px', fontWeight: 700 }}
                        >
                          🛵 Rider Dispatched
                        </button>
                      )}
                      {order.status === 'ON_THE_WAY' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'DELIVERED')}
                          style={{ gridColumn: 'span 2', background: '#10B981', color: '#fff', padding: '10px', borderRadius: '8px', fontWeight: 700 }}
                        >
                          ✓ Mark Delivered
                        </button>
                      )}
                      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                          style={{ gridColumn: 'span 2', background: '#334155', color: '#EF4444', padding: '6px', borderRadius: '8px', fontSize: '0.78rem', marginTop: '4px' }}
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRODUCT CATALOG (110% DYNAMIC CRUD) */}
        {activeTab === 'products' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Product Catalog ({products.length} Items)</h2>
                <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>All items stored dynamically in PostgreSQL database.</p>
              </div>

              <button
                onClick={() => setShowAddProductModal(true)}
                style={{ background: '#F15B25', color: '#fff', padding: '12px 24px', borderRadius: '9999px', fontWeight: 700, fontSize: '0.92rem' }}
              >
                + Add New Product
              </button>
            </div>

            {/* Products Table */}
            <div style={{ background: '#1E293B', borderRadius: '14px', overflow: 'hidden', border: '1px solid #334155' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                    <th style={{ padding: '14px 18px' }}>Product</th>
                    <th style={{ padding: '14px 18px' }}>Category</th>
                    <th style={{ padding: '14px 18px' }}>Price (PKR)</th>
                    <th style={{ padding: '14px 18px' }}>Stock Status</th>
                    <th style={{ padding: '14px 18px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={p.image} alt={p.name} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <strong>{p.name}</strong>
                          {p.isBestSeller && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#F59E0B' }}>★ BestSeller</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', color: '#94A3B8' }}>{p.category?.name || 'General'}</td>
                      <td style={{ padding: '12px 18px', fontWeight: 700, color: '#10B981' }}>Rs. {p.price.toLocaleString('en-PK')}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <button
                          onClick={() => handleToggleStock(p)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: p.inStock ? '#065F46' : '#991B1B',
                            color: '#fff',
                          }}
                        >
                          {p.inStock ? 'In Stock' : 'Out of Stock'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          style={{ background: '#334155', color: '#EF4444', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* MODAL: ADD PRODUCT DYNAMICALLY */}
      {showAddProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1E293B', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '520px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>Add New Product to Database</h3>
            
            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Product Name *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="e.g. Royal Crown Crust Pizza"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0F172A', border: '1px solid #334155', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Ingredients and toppings..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0F172A', border: '1px solid #334155', color: '#fff', height: '60px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Price (PKR) *</label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0F172A', border: '1px solid #334155', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Category</label>
                  <select
                    value={newProduct.categoryId}
                    onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0F172A', border: '1px solid #334155', color: '#fff' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Image URL</label>
                <input
                  type="url"
                  value={newProduct.image}
                  onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0F172A', border: '1px solid #334155', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '20px', margin: '4px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={newProduct.isBestSeller}
                    onChange={(e) => setNewProduct({ ...newProduct, isBestSeller: e.target.checked })}
                  />
                  Mark as BestSeller
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={newProduct.isDeal}
                    onChange={(e) => setNewProduct({ ...newProduct, isDeal: e.target.checked })}
                  />
                  Mark as Special Deal
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', background: '#334155', color: '#fff' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 22px', borderRadius: '8px', background: '#F15B25', color: '#fff', fontWeight: 700 }}
                >
                  Save to PostgreSQL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
