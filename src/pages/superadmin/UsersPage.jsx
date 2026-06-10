import { useState } from 'react';
import { useSuperAdmin } from '../../context/SuperAdminContext';

const ROLES = ['super_admin', 'admin', 'employee'];
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', employee: 'Empleado' };

const EMPTY_EDIT   = { name: '', role: 'employee', eid: '', company_id: '', production_id: '' };
const EMPTY_NEW    = { email: '', password: '', name: '', role: 'employee', eid: '', company_id: '', production_id: '' };

export default function UsersPage() {
  const { users, companies, productions, updateProfile, createUser } = useSuperAdmin();
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState(EMPTY_NEW);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [saving, setSaving]   = useState(false);

  const openEdit = (u) => {
    setEditForm({
      name: u.name || '',
      role: u.role || 'employee',
      eid: u.eid || '',
      company_id: u.company_id || '',
      production_id: u.production_id || '',
    });
    setEditing(u);
  };

  const saveEdit = async () => {
    setSaving(true);
    await updateProfile(editing.id, {
      name: editForm.name,
      role: editForm.role,
      eid: editForm.eid || null,
      company_id: editForm.company_id || null,
      production_id: editForm.production_id || null,
    });
    setSaving(false);
    setEditing(null);
  };

  const saveNew = async () => {
    if (!form.email.trim() || !form.password.trim() || !form.name.trim()) return;
    setSaving(true);
    const result = await createUser({
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      role: form.role,
      eid: form.eid || null,
      company_id: form.company_id || null,
      production_id: form.production_id || null,
    });
    setSaving(false);
    if (result) { setShowNew(false); setForm(EMPTY_NEW); }
  };

  const getProductionName = (pid) => productions.find(p => p.id === pid)?.name || '—';
  const getCompanyName    = (cid) => companies.find(c => c.id === cid)?.name || '—';

  const filteredProds = (companyId) =>
    companyId ? productions.filter(p => p.company_id === companyId) : productions;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Usuarios</h2>
        <button className="btn-primary" onClick={() => { setForm(EMPTY_PROFILE); setShowNew(true); }}>
          + Añadir usuario
        </button>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Productora</th>
              <th>Producción</th>
              <th>EID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name || '—'}</strong>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.id.slice(0, 8)}…</div>
                </td>
                <td><span className={`status-badge ${u.role === 'super_admin' ? 'special' : u.role === 'admin' ? 'approved' : 'pending'}`}>{ROLE_LABEL[u.role] || u.role}</span></td>
                <td>{getCompanyName(u.company_id)}</td>
                <td>{getProductionName(u.production_id)}</td>
                <td style={{ color: 'var(--text3)' }}>{u.eid || '—'}</td>
                <td>
                  <button className="btn-ghost btn-sm" onClick={() => openEdit(u)}>
                    <i className="ti ti-edit" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)' }}>Sin usuarios</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal editar */}
      {editing && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h3>Editar usuario</h3>
            <UserForm form={editForm} setForm={setEditForm} companies={companies} filteredProds={filteredProds} />
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo usuario */}
      {showNew && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal">
            <h3>Nuevo usuario</h3>
            <div className="frow">
              <div className="fg">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="empleado@email.com" />
              </div>
              <div className="fg">
                <label>Contraseña *</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Mín. 6 caracteres" />
              </div>
            </div>
            <UserForm form={form} setForm={setForm} companies={companies} filteredProds={filteredProds} />
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              El usuario podrá cambiar su contraseña desde el login si la olvida.
            </p>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveNew}
                disabled={saving || !form.email.trim() || !form.password.trim() || !form.name.trim()}>
                {saving ? 'Creando…' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({ form, setForm, companies, filteredProds }) {
  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const prods = filteredProds(form.company_id);

  return (
    <>
      <div className="fg">
        <label>Nombre *</label>
        <input value={form.name} onChange={f('name')} placeholder="Pablo Espinosa" />
      </div>
      <div className="fg">
        <label>Rol</label>
        <select value={form.role} onChange={f('role')}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      <div className="fg">
        <label>Productora</label>
        <select value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, production_id: '' }))}>
          <option value="">— Sin asignar —</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="fg">
        <label>Producción</label>
        <select value={form.production_id} onChange={f('production_id')} disabled={!form.company_id}>
          <option value="">— Sin asignar —</option>
          {prods.map(p => <option key={p.id} value={p.id}>{p.name}{p.season ? ` (${p.season})` : ''}</option>)}
        </select>
      </div>
      <div className="fg">
        <label>EID (empleado vinculado)</label>
        <input value={form.eid} onChange={f('eid')} placeholder="pablo_espinosa" />
      </div>
    </>
  );
}
