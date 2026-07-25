import { useState } from 'react';
import { useSuperAdmin } from '../../context/SuperAdminContext';
import { DEPARTMENTS } from '../../lib/constants';

const ROLES = ['super_admin', 'admin', 'dept_head', 'employee'];
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', dept_head: 'Jefe de equipo', employee: 'Empleado' };

const EMPTY_EDIT = { name: '', role: 'employee', eid: '', company_id: '', production_id: '' };
const EMPTY_NEW  = {
  // Acceso (sin contraseña: el empleado la crea desde el email de invitación)
  email: '',
  // Datos básicos del empleado
  name: '', alias: '', dni: '', position: '', dept: 'Producción',
  // Horario y contrato
  start_time: '09:00', end_time: '18:00', brk: 60, ch: 8,
  c_start: new Date().toISOString().slice(0, 10), c_end: '',
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

  // Filtros de la lista
  const [fCompany, setFCompany] = useState('');
  const [fProd, setFProd]       = useState('');
  const [fRole, setFRole]       = useState('');
  const [fSearch, setFSearch]   = useState('');

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

  const isActor = form.dept === 'Actores';
  const newValid =
    form.email.trim() && form.name.trim() && form.c_start &&
    (isActor || (form.start_time && form.end_time));

  const saveNew = async () => {
    if (!newValid) return;
    setSaving(true);
    setError('');
    const result = await createUser({
      email:         form.email.trim(),
      name:          form.name.trim(),
      alias:         form.alias.trim() || null,
      dni:           form.dni.trim() || null,
      position:      form.position.trim() || null,
      dept:          form.dept || 'Producción',
      start_time:    isActor ? null : form.start_time,
      end_time:      isActor ? null : form.end_time,
      brk:           isActor ? 0 : Number(form.brk) || 60,
      ch:            Number(form.ch) || 8,
      c_start:       form.c_start,
      c_end:         form.c_end || null,
      role:          form.role,
      company_id:    form.company_id || null,
      production_id: form.production_id || null,
    });
    setSaving(false);
    if (result) {
      setShowNew(false);
      setForm(EMPTY_NEW);
    } else {
      setError('No se pudo invitar al usuario. Revisa que el email no esté ya en uso.');
    }
  };

  const getProductionName = (pid) => productions.find(p => p.id === pid)?.name || '—';
  const getCompanyName    = (cid) => companies.find(c => c.id === cid)?.name || '—';
  const filteredProds     = (companyId) =>
    companyId ? productions.filter(p => p.company_id === companyId) : productions;

  // Lista filtrada por productora, producción, rol y búsqueda de nombre.
  const term = fSearch.trim().toLowerCase();
  const visibles = users.filter(u =>
    (!fCompany || u.company_id === fCompany) &&
    (!fProd || u.production_id === fProd) &&
    (!fRole || u.role === fRole) &&
    (!term || (u.name || '').toLowerCase().includes(term))
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Usuarios</h2>
        <button className="btn-primary" onClick={() => { setForm(EMPTY_NEW); setError(''); setShowNew(true); }}>
          + Añadir usuario
        </button>
      </div>

      <div className="fb" style={{ marginBottom: '1rem' }}>
        <select value={fCompany} onChange={e => { setFCompany(e.target.value); setFProd(''); }}>
          <option value="">Todas las productoras</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={fProd} onChange={e => setFProd(e.target.value)}>
          <option value="">Todas las producciones</option>
          {filteredProds(fCompany).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fRole} onChange={e => setFRole(e.target.value)}>
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <input type="text" value={fSearch} onChange={e => setFSearch(e.target.value)}
          placeholder="Buscar por nombre…"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, minWidth: 180, outline: 'none' }} />
        {(fCompany || fProd || fRole || fSearch) && (
          <button className="btn-sm" onClick={() => { setFCompany(''); setFProd(''); setFRole(''); setFSearch(''); }}>Limpiar</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto', alignSelf: 'center' }}>
          {visibles.length} de {users.length}
        </span>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th><th>Rol</th><th>Productora</th><th>Producción</th><th>EID</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(u => (
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
            {visibles.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)' }}>
                {users.length ? 'Nadie coincide con los filtros.' : 'Sin usuarios'}
              </td></tr>
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
              Acceso
            </div>
            <div className="fg">
              <label>Email *</label>
              <input type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="empleado@email.com" />
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                El empleado recibirá un email para crear su propia contraseña. Tú no la conocerás.
              </p>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '1rem 0 .5rem' }}>
              Datos del empleado
            </div>
            <div className="frow">
              <div className="fg">
                <label>Nombre completo *</label>
                <input value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="María García López" autoComplete="off" />
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
              Horario y contrato
            </div>
            {isActor ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '.5rem .75rem', background: 'var(--bg3)', borderRadius: 8, marginBottom: '.5rem' }}>
                Los actores no tienen horario fijo — sus jornadas se registran día a día.
              </div>
            ) : (
              <>
                <div className="frow">
                  <div className="fg">
                    <label>Hora de entrada *</label>
                    <input type="time" value={form.start_time}
                      onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label>Hora de salida *</label>
                    <input type="time" value={form.end_time}
                      onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
                  </div>
                </div>
                <div className="frow">
                  <div className="fg">
                    <label>Descanso (min)</label>
                    <input type="number" min={0} step={15} value={form.brk}
                      onChange={e => setForm(p => ({ ...p, brk: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label>Horas/día contrato</label>
                    <input type="number" min={1} step={0.5} value={form.ch}
                      onChange={e => setForm(p => ({ ...p, ch: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            <div className="frow">
              <div className="fg">
                <label>Inicio de contrato *</label>
                <input type="date" value={form.c_start}
                  onChange={e => setForm(p => ({ ...p, c_start: e.target.value }))} />
              </div>
              <div className="fg">
                <label>Fin de contrato <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(vacío = indefinido)</span></label>
                <input type="date" value={form.c_end}
                  onChange={e => setForm(p => ({ ...p, c_end: e.target.value }))} />
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '1rem 0 .5rem' }}>
              Rol y producción
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
              El empleado quedará activado con su horario y contrato. El admin del proyecto podrá editarlo, pero no necesita activarlo.
            </p>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveNew} disabled={saving || !newValid}>
                {saving ? 'Invitando…' : 'Invitar empleado'}
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
        <input value={form.name} onChange={f('name')} placeholder="Pablo Espinosa" autoComplete="off" />
      </div>
      <div className="fg">
        <label>Rol</label>
        <select value={form.role} onChange={f('role')}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
          La administración de una producción es una cuenta <b>aparte</b> (rol Admin) con su
          propio correo. No des rol de Admin a la cuenta de empleado de una persona: crea una
          cuenta distinta para administrar.
        </p>
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
