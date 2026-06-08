import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { fmtDate } from '../../lib/utils';

const TYPE_CLASS = { 'Vacaciones': 'bp', 'Baja médica': 'bc', 'Permiso médico': 'by', 'Asunto personal': 'bx', 'Maternidad/Paternidad': 'bt', 'Otro': 'bx' };
const BASE_PERMS = [{ names: 'Laura Fernández', type: 'Vacaciones', start: '2025-04-01', end: '2025-04-05', days: 5, note: '—' }];

export default function Permissions() {
  const { emps, adminPerms, addAdminPerm, festivos, addFestivo, removeFestivo } = useApp();
  const { showToast } = useToast();
  const [vacEmps, setVacEmps] = useState([]);
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacNote, setVacNote] = useState('');
  const [othEmp, setOthEmp] = useState(emps[0]?.id || '');
  const [othType, setOthType] = useState('Baja médica');
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

  const allPerms = [...BASE_PERMS, ...adminPerms];

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
        <p className="sub">Selecciona varios empleados a la vez (Cmd/Ctrl + clic).</p>
        <div className="fg">
          <label>Empleados</label>
          <select multiple style={{ height: 90 }} value={vacEmps} onChange={e => setVacEmps(Array.from(e.target.selectedOptions, o => o.value))}>
            {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
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
        <p className="sub">Bajas, permisos médicos, asuntos personales, etc.</p>
        <div className="frow">
          <div className="fg">
            <label>Empleado</label>
            <select value={othEmp} onChange={e => setOthEmp(e.target.value)}>
              {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Tipo</label>
            <select value={othType} onChange={e => setOthType(e.target.value)}>
              {Object.keys(TYPE_CLASS).map(t => <option key={t}>{t}</option>)}
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
          <thead><tr><th>Empleado(s)</th><th>Tipo</th><th>Fechas</th><th>Días</th><th>Notas</th></tr></thead>
          <tbody>
            {allPerms.map((p, i) => (
              <tr key={i}>
                <td style={{ fontSize: 13 }}>{p.names}</td>
                <td><span className={`b ${TYPE_CLASS[p.type] || 'bx'}`}>{p.type}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{p.start} a {p.end}</td>
                <td>{p.days}</td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{p.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
