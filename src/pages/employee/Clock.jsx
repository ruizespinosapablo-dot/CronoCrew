import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { calcRec, fmt, fmtDate, getToday, t2m } from '../../lib/utils';

const PERM_REASONS = ['Médico (propio)', 'Acompañamiento a familiar', 'Asuntos propios', 'Deber público', 'Otro'];

export default function Clock({ emp }) {
  const { recs, upsertRec, festivos } = useApp();
  const { showToast } = useToast();
  const TODAY = getToday();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [citedIn, setCitedIn] = useState(emp.start);
  const [citedOut, setCitedOut] = useState(emp.end);
  const [brkMins, setBrkMins] = useState(emp.brk);
  const [ajustar, setAjustar] = useState(false);   // desplegar la edición de citación
  const [custIn, setCustIn] = useState('');
  const [custOut, setCustOut] = useState('');
  const [obs, setObs] = useState('');
  const [permH, setPermH] = useState('');
  const [permReason, setPermReason] = useState(PERM_REASONS[0]);
  const [kmOn, setKmOn] = useState(false);
  const [kmCount, setKmCount] = useState('');

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
  const [extraKm, setExtraKm] = useState(false);
  const [extraKmCount, setExtraKmCount] = useState('');

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

  // ─── Citación planificada en ClapCrew ─────────────────────────────────────
  // Solo LECTURA y solo de turnos publicados. ClapCrew nunca escribe en recs:
  // el registro horario legal sigue siendo únicamente de ClapTime. Esto se
  // limita a proponer la citación de partida en lugar del horario de la ficha.
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('crew_shifts')
        .select('kind, cited_in, cited_out, brk, location')
        .eq('eid', emp.id).eq('date', TODAY).eq('status', 'published')
        .maybeSingle();
      if (vivo) setPlan(data || null);
    })();
    return () => { vivo = false; };
  }, [emp.id, TODAY]);

  // Se precarga solo si aún no hay fichaje del día: si ya fichó, sus horas
  // mandan y sobrescribirlas sería pisarle datos ya introducidos.
  useEffect(() => {
    if (!plan || rec || plan.kind === 'libranza') return;
    if (plan.cited_in) setCitedIn(plan.cited_in);
    if (plan.cited_out) setCitedOut(plan.cited_out);
    if (plan.brk != null) setBrkMins(plan.brk);
  }, [plan, rec]);
  const calc = rec?.exit ? calcRec({ ...rec, citedIn, citedOut, brk: parseInt(brkMins) || emp.brk }, emp) : null;

  // Mientras el día es 'draft' el empleado edita libremente. Al confirmar pasa a
  // 'pending' (lo ve el admin) y se bloquea la edición en Fichar.
  const locked = !!rec && rec.status !== 'draft' && !rec.absence && !rec.libranza;
  const canConfirm = !locked && !!rec?.entry;

  useEffect(() => {
    setKmOn(!!rec?.kmApplied);
    setKmCount(rec?.kmCount != null ? String(rec.kmCount) : '');
  }, [rec?.id, rec?.kmApplied, rec?.kmCount]);

  const citedNet = t2m(citedOut) - t2m(citedIn) - (parseInt(brkMins) || emp.brk);
  const isLongCited = citedNet > 555; // > 9h15m

  const LOCK_MSG = 'Fichaje ya confirmado. Para cambios, edítalo desde tu Historial.';

  const applyCited = () => {
    if (locked) { showToast(LOCK_MSG, 'warning'); return; }
    if (!rec) { showToast('Debes fichar primero.', 'warning'); return; }
    upsertRec({
      ...rec,
      citedIn, citedOut,
      brk: parseInt(brkMins) || emp.brk,
      ...(isLongCited ? { special: true } : {}),
    });
    showToast(isLongCited ? 'Hora citada aplicada · ⭐ Jornada especial marcada' : 'Hora citada aplicada', 'success');
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

  const nowHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  };

  const doFich = (type, method) => {
    if (locked) { showToast(LOCK_MSG, 'warning'); return; }
    let t;
    if (method === 'def') t = type === 'in' ? citedIn : citedOut;
    else if (method === 'now') t = nowHHMM();
    else {
      t = type === 'in' ? custIn : custOut;
      if (!t) { showToast('Introduce una hora personalizada.', 'warning'); return; }
    }
    // No se puede fichar la entrada antes de la hora de citación.
    if (type === 'in' && t2m(t) < t2m(citedIn)) {
      showToast(`No puedes fichar la entrada antes de tu hora citada (${citedIn}).`, 'warning');
      return;
    }
    const methodLabel = method === 'def' ? 'Hora citada' : method === 'now' ? 'Hora actual' : 'Personalizada';
    const existing = recs.find(r => r.eid === emp.id && r.date === TODAY);
    if (type === 'in') {
      upsertRec({
        id: existing?.id || crypto.randomUUID(),
        eid: emp.id, date: TODAY,
        entry: t, exit: existing?.exit || '',
        brk: parseInt(brkMins) || emp.brk,
        obs: existing?.obs || '', status: 'draft',
        method: methodLabel, citedIn, citedOut,
      });
    } else {
      if (!existing) { showToast('Debes fichar la entrada antes de registrar la salida.', 'warning'); return; }
      upsertRec({ ...existing, exit: t, brk: parseInt(brkMins) || emp.brk, status: 'draft' });
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

  const savePerm = () => {
    if (locked) { showToast(LOCK_MSG, 'warning'); return; }
    const h = parseFloat(permH);
    if (!h || h <= 0) { showToast('Indica las horas de la ausencia.', 'warning'); return; }
    const base = recs.find(r => r.eid === emp.id && r.date === TODAY) || {
      id: crypto.randomUUID(), eid: emp.id, date: TODAY, entry: '', exit: '',
      brk: emp.brk, obs: '', status: 'draft', method: '—', citedIn, citedOut,
    };
    upsertRec({ ...base, permMin: Math.round(h * 60), permReason });
    setPermH('');
    showToast(`Ausencia parcial registrada: ${h} h (${permReason})`, 'success');
  };

  const saveKm = (on) => {
    if (locked) { showToast(LOCK_MSG, 'warning'); return; }
    const base = recs.find(r => r.eid === emp.id && r.date === TODAY) || {
      id: crypto.randomUUID(), eid: emp.id, date: TODAY, entry: '', exit: '',
      brk: emp.brk, obs: '', status: 'draft', method: '—', citedIn, citedOut,
    };
    const cnt = parseFloat(kmCount);
    upsertRec({ ...base, kmApplied: on, kmCount: on && cnt > 0 ? cnt : null });
    showToast(on ? 'Kilometraje marcado. El administrador le asignará un importe.' : 'Kilometraje retirado.', on ? 'success' : 'info');
  };

  const confirmFichaje = () => {
    const r = recs.find(x => x.eid === emp.id && x.date === TODAY);
    if (!r || !r.entry) { showToast('Ficha al menos la entrada antes de confirmar.', 'warning'); return; }
    if (!r.exit && !window.confirm('Aún no has fichado la salida. ¿Confirmar el fichaje del día igualmente?')) return;
    upsertRec({ ...r, status: 'pending' });
    showToast('✓ Fichaje confirmado y enviado a administración.', 'success');
  };

  // El descanso es del día real (a veces no se cumplen los 60 min), no de la
  // citación. Se guarda directamente en el fichaje de hoy; si aún no hay
  // fichaje, se deja anotado en un borrador para que cuente al fichar.
  const saveBrk = () => {
    if (locked) { showToast(LOCK_MSG, 'warning'); return; }
    const b = parseInt(brkMins);
    const mins = Number.isFinite(b) && b >= 0 ? b : emp.brk;
    const base = recs.find(r => r.eid === emp.id && r.date === TODAY) || {
      id: crypto.randomUUID(), eid: emp.id, date: TODAY, entry: '', exit: '',
      obs: '', status: 'draft', method: '—', citedIn, citedOut,
    };
    upsertRec({ ...base, brk: mins });
    showToast(`Descanso del día: ${mins} min`, 'success');
  };

  const saveObs = () => {
    if (locked) { showToast(LOCK_MSG, 'warning'); return; }
    if (!obs.trim()) { showToast('Escribe una observación antes de guardar.', 'warning'); return; }
    const existing = recs.find(r => r.eid === emp.id && r.date === TODAY);
    upsertRec({
      id: existing?.id || crypto.randomUUID(),
      eid: emp.id, date: TODAY,
      entry: existing?.entry || '', exit: existing?.exit || '',
      brk: emp.brk, obs: obs.trim(), status: 'draft',
      method: '—', citedIn, citedOut,
    });
    setObs('');
    showToast('Observación guardada.', 'success');
  };

  const savePastDay = () => {
    if (!selectedPast) { showToast('Selecciona un día.', 'warning'); return; }
    const isFestivoPast = festivoSet.has(selectedPast);
    const existingRec = recs.find(r => r.eid === emp.id && r.date === selectedPast);
    const recId = existingRec?.id || crypto.randomUUID();

    if (pastType === 'festivo' || (isFestivoPast && pastType === 'festivo-no')) {
      upsertRec({
        id: recId, eid: emp.id, date: selectedPast,
        entry: '', exit: '', brk: 0,
        obs: festivos.find(f => f.date === selectedPast)?.name || 'Festivo',
        status: 'pending', method: 'Manual', citedIn: emp.start, citedOut: emp.end, absence: 'festivo',
      });
    } else if (pastType === 'libranza') {
      upsertRec({
        id: recId, eid: emp.id, date: selectedPast,
        entry: '', exit: '', brk: emp.brk,
        obs: 'Libranza', status: 'pending', method: 'Manual',
        citedIn: emp.start, citedOut: emp.end, libranza: true,
      });
    } else {
      if (!pastEntry || !pastExit) { showToast('Indica entrada y salida.', 'warning'); return; }
      if (t2m(pastEntry) < t2m(emp.start)) { showToast(`La entrada no puede ser anterior a la hora citada (${emp.start}).`, 'warning'); return; }
      upsertRec({
        id: recId, eid: emp.id, date: selectedPast,
        entry: pastEntry, exit: pastExit, brk: parseInt(pastBrk) || emp.brk,
        obs: pastObs, status: 'pending', method: 'Manual retroactivo',
        citedIn: emp.start, citedOut: emp.end,
      });
    }
    setSelectedPast('');
    setPastEntry(''); setPastExit(''); setPastObs(''); setPastType('normal');
  };

  const saveExtraDay = () => {
    if (!extraDate) { showToast('Selecciona una fecha.', 'warning'); return; }
    if (!extraEntry || !extraExit) { showToast('Indica entrada y salida.', 'warning'); return; }
    if (recs.some(r => r.eid === emp.id && r.date === extraDate)) {
      showToast('Ya existe un registro para ese día.', 'error'); return;
    }
    const citedMins = Math.round(parseFloat(extraCited) * 60) || 0;
    const brk = parseInt(extraBrk) || 0;
    const entryMin = t2m(extraEntry);
    const citedOutMin = entryMin + citedMins + brk;
    const citedOutH = String(Math.floor(citedOutMin / 60) % 24).padStart(2, '0');
    const citedOutM = String(citedOutMin % 60).padStart(2, '0');
    const cnt = parseFloat(extraKmCount);
    upsertRec({
      id: crypto.randomUUID(), eid: emp.id, date: extraDate,
      entry: extraEntry, exit: extraExit, brk,
      obs: extraObs, status: 'pending', method: 'Manual',
      citedIn: extraEntry, citedOut: `${citedOutH}:${citedOutM}`,
      extraDay: true,                       // día no habitual → todo va al acumulado
      special: citedMins > 555,             // jornada especial automática si citación > 9h15
      kmApplied: extraKm, kmCount: extraKm && cnt > 0 ? cnt : null,
    });
    setExtraDate(''); setExtraCited(defaultExtraCited);
    setExtraEntry(''); setExtraExit('');
    setExtraBrk(emp.brk); setExtraObs('');
    setExtraKm(false); setExtraKmCount('');
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

      {plan?.kind === 'libranza' && !rec && (
        <div style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid var(--teal)', borderRadius: 'var(--r)', padding: '1rem 1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--teal)' }}>📋 HOY LIBRAS</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text2)' }}>
              Según la planificación de producción
            </span>
          </div>
          <button className="btn-teal" onClick={doLibranza}>MARCAR LIBRANZA</button>
        </div>
      )}

      {plan && plan.kind !== 'libranza' && !rec && (
        <div style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid var(--teal)', borderRadius: 'var(--r)', padding: '.8rem 1.2rem', marginBottom: '1rem', fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ fontWeight: 700, color: 'var(--teal)' }}>📋 Citación de producción</span>
          {' · '}{plan.cited_in}–{plan.cited_out}
          {plan.brk != null ? ` · ${plan.brk} min de descanso` : ''}
          {plan.location ? ` · ${plan.location}` : ''}
        </div>
      )}

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
          {locked && (
            <div style={{ background: rec.status === 'approved' ? 'rgba(51,214,192,0.08)' : 'rgba(201,242,62,0.08)', border: `1px solid ${rec.status === 'approved' ? 'var(--teal)' : 'var(--accent)'}`, borderRadius: 'var(--r)', padding: '.7rem 1rem', marginBottom: '.85rem', fontSize: 13, color: rec.status === 'approved' ? 'var(--teal)' : 'var(--accent)', fontWeight: 600 }}>
              {rec.status === 'approved'
                ? '✓ Fichaje aprobado por administración.'
                : '✓ Fichaje confirmado · pendiente de revisión. Para corregir algo, edítalo desde tu Historial.'}
            </div>
          )}
          <div style={{ opacity: locked ? 0.5 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
          {/* Citación de referencia + ajuste plegable */}
          <div className="fichar-cita">
            <div style={{ minWidth: 0 }}>
              <span className="fichar-cita-lbl">Tu citación de hoy</span>
              <span className="fichar-cita-val">
                {citedIn} – {citedOut} · {brkMins} min descanso
                {isLongCited && <span className="b ba" style={{ fontSize: 11, marginLeft: 8 }}>⭐ Especial</span>}
              </span>
            </div>
            <button className="btn-sm" onClick={() => setAjustar(a => !a)}>{ajustar ? 'Cerrar' : 'Ajustar'}</button>
          </div>
          {ajustar && (
            <div className="fichar-ajuste">
              <label>Entrada <input type="time" className="tinput" value={citedIn} onChange={e => setCitedIn(e.target.value)} /></label>
              <label>Salida <input type="time" className="tinput" value={citedOut} onChange={e => setCitedOut(e.target.value)} /></label>
              <button className="btn-sm" onClick={applyCited}>Aplicar</button>
            </div>
          )}

          {/* Acción principal: dos botones grandes */}
          <div className="fichar-acciones">
            <div className="fa-col">
              <button className="fbtn fbtn-in" onClick={() => doFich('in', 'def')}>
                <span className="fbtn-k">Fichar entrada</span>
                <span className="fbtn-h">{citedIn}</span>
              </button>
              <div className="fa-alt">
                <button className="btn-sm" onClick={() => doFich('in', 'now')}>Ahora · {time}</button>
                <input type="time" value={custIn} onChange={e => setCustIn(e.target.value)} className="fa-time" />
                <button className="btn-sm" onClick={() => doFich('in', 'cust')}>Otra</button>
              </div>
            </div>
            <div className="fa-col">
              <button className="fbtn fbtn-out" onClick={() => doFich('out', 'def')}>
                <span className="fbtn-k">Fichar salida</span>
                <span className="fbtn-h">{citedOut}</span>
              </button>
              <div className="fa-alt">
                <button className="btn-sm" onClick={() => doFich('out', 'now')}>Ahora · {time}</button>
                <input type="time" value={custOut} onChange={e => setCustOut(e.target.value)} className="fa-time" />
                <button className="btn-sm" onClick={() => doFich('out', 'cust')}>Otra</button>
              </div>
            </div>
          </div>

          <div className="fichar-secundario">
            <div className="fichar-desc">
              <span className="fx-lbl" style={{ margin: 0 }}>Descanso real</span>
              <input type="number" min={0} step={5} value={brkMins}
                onChange={e => setBrkMins(e.target.value)} className="fx-num" />
              <span className="fichar-hint">min</span>
              <button className="btn-sm" onClick={saveBrk}>Aplicar</button>
            </div>
            <button className="btn-libranza" onClick={doLibranza}>📅 Hoy libro</button>
          </div>
          <p className="fichar-hint" style={{ marginBottom: '.85rem' }}>
            Cambia el descanso si hoy no has disfrutado tus {emp.brk} min habituales. La libranza compensa {emp.ch}h de contrato.
          </p>

          {/* Lo que casi nunca se usa, plegado */}
          <details className="fichar-extra">
            <summary>Añadir a la jornada — ausencia médica, kilometraje, observación</summary>
            <div className="fichar-extra-body">
              <div className="fx-block">
                <span className="fx-lbl">Ausencia parcial justificada (médico, etc.)</span>
                <div className="fx-row">
                  <select value={permReason} onChange={e => setPermReason(e.target.value)} className="fx-sel">
                    {PERM_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                  <input type="number" min={0} step={0.25} value={permH} onChange={e => setPermH(e.target.value)} placeholder="0" className="fx-num" />
                  <span className="fichar-hint">horas</span>
                  <button className="btn-sm" onClick={savePerm}>Aplicar</button>
                  {rec?.permMin > 0 && <span className="b bp" style={{ fontSize: 11 }}>{Math.round(rec.permMin / 60 * 100) / 100} h · {rec.permReason}</span>}
                </div>
                <p className="fichar-hint">No penaliza tu saldo: se descuentan de la jornada esperada del día.</p>
              </div>
              <div className="fx-block">
                <span className="fx-lbl">Kilometraje</span>
                <div className="fx-row">
                  <label className="fx-chk">
                    <input type="checkbox" checked={kmOn} onChange={e => setKmOn(e.target.checked)} /> 🚗 Aplicar
                  </label>
                  {kmOn && <input type="number" min={0} step={1} value={kmCount} onChange={e => setKmCount(e.target.value)} placeholder="km" className="fx-num" />}
                  <button className="btn-sm" onClick={() => saveKm(kmOn)}>Aplicar</button>
                  {rec?.kmApplied && (
                    <span className="b bp" style={{ fontSize: 11 }}>
                      🚗 {rec.kmEur != null ? `${rec.kmEur} €` : `${rec.kmCount ? rec.kmCount + ' km · ' : ''}pendiente`}
                    </span>
                  )}
                </div>
                <p className="fichar-hint">El administrador asigna el importe en € al revisar tu jornada.</p>
              </div>
              <div className="fx-block">
                <span className="fx-lbl">Observación del día</span>
                <div className="fx-row">
                  <input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ej: rodaje exterior..." className="fx-obs" />
                  <button className="btn-sm" onClick={saveObs}>Guardar</button>
                </div>
              </div>
            </div>
          </details>
          </div>
          {!locked && rec?.entry && (
            <div style={{ marginTop: '.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', background: 'rgba(201,242,62,0.06)', border: '1px solid var(--accent)', borderRadius: 'var(--r)', padding: '.8rem 1rem' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cuando termines, confirma tu fichaje para enviarlo a administración. Mientras no lo confirmes queda en <b style={{ color: 'var(--accent)' }}>borrador</b> y solo lo ves tú.</span>
              <button className="btn-accent" onClick={confirmFichaje} disabled={!canConfirm} style={{ flexShrink: 0 }}>✓ Confirmar fichaje</button>
            </div>
          )}
        </div>
      </div>

      <div className="tc">
        <div className="tch">
          <h3>Fichajes de hoy</h3>
          {rec && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!rec.absence && rec.status === 'approved' && <span className="b bg">Aprobado</span>}
              {!rec.absence && rec.status === 'pending' && <span className="b by">Pendiente</span>}
              {!rec.absence && rec.status === 'draft' && <span className="b" style={{ background: 'var(--bg4)', color: 'var(--text2)' }}>📝 Borrador</span>}
              {rec.special && <span className="b ba">⭐ Jornada especial</span>}
              {rec.catUp && <span className="b bp">⬆ Subida categoría</span>}
              {rec.libranza && <span className="b bp">📅 Libranza</span>}
              {rec.permMin > 0 && <span className="b bp" title={rec.permReason || ''}>🩺 {Math.round(rec.permMin / 60 * 100) / 100}h just.</span>}
              {rec.kmApplied && <span className="b bp">🚗 {rec.kmEur != null ? `${rec.kmEur} €` : (rec.kmCount ? `${rec.kmCount} km` : 'kilometraje')}</span>}
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Contacta con administración para corregir errores</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={extraKm} onChange={e => setExtraKm(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              🚗 Aplicar kilometraje
            </label>
            {extraKm && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="number" min={0} step={1} value={extraKmCount} onChange={e => setExtraKmCount(e.target.value)} placeholder="0" style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13, width: 80, outline: 'none' }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>km (opcional)</span>
              </div>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: '.75rem' }}>
            Es un día que normalmente no trabajas: <b style={{ color: 'var(--teal)' }}>todo el tiempo trabajado se suma a tu acumulado</b> (no genera compensación). La jornada especial se marca sola si la citación supera 9h15.
          </p>
          <button className="btn-accent" onClick={saveExtraDay} disabled={!extraDate || !extraEntry || !extraExit}>
            Registrar jornada no habitual
          </button>
        </div>
      </div>
    </>
  );
}
