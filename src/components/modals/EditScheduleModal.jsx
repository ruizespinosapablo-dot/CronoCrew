import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt, t2m } from '../../lib/utils';

export default function EditScheduleModal({ empId, onClose }) {
  const { emps, updateEmp } = useApp();
  const emp = emps.find(e => e.id === empId);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [brk, setBrk] = useState(0);
  const [ch, setCh] = useState(8);

  useEffect(() => {
    if (!emp) return;
    setStart(emp.start); setEnd(emp.end); setBrk(emp.brk); setCh(emp.ch);
  }, [emp]);

  if (!emp) return null;

  const citedNet = start && end ? (t2m(end) - t2m(start)) - parseInt(brk) : null;

  const handleSave = () => {
    updateEmp(empId, { start, end, brk: parseInt(brk) || emp.brk, ch: parseFloat(ch) || emp.ch });
    onClose();
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Editar horario</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>{emp.name} · {emp.role}</p>
        <div className="frow">
          <div className="fg"><label>Entrada asignada</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div className="fg"><label>Salida asignada</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div className="frow">
          <div className="fg"><label>Descanso comida (min)</label><input type="number" value={brk} min={0} step={15} onChange={e => setBrk(e.target.value)} /></div>
          <div className="fg"><label>Horas/día contrato</label><input type="number" value={ch} min={1} step={0.5} onChange={e => setCh(e.target.value)} /></div>
        </div>
        {citedNet !== null && (
          <div className="calc-box">
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ color: 'var(--text3)' }}>Netas citadas: <b style={{ color: 'var(--accent)' }}>{fmt(citedNet)}</b></span>
              <span style={{ color: 'var(--text3)' }}>Contrato: <b style={{ color: 'var(--teal)' }}>{ch}h</b></span>
              <span style={{ color: 'var(--text3)' }}>Margen acumule: <b style={{ color: 'var(--purple)' }}>+{fmt(citedNet - ch * 60)}</b></span>
            </div>
          </div>
        )}
        <div className="modal-foot">
          <button className="btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" onClick={handleSave}>Guardar horario</button>
        </div>
      </div>
    </div>
  );
}
