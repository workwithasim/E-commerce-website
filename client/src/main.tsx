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
import { AcceptStaffInvitation } from './admin/AcceptStaffInvitation';
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
  const effectiveRoles = user?.roles || (user ? [user.role] : []);
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const portal = (() => {
    if (['/admin', '/admin/login'].includes(path)) return { title: 'Restaurant Admin', roles: ['TENANT_ADMIN'] as AuthUser['role'][] };
    if (['/branch'].includes(path)) return { title: 'Branch Manager', roles: ['BRANCH_MANAGER'] as AuthUser['role'][] };
    if (['/kitchen'].includes(path)) return { title: 'Kitchen Staff', roles: ['KITCHEN_MANAGER', 'KITCHEN_STAFF'] as AuthUser['role'][] };
    if (['/staff/login'].includes(path)) return { title: 'Restaurant Staff', roles: ['BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'DISPATCHER', 'SUPPORT_STAFF'] as AuthUser['role'][] };
    if (['/rider', '/rider/login'].includes(path)) return { title: 'Rider', roles: ['RIDER'] as AuthUser['role'][] };
    if (['/platform', '/platform/login'].includes(path)) return { title: 'Platform Administration', roles: ['SUPER_ADMIN'] as AuthUser['role'][] };
    return null;
  })();

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
    void api.logout();
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

  if (path === '/staff/accept-invite') return <AcceptStaffInvitation />;

  if (!user && portal) {
    return <LoginPage onLogin={handleLogin} allowedRoles={portal.roles} portalTitle={portal.title} allowRegistration={false} />;
  }

  if (user && portal && !(user.roles || [user.role]).some(role => portal.roles.includes(role))) {
    return <main className="container page-content"><h1>Access denied</h1><p>Your account does not have access to the {portal.title} portal.</p><button onClick={handleLogout}>Sign out</button></main>;
  }

  // 1. Super Admin View (triggered explicitly or by login role)
  if (showSuperAdmin && effectiveRoles.includes('SUPER_ADMIN')) {
    return (
      <>
        <TenantSwitcher onOpenSuperAdmin={effectiveRoles.includes('SUPER_ADMIN') ? () => setShowSuperAdmin(true) : undefined} />
        <SuperAdminDashboard onLogout={handleLogout} onClose={() => setShowSuperAdmin(false)} />
      </>
    );
  }

  // 2. Kitchen Staff View
  if (user && (effectiveRoles.includes('KITCHEN_STAFF') || effectiveRoles.includes('KITCHEN_MANAGER'))) {
    return (
      <>
        <TenantSwitcher />
        <KitchenDisplay onLogout={handleLogout} />
      </>
    );
  }

  // 3. Rider View
  if (user && effectiveRoles.includes('RIDER')) {
    return (
      <>
        <TenantSwitcher />
        <RiderDashboard user={user} onLogout={handleLogout} />
      </>
    );
  }

  // 4. Restaurant Admin or Branch Manager View
  if (user && (effectiveRoles.includes('TENANT_ADMIN') || effectiveRoles.includes('BRANCH_MANAGER') || effectiveRoles.includes('DISPATCHER') || effectiveRoles.includes('SUPPORT_STAFF'))) {
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
      <TenantSwitcher onOpenSuperAdmin={effectiveRoles.includes('SUPER_ADMIN') ? () => setShowSuperAdmin(true) : undefined} />
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
