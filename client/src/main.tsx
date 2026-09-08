import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { TenantProvider, useTenant } from './theme/ThemeProvider';
import { TenantSwitcher } from './components/TenantSwitcher';
import { App } from './App';
import { LoginPage, AuthUser } from './LoginPage';
import { RiderDashboard } from './RiderDashboard';
import { KitchenDisplay } from './admin/KitchenDisplay';
import { AdminDashboard } from './admin/AdminDashboard';
import { SuperAdminDashboard } from './admin/SuperAdminDashboard';
import { getToken, removeToken, api } from './api';
import './styles.css';

const MainApp: React.FC = () => {
  const { tenant, loading: tenantLoading, error: tenantError, refreshTenant } = useTenant();
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { const saved = localStorage.getItem('platform_auth_user'); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const clear = () => setUser(null);
    window.addEventListener('platform:logout', clear);
    return () => window.removeEventListener('platform:logout', clear);
  }, []);

  // Verify token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }
    api
      .getMe()
      .then((res) => {
        if (res.data?.user || res.user) {
          const u = res.data?.user || res.user;
          setUser(u);
          localStorage.setItem('platform_auth_user', JSON.stringify(u));
        } else {
          handleLogout();
        }
      })
      .catch(() => handleLogout())
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = (loggedInUser: AuthUser) => {
    setUser(loggedInUser);
    setShowSuperAdmin(loggedInUser.role === 'SUPER_ADMIN');
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    removeToken();
    localStorage.removeItem('platform_auth_user');
    setUser(null);
    setShowSuperAdmin(false);
  };

  if (tenantError) return <div className="platform-error"><h1>Restaurant unavailable</h1><p>{tenantError}</p><button onClick={refreshTenant}>Retry</button></div>;

  if (checking || tenantLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0F172A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ textAlign: 'center', color: '#FEDC00' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px', animation: 'bounce 1s infinite' }}>🍔</div>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F8FAFC' }}>
            Loading restaurant…
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '6px' }}>
            Getting your menu ready
          </div>
        </div>
      </div>
    );
  }

  // 1. Super Admin View (triggered explicitly or by login role)
  if (showSuperAdmin && user?.role === 'SUPER_ADMIN') {
    return (
      <>
        <TenantSwitcher onOpenSuperAdmin={user?.role === 'SUPER_ADMIN' ? () => setShowSuperAdmin(true) : undefined} />
        <SuperAdminDashboard onLogout={handleLogout} onClose={() => setShowSuperAdmin(false)} />
      </>
    );
  }

  // 2. Kitchen Staff View
  if (user && (user.role === 'KITCHEN_STAFF' || user.role === 'KITCHEN_MANAGER')) {
    return (
      <>
        <TenantSwitcher />
        <KitchenDisplay onLogout={handleLogout} />
      </>
    );
  }

  // 3. Rider View
  if (user && user.role === 'RIDER') {
    return (
      <>
        <TenantSwitcher />
        <RiderDashboard user={user} onLogout={handleLogout} />
      </>
    );
  }

  // 4. Restaurant Admin or Branch Manager View
  if (user && (user.role === 'TENANT_ADMIN' || user.role === 'BRANCH_MANAGER')) {
    return (
      <>
        <TenantSwitcher />
        <AdminDashboard authUser={user} onLogout={handleLogout} onBackToStore={handleLogout} />
      </>
    );
  }

  // 5. Default: Customer Storefront with Login modal
  return (
    <>
      <TenantSwitcher onOpenSuperAdmin={user?.role === 'SUPER_ADMIN' ? () => setShowSuperAdmin(true) : undefined} />
      <App key={tenant?.id}
        authUser={user}
        onLogout={handleLogout}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {showLoginModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowLoginModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px' }}>
            <LoginPage onLogin={handleLogin} />
          </div>
        </div>
      )}
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TenantProvider>
      <MainApp />
    </TenantProvider>
  </React.StrictMode>
);
