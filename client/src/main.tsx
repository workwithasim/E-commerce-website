import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { LoginPage, AuthUser } from './LoginPage';
import { RiderDashboard } from './RiderDashboard';
import { AdminDashboard } from './admin/AdminDashboard';
import { getToken, removeToken, api } from './api';
import './styles.css';

const Root: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('cheezious_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [checking, setChecking] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    api.getMe().then(res => {
      if (res.user) {
        setUser(res.user);
        localStorage.setItem('cheezious_auth_user', JSON.stringify(res.user));
      } else {
        handleLogout();
      }
    }).catch(() => handleLogout()).finally(() => setChecking(false));
  }, []);

  const handleLogin = (loggedInUser: AuthUser) => setUser(loggedInUser);

  const handleLogout = () => {
    removeToken();
    localStorage.removeItem('cheezious_auth_user');
    setUser(null);
  };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#FFE600' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍕</div>
          <div style={{ fontWeight: 700 }}>Loading Cheezious...</div>
        </div>
      </div>
    );
  }

  // Not logged in → show login page
  if (!user) return <LoginPage onLogin={handleLogin} />;

  // Logged in → role-based routing
  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard onLogout={handleLogout} authUser={user} />;
    case 'KITCHEN':
      return <AdminDashboard onLogout={handleLogout} authUser={user} kitchenOnly />;
    case 'RIDER':
      return <RiderDashboard user={user} onLogout={handleLogout} />;
    case 'CUSTOMER':
    default:
      return <App authUser={user} onLogout={handleLogout} />;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
