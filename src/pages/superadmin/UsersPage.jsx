import { useState } from 'react';
import { useSuperAdmin } from '../../context/SuperAdminContext';

const ROLES = ['super_admin', 'admin', 'employee'];
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', employee: 'Empleado' };

const EMPTY_PROFILE = { id: '', name: '', role: 'employee', eid: '', company_id: '', production_id: '' };

export default function UsersPage() {
  const { users, companies, productions, updateProfile, createProfile } = useSuperAdmin();
  const [editing, setEditing]   = useState(null);   // profile being edited
  const [showNew, setShowNew]   = useState(false);  // new profile modal
  const [form, setForm]         = useState(EMPTY_PROFILE);
  const [saving, setSaving]     = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const openEdit = (u) => {
    setForm({
      id: u.id, name: u.name || '',
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
      name: form.name,
      role: form.role,
      eid: form.eid || null,
      company_id: form.company_id || null,
      production_id: form.production_id || null,
    });
    setSaving(false);
    setEditing(null);
  };

  const saveNew = async () => {
    if (!form.id.trim() || !form.name.trim()) return;
    setSaving(true);
    await createProfile({
      id: form.id.trim(),
      name: form.name.trim(),
      role: form.role,
      eid: form.eid || null,
      company_id: form.company_id || null,
      production_id: form.production_id || null,
    });
    setSaving(false);
    setShowNew(false);
    setForm(EMPTY_PROFILE);
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

      {/* Ayuda para crear usuarios en Supabase */}
      <div className="card" style={{ marginTop: 16, borderColor: 'var(--accent)', borderWidth: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
             onClick={() => setShowHelp(h => !h)}>
          <i className="ti ti-info-circle" style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600 }}>¿Cómo crear nuevos usuarios?</span>
          <i className={`ti ${showHelp ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ marginLeft: 'auto', color: 'var(--text3)' }} />
        </div>
        {showHelp && (
          <ol style={{ marginTop: 12, paddingLeft: 20, color: 'var(--text2)', lineHeight: 2, fontSize: 14 }}>
            <li>Ve a <strong>Supabase → Authentication → Users → Add user</strong></li>
            <li>Introduce el email y contraseña del usuario. Marca "Auto Confirm User".</li>
            <li>Copia el <strong>UUID</strong> que aparece en la columna User UID.</li>
            <li>Vuelve aquí y haz clic en <strong>"+ Añadir usuario"</strong> para crear el perfil con ese UUID.</li>
          </ol>
        )}
      </div>

      {/* Modal editar */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar usuario</h3>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              <UserForm form={form} setForm={setForm} companies={companies} filteredProds={filteredProds} />
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo perfil */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Añadir usuario</h3>
              <button className="modal-close" onClick={() => setShowNew(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="fg">
                <label>UUID (de Supabase Auth) *</label>
                <input value={form.id} onChange={e => setForm(p => ({ ...p, id: e.target.value }))}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={{ fontFamily: 'monospace', fontSize: 12 }} />
              </div>
              <UserForm form={form} setForm={setForm} companies={companies} filteredProds={filteredProds} />
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveNew} disabled={saving || !form.id.trim() || !form.name.trim()}>
                {saving ? 'Guardando…' : 'Crear perfil'}
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
