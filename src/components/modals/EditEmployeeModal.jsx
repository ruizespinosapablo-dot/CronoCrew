import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DEPARTMENTS } from '../../lib/constants';
import { fmt, t2m } from '../../lib/utils';
import { useEnterKey } from '../../lib/useEnterKey';

export default function EditEmployeeModal({ empId, onClose }) {
  const { emps, updateEmp } = useApp();
  const emp = emps.find(e => e.id === empId);

  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [dept, setDept] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [brk, setBrk] = useState(0);
  const [ch, setCh] = useState(8);
  const [cStart, setCStart] = useState('');
  const [cEnd, setCEnd] = useState('');

  useEffect(() => {
    if (!emp) return;
    setName(emp.name || '');
    setAlias(emp.alias || '');
    setDni(emp.dni || '');
    setEmail(emp.email || '');
    setRole(emp.role || '');
    setDept(emp.dept || DEPARTMENTS[0]);
    setStart(emp.start || '09:00');
    setEnd(emp.end || '18:00');
    setBrk(emp.brk ?? 60);
    setCh(emp.ch ?? 8);
    setCStart(emp.cStart || '');
    setCEnd(emp.cEnd || '');
  }, [emp]);

  if (!emp) return null;

  const isActor = dept === 'Actores';
  const citedNet = !isActor && start && end ? (t2m(end) - t2m(start)) - parseInt(brk) : null;

  const handleSave = () => {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    updateEmp(empId, {
      name, alias, dni, email, role, dept,
      start, end, brk: parseInt(brk) || emp.brk,
      ch: parseFloat(ch) || emp.ch,
      cStart, cEnd: cEnd || null,
      initials,
      setupComplete: true,
    });
    onClose();
  };
  useEnterKey(handleSave);

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <h3>Editar empleado</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>{emp.name}</p>
        <div className="frow">
          <div className="fg"><label>Nombre completo</label><input type="text" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="fg"><label>Alias</label><input type="text" value={alias} onChange={e => setAlias(e.target.value)} /></div>
        </div>
        <div className="frow">
          <div className="fg"><label>DNI</label><input type="text" value={dni} onChange={e => setDni(e.target.value)} /></div>
          <div className="fg"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        </div>
        <div className="frow">
          <div className="fg"><label>Puesto</label><input type="text" value={role} onChange={e => setRole(e.target.value)} /></div>
          <div className="fg">
            <label>Departamento</label>
            <select value={dept} onChange={e => setDept(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        {!isActor && (
          <div className="frow">
            <div className="fg"><label>Entrada asignada</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div className="fg"><label>Salida asignada</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
        )}
        <div className="frow">
          {!isActor && <div className="fg"><label>Descanso (min)</label><input type="number" value={brk} min={0} step={15} onChange={e => setBrk(e.target.value)} /></div>}
          <div className="fg"><label>Horas/día contrato</label><input type="number" value={ch} min={1} step={0.5} onChange={e => setCh(e.target.value)} /></div>
        </div>
        {citedNet !== null && (
          <div className="calc-box">
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ color: 'var(--text3)' }}>Netas citadas: <b style={{ color: 'var(--accent)' }}>{fmt(citedNet)}</b></span>
              <span style={{ color: 'var(--text3)' }}>Contrato: <b style={{ color: 'var(--teal)' }}>{ch}h</b></span>
            </div>
          </div>
        )}
        {isActor && (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '.5rem .75rem', background: 'var(--bg3)', borderRadius: 8, marginBottom: '.5rem' }}>
            Actor — sus jornadas se registran día a día. Solo se configura la jornada contractual en horas.
          </div>
        )}
        <div className="frow">
          <div className="fg"><label>Inicio de contrato</label><input type="date" value={cStart} onChange={e => setCStart(e.target.value)} /></div>
          <div className="fg"><label>Fin de contrato (vacío = indefinido)</label><input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} /></div>
        </div>
        <div className="modal-foot">
          <button className="btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" onClick={handleSave}>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
