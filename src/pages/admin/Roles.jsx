import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { DEPARTMENTS } from '../../lib/constants';

// El admin de producción designa quién es jefe de equipo. Un jefe de equipo
// ficha como empleado y además aprueba lo de su departamento (sin tocar dinero).
// El departamento sale de su ficha, no se elige aquí.
const ROLES = [
  { id: 'employee',  label: 'Empleado' },
  { id: 'dept_head', label: 'Jefe de equipo' },
];

export default function Roles() {
  const { emps, currentUser } = useApp();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [q, setQ] = useState('');

  const prodId = currentUser?.productionId || null;

  const cargar = useCallback(async () => {
    if (!supabase || !prodId) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles').select('id, name, role, eid, production_id')
      .eq('production_id', prodId);
    setProfiles(data || []);
    setLoading(false);
  }, [prodId]);

  useEffect(() => { cargar(); }, [cargar]);

  const empByEid = useMemo(() => Object.fromEntries(emps.map(e => [e.id, e])), [emps]);

  // Solo se listan las cuentas con ficha (empleados). Los admin y super_admin no
  // se tocan desde aquí: sus roles los gestiona el super admin.
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return profiles
      .filter(p => p.role === 'employee' || p.role === 'dept_head')
      .map(p => {
        const e = p.eid ? empByEid[p.eid] : null;
        return {
          id: p.id, role: p.role,
          name: e?.name || p.name || '(sin nombre)',
          dept: e?.dept || null,
          position: e?.role || null,
        };
      })
      .filter(r => !term || r.name.toLowerCase().includes(term) || (r.dept || '').toLowerCase().includes(term))
      .sort((a, b) =>
        (a.role === 'dept_head' ? 0 : 1) - (b.role === 'dept_head' ? 0 : 1) ||
        (a.dept || 'zzz').localeCompare(b.dept || 'zzz', 'es') ||
        a.name.localeCompare(b.name, 'es'));
  }, [profiles, empByEid, q]);

  const jefes = rows.filter(r => r.role === 'dept_head');

  const cambiar = async (row, role) => {
    if (role === row.role) return;
    if (role === 'dept_head' && !row.dept) {
      showToast('Esa persona no tiene departamento en su ficha; no puede ser jefe de equipo.', 'warning');
      return;
    }
    setSaving(row.id);
    const { error } = await supabase.from('profiles').update({ role }).eq('id', row.id);
    setSaving(null);
    if (error) { showToast(error.message, 'error'); return; }
    setProfiles(prev => prev.map(p => p.id === row.id ? { ...p, role } : p));
    showToast(`${row.name} · ${role === 'dept_head' ? 'jefe de equipo' : 'empleado'}`, 'success');
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Roles del equipo</h1>
          <p>Quién puede aprobar en cada departamento. Un jefe de equipo ficha como empleado y además aprueba los fichajes y permisos de SU departamento (nunca pagos ni kilometraje).</p>
        </div>
        <input className="fb-input" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre o departamento…"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, minWidth: 240, outline: 'none' }} />
      </div>

      {jefes.length > 0 && (
        <div className="card-section" style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Jefes de equipo actuales: </span>
          {DEPARTMENTS.filter(d => jefes.some(j => j.dept === d)).map(d => (
            <span key={d} className="b bp" style={{ marginRight: 6 }}>
              {d}: {jefes.filter(j => j.dept === d).map(j => j.name).join(', ')}
            </span>
          ))}
        </div>
      )}

      <div className="tc">
        <div className="tch"><h3>Cuentas del equipo</h3></div>
        <table>
          <thead>
            <tr><th>Persona</th><th>Departamento</th><th>Rol</th></tr>
          </thead>
          <tbody>
            {loading && !profiles.length ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Cargando…</td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>
                {q ? 'Nadie coincide con la búsqueda.' : 'No hay cuentas de empleado en esta producción.'}
              </td></tr>
            ) : rows.map(row => (
              <tr key={row.id}>
                <td style={{ fontSize: 13 }}>
                  {row.name}
                  {row.position && <span style={{ display: 'block', color: 'var(--text3)', fontSize: 11 }}>{row.position}</span>}
                </td>
                <td style={{ fontSize: 12, color: row.dept ? 'var(--text2)' : 'var(--text3)' }}>{row.dept || 'sin ficha'}</td>
                <td>
                  <select value={row.role} disabled={saving === row.id}
                    onChange={e => cambiar(row, e.target.value)}
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 9px', color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                    {ROLES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: '1rem' }}>
        Solo aparece quien tiene cuenta de acceso. Las altas de personas nuevas se hacen desde el panel de super admin.
      </p>
    </>
  );
}
