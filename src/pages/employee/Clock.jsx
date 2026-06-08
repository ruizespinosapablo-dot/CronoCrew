import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calcRec, fmt, fmtDate, getToday, t2m } from '../../lib/utils';

export default function Clock({ emp }) {
  const { recs, upsertRec, deleteRec, festivos } = useApp();
  const TODAY = getToday();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [citedIn, setCitedIn] = useState(emp.start);
  const [citedOut, setCitedOut] = useState(emp.end);
  const [brkMins, setBrkMins] = useState(emp.brk);
  const [custIn, setCustIn] = useState('');
  const [custOut, setCustOut] = useState('');
  const [obs, setObs] = useState('');

  // Past days filing state
  const [selectedPast, setSelectedPast] = useState('');
  const [pastEntry, setPastEntry] = useState('');
  const [pastExit, setPastExit] = useState('');
  const [pastBrk, setPastBrk] = useState(emp.brk);
  const [pastObs, setPastObs] = useState('');
  const [pastType, setPastType] = useState('normal');

  // Non-working day filing state
  const defaultExtraCited = Math.round((t2m(emp.end) - t2m(emp.start) - emp.brk) / 60 * 10) / 10;
  const [extraDate, setExtraDate] = useState('');
  const [extraCited, setExtraCited] = useState(defaultExtraCited);
  const [extraEntry, setExtraEntry] = useState('');
  const [extraExit, setExtraExit] = useState('');
  const [extraBrk, setExtraBrk] = useState(emp.brk);
  const [extraObs, setExtraObs] = useState('');

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
  const calc = rec?.exit ? calcRec(rec, emp) : null;

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

  const nowHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  };

  const doFich = (type, method) => {
    let t;
    if (method === 'def') t = type === 'in' ? citedIn : citedOut;
    else if (method === 'now') t = nowHHMM();
    else {
      t = type === 'in' ? custIn : custOut;
      if (!t) { alert('Introduce una hora personalizada.'); return; }
    }
    const methodLabel = method === 'def' ? 'Hora citada' : method === 'now' ? 'Hora actual' : 'Personalizada';
    const existing = recs.find(r => r.eid === emp.id && r.date === TODAY);
    if (type === 'in') {
      upsertRec({
        id: existing?.id || crypto.randomUUID(),
        eid: emp.id, date: TODAY,
        entry: t, exit: existing?.exit || '',
        brk: parseInt(brkMins) || emp.brk,
        obs: existing?.obs || '', status: 'pending',
        method: methodLabel, citedIn, citedOut,
      });
    } else {
      if (!existing) { alert('Debes fichar la entrada antes de registrar la salida.'); return; }
      upsertRec({ ...existing, exit: t, brk: parseInt(brkMins) || emp.brk, status: 'pending' });
    }
  };

  const doLibranza = () => {
    upsertRec({
      id: rec?.id || crypto.randomUUID(),
      eid: emp.id, date: TODAY,
      entry: '', exit: '', brk: emp.brk,
      obs: 'Libranza', status: 'pending',
      method: 'Libranza', citedIn, citedOut, libranza: true,
    });
  };

  const doFestivoNoTrabajado = () => {
    upsertRec({
      id: rec?.id || crypto.randomUUID(),
      eid: emp.id, date: TODAY,
      entry: '', exit: '', brk: 0,
      obs: todayFestivo?.name || 'Festivo', status: 'pending',
      method: 'Sistema', citedIn, citedOut, absence: 'festivo',
    });
  };

  const saveObs = () => {
    if (!obs.trim()) { alert('Escribe una observación antes de guardar.'); return; }
    const existing = recs.find(r => r.eid === emp.id && r.date === TODAY);
    upsertRec({
      id: existing?.id || crypto.randomUUID(),
      eid: emp.id, date: TODAY,
      entry: existing?.entry || '', exit: existing?.exit || '',
      brk: emp.brk, obs: obs.trim(), status: 'pending',
      method: '—', citedIn, citedOut,
    });
    setObs('');
    alert('Observación guardada.');
  };

  const savePastDay = () => {
    if (!selectedPast) { alert('Selecciona un día.'); return; }
    const isFestivoPast = festivoSet.has(selectedPast);

    if (pastType === 'festivo' || (isFestivoPast && pastType === 'festivo-no')) {
      upsertRec({
        id: crypto.randomUUID(), eid: emp.id, date: selectedPast,
        entry: '', exit: '', brk: 0,
        obs: festivos.find(f => f.date === selectedPast)?.name || 'Festivo',
        status: 'pending', method: 'Manual', citedIn: emp.start, citedOut: emp.end, absence: 'festivo',
      });
    } else if (pastType === 'libranza') {
      upsertRec({
        id: crypto.randomUUID(), eid: emp.id, date: selectedPast,
        entry: '', exit: '', brk: emp.brk,
        obs: 'Libranza', status: 'pending', method: 'Manual',
        citedIn: emp.start, citedOut: emp.end, libranza: true,
      });
    } else {
      if (!pastEntry || !pastExit) { alert('Indica entrada y salida.'); return; }
      upsertRec({
        id: crypto.randomUUID(), eid: emp.id, date: selectedPast,
        entry: pastEntry, exit: pastExit, brk: parseInt(pastBrk) || emp.brk,
        obs: pastObs, status: 'pending', method: 'Manual retroactivo',
        citedIn: emp.start, citedOut: emp.end,
      });
    }
    setSelectedPast('');
    setPastEntry(''); setPastExit(''); setPastObs(''); setPastType('normal');
  };

  const saveExtraDay = () => {
    if (!extraDate) { alert('Selecciona una fecha.'); return; }
    if (!extraEntry || !extraExit) { alert('Indica entrada y salida.'); return; }
    if (recs.some(r => r.eid === emp.id && r.date === extraDate)) {
      alert('Ya existe un registro para ese día.'); return;
    }
    const citedMins = Math.round(parseFloat(extraCited) * 60) || 0;
    const brk = parseInt(extraBrk) || 0;
    const entryMin = t2m(extraEntry);
    const citedOutMin = entryMin + citedMins + brk;
    const citedOutH = String(Math.floor(citedOutMin / 60) % 24).padStart(2, '0');
    const citedOutM = String(citedOutMin % 60).padStart(2, '0');
    upsertRec({
      id: crypto.randomUUID(), eid: emp.id, date: extraDate,
      entry: extraEntry, exit: extraExit, brk,
      obs: extraObs, status: 'pending', method: 'Manual',
      citedIn: extraEntry, citedOut: `${citedOutH}:${citedOutM}`, special: true,
    });
    setExtraDate(''); setExtraCited(defaultExtraCited);
    setExtraEntry(''); setExtraExit('');
    setExtraBrk(emp.brk); setExtraObs('');
  };

  const absLabels = { baja: '🏥 Baja médica', vacaciones: '🌴 Vacaciones', festivo: '🎉 Festivo', permiso: '📋 Permiso' };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Fichar</h1>
          <p>Horario: {emp.start}–{emp.end} | Descanso {emp.brk}min | Contrato {emp.ch}h/día</p>
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
      {todayIsFestivo && rec?.absence === 'festivo' && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid var(--amber)', borderRadius: 'var(--r)', padding: '.8rem 1.2rem', marginBottom: '1rem', color: 'var(--amber)', fontWeight: 600, fontSize: 13 }}>
          🎉 Festivo registrado como no trabajado.
        </div>
      )}

      <div className="cp-panel">
        <div className="cp-left">
          <div className="cp-time">{time}</div>
          <div className="cp-date">{date}</div>
          {rec?.entry && !rec.absence && !rec.libranza && (
            <div className="cp-badge">
              <div className="pulse" />
              Entrada: {rec.entry}
            </div>
          )}
        </div>
        <div className="cp-right">
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '.7rem 1rem', marginBottom: '.85rem' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', fontWeight: 700, display: 'block', marginBottom: '.5rem' }}>Hora citada hoy</span>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <label style={{ fontSize: 12, color: 'var(--text2)' }}>Entrada</label>
                <input type="time" className="tinput" value={citedIn} onChange={e => setCitedIn(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <label style={{ fontSize: 12, color: 'var(--text2)' }}>Salida</label>
                <input type="time" className="tinput" value={citedOut} onChange={e => setCitedOut(e.target.value)} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Editable para este día</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '.7rem 1rem', marginBottom: '.85rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', fontWeight: 700 }}>Descanso real</span>
            <input type="number" value={brkMins} min={0} step={5} onChange={e => setBrkMins(e.target.value)} style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 8px', color: 'var(--amber)', fontSize: 13, fontWeight: 600, outline: 'none', width: 70 }} />
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>minutos</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '.85rem' }}>
            <div className="co-group">
              <h4>Entrada</h4>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button className="btn-ci" onClick={() => doFich('in', 'def')}>Hora citada</button>
                <button className="btn-ci-outline" onClick={() => doFich('in', 'now')}>Hora actual</button>
              </div>
              <div style={{ marginTop: 7, display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                <input type="time" value={custIn} onChange={e => setCustIn(e.target.value)} style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13, width: 95, minWidth: 0, maxWidth: '100%', outline: 'none' }} />
                <button className="btn-sm" onClick={() => doFich('in', 'cust')}>Personalizada</button>
              </div>
            </div>
            <div className="co-group">
              <h4>Salida</h4>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button className="btn-co" onClick={() => doFich('out', 'def')}>Hora citada</button>
                <button className="btn-co-outline" onClick={() => doFich('out', 'now')}>Hora actual</button>
              </div>
              <div style={{ marginTop: 7, display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                <input type="time" value={custOut} onChange={e => setCustOut(e.target.value)} style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13, width: 95, minWidth: 0, maxWidth: '100%', outline: 'none' }} />
                <button className="btn-sm" onClick={() => doFich('out', 'cust')}>Personalizada</button>
              </div>
            </div>
            <div className="co-group" style={{ flex: '0 0 auto' }}>
              <h4>Libranza</h4>
              <button className="btn-libranza" style={{ width: '100%' }} onClick={doLibranza}>📅 Marcar libranza</button>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>Compensa {emp.ch}h (jornada contrato)</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', fontWeight: 700, display: 'block', marginBottom: 5 }}>Observación del día</label>
              <input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ej: rodaje exterior..." style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
            </div>
            <button className="btn-accent" onClick={saveObs} style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12 }}>Guardar obs.</button>
          </div>
        </div>
      </div>

      <div className="tc">
        <div className="tch">
          <h3>Fichajes de hoy</h3>
          {rec && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!rec.absence && rec.status === 'approved' && <span className="b bg">Aprobado</span>}
              {!rec.absence && rec.status !== 'approved' && <span className="b by">Pendiente</span>}
              {rec.special && <span className="b ba">⭐ Jornada especial</span>}
              {rec.catUp && <span className="b bp">⬆ Subida categoría</span>}
              {rec.libranza && <span className="b bp">📅 Libranza</span>}
              <button className="btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => { if (window.confirm('¿Eliminar el registro de hoy?')) deleteRec(rec.id); }}>Eliminar</button>
            </span>
          )}
        </div>
        <table>
          <thead><tr><th>Tipo</th><th>Hora</th><th>Método</th></tr></thead>
          <tbody>
            {!rec && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>Sin fichajes hoy</td></tr>
            )}
            {rec?.absence && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text2)', padding: '2rem', fontStyle: 'italic' }}>{absLabels[rec.absence] || rec.absence}</td></tr>
            )}
            {rec && !rec.absence && !rec.libranza && rec.entry && (
              <tr>
                <td><span className="b bt">Entrada</span></td>
                <td style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600 }}>{rec.entry}</td>
                <td style={{ color: 'var(--text2)' }}>{rec.method}</td>
              </tr>
            )}
            {rec && !rec.absence && !rec.libranza && rec.exit && (
              <>
                <tr>
                  <td><span className="b bc">Salida</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600 }}>{rec.exit}</td>
                  <td style={{ color: 'var(--text2)' }}>{rec.method}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ padding: '10px 1.1rem' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: 13 }}>
                      <span>Netas: <b style={{ color: 'var(--text)' }}>{fmt(calc.net)}</b></span>
                      <span style={{ color: 'var(--text2)' }}>Descanso: {fmt(rec.brk != null ? rec.brk : emp.brk)}</span>
                      <span>Acumuladas: <b style={{ color: 'var(--teal)' }}>{calc.accum > 0 ? '+' + fmt(calc.accum) : '—'}</b></span>
                      {calc.comp > 0 && <span>Compensadas: <b style={{ color: 'var(--coral)' }}>−{fmt(calc.comp)}</b></span>}
                      {calc.extra > 0 && <span>Extras: <b style={{ color: 'var(--purple)' }}>+{fmt(calc.extra)}</b></span>}
                    </div>
                  </td>
                </tr>
              </>
            )}
            {rec?.libranza && (
              <tr>
                <td><span className="b bp">📅 Libranza</span></td>
                <td colSpan={2} style={{ color: 'var(--text2)' }}>Compensa {emp.ch}h de contrato</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rec?.obs && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '1rem', fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Observación</span><br />
          {rec.obs}
        </div>
      )}

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
                    <option key={`opt_${d}`} value={d}>
                      {fmtDate(d)}{festivoSet.has(d) ? ' 🎉 FESTIVO' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Tipo de registro</label>
                <select value={pastType} onChange={e => setPastType(e.target.value)}>
                  <option value="normal">Jornada normal</option>
                  <option value="libranza">Libranza</option>
                  <option value="festivo">Festivo no trabajado</option>
                </select>
              </div>
            </div>
            {pastType === 'normal' && (
              <div className="frow" style={{ marginBottom: '.75rem' }}>
                <div className="fg"><label>Entrada</label><input type="time" value={pastEntry} onChange={e => setPastEntry(e.target.value)} /></div>
                <div className="fg"><label>Salida</label><input type="time" value={pastExit} onChange={e => setPastExit(e.target.value)} /></div>
                <div className="fg"><label>Descanso (min)</label><input type="number" value={pastBrk} min={0} step={5} onChange={e => setPastBrk(e.target.value)} /></div>
                <div className="fg"><label>Obs.</label><input type="text" value={pastObs} onChange={e => setPastObs(e.target.value)} placeholder="Opcional" /></div>
              </div>
            )}
            <button className="btn-accent" onClick={savePastDay} disabled={!selectedPast}>Registrar día</button>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Fecha pendiente</th><th>Festivo</th></tr></thead>
              <tbody>
                {pendingDays.map(d => (
                  <tr key={d} style={d === selectedPast ? { background: 'var(--bg3)' } : {}}>
                    <td style={{ fontSize: 12, cursor: 'pointer', color: d === selectedPast ? 'var(--accent)' : undefined }} onClick={() => setSelectedPast(d)}>{fmtDate(d)}</td>
                    <td>{festivoSet.has(d) ? <span className="b by">🎉 Festivo</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="tc" style={{ marginTop: '1.5rem' }}>
        <div className="tch">
          <h3>📅 Registrar jornada no habitual</h3>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Fin de semana o festivo trabajado</span>
        </div>
        <div style={{ padding: '1rem 1.2rem' }}>
          <div className="frow" style={{ marginBottom: '.75rem' }}>
            <div className="fg">
              <label>Fecha</label>
              <input type="date" value={extraDate} max={TODAY} onChange={e => setExtraDate(e.target.value)} />
            </div>
            <div className="fg">
              <label>Horas citadas</label>
              <input type="number" value={extraCited} min={0} max={24} step={0.5} onChange={e => setExtraCited(e.target.value)} />
            </div>
            <div className="fg"><label>Entrada</label><input type="time" value={extraEntry} onChange={e => setExtraEntry(e.target.value)} /></div>
            <div className="fg"><label>Salida</label><input type="time" value={extraExit} onChange={e => setExtraExit(e.target.value)} /></div>
            <div className="fg"><label>Descanso (min)</label><input type="number" value={extraBrk} min={0} step={5} onChange={e => setExtraBrk(e.target.value)} /></div>
            <div className="fg"><label>Obs.</label><input type="text" value={extraObs} onChange={e => setExtraObs(e.target.value)} placeholder="Opcional" /></div>
          </div>
          <button className="btn-accent" onClick={saveExtraDay} disabled={!extraDate || !extraEntry || !extraExit}>
            Registrar jornada no habitual
          </button>
        </div>
      </div>
    </>
  );
}
