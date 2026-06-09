import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtDate } from '../../lib/utils';
import { useEnterKey } from '../../lib/useEnterKey';

export default function EditDayModal({ empId, date, onClose }) {
  const { recs, emps, upsertRec } = useApp();
  const emp = emps.find(e => e.id === empId);
  const rec = recs.find(r => r.eid === empId && r.date === date);

  const [isLibranza, setIsLibranza] = useState(false);
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [citedIn, setCitedIn] = useState('');
  const [citedOut, setCitedOut] = useState('');
  const [brk, setBrk] = useState(0);
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (!emp) return;
    setIsLibranza(rec?.libranza || false);
    setEntry(rec?.entry || '');
    setExit(rec?.exit || '');
    setCitedIn(rec?.citedIn || emp.start);
    setCitedOut(rec?.citedOut || emp.end);
    setBrk(rec?.brk != null ? rec.brk : emp.brk);
    setObs(rec?.obs || '');
  }, [rec, emp]);

  if (!emp) return null;

  const handleSave = () => {
    upsertRec({
      id: rec?.id || crypto.randomUUID(),
      eid: empId, date,
      entry: isLibranza ? '' : entry,
      exit: isLibranza ? '' : exit,
      brk: isLibranza ? emp.brk : (parseInt(brk) || 0),
      obs: isLibranza ? (obs || 'Libranza') : obs,
      status: 'pending',
      method: 'Personalizada',
      citedIn: isLibranza ? emp.start : citedIn,
      citedOut: isLibranza ? emp.end : citedOut,
      libranza: isLibranza || undefined,
    });
    onClose();
  };
  useEnterKey(handleSave);

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Editar jornada</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>Los cambios quedarán pendientes de aprobación del administrador.</p>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: '1rem' }}>{fmtDate(date)}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', padding: '.6rem 1rem', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--border2)' }}>
          <input type="checkbox" id="edm-libranza" checked={isLibranza} onChange={e => setIsLibranza(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <label htmlFor="edm-libranza" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>📅 Marcar como libranza</label>
        </div>

        {!isLibranza && (
          <>
            <div className="frow">
              <div className="fg"><label>Entrada</label><input type="time" value={entry} onChange={e => setEntry(e.target.value)} /></div>
              <div className="fg"><label>Salida</label><input type="time" value={exit} onChange={e => setExit(e.target.value)} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label>Citación entrada</label><input type="time" value={citedIn} onChange={e => setCitedIn(e.target.value)} /></div>
              <div className="fg"><label>Citación salida</label><input type="time" value={citedOut} onChange={e => setCitedOut(e.target.value)} /></div>
            </div>
            <div className="fg"><label>Descanso real (min)</label><input type="number" value={brk} min={0} step={5} onChange={e => setBrk(e.target.value)} /></div>
          </>
        )}

        <div className="fg"><label>Observación</label><input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ej: olvidé fichar la salida" /></div>

        <div className="modal-foot">
          <button className="btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" onClick={handleSave}>Enviar para aprobación</button>
        </div>
      </div>
    </div>
  );
}
