import React, { useEffect, useRef, useState } from 'react';
import { api, socket } from './api';
import { Delivery } from './types';
import { AuthUser } from './LoginPage';
import { useTenant } from './theme/ThemeProvider';

export const RiderDashboard: React.FC<{ user: AuthUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const { tenant, settings } = useTenant();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const watch = useRef<number | null>(null);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const load = async () => { try { setDeliveries(await api.getAssignedDeliveries()); } catch (e: any) { setError(e.message); } };
  const stop = () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; setTracking(null); };
  useEffect(() => {
    load(); api.getMe().then(r => setAvailable(!!r.data?.user?.riderProfile?.isAvailable)).catch(e => setError(e.message));
    socket.on('connect', load); socket.on('delivery:assigned', load); socket.on('delivery:status_updated', load);
    return () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); socket.off('connect', load); socket.off('delivery:assigned', load); socket.off('delivery:status_updated', load); };
  }, [user.id, tenant?.id]);
  useEffect(() => { if (tracking && !deliveries.some(d => d.id === tracking && ['PICKED_UP','ON_THE_WAY'].includes(d.status))) stop(); }, [deliveries, tracking]);
  const start = (id: string) => {
    stop(); setError(''); setLastUpdate('');
    if (!navigator.geolocation) { setError('Location sharing is unavailable in this browser.'); return; }
    setTracking(id);
    let sending = false;
    let sentAt = 0;
    watch.current = navigator.geolocation.watchPosition(async position => {
      if (sending || Date.now() - sentAt < 4000) return;
      sending = true; sentAt = Date.now();
      try { await api.sendRiderLocation(id, { latitude: position.coords.latitude, longitude: position.coords.longitude }); setLastUpdate(new Date().toLocaleTimeString()); }
      catch (e: any) { setError(e.message); stop(); }
      finally { sending = false; }
    }, e => { setError(e.message); stop(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  };
  const transition: Record<string, { status: string; label: string }> = { ASSIGNED: { status: 'ACCEPTED', label: 'Accept delivery' }, ACCEPTED: { status: 'PICKED_UP', label: 'Picked up from kitchen' }, PICKED_UP: { status: 'ON_THE_WAY', label: 'Start delivery' }, ON_THE_WAY: { status: 'DELIVERED', label: 'Mark delivered' } };
  const update = async (d: Delivery) => { setBusy(true); setError(''); try { await api.updateDeliveryStatus(d.id, transition[d.status].status); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const shown = deliveries.filter(d => tab === 'active' ? !['DELIVERED','CANCELLED'].includes(d.status) : ['DELIVERED','CANCELLED'].includes(d.status));
  return <main className="container page-content"><div className="store-controls"><div><h1>{tenant?.name} deliveries</h1><p>{user.name}</p></div><button className="add-card-btn" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api.setRiderAvailability(!available); setAvailable(r.isAvailable); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}>{available ? 'Available · go offline' : 'Offline · go available'}</button><button onClick={() => { stop(); onLogout(); }}>Sign out</button></div>
    {error && <p role="alert" className="error-message">{error}</p>}<div className="store-controls"><button className="add-card-btn" onClick={() => setTab('active')}>Active assignments</button><button className="add-card-btn" onClick={() => setTab('completed')}>Completed</button><button onClick={load}>Refresh</button></div>
    {!shown.length && <p>No {tab} deliveries.</p>}<div className="products-grid">{shown.map(d => <article className="tracking-card" key={d.id}><h2>{d.order?.orderNumber}</h2><p className="status-badge">{d.status.replace(/_/g,' ')}</p><p>{d.order?.customerName}</p><p><a href={`tel:${d.order?.customerPhone}`}>{d.order?.customerPhone}</a></p><p>{d.order?.deliveryAddress}</p><p>Collect: {settings?.currencySymbol} {d.order?.total}</p><ul>{d.order?.items.map((i,n) => <li key={n}>{i.quantity} × {i.productName}</li>)}</ul>{transition[d.status] && <button className="checkout-action-btn" disabled={busy} onClick={() => update(d)}>{transition[d.status].label}</button>}{settings?.riderTrackingEnabled !== false && ['PICKED_UP','ON_THE_WAY'].includes(d.status) && <button className="checkout-action-btn" onClick={() => tracking === d.id ? stop() : start(d.id)}>{tracking === d.id ? 'Stop sharing location' : 'Share live location'}</button>}{tracking === d.id && <p role="status">{lastUpdate ? `Location sent at ${lastUpdate}` : 'Waiting for device location…'}</p>}</article>)}</div>
  </main>;
};
