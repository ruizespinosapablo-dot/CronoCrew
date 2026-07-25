import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { DEPARTMENTS } from '../../lib/constants';

// El admin nombra jefes de equipo POR DEPARTAMENTO. Un jefe puede dirigir
// cualquier departamento, sea o no el de su ficha, y un departamento puede
// tener varios jefes. El departamento dirigido se guarda en profiles.managed_dept.
export default function Roles() {
  const { emps, currentUser } = useApp();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const prodId = currentUser?.productionId || null;

  const cargar = useCallback(async () => {
    if (!supabase || !prodId) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles').select('id, name, role, eid, managed_dept, production_id')
      .eq('production_id', prodId);
    setProfiles(data || []);
    setLoading(false);
  }, [prodId]);

  useEffect(() => { cargar(); }, [cargar]);

  const empByEid = useMemo(() => Object.fromEntries(emps.map(e => [e.id, e])), [emps]);
  const nombreDe = (p) => empByEid[p.eid]?.name || p.name || '(sin nombre)';
  const fichaDeptDe = (p) => empByEid[p.eid]?.dept || null;

  // Cuentas asignables: las que tienen ficha (empleados), y no son admin/super.
  const asignables = useMemo(
    () => profiles
      .filter(p => p.eid && (p.role === 'employee' || p.role === 'dept_head'))
      .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')),
    [profiles, empByEid]);

  // Jefes actuales de un departamento.
  const jefesDe = (dept) =>
    profiles.filter(p => p.role === 'dept_head' && p.managed_dept === dept);

  // Departamentos que tienen a alguien (ficha) en la producción.
  const deptsConGente = useMemo(() => {
    const s = new Set(emps.filter(e => !e.archived).map(e => e.dept).filter(Boolean));
    return DEPARTMENTS.filter(d => s.has(d)).concat(
      [...s].filter(d => !DEPARTMENTS.includes(d)).sort());
  }, [emps]);

  const asignar = async (personaId, dept) => {
    if (!personaId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ role: 'dept_head', managed_dept: dept }).eq('id', personaId);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    setProfiles(prev => prev.map(p => p.id === personaId ? { ...p, role: 'dept_head', managed_dept: dept } : p));
    const p = profiles.find(x => x.id === personaId);
    showToast(`${nombreDe(p)} · jefe de ${dept}`, 'success');
  };

  const quitar = async (personaId) => {
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ role: 'employee', managed_dept: null }).eq('id', personaId);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    setProfiles(prev => prev.map(p => p.id === personaId ? { ...p, role: 'employee', managed_dept: null } : p));
    showToast('Jefe de equipo retirado', 'info');
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Roles del equipo</h1>
          <p>Nombra jefes de equipo por departamento. Un jefe da el visto bueno a los fichajes y permisos de su departamento (nunca pagos). Puedes poner a varias personas, y no tiene por qué ser de ese departamento.</p>
        </div>
      </div>

      {loading && !profiles.length ? (
        <div className="tc"><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Cargando…</div></div>
      ) : deptsConGente.map(dept => {
        const jefes = jefesDe(dept);
        const jefeIds = new Set(jefes.map(j => j.id));
        const disponibles = asignables.filter(p => !jefeIds.has(p.id));
        return (
          <div key={dept} className="tc" style={{ marginBottom: '1rem' }}>
            <div className="tch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{dept}</h3>
              <select defaultValue="" disabled={saving}
                onChange={e => { asignar(e.target.value, dept); e.target.value = ''; }}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 11px', color: 'var(--text)', fontSize: 13, outline: 'none', minWidth: 220 }}>
                <option value="">+ Añadir jefe de equipo…</option>
                {disponibles.map(p => {
                  const fd = fichaDeptDe(p);
                  return (
                    <option key={p.id} value={p.id}>
                      {nombreDe(p)}{fd && fd !== dept ? ` (ficha: ${fd})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div style={{ padding: '.9rem 1.2rem', display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 20 }}>
              {jefes.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>Sin jefe de equipo asignado.</span>
              )}
              {jefes.map(j => {
                const fd = fichaDeptDe(j);
                return (
                  <span key={j.id} className="role-chip">
                    {nombreDe(j)}
                    {fd && fd !== dept && <span className="role-chip-sub">de {fd}</span>}
                    <button className="role-chip-x" title="Retirar" disabled={saving}
                      onClick={() => quitar(j.id)}>×</button>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: '1rem' }}>
        Solo aparece quien tiene cuenta de acceso con ficha. Las altas de personas nuevas se hacen desde el panel de super admin.
      </p>
    </>
  );
}
