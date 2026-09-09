import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Branch, StaffMember, UserRole } from '../types';

const roles: UserRole[] = ['TENANT_ADMIN', 'BRANCH_MANAGER', 'KITCHEN_MANAGER', 'KITCHEN_STAFF', 'DISPATCHER', 'SUPPORT_STAFF', 'RIDER'];

export function StaffManagement({ branches, canDisable }: { branches: Branch[]; canDisable: boolean }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [invitePath, setInvitePath] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', employeeId: '', role: 'KITCHEN_STAFF' as UserRole, branchIds: [] as string[] });

  const load = async () => {
    try { setStaff(await api.getStaff({ search, status })); setError(''); }
    catch (e: any) { setError(e.message); }
  };
  useEffect(() => { void load(); }, [status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setInvitePath('');
    try {
      const created = await api.createStaff(form);
      setInvitePath(created.developmentInvitationPath || 'Invitation created. Delivery integration is not configured.');
      setForm({ name: '', email: '', phone: '', employeeId: '', role: 'KITCHEN_STAFF', branchIds: [] });
      await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const assignedBranches = (member: StaffMember) => member.roleAssignments.map(assignment => assignment.branchId).filter((id): id is string => Boolean(id));
  const updateAssignment = async (member: StaffMember, role: UserRole, branchIds: string[]) => {
    try { await api.updateStaff(member.id, { role, branchIds }); await load(); }
    catch (e: any) { setError(e.message); }
  };

  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
      <div><h2 style={{ margin: 0 }}>Staff management</h2><p>Create invited employees and control tenant/branch access.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><input aria-label="Search staff" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, phone, employee ID"/><button onClick={load}>Search</button><select aria-label="Filter staff status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive/invited</option></select></div>
    </div>
    {error && <p role="alert" className="error-message">{error}</p>}
    {invitePath && <div className="tracking-card"><strong>Development-safe invitation</strong><p>{invitePath}</p><small>No email delivery is being claimed. Share this path only in development.</small></div>}
    <form onSubmit={submit} className="tracking-card" style={{ marginBottom: 20 }}>
      <h3>Add staff</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
        <input required type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/>
        <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/>
        <input placeholder="Employee ID" value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}/>
        <select aria-label="Staff role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>{roles.map(role => <option key={role}>{role}</option>)}</select>
        <select multiple aria-label="Assigned branches" value={form.branchIds} onChange={e => setForm({ ...form, branchIds: [...e.target.selectedOptions].map(option => option.value) })}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      </div>
      <button className="add-card-btn" disabled={saving} style={{ marginTop: 12 }}>{saving ? 'Creating…' : 'Create invitation'}</button>
    </form>
    {!staff.length ? <p>No staff match these filters.</p> : <div className="products-grid">{staff.map(member => {
      const branchIds = assignedBranches(member);
      return <article className="tracking-card" key={member.id}>
        <h3>{member.name}</h3><p>{member.email}</p><p>{member.phone || 'No phone'} · {member.employeeId || 'No employee ID'}</p>
        <p className="status-badge">{member.isActive ? 'ACTIVE' : member.staffInvitation?.status || 'INACTIVE'}</p>
        <label>Role<select value={member.role} onChange={e => void updateAssignment(member, e.target.value as UserRole, branchIds)}>{roles.map(role => <option key={role}>{role}</option>)}</select></label>
        <label>Branches<select multiple value={branchIds} onChange={e => void updateAssignment(member, member.role, [...e.target.selectedOptions].map(option => option.value))}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <p>Created {new Date(member.createdAt).toLocaleDateString()} · Last login {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Never'}</p>
        {canDisable && <button onClick={async () => { try { await api.setStaffStatus(member.id, !member.isActive); await load(); } catch (e: any) { setError(e.message); } }}>{member.isActive ? 'Deactivate' : 'Reactivate'}</button>}
      </article>;
    })}</div>}
  </section>;
}
