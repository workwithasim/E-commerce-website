import React, { useState, useEffect } from 'react';
import { api, socket } from '../api';
import { Product, Category, Order, AnalyticsStats, Branch, Rider } from '../types';
import { AuthUser } from '../LoginPage';
import { useTenant } from '../theme/ThemeProvider';
import { StaffManagement } from './StaffManagement';
import { RiderManagement } from './RiderManagement';
import { AuditViewer } from './AuditViewer';

interface AdminDashboardProps {
  onBackToStore?: () => void;
  onLogout?: () => void;
  authUser?: AuthUser;
  kitchenOnly?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToStore,
  onLogout,
  authUser,
}) => {
  const { tenant, branding, settings, refreshTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'orders' | 'staff' | 'riders' | 'products' | 'branding' | 'branches' | 'analytics' | 'audit'>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [orderFilter, setOrderFilter] = useState<string>('ALL');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [codReceived, setCodReceived] = useState('');
  const [codReason, setCodReason] = useState('');
  const can = (permission: string) => Boolean(authUser?.permissions?.includes(permission) || authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'TENANT_ADMIN');

  // Branding Editor state
  const [brandForm, setBrandForm] = useState({
    primaryColor: branding?.primaryColor || '#D80032',
    secondaryColor: branding?.secondaryColor || '#FFE600',
    logo: branding?.logo || '',
    buttonRadius: branding?.buttonRadius || '8px',
    cardRadius: branding?.cardRadius || '14px',
  });
  const [savingBranding, setSavingBranding] = useState(false);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    basePrice: 500,
    categoryId: '',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
    isBestSeller: false,
    isDeal: false,
  });

  useEffect(() => {
    if (branding) {
      setBrandForm({
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        logo: branding.logo,
        buttonRadius: branding.buttonRadius || '8px',
        cardRadius: branding.cardRadius || '14px',
      });
    }
  }, [branding]);

  const loadData = async () => {
    try {
      const [ord, prod, cat, br, st] = await Promise.all([
        api.getOrders(),
        api.getProducts(),
        api.getCategories(),
        api.getBranches(),
        api.getStats().catch(() => null),
      ]);
      setOrders(ord);
      setProducts(prod);
      setCategories(cat);
      setBranches(br);
      setStats(st);

      // Load riders if available
      api.getRiders().then(setRiders).catch(() => {});
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useEffect(() => {
    loadData();

    socket.on('connect', loadData);

    socket.on('order:new', (newOrder: Order) => {
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
      api.getStats().then(setStats).catch(() => {});
    });

    socket.on('order:status_updated', (updated: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      api.getStats().then(setStats).catch(() => {});
    });

    return () => {
      socket.off('connect', loadData);
      socket.off('order:new');
      socket.off('order:status_updated');
    };
  }, [tenant?.id]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const updated = await api.updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const openOrderDetail = async (id: string) => {
    const [detail, messages, internalNotes] = await Promise.all([api.getAdminOrderDetail(id), api.getOrderMessages(id), api.getInternalNotes(id)]);
    setOrderDetail({ ...detail, messages, internalNotes });
  };

  const handleAssignRider = async () => {
    if (!assigningOrder || !selectedRiderId) return;
    try {
      await api.assignRider(assigningOrder.id, selectedRiderId);
      alert('Rider successfully assigned!');
      setAssigningOrder(null);
      await loadData();
    } catch (err: any) {
      alert(`Assignment failed: ${err.message}`);
    }
  };

  const handleToggleStock = async (product: Product) => {
    try {
      const updated = await api.updateProduct(product.id, {
        isAvailable: !product.isAvailable,
      });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err: any) {
      alert(`Stock toggle failed: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to remove this product?')) return;
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createProduct({
        name: newProduct.name,
        description: newProduct.description,
        basePrice: Number(newProduct.basePrice),
        categoryId: newProduct.categoryId || (categories[0]?.id ?? null),
        image: newProduct.image,
        isBestSeller: newProduct.isBestSeller,
        isDeal: newProduct.isDeal,
      });
      setProducts((prev) => [created, ...prev]);
      setShowAddProductModal(false);
      setNewProduct({
        name: '',
        description: '',
        basePrice: 500,
        categoryId: categories[0]?.id || '',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
        isBestSeller: false,
        isDeal: false,
      });
    } catch (err: any) {
      alert(`Failed to add product: ${err.message}`);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSavingBranding(true);
    try {
      await api.updateBranding(tenant.id, brandForm);
      await refreshTenant();
      alert('🎨 Restaurant branding updated successfully!');
    } catch (err: any) {
      alert(`Branding update failed: ${err.message}`);
    } finally {
      setSavingBranding(false);
    }
  };

  const handleToggleBranch = async (id: string) => {
    try {
      const updated = await api.toggleBranch(id);
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      alert(`Branch toggle failed: ${err.message}`);
    }
  };

  const filteredOrders =
    orderFilter === 'ALL' ? orders : orders.filter((o) => o.status === orderFilter);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', color: '#1E293B', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Navbar */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={branding?.logo || 'https://images.deliveryhero.io/image/fd-pk/LH/w3ws-listing.jpg'}
            alt={tenant?.name}
            style={{ height: '36px', borderRadius: '6px', objectFit: 'contain' }}
          />
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--color-primary, #E32726)' }}>
              {tenant?.name || 'Restaurant'} Admin Portal
            </h1>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Multi-Tenant Management Console • Logged in as {authUser?.name || 'Admin'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
          {[
            { id: 'orders', label: `📦 Orders (${orders.length})` },
            ...(can('staff.view') ? [{ id: 'staff', label: '👥 Staff' }] : []),
            ...(can('riders.view') ? [{ id: 'riders', label: `🛵 Riders (${riders.length})` }] : []),
            ...(can('menu.manage') ? [{ id: 'products', label: `🍔 Menu (${products.length})` }] : []),
            ...(can('settings.manage') ? [{ id: 'branding', label: `🎨 Visual Branding` }] : []),
            ...(can('branches.view') ? [{ id: 'branches', label: `📍 Branches (${branches.length})` }] : []),
            ...(can('reports.view') ? [{ id: 'analytics', label: `📊 Revenue Stats` }] : []),
            ...(can('audit.view') ? [{ id: 'audit', label: '🧾 Audit Logs' }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-primary, #E32726)' : '#64748B',
                boxShadow: activeTab === tab.id ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onBackToStore && (
            <button
              onClick={onBackToStore}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#F1F5F9',
                color: '#334155',
                border: '1px solid #CBD5E1',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              ← Customer View
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#FEE2E2',
                color: '#DC2626',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 24px' }}>
        {activeTab === 'staff' && can('staff.view') && <StaffManagement branches={branches} canDisable={can('staff.disable')} />}
        {activeTab === 'riders' && can('riders.view') && <RiderManagement initialRiders={riders} branches={branches} canManage={can('riders.manage')} reload={loadData} />}
        {activeTab === 'audit' && can('audit.view') && <AuditViewer branches={branches} />}
        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'RIDER_ASSIGNED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderFilter(st)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: orderFilter === st ? 'var(--color-primary, #E32726)' : '#FFFFFF',
                      color: orderFilter === st ? '#FFFFFF' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                Total Orders: <strong>{filteredOrders.length}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    padding: '18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0F172A' }}>
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
                            ? '#DCFCE7'
                            : order.status === 'PREPARING'
                            ? '#FEF3C7'
                            : '#FEE2E2',
                        color:
                          order.status === 'DELIVERED'
                            ? '#15803D'
                            : order.status === 'PREPARING'
                            ? '#B45309'
                            : '#B91C1C',
                      }}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '12px' }}>
                    Customer: <strong style={{ color: '#0F172A' }}>{order.customerName}</strong> ({order.customerPhone})
                    <br />
                    Address: {order.deliveryAddress || 'Takeaway'}
                  </div>

                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px', marginBottom: '12px' }}>
                    {order.items.map((it, idx) => (
                      <div key={idx} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          {it.quantity}x {it.productName}
                        </span>
                        <span style={{ fontWeight: 600 }}>{settings?.currencySymbol} {it.totalPrice || it.unitPrice * it.quantity}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                      <span>Total</span>
                      <span style={{ color: 'var(--color-primary, #E32726)' }}>{settings?.currencySymbol} {order.total}</span>
                    </div>
                  </div>

                  {/* Rider Assignment Info */}
                  {order.delivery?.rider && (
                    <div style={{ backgroundColor: '#EFF6FF', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', color: '#1D4ED8', marginBottom: '10px' }}>
                      🛵 Assigned Rider: <strong>{order.delivery.rider.user.name}</strong> ({order.delivery.rider.vehicleType})
                    </div>
                  )}

                  {/* Order Controls */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {can('orders.internal_view') && <button onClick={async () => { try { await openOrderDetail(order.id); } catch (err: any) { alert(err.message); } }} style={{ padding: '6px 10px', borderRadius: '6px', background: '#E2E8F0', border: 'none', fontWeight: 700, fontSize: '0.75rem' }}>Full details</button>}
                    <button
                      disabled={!['PENDING', 'CONFIRMED'].includes(order.status)} onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#FEF3C7', color: '#B45309', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Baking
                    </button>
                    <button
                      disabled={order.status !== 'PREPARING'} onClick={() => handleUpdateStatus(order.id, 'READY')}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#DCFCE7', color: '#15803D', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Ready
                    </button>
                    <button
                      onClick={() => {
                        if (order.status !== 'READY' || order.orderMode !== 'DELIVERY') return;
                        setAssigningOrder(order);
                        setSelectedRiderId(riders[0]?.id || '');
                      }}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#DBEAFE', color: '#1D4ED8', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Assign Rider
                    </button>
                    <button
                      disabled={order.status !== 'READY' || order.orderMode === 'DELIVERY'} onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#0F172A', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Delivered
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS (MENU BUILDER) */}
        {activeTab === 'products' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Restaurant Menu Catalog</h2>
                <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Manage base prices, stock availability, and option customizers</span>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                style={{
                  backgroundColor: 'var(--color-primary, #E32726)',
                  color: '#FFFFFF',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                + Add New Product
              </button>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '12px 16px' }}>Item</th>
                    <th style={{ padding: '12px 16px' }}>Category</th>
                    <th style={{ padding: '12px 16px' }}>Price</th>
                    <th style={{ padding: '12px 16px' }}>Customizer Groups</th>
                    <th style={{ padding: '12px 16px' }}>In Stock</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={p.image} alt={p.name} style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
                          <div>
                            <div>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 400 }}>{p.description?.slice(0, 50)}...</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748B' }}>{p.category?.name || 'Uncategorized'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary, #E32726)' }}>
                        {settings?.currencySymbol} {p.basePrice ?? p.price}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {p.optionGroups && p.optionGroups.length > 0 ? (
                          <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {p.optionGroups.map((g) => g.name).join(', ')}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Standard Item</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => handleToggleStock(p)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            backgroundColor: p.isAvailable ? '#DCFCE7' : '#FEE2E2',
                            color: p.isAvailable ? '#15803D' : '#DC2626',
                          }}
                        >
                          {p.isAvailable ? '✓ In Stock' : '✕ Out of Stock'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          style={{ padding: '4px 8px', borderRadius: '4px', background: '#FEE2E2', color: '#DC2626', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
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

        {/* TAB 3: VISUAL BRANDING EDITOR */}
        {activeTab === 'branding' && (
          <div style={{ maxWidth: '700px', margin: '0 auto', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-primary, #E32726)', margin: '0 0 8px' }}>
              🎨 Visual Branding & Design System
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '24px' }}>
              Change brand colors, logo, and theme tokens dynamically without modifying any code.
            </p>

            <form onSubmit={handleSaveBranding}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Primary Brand Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={brandForm.primaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                      style={{ width: '44px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={brandForm.primaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Secondary Accent Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={brandForm.secondaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, secondaryColor: e.target.value })}
                      style={{ width: '44px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={brandForm.secondaryColor}
                      onChange={(e) => setBrandForm({ ...brandForm, secondaryColor: e.target.value })}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Logo Image URL</label>
                <input
                  type="text"
                  value={brandForm.logo}
                  onChange={(e) => setBrandForm({ ...brandForm, logo: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Live Preview Box */}
              <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px dashed #CBD5E1', marginBottom: '24px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Live UI Component Preview:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
                  <button
                    type="button"
                    style={{
                      backgroundColor: brandForm.primaryColor,
                      color: '#FFFFFF',
                      padding: '10px 18px',
                      borderRadius: brandForm.buttonRadius,
                      border: 'none',
                      fontWeight: 800,
                    }}
                  >
                    Primary Button
                  </button>
                  <button
                    type="button"
                    style={{
                      backgroundColor: brandForm.secondaryColor,
                      color: '#0F172A',
                      padding: '10px 18px',
                      borderRadius: brandForm.buttonRadius,
                      border: 'none',
                      fontWeight: 800,
                    }}
                  >
                    Accent Button
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingBranding}
                style={{
                  width: '100%',
                  padding: '13px',
                  backgroundColor: 'var(--color-primary, #E32726)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  border: 'none',
                  cursor: savingBranding ? 'not-allowed' : 'pointer',
                }}
              >
                {savingBranding ? 'Saving...' : 'Save & Publish Branding Changes'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: BRANCHES */}
        {activeTab === 'branches' && (
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Branch Locations & Operations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {branches.map((b) => (
                <div key={b.id} style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem' }}>{b.name}</span>
                    <button
                      onClick={() => handleToggleBranch(b.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        backgroundColor: b.isOpen ? '#DCFCE7' : '#FEE2E2',
                        color: b.isOpen ? '#15803D' : '#DC2626',
                      }}
                    >
                      {b.isOpen ? 'Open' : 'Closed'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '6px' }}>📍 {b.address}, {b.city}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748B' }}>📞 {b.phone}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Business Metrics & Sales Summary</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>TOTAL REVENUE</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--color-primary, #E32726)', marginTop: '4px' }}>
                  {settings?.currencySymbol} {stats?.totalRevenue?.toLocaleString() ?? 0}
                </div>
              </div>
              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>TOTAL ORDERS</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                  {stats?.totalOrders ?? orders.length}
                </div>
              </div>
              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>DELIVERED ORDERS</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#16A34A', marginTop: '4px' }}>
                  {stats?.deliveredOrders ?? 0}
                </div>
              </div>
              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>ACTIVE RIDERS</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#2563EB', marginTop: '4px' }}>
                  {riders.filter((r) => r.isAvailable).length}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {orderDetail && <div role="dialog" aria-modal="true" aria-label={`Order ${orderDetail.orderNumber} details`} onClick={() => setOrderDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,.75)', padding: 24, overflow: 'auto' }}>
        <article onClick={event => event.stopPropagation()} style={{ maxWidth: 1000, margin: '0 auto', background: '#fff', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><div><h2 style={{ margin: 0 }}>Order #{orderDetail.orderNumber}</h2><p>{orderDetail.branch?.name || 'No branch'} · {new Date(orderDetail.createdAt).toLocaleString()}</p></div><button aria-label="Close order details" onClick={() => setOrderDetail(null)}>✕</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
            <section className="tracking-card"><h3>Customer</h3><p>{orderDetail.customer?.name || orderDetail.customerName}</p><p>{orderDetail.customer?.email || 'No email'} · {orderDetail.customerPhone}</p><p>{orderDetail.deliveryAddress || 'Pickup'} {orderDetail.landmark || ''}</p><p>{orderDetail.previousOrderCount} previous orders</p></section>
            <section className="tracking-card"><h3>Financial</h3><p>Subtotal: {orderDetail.financial.currency} {orderDetail.financial.subtotal}</p><p>Discount: {orderDetail.financial.discount} · Tax: {orderDetail.financial.tax} · Delivery: {orderDetail.financial.deliveryFee}</p><p><strong>Total: {orderDetail.financial.currency} {orderDetail.financial.total}</strong></p><p>{orderDetail.paymentMethod} · {orderDetail.paymentStatus} · Outstanding {orderDetail.financial.outstandingAmount}</p></section>
            <section className="tracking-card"><h3>Kitchen</h3><p>Received: {new Date(orderDetail.kitchen.receivedAt).toLocaleString()}</p><p>Started: {orderDetail.kitchen.preparationStarted ? `${new Date(orderDetail.kitchen.preparationStarted.timestamp).toLocaleString()} by ${orderDetail.kitchen.preparationStarted.actor?.name || 'Unknown'}` : 'Not started'}</p><p>Ready: {orderDetail.kitchen.ready ? `${new Date(orderDetail.kitchen.ready.timestamp).toLocaleString()} by ${orderDetail.kitchen.ready.actor?.name || 'Unknown'}` : 'Not ready'}</p><p>Preparation: {orderDetail.kitchen.preparationDurationMs == null ? 'Unavailable' : `${Math.round(orderDetail.kitchen.preparationDurationMs / 60000)} minutes`}</p></section>
            <section className="tracking-card"><h3>Delivery</h3>{orderDetail.deliveryDetail ? <><p>{orderDetail.deliveryDetail.rider?.user?.name || 'Unassigned'} · {orderDetail.deliveryDetail.status}</p><p>Assigned: {orderDetail.deliveryDetail.assignedAt ? new Date(orderDetail.deliveryDetail.assignedAt).toLocaleString() : '—'}</p><p>Accepted: {orderDetail.deliveryDetail.acceptedAt ? new Date(orderDetail.deliveryDetail.acceptedAt).toLocaleString() : '—'}</p><p>Picked up: {orderDetail.deliveryDetail.pickedUpAt ? new Date(orderDetail.deliveryDetail.pickedUpAt).toLocaleString() : '—'}</p><p>Delivered: {orderDetail.deliveryDetail.deliveredAt ? new Date(orderDetail.deliveryDetail.deliveredAt).toLocaleString() : '—'}</p></> : <p>Pickup order</p>}</section>
            {orderDetail.codRecord && <section className="tracking-card"><h3>COD accountability</h3><p><strong>{orderDetail.codRecord.status.replace(/_/g, ' ')}</strong></p><p>Expected: {orderDetail.financial.currency} {orderDetail.codRecord.expectedAmount}</p><p>Collected: {orderDetail.codRecord.collectedAmount ?? '—'} by {orderDetail.codRecord.collectedBy?.name || '—'}</p><p>Restaurant received: {orderDetail.codRecord.receivedAmount ?? '—'} by {orderDetail.codRecord.receivedBy?.name || '—'}</p>{orderDetail.codRecord.differenceAmount != null && <p>Difference: {orderDetail.codRecord.differenceAmount}</p>}{orderDetail.codRecord.disputeReason && <p>Dispute: {orderDetail.codRecord.disputeReason}</p>}{can('payments.manage') && orderDetail.codRecord.status === 'PENDING_COLLECTION' && ['READY', 'DELIVERED'].includes(orderDetail.status) && <button onClick={async () => { await api.collectCod(orderDetail.id, orderDetail.codRecord.expectedAmount); await openOrderDetail(orderDetail.id); }}>Record counter COD and settle</button>}{can('payments.manage') && orderDetail.codRecord.status !== 'PENDING_COLLECTION' && orderDetail.codRecord.status !== 'SETTLED' && <div><input aria-label="COD amount received by restaurant" type="number" min="0" step="0.01" placeholder={String(orderDetail.codRecord.collectedAmount ?? orderDetail.codRecord.expectedAmount)} value={codReceived} onChange={event => setCodReceived(event.target.value)}/><input aria-label="COD dispute reason" placeholder="Required only for dispute" value={codReason} onChange={event => setCodReason(event.target.value)}/><div className="store-controls"><button onClick={async () => { await api.updateCodSettlement(orderDetail.id, { status: 'PENDING_SETTLEMENT', receivedAmount: Number(codReceived || orderDetail.codRecord.collectedAmount) }); await openOrderDetail(orderDetail.id); }}>Pending settlement</button><button onClick={async () => { await api.updateCodSettlement(orderDetail.id, { status: 'SETTLED', receivedAmount: Number(codReceived || orderDetail.codRecord.collectedAmount) }); await openOrderDetail(orderDetail.id); }}>Mark settled</button><button disabled={!codReason.trim()} onClick={async () => { await api.updateCodSettlement(orderDetail.id, { status: 'DISPUTED', receivedAmount: Number(codReceived || orderDetail.codRecord.collectedAmount), reason: codReason }); await openOrderDetail(orderDetail.id); }}>Dispute</button></div></div>}</section>}
          </div>
          <section className="tracking-card"><h3>Items</h3>{orderDetail.items.map((item: any) => <p key={item.id}>{item.quantity} × {item.productName} — {orderDetail.financial.currency} {item.totalPrice}{item.instructions ? ` · ${item.instructions}` : ''}</p>)}</section>
          <section className="tracking-card"><h3>Complete timeline</h3><ol>{orderDetail.timeline.map((event: any) => <li key={`${event.type}-${event.id}`}><strong>{event.action.replace(/_/g, ' ')}</strong> · {new Date(event.timestamp).toLocaleString()} · {event.actor?.name || 'System'}{event.actor?.role ? ` (${event.actor.role.replace(/_/g, ' ')})` : ''}</li>)}</ol></section>
          <section className="tracking-card"><h3>Order conversation</h3>{orderDetail.messages.map((message: any) => <p key={message.id}><strong>{message.type === 'SYSTEM' ? 'System' : message.sender?.name || message.senderRole}:</strong> {message.message}</p>)}<form onSubmit={async event => { event.preventDefault(); if (!chatMessage.trim()) return; await api.sendOrderMessage(orderDetail.id, chatMessage); setChatMessage(''); await openOrderDetail(orderDetail.id); }}><input aria-label="Order message" value={chatMessage} onChange={event => setChatMessage(event.target.value)} maxLength={2000}/><button>Send</button></form></section>
          <section className="tracking-card"><h3>Internal notes</h3><p>Never returned by customer order APIs.</p>{orderDetail.internalNotes.map((note: any) => <p key={note.id}><strong>{note.author.name}:</strong> {note.note} · {new Date(note.createdAt).toLocaleString()}</p>)}<form onSubmit={async event => { event.preventDefault(); if (!internalNote.trim()) return; await api.addInternalNote(orderDetail.id, internalNote); setInternalNote(''); await openOrderDetail(orderDetail.id); }}><input aria-label="Internal order note" value={internalNote} onChange={event => setInternalNote(event.target.value)} maxLength={2000}/><button>Add note</button></form></section>
        </article>
      </div>}

      {/* Assign Rider Modal */}
      {assigningOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem', fontWeight: 800 }}>
              Assign Rider to #{assigningOrder.orderNumber}
            </h3>
            <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '16px' }}>
              Select an available delivery rider for dispatch:
            </p>

            <select
              value={selectedRiderId}
              onChange={(e) => setSelectedRiderId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', marginBottom: '20px' }}
            >
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.user.name} ({r.vehicleType} • {r.status})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setAssigningOrder(null)}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignRider}
                style={{ flex: 1, padding: '10px', background: 'var(--color-primary, #E32726)', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '14px', maxWidth: '500px', width: '100%' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '1.2rem', fontWeight: 800 }}>Add New Menu Item</h3>
            <form onSubmit={handleAddProduct}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Product Title</label>
                <input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="e.g. Special Platter"
                  required
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Base Price ({settings?.currencySymbol})</label>
                  <input
                    type="number"
                    value={newProduct.basePrice}
                    onChange={(e) => setNewProduct({ ...newProduct, basePrice: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Category</label>
                  <select
                    value={newProduct.categoryId}
                    onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Image URL</label>
                <input
                  value={newProduct.image}
                  onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', background: 'var(--color-primary, #E32726)', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
