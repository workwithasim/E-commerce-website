import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useTenant } from '../theme/ThemeProvider';

export const SuperAdminDashboard: React.FC<{ onLogout: () => void; onClose?: () => void }> = ({
  onLogout,
  onClose,
}) => {
  const { switchTenant } = useTenant();
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New tenant form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    primaryColor: '#D80032',
    secondaryColor: '#FFE600',
    logo: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
    currency: 'PKR',
    branchName: 'Main Boulevard Branch',
    branchCity: 'Islamabad',
    branchAddress: 'Main Commercial Hub, Blue Area',
    branchPhone: '051-111-222-333',
    adminName: 'Restaurant Admin',
    adminEmail: '',
    adminPassword: 'Admin@123',
  });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getSuperAdminStats();
      if (data) {
        setStats(data);
        setTenants((data as any)?.tenants || []);
      }
    } catch (err) {
      console.error('Failed to load superadmin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    try {
      const res = await api.createTenant(formData);
      setMessage(`🎉 Restaurant "${res.name}" successfully created!`);
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B0F19', color: '#F1F5F9', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Navbar */}
      <header
        style={{
          backgroundColor: '#111827',
          borderBottom: '1px solid #1F2937',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>👑</span>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
              Platform Super Admin
            </h1>
            <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              Multi-Tenant Architecture Control Center
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: '#1F2937',
                color: '#E5E7EB',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #374151',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              ← Back to Storefront
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
              color: '#FFFFFF',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            }}
          >
            + Onboard New Restaurant
          </button>
          <button
            onClick={onLogout}
            style={{
              background: '#374151',
              color: '#F87171',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
        {message && (
          <div
            style={{
              backgroundColor: '#1E3A8A',
              color: '#BFDBFE',
              padding: '12px 18px',
              borderRadius: '8px',
              marginBottom: '24px',
              fontWeight: 600,
            }}
          >
            {message}
          </div>
        )}

        {/* Global Platform KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={kpiCardStyle}>
            <span style={{ color: '#9CA3AF', fontSize: '0.85rem', fontWeight: 600 }}>ACTIVE RESTAURANTS</span>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38BDF8', marginTop: '4px' }}>
              {stats?.activeTenants ?? 2}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#10B981' }}>● Shared SaaS Architecture</span>
          </div>

          <div style={kpiCardStyle}>
            <span style={{ color: '#9CA3AF', fontSize: '0.85rem', fontWeight: 600 }}>TOTAL BRANCHES NATIONWIDE</span>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#FBBF24', marginTop: '4px' }}>
              {stats?.totalBranches ?? 64}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Across all tenants</span>
          </div>

          <div style={kpiCardStyle}>
            <span style={{ color: '#9CA3AF', fontSize: '0.85rem', fontWeight: 600 }}>SYSTEM ORDERS PLACED</span>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#A78BFA', marginTop: '4px' }}>
              {stats?.totalOrders ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Real-time processed</span>
          </div>

          <div style={kpiCardStyle}>
            <span style={{ color: '#9CA3AF', fontSize: '0.85rem', fontWeight: 600 }}>PLATFORM GROSS VOLUME</span>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34D399', marginTop: '4px' }}>
              Rs. {stats?.totalPlatformRevenue?.toLocaleString() ?? 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#10B981' }}>authoritative server pricing</span>
          </div>
        </div>

        {/* Tenants Table */}
        <div style={{ backgroundColor: '#111827', borderRadius: '16px', border: '1px solid #1F2937', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Onboarded Restaurant Tenants</h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Each tenant operates with isolated data and dynamic branding from this single platform.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1F2937', color: '#9CA3AF' }}>
                  <th style={{ padding: '12px 16px' }}>Brand / Restaurant</th>
                  <th style={{ padding: '12px 16px' }}>Slug Identifier</th>
                  <th style={{ padding: '12px 16px' }}>Theme Colors</th>
                  <th style={{ padding: '12px 16px' }}>Branches</th>
                  <th style={{ padding: '12px 16px' }}>Catalog Items</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #1F2937' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#F9FAFB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={t.branding?.logo || 'https://images.deliveryhero.io/image/fd-pk/LH/w3ws-listing.jpg'}
                          alt={t.name}
                          style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        {t.name}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#38BDF8', fontFamily: 'monospace' }}>
                      {t.slug}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            backgroundColor: t.branding?.primaryColor || '#E32726',
                          }}
                          title={`Primary: ${t.branding?.primaryColor}`}
                        />
                        <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                          {t.branding?.primaryColor}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>{t._count?.branches ?? 0} branches</td>
                    <td style={{ padding: '14px 16px' }}>{t._count?.products ?? 0} products</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          backgroundColor: t.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: t.status === 'ACTIVE' ? '#34D399' : '#F87171',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          switchTenant(t.slug);
                          if (onClose) onClose();
                        }}
                        style={{
                          background: '#1F2937',
                          color: '#38BDF8',
                          border: '1px solid #374151',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Launch Storefront →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Onboarding Wizard Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1F2937',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#F9FAFB' }}>
                  🚀 1-Click Restaurant Onboarding Wizard
                </h2>
                <p style={{ color: '#9CA3AF', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  Creates tenant, dynamic branding, initial branch, and admin account in one step.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ color: '#9CA3AF', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant}>
              {/* Brand Details */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Restaurant Brand Name</label>
                <input
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    setFormData({ ...formData, name, slug });
                  }}
                  placeholder="e.g. Burger Lab"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Slug (URL identifier)</label>
                  <input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="burger-lab"
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="AED">AED (Emirati Dirham)</option>
                  </select>
                </div>
              </div>

              {/* Branding Colors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Primary Brand Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      style={{ width: '42px', height: '40px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Secondary Accent Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      style={{ width: '42px', height: '40px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              {/* Logo URL */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Logo Image URL</label>
                <input
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  placeholder="https://..."
                  style={inputStyle}
                />
              </div>

              {/* Initial Branch */}
              <div style={{ borderTop: '1px solid #1F2937', paddingTop: '16px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38BDF8' }}>Initial Branch:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginTop: '8px' }}>
                  <input
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    placeholder="Branch Name"
                    style={inputStyle}
                  />
                  <input
                    value={formData.branchCity}
                    onChange={(e) => setFormData({ ...formData, branchCity: e.target.value })}
                    placeholder="City (e.g. Islamabad)"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Initial Admin */}
              <div style={{ borderTop: '1px solid #1F2937', paddingTop: '16px', marginBottom: '24px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FBBF24' }}>Initial Tenant Admin User:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                  <input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="admin@newrestaurant.com"
                    required
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    placeholder="Admin Password"
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  border: 'none',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Creating Restaurant...' : 'Publish & Launch Restaurant 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const kpiCardStyle = {
  backgroundColor: '#111827',
  borderRadius: '12px',
  border: '1px solid #1F2937',
  padding: '20px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#9CA3AF',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  backgroundColor: '#1F2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#F9FAFB',
  padding: '10px 12px',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box' as const,
};
