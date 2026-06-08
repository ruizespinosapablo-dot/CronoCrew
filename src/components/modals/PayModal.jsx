import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { calcPeriod, fmt } from '../../lib/utils';

export default function PayModal({ empId: initialEmpId, onClose }) {
  const { emps, recs, paid, addPaid } = useApp();
  const [eid, setEid] = useState(initialEmpId || emps[0]?.id || '');
  const [ord, setOrd] = useState(0);
  const [ext, setExt] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => { if (initialEmpId) setEid(initialEmpId); }, [initialEmpId]);

  const emp = emps.find(e => e.id === eid);
  const s = emp ? calcPeriod(eid, emps, recs) : null;

  const handleSave = () => {
    const today = new Date().toISOString().slice(0, 10);
    addPaid({ eid, month: today.slice(0, 7), ordMin: Math.round(parseFloat(ord) * 60), extMin: parseFloat(ext), note: note || 'Pago registrado' });
    onClose();
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Registrar pago de horas</h3>
        <div className="fg">
          <label>Empleado</label>
          <select value={eid} onChange={e => setEid(e.target.value)}>
            {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="frow">
          <div className="fg"><label>Horas ordinarias</label><input type="number" value={ord} min={0} step={0.5} onChange={e => setOrd(e.target.value)} /></div>
          <div className="fg"><label>Minutos extra (×1.5)</label><input type="number" value={ext} min={0} step={15} onChange={e => setExt(e.target.value)} /></div>
        </div>
        <div className="fg"><label>Nota</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: liquidación mayo" /></div>
        {emp && s && (
          <div className="calc-box">
            <b>Se pagarán a {emp.name}:</b><br />
            <span style={{ color: 'var(--teal)' }}>{fmt(Math.round(parseFloat(ord) * 60))} horas ordinarias</span>
            {parseFloat(ext) > 0 && <span style={{ color: 'var(--purple)' }}> + {ext}min extra</span>}<br />
            <span style={{ color: 'var(--text3)', fontSize: 12, marginTop: 5, display: 'block' }}>
              Saldo actual: <b style={{ color: s.total >= 0 ? 'var(--teal)' : 'var(--coral)' }}>{fmt(Math.round(s.total))}</b>
            </span>
          </div>
        )}
        <div className="modal-foot">
          <button className="btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" onClick={handleSave}>Registrar pago</button>
        </div>
      </div>
    </div>
  );
}
