import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { calcActorRec, fmt, fmtDate, getToday } from '../../lib/utils';

function MinInput({ label, value, onChange }) {
  return (
    <div className="fg">
      <label>{label} <span style={{ fontSize: 10, color: 'var(--text3)' }}>(min)</span></label>
      <input type="number" value={value} min={0} step={5} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

export default function ActorClock({ emp }) {
  const { recs, upsertRec, festivos } = useApp();
  const { showToast } = useToast();
  const TODAY = getToday();

  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  // Form fields
  const [actorCited, setActorCited] = useState('08:00');
  const [actorEnd, setActorEnd] = useState('18:00');
  const [actorMakeup, setActorMakeup] = useState(60);
  const [actorTravelIn, setActorTravelIn] = useState(0);
  const [actorTravelOut, setActorTravelOut] = useState(0);
  const [actorBreak, setActorBreak] = useState(60);
  const [obs, setObs] = useState('');

  // Past days
  const [selectedPast, setSelectedPast] = useState('');
  const [pastCited, setPastCited] = useState('08:00');
  const [pastEnd, setPastEnd] = useState('18:00');
  const [pastMakeup, setPastMakeup] = useState(60);
  const [pastTravelIn, setPastTravelIn] = useState(0);
  const [pastTravelOut, setPastTravelOut] = useState(0);
  const [pastBreak, setPastBreak] = useState(60);
  const [pastObs, setPastObs] = useState('');
  const [pastType, setPastType] = useState('normal');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(n.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      setDate(n.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const festivoSet = useMemo(() => new Set(festivos.map(f => f.date)), [festivos]);
  const todayIsFestivo = festivoSet.has(TODAY);
  const todayFestivo = todayIsFestivo ? festivos.find(f => f.date === TODAY) : null;

  const rec = recs.find(r => r.eid === emp.id && r.date === TODAY);

  // Live preview of current form values
  const previewRec = { actorCited, actorEnd, actorMakeup: +actorMakeup, actorTravelIn: +actorTravelIn, actorTravelOut: +actorTravelOut, actorBreak: +actorBreak };
  const preview = actorCited && actorEnd ? calcActorRec(previewRec, emp) : null;

  const buildActorRec = (id, date, cited, end, makeup, travelIn, travelOut, brk, obsText) => ({
    id,
    eid: emp.id,
    date,
    entry: cited,
    exit: end,
    brk: +brk,
    obs: obsText,
    status: 'pending',
    method: 'Actor',
    citedIn: cited,
    citedOut: end,
    actorCited: cited,
    actorEnd: end,
    actorMakeup: +makeup,
    actorTravelIn: +travelIn,
    actorTravelOut: +travelOut,
    actorBreak: +brk,
  });

  const saveToday = () => {
    if (!actorCited || !actorEnd) { showToast('Indica la hora de citación y fin de jornada.', 'warning'); return; }
    upsertRec(buildActorRec(rec?.id || crypto.randomUUID(), TODAY, actorCited, actorEnd, actorMakeup, actorTravelIn, actorTravelOut, actorBreak, obs));
    showToast('Jornada registrada.', 'success');
  };

  const doLibranza = () => {
    upsertRec({
      id: rec?.id || crypto.randomUUID(),
      eid: emp.id, date: TODAY,
      entry: '', exit: '', brk: 0,
      obs: 'Libranza', status: 'pending',
      method: 'Libranza', citedIn: '', citedOut: '', libranza: true,
    });
    showToast('Libranza registrada.', 'success');
  };

  const doFestivoNoTrabajado = () => {
    upsertRec({
      id: rec?.id || crypto.randomUUID(),
      eid: emp.id, date: TODAY,
      entry: '', exit: '', brk: 0,
      obs: todayFestivo?.name || 'Festivo', status: 'pending',
      method: 'Sistema', citedIn: '', citedOut: '', absence: 'festivo',
    });
  };

  const pendingDays = useMemo(() => {
    if (!emp.cStart) return [];
    const start = new Date(emp.cStart);
    const todayDate = new Date(TODAY);
    const limitDate = emp.cEnd
      ? new Date(Math.min(new Date(emp.cEnd + 'T12:00:00').getTime() + 86400000, todayDate.getTime()))
      : todayDate;
    const days = [];
    const d = new Date(start);
    while (d < limitDate) {
      const dateStr = d.toISOString().slice(0, 10);
      const dow = new Date(dateStr + 'T12:00:00').getDay();
      const hasRec = recs.some(r => r.eid === emp.id && r.date === dateStr);
      if (!hasRec && dow !== 0 && dow !== 6 && !festivoSet.has(dateStr)) days.push(dateStr);
      d.setDate(d.getDate() + 1);
    }
    return days.slice(-90);
  }, [emp.cStart, emp.cEnd, emp.id, recs, TODAY, festivoSet]);

  const savePastDay = () => {
    if (!selectedPast) { showToast('Selecciona un día.', 'warning'); return; }
    const existingRec = recs.find(r => r.eid === emp.id && r.date === selectedPast);
    const recId = existingRec?.id || crypto.randomUUID();
    if (pastType === 'libranza') {
      upsertRec({ id: recId, eid: emp.id, date: selectedPast, entry: '', exit: '', brk: 0, obs: 'Libranza', status: 'pending', method: 'Manual', citedIn: '', citedOut: '', libranza: true });
    } else if (pastType === 'festivo') {
      upsertRec({ id: recId, eid: emp.id, date: selectedPast, entry: '', exit: '', brk: 0, obs: festivos.find(f => f.date === selectedPast)?.name || 'Festivo', status: 'pending', method: 'Manual', citedIn: '', citedOut: '', absence: 'festivo' });
    } else {
      if (!pastCited || !pastEnd) { showToast('Indica citación y fin de jornada.', 'warning'); return; }
      upsertRec(buildActorRec(recId, selectedPast, pastCited, pastEnd, pastMakeup, pastTravelIn, pastTravelOut, pastBreak, pastObs));
    }
    setSelectedPast(''); setPastCited('08:00'); setPastEnd('18:00');
    setPastMakeup(60); setPastTravelIn(0); setPastTravelOut(0); setPastBreak(60); setPastObs('');
    setPastType('normal');
    showToast('Día registrado.', 'success');
  };

  const recCalc = rec && rec.actorEnd ? calcActorRec(rec, emp) : null;
  const absLabels = { baja: '🏥 Baja médica', vacaciones: '🌴 Vacaciones', festivo: '🎉 Festivo', permiso: '📋 Permiso' };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Fichar · Actor</h1>
          <p>Contrato: {emp.ch}h/día · {emp.name}</p>
        </div>
      </div>

      {todayIsFestivo && !rec && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid var(--amber)', borderRadius: 'var(--r)', padding: '1rem 1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--amber)' }}>🎉 HOY ES FESTIVO</span>
            {todayFestivo?.name && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text2)' }}>{todayFestivo.name}</span>}
          </div>
          <button className="btn-accent" style={{ background: 'var(--amber)', color: '#0a0b0f' }} onClick={doFestivoNoTrabajado}>
            FESTIVO NO TRABAJADO
          </button>
        </div>
      )}

      <div className="cp-panel">
        <div className="cp-left">
          <div className="cp-time">{time}</div>
          <div className="cp-date">{date}</div>
          {rec?.actorEnd && !rec.absence && !rec.libranza && (
            <div className="cp-badge">
              <div className="pulse" />
              Jornada registrada: {rec.actorCited}–{rec.actorEnd}
            </div>
          )}
        </div>
        <div className="cp-right">
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '.85rem 1rem', marginBottom: '.85rem' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', fontWeight: 700, display: 'block', marginBottom: '.6rem' }}>Registro de jornada — hoy</span>
            <div className="frow" style={{ marginBottom: '.6rem' }}>
              <div className="fg">
                <label>Hora de citación</label>
                <input type="time" value={actorCited} onChange={e => setActorCited(e.target.value)} />
              </div>
              <div className="fg">
                <label>Fin de jornada</label>
                <input type="time" value={actorEnd} onChange={e => setActorEnd(e.target.value)} />
              </div>
            </div>
            <div className="frow" style={{ marginBottom: '.6rem' }}>
              <MinInput label="Caracterización" value={actorMakeup} onChange={setActorMakeup} />
              <MinInput label="Viaje de ida" value={actorTravelIn} onChange={setActorTravelIn} />
              <MinInput label="Viaje de vuelta" value={actorTravelOut} onChange={setActorTravelOut} />
              <MinInput label="Descanso" value={actorBreak} onChange={setActorBreak} />
            </div>
            <div className="fg" style={{ marginBottom: '.75rem' }}>
              <label>Observación</label>
              <input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" />
            </div>

            {preview && (() => {
              const contractMin = emp.ch * 60;
              const hoursOnly = preview.net - preview.makeupExtra - preview.travelExtra - contractMin; // acum/comp solo horas
              const totalSaldo = preview.net - contractMin;                                            // acum/comp total
              const sgn = v => (v > 0 ? '+' : '') + fmt(v);
              const col = v => (v > 0 ? 'var(--teal)' : v < 0 ? 'var(--coral)' : 'var(--text3)');
              return (
                <div style={{ background: 'var(--bg4)', borderRadius: 8, padding: '.6rem .9rem', marginBottom: '.75rem', fontSize: 12 }}>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text3)' }}>Horas (acum/comp): <b style={{ color: col(hoursOnly) }}>{sgn(hoursOnly)}</b></span>
                    <span style={{ color: 'var(--text3)' }}>Caracterización extra: <b style={{ color: col(preview.makeupExtra) }}>{sgn(preview.makeupExtra)}</b></span>
                    <span style={{ color: 'var(--text3)' }}>Viajes extra: <b style={{ color: col(preview.travelExtra) }}>{sgn(preview.travelExtra)}</b></span>
                    <span style={{ borderLeft: '1px solid var(--border2)', paddingLeft: '1.25rem', color: 'var(--text2)' }}>Total (acum/comp): <b style={{ color: col(totalSaldo) }}>{sgn(totalSaldo)}</b></span>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-accent" onClick={saveToday}>Registrar jornada</button>
              <button className="btn-libranza" onClick={doLibranza}>📅 Libranza</button>
            </div>
          </div>
        </div>
      </div>

      <div className="tc">
        <div className="tch">
          <h3>Fichaje de hoy</h3>
          {rec && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!rec.absence && rec.status === 'approved' && <span className="b bg">Aprobado</span>}
              {!rec.absence && rec.status !== 'approved' && <span className="b by">Pendiente</span>}
              {rec.libranza && <span className="b bp">📅 Libranza</span>}
            </span>
          )}
        </div>
        <table>
          <thead><tr><th>Citación</th><th>Fin</th><th>Caract.</th><th>Viaje I.</th><th>Viaje V.</th><th>Descanso</th><th>Efectivo</th><th>Saldo</th></tr></thead>
          <tbody>
            {!rec && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>Sin registro hoy</td></tr>
            )}
            {rec?.absence && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: '2rem', fontStyle: 'italic' }}>{absLabels[rec.absence] || rec.absence}</td></tr>
            )}
            {rec?.libranza && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--purple)', fontWeight: 600 }}>📅 Libranza</td>
                <td colSpan={2} style={{ color: 'var(--coral)' }}>−{fmt(emp.ch * 60)}</td>
              </tr>
            )}
            {rec && !rec.absence && !rec.libranza && rec.actorEnd && (
              <tr>
                <td style={{ fontFamily: 'monospace' }}>{rec.actorCited}</td>
                <td style={{ fontFamily: 'monospace' }}>{rec.actorEnd}</td>
                <td style={{ fontSize: 12 }}>{rec.actorMakeup ?? '—'}min</td>
                <td style={{ fontSize: 12 }}>{rec.actorTravelIn ?? '—'}min</td>
                <td style={{ fontSize: 12 }}>{rec.actorTravelOut ?? '—'}min</td>
                <td style={{ fontSize: 12 }}>{rec.actorBreak ?? '—'}min</td>
                <td style={{ fontWeight: 700 }}>{recCalc ? fmt(recCalc.net) : '—'}</td>
                <td>
                  {recCalc?.accum > 0 && <span style={{ color: 'var(--teal)', fontWeight: 600 }}>+{fmt(recCalc.accum)}</span>}
                  {recCalc?.comp > 0 && <span style={{ color: 'var(--coral)', fontWeight: 600 }}>−{fmt(recCalc.comp)}</span>}
                  {recCalc && recCalc.accum === 0 && recCalc.comp === 0 && <span style={{ color: 'var(--text3)' }}>0</span>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pendingDays.length > 0 && (
        <div className="tc" style={{ marginTop: '1.5rem' }}>
          <div className="tch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>📋 Días pendientes de fichar</h3>
            <span className="b by">{pendingDays.length} días sin registrar</span>
          </div>
          <div style={{ padding: '1rem 1.2rem' }}>
            <div className="frow" style={{ marginBottom: '.75rem' }}>
              <div className="fg">
                <label>Día a fichar</label>
                <select value={selectedPast} onChange={e => setSelectedPast(e.target.value)}>
                  <option value="">Seleccionar día...</option>
                  {pendingDays.map(d => (
                    <option key={d} value={d}>{fmtDate(d)}{festivoSet.has(d) ? ' 🎉' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Tipo</label>
                <select value={pastType} onChange={e => setPastType(e.target.value)}>
                  <option value="normal">Jornada normal</option>
                  <option value="libranza">Libranza</option>
                  <option value="festivo">Festivo no trabajado</option>
                </select>
              </div>
            </div>
            {pastType === 'normal' && (
              <>
                <div className="frow" style={{ marginBottom: '.6rem' }}>
                  <div className="fg"><label>Hora de citación</label><input type="time" value={pastCited} onChange={e => setPastCited(e.target.value)} /></div>
                  <div className="fg"><label>Fin de jornada</label><input type="time" value={pastEnd} onChange={e => setPastEnd(e.target.value)} /></div>
                </div>
                <div className="frow" style={{ marginBottom: '.6rem' }}>
                  <MinInput label="Caracterización" value={pastMakeup} onChange={setPastMakeup} />
                  <MinInput label="Viaje de ida" value={pastTravelIn} onChange={setPastTravelIn} />
                  <MinInput label="Viaje de vuelta" value={pastTravelOut} onChange={setPastTravelOut} />
                  <MinInput label="Descanso" value={pastBreak} onChange={setPastBreak} />
                </div>
                <div className="fg" style={{ marginBottom: '.75rem' }}>
                  <label>Obs.</label>
                  <input type="text" value={pastObs} onChange={e => setPastObs(e.target.value)} placeholder="Opcional" />
                </div>
              </>
            )}
            <button className="btn-accent" onClick={savePastDay} disabled={!selectedPast}>Registrar día</button>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Fecha pendiente</th><th>Festivo</th></tr></thead>
              <tbody>
                {pendingDays.map(d => (
                  <tr key={d} style={d === selectedPast ? { background: 'var(--bg3)' } : {}}>
                    <td style={{ fontSize: 12, cursor: 'pointer', color: d === selectedPast ? 'var(--accent)' : undefined }} onClick={() => setSelectedPast(d)}>{fmtDate(d)}</td>
                    <td>{festivoSet.has(d) ? <span className="b by">🎉</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
