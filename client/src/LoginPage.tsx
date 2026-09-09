import React, { useState } from 'react';
import { api, setSession } from './api';
import { useTenant } from './theme/ThemeProvider';
import { UserRole } from './types';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  tenantId?: string | null;
  tenantSlug?: string | null;
  tenantName?: string | null;
  roles?: UserRole[];
  permissions?: string[];
  branchIds?: string[];
};

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
  allowedRoles?: UserRole[];
  portalTitle?: string;
  allowRegistration?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, allowedRoles, portalTitle, allowRegistration = true }) => {
  const { tenant, branding, currentSlug, switchTenant } = useTenant();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await api.login(email, password);
      } else {
        if (!name.trim()) {
          setError('Name is required.');
          setLoading(false);
          return;
        }
        result = await api.register(name, email, password, phone);
      }

      if (result.error || !result.success) {
        setError(result.error?.message || result.error || 'Authentication failed');
      } else {
        const authData = result.data || result;
        const effectiveRoles: UserRole[] = authData.user.roles || [authData.user.role];
        if (allowedRoles && !effectiveRoles.some(role => allowedRoles.includes(role))) {
          setError('This account does not have access to this portal.');
          return;
        }
        setSession(authData.token, authData.refreshToken);
        localStorage.setItem('platform_auth_user', JSON.stringify(authData.user));
        
        // If user belongs to a specific tenant, switch to that tenant
        if (authData.user.tenantSlug) {
          switchTenant(authData.user.tenantSlug);
        }
        
        onLogin(authData.user);
      }
    } catch (err: any) {
      setError(err.message || 'Network error. Please ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string, tenantToSwitch?: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setMode('login');
    setError('');

  };

  const brandName = tenant?.name || 'Restaurant Platform';
  const brandLogo = branding?.logo || '/assets/logo.svg';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Dynamic Brand Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src={brandLogo}
            alt={brandName}
            style={{
              height: '64px',
              maxWidth: '180px',
              objectFit: 'contain',
              marginBottom: '12px',
              borderRadius: '12px',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <h1
            style={{
              color: 'var(--color-secondary, #FEDC00)',
              fontSize: '1.8rem',
              fontWeight: 900,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {brandName.toUpperCase()}
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '6px 0 0' }}>
            Order from your restaurant
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '32px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Tab switcher */}
          <div
            style={{
              display: 'flex',
              background: '#F1F5F9',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '24px',
            }}
          >
            {(allowRegistration ? ['login', 'register'] as const : ['login'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: '9px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: mode === m ? '#FFFFFF' : 'transparent',
                  color: mode === m ? '#0F172A' : '#64748B',
                  boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {m === 'login' ? '🔐 Sign In' : '✨ Register'}
              </button>
            ))}
          </div>

          {portalTitle && <p style={{ textAlign: 'center', color: '#475569', fontWeight: 700, margin: '-10px 0 18px' }}>{portalTitle}</p>}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Muhammad Ali"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    border: '2px solid #E2E8F0',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  border: '2px solid #E2E8F0',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {mode === 'register' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Phone Number
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03001234567"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    border: '2px solid #E2E8F0',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 44px 11px 14px',
                    border: '2px solid #E2E8F0',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: 'var(--color-primary, #E32726)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          {import.meta.env.DEV && <>
          {/* Quick Demo Login Grid for both Tenants and Super Admin */}
          <div style={{ marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px', textAlign: 'center' }}>
              ⚡ 1-Click Role Login Demo:
            </p>

            {/* Super Admin */}
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={() => fillDemo('superadmin@platform.com', 'SuperAdmin@123')}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  background: 'linear-gradient(135deg, #1E293B, #334155)',
                  color: '#38BDF8',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                👑 Platform Super Admin (Manage All Tenants)
              </button>
            </div>

            {/* Cheezious Tenant Roles */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#E32726' }}>🍕 Cheezious Brand:</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => fillDemo('admin@cheezious.com', 'Admin@123', 'cheezious')}
                  style={demoBtnStyle('#FFF1F2', '#E11D48', '#FECDD3')}
                >
                  ⚡ Admin
                </button>
                <button
                  onClick={() => fillDemo('kitchen@cheezious.com', 'Kitchen@123', 'cheezious')}
                  style={demoBtnStyle('#FEF3C7', '#D97706', '#FDE68A')}
                >
                  👨‍🍳 Kitchen
                </button>
                <button
                  onClick={() => fillDemo('rider@cheezious.com', 'Rider@123', 'cheezious')}
                  style={demoBtnStyle('#EFF6FF', '#2563EB', '#BFDBFE')}
                >
                  🛵 Rider
                </button>
                <button
                  onClick={() => fillDemo('customer@cheezious.com', 'Customer@123', 'cheezious')}
                  style={demoBtnStyle('#F0FDF4', '#16A34A', '#BBF7D0')}
                >
                  🛒 Customer
                </button>
              </div>
            </div>

            {/* Savour Foods Tenant Roles */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0B6E4F' }}>🍗 Savour Foods Brand:</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => fillDemo('admin@savour.com', 'Admin@123', 'savour-foods')}
                  style={demoBtnStyle('#ECFDF5', '#059669', '#A7F3D0')}
                >
                  ⚡ Admin
                </button>
                <button
                  onClick={() => fillDemo('kitchen@savour.com', 'Kitchen@123', 'savour-foods')}
                  style={demoBtnStyle('#FEF9C3', '#CA8A04', '#FEF08A')}
                >
                  👨‍🍳 Kitchen
                </button>
                <button
                  onClick={() => fillDemo('rider@savour.com', 'Rider@123', 'savour-foods')}
                  style={demoBtnStyle('#F0F9FF', '#0284C7', '#BAE6FD')}
                >
                  🛵 Rider
                </button>
                <button
                  onClick={() => fillDemo('customer@savour.com', 'Customer@123', 'savour-foods')}
                  style={demoBtnStyle('#FAF5FF', '#9333EA', '#E9D5FF')}
                >
                  🛒 Customer
                </button>
              </div>
            </div>
          </div>
          </>}
        </div>
      </div>
    </div>
  );
};

const demoBtnStyle = (bg: string, color: string, border: string) => ({
  padding: '6px 8px',
  background: bg,
  color: color,
  border: `1px solid ${border}`,
  borderRadius: '6px',
  fontWeight: 700,
  fontSize: '0.78rem',
  cursor: 'pointer',
});
