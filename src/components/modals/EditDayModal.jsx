import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtDate, t2m } from '../../lib/utils';
import { useEnterKey } from '../../lib/useEnterKey';

const PERM_REASONS = ['Médico (propio)', 'Acompañamiento a familiar', 'Asuntos propios', 'Deber público', 'Otro'];

export default function EditDayModal({ empId, date, onClose }) {
  const { recs, emps, upsertRec } = useApp();
  const emp = emps.find(e => e.id === empId);
  const rec = recs.find(r => r.eid === empId && r.date === date);
  const isActor = emp?.dept === 'Actores';

  const [isLibranza, setIsLibranza] = useState(false);
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [citedIn, setCitedIn] = useState('');
  const [citedOut, setCitedOut] = useState('');
  const [brk, setBrk] = useState(0);
  const [obs, setObs] = useState('');
  const [permH, setPermH] = useState('');
  const [permReason, setPermReason] = useState(PERM_REASONS[0]);
  const [kmOn, setKmOn] = useState(false);
  const [kmCount, setKmCount] = useState('');
  // Actor fields
  const [actorCited, setActorCited] = useState('08:00');
  const [actorEnd, setActorEnd] = useState('18:00');
  const [actorMakeup, setActorMakeup] = useState(60);
  const [actorTravelIn, setActorTravelIn] = useState(0);
  const [actorTravelOut, setActorTravelOut] = useState(0);
  const [actorBreak, setActorBreak] = useState(60);

  useEffect(() => {
    if (!emp) return;
    setIsLibranza(rec?.libranza || false);
    setEntry(rec?.entry || '');
    setExit(rec?.exit || '');
    setCitedIn(rec?.citedIn || emp.start);
    setCitedOut(rec?.citedOut || emp.end);
    setBrk(rec?.brk != null ? rec.brk : emp.brk);
    setObs(rec?.obs || '');
    setPermH(rec?.permMin ? String(Math.round(rec.permMin / 60 * 100) / 100) : '');
    setPermReason(rec?.permReason || PERM_REASONS[0]);
    setKmOn(!!rec?.kmApplied);
    setKmCount(rec?.kmCount != null ? String(rec.kmCount) : '');
    setActorCited(rec?.actorCited || rec?.entry || '08:00');
    setActorEnd(rec?.actorEnd || rec?.exit || '18:00');
    setActorMakeup(rec?.actorMakeup ?? 60);
    setActorTravelIn(rec?.actorTravelIn ?? 0);
    setActorTravelOut(rec?.actorTravelOut ?? 0);
    setActorBreak(rec?.actorBreak ?? 60);
  }, [rec, emp]);

  if (!emp) return null;

  const handleSave = () => {
    const permMin = parseFloat(permH) > 0 ? Math.round(parseFloat(permH) * 60) : 0;
    const cnt = parseFloat(kmCount);
    const kmFields = { kmApplied: kmOn, kmCount: kmOn && cnt > 0 ? cnt : null };
    // Jornada especial: automática si la citación supera 9h15 (555 min), igual que en Fichar.
    const citedNetMin = t2m(citedOut) - t2m(citedIn) - (parseInt(brk) || 0);
    const autoSpecial = citedNetMin > 555;
    // La entrada no puede ser anterior a la hora de citación.
    if (!isActor && !isLibranza && entry && t2m(entry) < t2m(citedIn)) {
      window.alert(`La entrada no puede ser anterior a la hora citada (${citedIn}).`);
      return;
    }
    if (isActor && !isLibranza) {
      upsertRec({
        id: rec?.id || crypto.randomUUID(),
        eid: empId, date,
        entry: actorCited, exit: actorEnd,
        brk: +actorBreak, obs,
        status: 'pending', method: 'Manual actor',
        citedIn: actorCited, citedOut: actorEnd,
        actorCited, actorEnd,
        actorMakeup: +actorMakeup, actorTravelIn: +actorTravelIn,
        actorTravelOut: +actorTravelOut, actorBreak: +actorBreak,
        permMin, permReason: permMin ? permReason : null, ...kmFields,
      });
    } else {
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
        permMin: isLibranza ? 0 : permMin,
        permReason: !isLibranza && permMin ? permReason : null,
        kmApplied: isLibranza ? false : kmFields.kmApplied,
        kmCount: isLibranza ? null : kmFields.kmCount,
        special: isLibranza ? false : autoSpecial,
      });
    }
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

        {isActor && !isLibranza && (
          <>
            <div className="frow">
              <div className="fg"><label>Hora de citación</label><input type="time" value={actorCited} onChange={e => setActorCited(e.target.value)} /></div>
              <div className="fg"><label>Fin de jornada</label><input type="time" value={actorEnd} onChange={e => setActorEnd(e.target.value)} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label>Caracterización (min)</label><input type="number" value={actorMakeup} min={0} step={5} onChange={e => setActorMakeup(e.target.value)} /></div>
              <div className="fg"><label>Viaje ida (min)</label><input type="number" value={actorTravelIn} min={0} step={5} onChange={e => setActorTravelIn(e.target.value)} /></div>
              <div className="fg"><label>Viaje vuelta (min)</label><input type="number" value={actorTravelOut} min={0} step={5} onChange={e => setActorTravelOut(e.target.value)} /></div>
              <div className="fg"><label>Descanso (min)</label><input type="number" value={actorBreak} min={0} step={5} onChange={e => setActorBreak(e.target.value)} /></div>
            </div>
          </>
        )}

        {!isActor && !isLibranza && (
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
            <div className="frow">
              <div className="fg">
                <label>Ausencia parcial justificada</label>
                <select value={permReason} onChange={e => setPermReason(e.target.value)}>
                  {PERM_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="fg"><label>Horas de ausencia</label><input type="number" min={0} step={0.25} value={permH} onChange={e => setPermH(e.target.value)} placeholder="0" /></div>
            </div>
            <div className="frow" style={{ alignItems: 'flex-end' }}>
              <div className="fg">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={kmOn} onChange={e => setKmOn(e.target.checked)} style={{ width: 16, height: 16 }} /> 🚗 Aplicar kilometraje
                </label>
              </div>
              {kmOn && <div className="fg"><label>Km (opcional)</label><input type="number" min={0} step={1} value={kmCount} onChange={e => setKmCount(e.target.value)} placeholder="0" /></div>}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -4 }}>La ausencia parcial no penaliza tu saldo. El importe del kilometraje lo fija el administrador al revisar. La jornada especial se marca sola si la citación supera 9h15.</p>
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
