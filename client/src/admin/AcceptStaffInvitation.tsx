import React, { useState } from 'react';
import { api } from '../api';

export function AcceptStaffInvitation() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return setMessage('Invitation token is missing.');
    if (password.length < 8 || password !== confirm) return setMessage('Passwords must match and contain at least 8 characters.');
    setSaving(true);
    try { await api.acceptStaffInvitation(token, password); setMessage('Account activated. You can now use the staff login.'); }
    catch (error: any) { setMessage(error.message); } finally { setSaving(false); }
  };

  return <main className="container page-content" style={{ maxWidth: 520 }}>
    <form className="tracking-card" onSubmit={submit}>
      <h1>Activate staff account</h1><p>Create your password to accept the invitation.</p>
      <label>New password<input type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/></label>
      <label>Confirm password<input type="password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)}/></label>
      <button className="checkout-action-btn" disabled={saving}>{saving ? 'Activating…' : 'Activate account'}</button>
      {message && <p role="status">{message}</p>}
      <a href="/staff/login">Go to staff login</a>
    </form>
  </main>;
}
