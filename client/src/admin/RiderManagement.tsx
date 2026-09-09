import React, { useState } from 'react';
import { api } from '../api';
import { Branch, Rider } from '../types';

export function RiderManagement({ initialRiders, branches, canManage, reload }: { initialRiders: Rider[]; branches: Branch[]; canManage: boolean; reload: () => Promise<void> }) {
  const [selected, setSelected] = useState<Rider | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const open = async (id: string) => {
    try { setSelected(await api.getRider(id)); setError(''); } catch (e: any) { setError(e.message); }
  };
  const save = async () => {
    if (!selected) return; setSaving(true);
    try {
      await api.updateRider(selected.id, { branchId: selected.branchId, vehicleType: selected.vehicleType, vehicleNumber: selected.vehicleNumber || '', deliveryZone: selected.deliveryZone || '' });
      await reload(); await open(selected.id);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return <section><h2>Rider management</h2><p>Operational location remains limited to active deliveries. This screen does not provide continuous employee tracking.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="products-grid">{initialRiders.map(rider => <article className="tracking-card" key={rider.id}>
      <h3>{rider.user.name}</h3><p>{rider.user.phone || rider.user.email}</p><p className="status-badge">{rider.status}</p>
      <p>{rider.vehicleType} · {rider.vehicleNumber || 'No registration'}</p><p>{rider.branch?.name || 'No branch'} · {rider.deliveryZone || 'No zone'}</p>
      <button onClick={() => void open(rider.id)}>View profile and history</button>
    </article>)}</div>
    {selected && <div className="tracking-card" style={{ marginTop: 20 }}><h3>{selected.user.name}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <label>Vehicle type<input disabled={!canManage} value={selected.vehicleType} onChange={e => setSelected({ ...selected, vehicleType: e.target.value })}/></label>
        <label>Registration<input disabled={!canManage} value={selected.vehicleNumber || ''} onChange={e => setSelected({ ...selected, vehicleNumber: e.target.value })}/></label>
        <label>Delivery zone<input disabled={!canManage} value={selected.deliveryZone || ''} onChange={e => setSelected({ ...selected, deliveryZone: e.target.value })}/></label>
        <label>Branch<select disabled={!canManage} value={selected.branchId || ''} onChange={e => setSelected({ ...selected, branchId: e.target.value || null })}><option value="">Unassigned</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      </div>
      {canManage && <button className="add-card-btn" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save rider profile'}</button>}
      <h4>Delivery history</h4>{!selected.deliveries?.length ? <p>No deliveries.</p> : <ul>{selected.deliveries.map(delivery => <li key={delivery.id}>{delivery.order?.orderNumber} · {delivery.status}</li>)}</ul>}
      <h4>Recent operational activity</h4>{!selected.activity?.length ? <p>No recorded activity.</p> : <ul>{selected.activity.map(event => <li key={event.id}>{event.action} · {new Date(event.timestamp).toLocaleString()}</li>)}</ul>}
    </div>}
  </section>;
}
