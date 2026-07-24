import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { fmtDate } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/constants';

// Colores de badge por tipo de permiso (registro).
const TYPE_CLASS = {
  'Vacaciones': 'bp',
  'Baja médica (IT)': 'bc',
  'Matrimonio / pareja de hecho': 'ba',
  'Fallecimiento de familiar': 'bx',
  'Hospitalización / enfermedad grave de familiar': 'bc',
  'Nacimiento / Maternidad / Paternidad': 'bt',
  'Lactancia': 'bt',
  'Traslado de domicilio': 'bx',
  'Deber inexcusable (público)': 'by',
  'Funciones sindicales / representación': 'bt',
  'Exámenes / formación': 'bp',
  'Fuerza mayor familiar': 'bc',
  'Asuntos propios': 'bx',
  'Permiso médico (día completo)': 'by',
  'Otro': 'bx',
};
// Tipos disponibles en "Otros permisos" (día completo). Excluye Vacaciones,
// que tiene su propia sección, y las ausencias por horas (médico/acompañamiento),
// que se registran en Fichar como ausencia parcial.
const OTHER_TYPES = Object.keys(TYPE_CLASS).filter(t => t !== 'Vacaciones');

export default function Permissions() {
  const { emps, adminPerms, addAdminPerm, removeAdminPerm, festivos, addFestivo, removeFestivo } = useApp();
  const { showToast } = useToast();
  const [vacEmps, setVacEmps] = useState([]);
  const [vacSearch, setVacSearch] = useState('');
  const [vacDept, setVacDept] = useState('');   // '' = todos los departamentos
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacNote, setVacNote] = useState('');
  const [othEmp, setOthEmp] = useState(emps[0]?.id || '');
  const [othType, setOthType] = useState(OTHER_TYPES[0]);
  const [othStart, setOthStart] = useState('');
  const [othEnd, setOthEnd] = useState('');
  const [othNote, setOthNote] = useState('');
  const [festDate, setFestDate] = useState('');
  const [festName, setFestName] = useState('');

  const applyVacations = () => {
    if (!vacEmps.length || !vacStart || !vacEnd) { showToast('Selecciona al menos un empleado y las fechas.', 'warning'); return; }
    const days = Math.round((new Date(vacEnd) - new Date(vacStart)) / 864e5) + 1;
    addAdminPerm({ names: vacEmps.map(id => emps.find(e => e.id === id)?.name).join(', '), type: 'Vacaciones', start: vacStart, end: vacEnd, days, note: vacNote });
    setVacNote('');
    showToast('Vacaciones aplicadas.', 'success');
  };

  const applyOther = () => {
    if (!othStart || !othEnd) { showToast('Indica las fechas.', 'warning'); return; }
    const days = Math.round((new Date(othEnd) - new Date(othStart)) / 864e5) + 1;
    const emp = emps.find(e => e.id === othEmp);
    addAdminPerm({ names: emp?.name || othEmp, type: othType, start: othStart, end: othEnd, days, note: othNote });
    setOthNote('');
    showToast('Permiso aplicado.', 'success');
  };

  const addFest = () => {
    if (!festDate) { showToast('Indica la fecha del festivo.', 'warning'); return; }
    addFestivo({ date: festDate, name: festName || 'Festivo' });
    setFestDate('');
    setFestName('');
  };

  const allPerms = adminPerms;

  // Selector de empleados para vacaciones (checkboxes + buscador)
  const vacActiveEmps = emps.filter(e => !e.archived);
  const vacDepts = DEPARTMENTS.filter(d => vacActiveEmps.some(e => e.dept === d));
  const vacFiltered = vacActiveEmps.filter(e =>
    (!vacDept || e.dept === vacDept) &&
    (e.name || '').toLowerCase().includes(vacSearch.toLowerCase()));
  const toggleVac = (id) => setVacEmps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allFilteredSelected = vacFiltered.length > 0 && vacFiltered.every(e => vacEmps.includes(e.id));
  const toggleAllFiltered = () => setVacEmps(prev =>
    allFilteredSelected
      ? prev.filter(id => !vacFiltered.some(e => e.id === id))
      : [...new Set([...prev, ...vacFiltered.map(e => e.id)])]
  );

  return (
    <>
      <div className="ph"><div><h1>Gestión de permisos</h1><p>Aplica directamente sin aprobación del empleado</p></div></div>

      <div className="card-section">
        <h3>🎉 Festivos</h3>
        <p className="sub">Los días festivos aparecen en el portal del empleado como "FESTIVO NO TRABAJADO". Si alguien trabaja en festivo, su registro quedará destacado en el panel de admin.</p>
        <div className="frow">
          <div className="fg"><label>Fecha del festivo</label><input type="date" value={festDate} onChange={e => setFestDate(e.target.value)} /></div>
          <div className="fg"><label>Nombre (opcional)</label><input type="text" value={festName} onChange={e => setFestName(e.target.value)} placeholder="Ej: Inmaculada Concepción" /></div>
        </div>
        <button className="btn-accent" onClick={addFest}>Añadir festivo</button>

        {festivos.length > 0 && (
          <table style={{ marginTop: '1rem' }}>
            <thead><tr><th>Fecha</th><th>Nombre</th><th></th></tr></thead>
            <tbody>
              {festivos.map(f => (
                <tr key={f.date}>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{fmtDate(f.date)}</td>
                  <td style={{ fontSize: 13 }}>{f.name}</td>
                  <td><button className="btn-sm" style={{ color: 'var(--coral)' }} onClick={() => removeFestivo(f.date)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-section">
        <h3>🌴 Vacaciones — múltiples empleados</h3>
        <p className="sub">Marca los empleados a los que aplicar las vacaciones.</p>
        <div className="fg">
          <label>Empleados {vacEmps.length > 0 && <span style={{ color: 'var(--accent)' }}>· {vacEmps.length} seleccionados</span>}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <select value={vacDept} onChange={e => setVacDept(e.target.value)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}>
              <option value="">Todos los departamentos</option>
              {vacDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input type="text" value={vacSearch} onChange={e => setVacSearch(e.target.value)} placeholder="Buscar empleado..." autoComplete="off"
              style={{ flex: 1, minWidth: 160, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
            <button className="btn-sm" onClick={toggleAllFiltered}>
              {allFilteredSelected ? 'Quitar' : 'Seleccionar'}{vacDept ? ` ${vacDept}` : ' todos'}
            </button>
            {vacEmps.length > 0 && <button className="btn-sm" onClick={() => setVacEmps([])}>Limpiar</button>}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border2)', borderRadius: 10, background: 'var(--bg3)' }}>
            {vacFiltered.map(e => {
              const sel = vacEmps.includes(e.id);
              return (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border2)', background: sel ? 'rgba(201,242,62,0.07)' : 'transparent' }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleVac(e.id)} style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                  <div className="avatar" style={{ background: e.color, color: '#fff', width: 24, height: 24, fontSize: 9, flexShrink: 0 }}>{e.initials}</div>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{e.dept}</span>
                </label>
              );
            })}
            {vacFiltered.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Sin resultados</div>}
          </div>
        </div>
        <div className="frow">
          <div className="fg"><label>Fecha inicio</label><input type="date" value={vacStart} onChange={e => setVacStart(e.target.value)} /></div>
          <div className="fg"><label>Fecha fin</label><input type="date" value={vacEnd} onChange={e => setVacEnd(e.target.value)} /></div>
        </div>
        <div className="fg"><label>Nota interna</label><input type="text" value={vacNote} onChange={e => setVacNote(e.target.value)} placeholder="Opcional" /></div>
        <button className="btn-accent" onClick={applyVacations}>Aplicar vacaciones</button>
      </div>

      <div className="card-section">
        <h3>📋 Otros permisos</h3>
        <p className="sub">Permisos de día(s) completo(s) según convenio. Las ausencias por horas (consulta médica propia, acompañamiento) se registran en Fichar como ausencia parcial.</p>
        <div className="frow">
          <div className="fg">
            <label>Empleado</label>
            <select value={othEmp} onChange={e => setOthEmp(e.target.value)}>
              {emps.filter(e => !e.archived).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Tipo</label>
            <select value={othType} onChange={e => setOthType(e.target.value)}>
              {OTHER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="frow">
          <div className="fg"><label>Fecha inicio</label><input type="date" value={othStart} onChange={e => setOthStart(e.target.value)} /></div>
          <div className="fg"><label>Fecha fin</label><input type="date" value={othEnd} onChange={e => setOthEnd(e.target.value)} /></div>
        </div>
        <div className="fg"><label>Notas</label><textarea value={othNote} onChange={e => setOthNote(e.target.value)} placeholder="Observaciones internas..." /></div>
        <button className="btn-accent" onClick={applyOther}>Aplicar permiso</button>
      </div>

      <div className="tc">
        <div className="tch"><h3>Permisos registrados</h3></div>
        <table>
          <thead><tr><th>Empleado(s)</th><th>Tipo</th><th>Fechas</th><th>Días</th><th>Notas</th><th></th></tr></thead>
          <tbody>
            {allPerms.map((p, i) => (
              <tr key={p.id || i}>
                <td style={{ fontSize: 13 }}>{p.names}</td>
                <td><span className={`b ${TYPE_CLASS[p.type] || 'bx'}`}>{p.type}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{p.start} a {p.end}</td>
                <td>{p.days}</td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{p.note || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn-sm" style={{ color: 'var(--coral)' }}
                    onClick={() => { if (window.confirm(`¿Eliminar este permiso de ${p.names}?`)) removeAdminPerm(p.id); }}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {allPerms.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Sin permisos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
