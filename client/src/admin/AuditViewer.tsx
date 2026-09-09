import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Branch } from '../types';

export const AuditViewer: React.FC<{ branches: Branch[] }> = ({ branches }) => {
  const [result, setResult] = useState<any>({ records: [], total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ action: '', entity: '', branchId: '', role: '', from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async (page = 1) => {
    setLoading(true); setError('');
    try { setResult(await api.getAuditLogs({ ...filters, to: filters.to ? `${filters.to}T23:59:59.999` : '', page })); }
    catch (value: any) { setError(value.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  return <section>
    <h2>Audit logs</h2><p>Append-only operational history for this restaurant. Credentials and tokens are never displayed.</p>
    <form onSubmit={event => { event.preventDefault(); load(); }} className="store-controls">
      <input aria-label="Audit action" placeholder="Action" value={filters.action} onChange={event => setFilters({ ...filters, action: event.target.value })}/>
      <input aria-label="Audit entity" placeholder="Entity type" value={filters.entity} onChange={event => setFilters({ ...filters, entity: event.target.value })}/>
      <input aria-label="Actor role" placeholder="Actor role" value={filters.role} onChange={event => setFilters({ ...filters, role: event.target.value })}/>
      <select aria-label="Audit branch" value={filters.branchId} onChange={event => setFilters({ ...filters, branchId: event.target.value })}><option value="">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      <input aria-label="Audit from date" type="date" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })}/>
      <input aria-label="Audit to date" type="date" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })}/>
      <button disabled={loading}>{loading ? 'Loading…' : 'Filter'}</button>
    </form>
    {error && <p role="alert" className="error-message">{error}</p>}
    <p>{result.total} matching records</p>
    <div className="products-grid">{result.records.map((record: any) => <article className="tracking-card" key={record.id}>
      <h3>{record.action.replace(/_/g, ' ')}</h3>
      <p>{record.entity} · {record.entityId}</p><p>{record.user?.name || 'System/historical actor'} · {record.actorRole || record.user?.email || 'Role unavailable'}</p>
      <p>{record.branch?.name || 'Tenant-wide'} · {new Date(record.timestamp).toLocaleString()}</p>
      {record.oldValue != null && <details><summary>Previous state</summary><pre>{record.oldValue}</pre></details>}
      {record.newValue != null && <details><summary>New state</summary><pre>{record.newValue}</pre></details>}
    </article>)}</div>
    {!loading && !result.records.length && <p>No audit records match these filters.</p>}
    <div className="store-controls"><button disabled={result.page <= 1 || loading} onClick={() => load(result.page - 1)}>Previous</button><span>Page {result.page} of {result.pages}</span><button disabled={result.page >= result.pages || loading} onClick={() => load(result.page + 1)}>Next</button></div>
  </section>;
};
