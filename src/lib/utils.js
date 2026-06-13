export const t2m = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const m2t = m => { const a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
export const fmt = m => { if (m === 0) return '0h 00m'; const a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60; return `${m < 0 ? '−' : ''}${h}h ${String(mm).padStart(2, '0')}m`; };

export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtDate = d => { if (!d) return '—'; const [y, mo, dy] = d.split('-'); return `${parseInt(dy)} ${MONTHS[parseInt(mo) - 1]} ${y}`; };

export const getToday = () => new Date().toISOString().slice(0, 10);

export function weekDates(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function weekLabel(offsetWeeks = 0) {
  const dates = weekDates(offsetWeeks);
  const a = new Date(dates[0]), b = new Date(dates[4]);
  return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

export function calcRec(rec, emp) {
  if (!rec || rec.absence) return { net: 0, accum: 0, comp: 0, extra: 0, total: 0, citedNet: 0, absence: rec?.absence };
  if (!rec.exit || !rec.entry) {
    if (rec.libranza) {
      const contractMin = emp.ch * 60;
      return { net: 0, accum: 0, comp: contractMin, extra: 0, total: -contractMin, citedNet: 0, libranza: true };
    }
    return { net: 0, accum: 0, comp: 0, extra: 0, total: 0, citedNet: 0 };
  }
  const ci = rec.citedIn || emp.start, co = rec.citedOut || emp.end;
  const realBrk = rec.brk != null ? rec.brk : emp.brk;
  let citedOutMin = t2m(co), citedInMin = t2m(ci);
  if (citedOutMin < citedInMin) citedOutMin += 24 * 60;
  const citedNet = (citedOutMin - citedInMin) - realBrk;
  // Ausencia parcial justificada (médico, etc.): se descuenta de la jornada
  // ESPERADA, no de la trabajada, así no penaliza el saldo (permiso retribuido).
  const permMin = rec.permMin || 0;
  const contractMin = Math.max(0, emp.ch * 60 - permMin);
  let exitMin = t2m(rec.exit), entryMin = t2m(rec.entry);
  if (exitMin < entryMin) exitMin += 24 * 60;
  const worked = exitMin - entryMin;
  const net = worked - realBrk;
  // Jornada no habitual (fin de semana / festivo trabajado): no hay jornada
  // esperada, así que TODO el trabajo se suma al acumulado y nunca compensa.
  if (rec.extraDay) {
    return { net, accum: net, comp: 0, extra: 0, total: net, citedNet, citedStart: ci, citedEnd: co, extraDay: true };
  }
  let accum = 0, comp = 0, extra = 0;
  if (net < contractMin) { comp = contractMin - net; }
  else if (net <= citedNet) { accum = net - contractMin; }
  else { accum = citedNet - contractMin; extra = net - citedNet; }
  const total = accum + extra * 1.5 - comp;
  return { net, accum, comp, extra, total, citedNet, citedStart: ci, citedEnd: co };
}

// Actors: effective = (actorEnd - actorCited) - actorBreak
//   + max(0, actorMakeup - 60)          [makeup beyond first hour]
//   + max(0, actorTravelIn + actorTravelOut - 90)  [travel beyond 1h30]
// No "extra" concept — only accum and comp.
export function calcActorRec(rec, emp) {
  if (!rec || rec.absence) return { net: 0, accum: 0, comp: 0, total: 0, absence: rec?.absence };
  if (rec.libranza) {
    const contractMin = emp.ch * 60;
    return { net: 0, accum: 0, comp: contractMin, total: -contractMin, libranza: true };
  }
  if (!rec.actorEnd || !rec.actorCited) return { net: 0, accum: 0, comp: 0, total: 0 };
  let endMin = t2m(rec.actorEnd), citedMin = t2m(rec.actorCited);
  if (endMin < citedMin) endMin += 24 * 60;
  const base = endMin - citedMin;
  const brk = rec.actorBreak ?? 0;
  const makeupExtra = Math.max(0, (rec.actorMakeup ?? 0) - 60);
  const travelExtra = Math.max(0, (rec.actorTravelIn ?? 0) + (rec.actorTravelOut ?? 0) - 90);
  const net = base - brk + makeupExtra + travelExtra;
  const permMin = rec.permMin || 0;
  const contractMin = Math.max(0, emp.ch * 60 - permMin);
  const accum = Math.max(0, net - contractMin);
  const comp = Math.max(0, contractMin - net);
  return { net, accum, comp, total: accum - comp, makeupExtra, travelExtra };
}

export function calcRecForEmp(rec, emp) {
  return emp?.dept === 'Actores' ? calcActorRec(rec, emp) : calcRec(rec, emp);
}

export function calcPeriod(eid, emps, recs, filterFn) {
  const emp = emps.find(e => e.id === eid);
  const isActor = emp?.dept === 'Actores';
  const filtered = recs.filter(r =>
    r.eid === eid && !r.absence &&
    (r.exit || r.actorEnd || r.libranza) &&
    (!filterFn || filterFn(r))
  );
  let accum = 0, comp = 0, extra = 0, days = 0;
  filtered.forEach(r => {
    const c = isActor ? calcActorRec(r, emp) : calcRec(r, emp);
    accum += c.accum; comp += c.comp; extra += (c.extra || 0); days++;
  });
  const total = isActor ? (accum - comp) : (accum + extra * 1.5 - comp);
  return { accum, comp, extra, total, days };
}

export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const ABS_MAP = {
  baja: '🏥 Baja médica',
  vacaciones: '🌴 Vacaciones',
  festivo: '🎉 Festivo',
  permiso: '📋 Permiso',
};
