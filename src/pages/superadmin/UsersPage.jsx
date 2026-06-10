import { useState } from 'react';
import { useSuperAdmin } from '../../context/SuperAdminContext';
import { DEPARTMENTS } from '../../lib/data';

const ROLES = ['super_admin', 'admin', 'employee'];
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', employee: 'Empleado' };

const EMPTY_EDIT = { name: '', role: 'employee', eid: '', company_id: '', production_id: '' };
const EMPTY_NEW  = {
  // Credenciales
  email: '', password: '',
  // Datos básicos del empleado
  name: '', alias: '', dni: '', position: '', dept: 'Producción',
  // Rol y producción
  role: 'employee', company_id: '', production_id: '',
};

export default function UsersPage() {
  const { users, companies, productions, updateProfile, createUser } = useSuperAdmin();
  const [editing, setEditing]     = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [form, setForm]           = useState(EMPTY_NEW);
  const [editForm, setEditForm]   = useState(EMPTY_EDIT);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

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
    setError('');
    const result = await createUser({
      email:         form.email.trim(),
      password:      form.password,
      name:          form.name.trim(),
      alias:         form.alias.trim() || null,
      dni:           form.dni.trim() || null,
      position:      form.position.trim() || null,
      dept:          form.dept || 'Producción',
      role:          form.role,
      company_id:    form.company_id || null,
      production_id: form.production_id || null,
    });
    setSaving(false);
    if (result) {
      setShowNew(false);
      setForm(EMPTY_NEW);
    } else {
      setError('Error al crear el usuario. Revisa que el email no esté ya en uso.');
    }
  };

  const getProductionName = (pid) => productions.find(p => p.id === pid)?.name || '—';
  const getCompanyName    = (cid) => companies.find(c => c.id === cid)?.name || '—';
  const filteredProds     = (companyId) =>
    companyId ? productions.filter(p => p.company_id === companyId) : productions;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Usuarios</h2>
        <button className="btn-primary" onClick={() => { setForm(EMPTY_NEW); setError(''); setShowNew(true); }}>
          + Añadir usuario
        </button>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th><th>Rol</th><th>Productora</th><th>Producción</th><th>EID</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name || '—'}</strong>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.id.slice(0, 8)}…</div>
                </td>
                <td>
                  <span className={`status-badge ${u.role === 'super_admin' ? 'special' : u.role === 'admin' ? 'approved' : 'pending'}`}>
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </td>
                <td>{getCompanyName(u.company_id)}</td>
                <td>{getProductionName(u.production_id)}</td>
                <td style={{ color: 'var(--text3)', fontFamily: 'monospace', fontSize: 12 }}>{u.eid || '—'}</td>
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

      {/* ── Modal editar ── */}
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

      {/* ── Modal nuevo usuario ── */}
      {showNew && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3>Nuevo usuario</h3>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.5rem' }}>
              Credenciales de acceso
            </div>
            <div className="frow">
              <div className="fg">
                <label>Email *</label>
                <input type="email" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="empleado@email.com" />
              </div>
              <div className="fg">
                <label>Contraseña *</label>
                <input type="password" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mín. 6 caracteres" />
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '1rem 0 .5rem' }}>
              Datos del empleado
            </div>
            <div className="frow">
              <div className="fg">
                <label>Nombre completo *</label>
                <input value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="María García López" />
              </div>
              <div className="fg">
                <label>Alias</label>
                <input value={form.alias}
                  onChange={e => setForm(p => ({ ...p, alias: e.target.value }))}
                  placeholder="María" />
              </div>
            </div>
            <div className="frow">
              <div className="fg">
                <label>DNI</label>
                <input value={form.dni}
                  onChange={e => setForm(p => ({ ...p, dni: e.target.value }))}
                  placeholder="12345678A" />
              </div>
              <div className="fg">
                <label>Puesto</label>
                <input value={form.position}
                  onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                  placeholder="Auxiliar de producción" />
              </div>
            </div>
            <div className="fg">
              <label>Departamento</label>
              <select value={form.dept} onChange={e => setForm(p => ({ ...p, dept: e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '1rem 0 .5rem' }}>
              Acceso y producción
            </div>
            <div className="fg">
              <label>Rol</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Productora</label>
              <select value={form.company_id}
                onChange={e => setForm(p => ({ ...p, company_id: e.target.value, production_id: '' }))}>
                <option value="">— Sin asignar —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Producción</label>
              <select value={form.production_id}
                onChange={e => setForm(p => ({ ...p, production_id: e.target.value }))}
                disabled={!form.company_id}>
                <option value="">— Sin asignar —</option>
                {filteredProds(form.company_id).map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.season ? ` (${p.season})` : ''}</option>
                ))}
              </select>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              El empleado aparecerá en el panel con un aviso para que el administrador complete su horario y contrato.
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
          {['super_admin', 'admin', 'employee'].map(r => (
            <option key={r} value={r}>{r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'Empleado'}</option>
          ))}
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
        <label>EID <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(opcional)</span></label>
        <input value={form.eid} onChange={f('eid')} placeholder="ID del empleado existente" />
      </div>
    </>
  );
}
