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
  const [brutoMes, setBrutoMes]         = useState('');
  const [irpfPct, setIrpfPct]           = useState('');
  const [exentoSS, setExentoSS]         = useState('');
  const [exentoIRPF, setExentoIRPF]     = useState('');
  const [descNomina, setDescNomina]     = useState('');
  const [tarifaHoraExt, setTarifaHoraExt] = useState('');

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
    setBrutoMes(emp.brutoMes != null ? String(emp.brutoMes) : '');
    setIrpfPct(emp.irpfPct != null ? String(emp.irpfPct) : '');
    setExentoSS(emp.exentoSS != null ? String(emp.exentoSS) : '');
    setExentoIRPF(emp.exentoIRPF != null ? String(emp.exentoIRPF) : '');
    setDescNomina(emp.descNomina != null ? String(emp.descNomina) : '');
    setTarifaHoraExt(emp.tarifaHoraExt != null ? String(emp.tarifaHoraExt) : '');
  }, [emp]);

  if (!emp) return null;

  const needsSetup = !emp.setupComplete;
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
      brutoMes:     brutoMes !== '' ? parseFloat(brutoMes) : null,
      irpfPct:      irpfPct !== '' ? parseFloat(irpfPct) : 0,
      exentoSS:     exentoSS !== '' ? parseFloat(exentoSS) : 0,
      exentoIRPF:   exentoIRPF !== '' ? parseFloat(exentoIRPF) : 0,
      descNomina:   descNomina !== '' ? parseFloat(descNomina) : 0,
      tarifaHoraExt: tarifaHoraExt !== '' ? parseFloat(tarifaHoraExt) : 0,
    });
    onClose();
  };
  useEnterKey(handleSave);

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <h3>Editar empleado</h3>
        {needsSetup && (
          <div style={{
            background: 'color-mix(in srgb, var(--warning, #f59e0b) 15%, transparent)',
            border: '1px solid var(--warning, #f59e0b)',
            borderRadius: 8, padding: '10px 14px', marginBottom: '1rem',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <i className="ti ti-alert-triangle" style={{ color: 'var(--warning, #f59e0b)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--warning, #f59e0b)', fontSize: 13 }}>Pendiente de configurar</strong>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text2)' }}>
                Rellena al menos el horario (entrada/salida) y la fecha de inicio de contrato. Al guardar, el empleado quedará activo.
              </p>
            </div>
          </div>
        )}
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
        {/* Configuración salarial */}
        <div style={{ borderTop: '1px solid var(--border2)', margin: '1rem 0 .75rem', paddingTop: '.75rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.75rem' }}>
            Configuración salarial (para Cierre mensual)
          </div>
          <div className="frow" style={{ marginBottom: '.75rem' }}>
            <div className="fg">
              <label>Bruto mensual fijo (€)</label>
              <input type="number" step="0.01" value={brutoMes} onChange={e => setBrutoMes(e.target.value)} placeholder="Ej: 3104.10" />
            </div>
            <div className="fg">
              <label>Retención IRPF (%)</label>
              <input type="number" step="0.01" value={irpfPct} onChange={e => setIrpfPct(e.target.value)} placeholder="Ej: 17.85" />
            </div>
          </div>
          <div className="frow" style={{ marginBottom: '.75rem' }}>
            <div className="fg">
              <label>Exento SS (€/mes)</label>
              <input type="number" step="0.01" value={exentoSS} onChange={e => setExentoSS(e.target.value)} placeholder="Ej: 126.10 (km)" />
            </div>
            <div className="fg">
              <label>Exento IRPF adicional (€/mes)</label>
              <input type="number" step="0.01" value={exentoIRPF} onChange={e => setExentoIRPF(e.target.value)} placeholder="Ej: 153.00 (comedor)" />
            </div>
          </div>
          <div className="frow">
            <div className="fg">
              <label>Descuento en nómina (€/mes)</label>
              <input type="number" step="0.01" value={descNomina} onChange={e => setDescNomina(e.target.value)} placeholder="Ej: 153.00 (dto. comedor)" />
            </div>
            <div className="fg">
              <label>Tarifa hora extra (€/h)</label>
              <input type="number" step="0.01" value={tarifaHoraExt} onChange={e => setTarifaHoraExt(e.target.value)} placeholder="Ej: 15.00" />
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" onClick={handleSave}>
            {needsSetup ? 'Guardar y activar empleado' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
