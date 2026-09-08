import React, { useState } from 'react';
import { api, setToken } from './api';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN' | 'KITCHEN' | 'RIDER';
  phone?: string;
};

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
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
        if (!name.trim()) { setError('Name is required.'); setLoading(false); return; }
        result = await api.register(name, email, password, phone);
      }

      if (result.error) {
        setError(result.error);
      } else {
        setToken(result.token);
        localStorage.setItem('cheezious_auth_user', JSON.stringify(result.user));
        onLogin(result.user);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    setEmail(email); setPassword(password); setMode('login');
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1a00 50%, #1a1a1a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', 'Segoe UI', sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/assets/logo.svg" alt="Cheezious" style={{ height: '60px', marginBottom: '12px' }} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
          <h1 style={{ color: '#FFE600', fontSize: '1.8rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>CHEEZIOUS</h1>
          <p style={{ color: '#999', fontSize: '0.85rem', margin: '4px 0 0' }}>The Cheeziest Food in Town</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '36px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: '12px', padding: '4px', marginBottom: '28px' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '9px', fontWeight: 700, fontSize: '0.9rem',
                cursor: 'pointer', transition: 'all 0.2s',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#1a1a1a' : '#999',
                boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
              }}>
                {m === 'login' ? '🔐 Sign In' : '✨ Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Name (register only) */}
            {mode === 'register' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Muhammad Ali" required
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #eee', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#FFE600'} onBlur={e => e.target.style.borderColor = '#eee'} />
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                style={{ width: '100%', padding: '12px 14px', border: '2px solid #eee', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#FFE600'} onBlur={e => e.target.style.borderColor = '#eee'} />
            </div>

            {/* Phone (register only) */}
            {mode === 'register' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Phone (optional)</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03001234567"
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #eee', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#FFE600'} onBlur={e => e.target.style.borderColor = '#eee'} />
              </div>
            )}

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{ width: '100%', padding: '12px 44px 12px 14px', border: '2px solid #eee', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#FFE600'} onBlur={e => e.target.style.borderColor = '#eee'} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#999' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#FFF0F0', border: '1px solid #FFC0C0', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', color: '#CC0000', fontSize: '0.85rem', fontWeight: 600 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', background: loading ? '#ccc' : '#E8131E', border: 'none',
              borderRadius: '12px', color: '#fff', fontSize: '1rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em', transition: 'background 0.2s, transform 0.1s',
            }}
              onMouseDown={e => { if (!loading) (e.target as HTMLButtonElement).style.transform = 'scale(0.98)'; }}
              onMouseUp={e => { (e.target as HTMLButtonElement).style.transform = 'scale(1)'; }}>
              {loading ? '⏳ Please wait...' : mode === 'login' ? '🚀 Sign In' : '✨ Create Account'}
            </button>
          </form>
        </div>

        {/* Demo Accounts */}
        <div style={{ marginTop: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#FFE600', fontSize: '0.8rem', fontWeight: 700, margin: '0 0 12px', textAlign: 'center', letterSpacing: '0.05em' }}>
            🧪 DEMO ACCOUNTS — CLICK TO FILL
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { role: 'Admin', emoji: '⚙️', email: 'admin@cheezious.com', pass: 'Admin@123', color: '#0284C7' },
              { role: 'Kitchen', emoji: '👨‍🍳', email: 'kitchen@cheezious.com', pass: 'Kitchen@123', color: '#F59E0B' },
              { role: 'Rider', emoji: '🛵', email: 'rider@cheezious.com', pass: 'Rider@123', color: '#10B981' },
              { role: 'Customer', emoji: '👤', email: 'customer@cheezious.com', pass: 'Customer@123', color: '#8B5CF6' },
            ].map(d => (
              <button key={d.role} onClick={() => fillDemo(d.email, d.pass)} style={{
                background: 'rgba(255,255,255,0.08)', border: `1px solid ${d.color}44`, borderRadius: '10px',
                padding: '10px 8px', cursor: 'pointer', color: '#fff', fontSize: '0.78rem', fontWeight: 600,
                transition: 'background 0.2s', textAlign: 'center',
              }}
                onMouseEnter={e => (e.target as HTMLButtonElement).style.background = `${d.color}33`}
                onMouseLeave={e => (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{d.emoji}</div>
                <div style={{ color: d.color }}>{d.role}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
