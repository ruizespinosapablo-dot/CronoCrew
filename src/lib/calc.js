// ─────────────────────────────────────────────────────────────────────────────
// ClapSuite · CÁLCULO HORARIO — ORIGEN ÚNICO
//
// Este archivo es la ÚNICA definición del cómputo de horas de ClapSuite. Lo
// usan ClapTime (registro legal) y ClapCrew (panel de equilibrio). Si las dos
// apps calcularan por su cuenta, acabarían diciendo cosas distintas sobre las
// mismas horas, y esa discrepancia sería casi imposible de detectar a tiempo.
//
// REGLAS:
//   · Se edita AQUÍ y solo aquí. La copia de ClapCrew es generada.
//   · Tras cualquier cambio:  cd ~/ClapCrew && node scripts/sync_calc.mjs
//   · Sin dependencias ni imports: tiene que poder copiarse tal cual.
// ─────────────────────────────────────────────────────────────────────────────

const t2m = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

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
  // Dos descansos distintos, y es crucial no confundirlos:
  //   realBrk  = el que la persona disfrutó de verdad (lo que fichó).
  //   citedBrk = el planificado en la citación. Si falta, se asume el de
  //              contrato (emp.brk).
  // La jornada CITADA se calcula con el descanso planificado; la TRABAJADA, con
  // el real. Así, descansar menos de lo previsto hace que el trabajo sobrepase
  // la jornada citada y ese exceso cuente como EXTRA (1,5×), no como acumulado.
  const realBrk = rec.brk != null ? rec.brk : emp.brk;
  const citedBrk = rec.citedBrk != null ? rec.citedBrk : emp.brk;
  let citedOutMin = t2m(co), citedInMin = t2m(ci);
  if (citedOutMin < citedInMin) citedOutMin += 24 * 60;
  const citedNet = (citedOutMin - citedInMin) - citedBrk;
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

// ─── Descansos mínimos entre jornadas ───────────────────────────────────────
// Convenios del sector + STS 274/2026. Los usan ClapTime (sobre fichajes
// reales) y ClapCrew (sobre citaciones planificadas). Si cambian, se cambian
// AQUÍ y se sincroniza ClapCrew.
export const REST_DAY_H = 12;            // técnicos: entre fin de jornada e inicio de la siguiente
export const REST_DAY_ACTOR_H = 13;      // actores: su convenio exige 13h
export const REST_WEEKEND_H = 60;        // técnicos: descanso semanal (STS 274/2026)
export const REST_WEEKEND_ACTOR_H = 48;  // actores: descanso semanal de su convenio

// ¿Hay sábado o domingo ENTRE las dos fechas (sin contarlas)? Entonces lo que
// aplica es el descanso semanal, no el de entre jornadas.
export function weekendBetween(d1, d2) {
  const b = new Date(d2 + 'T00:00:00');
  for (let t = new Date(new Date(d1 + 'T00:00:00').getTime() + 86400000); t < b; t = new Date(t.getTime() + 86400000)) {
    const wd = t.getDay();
    if (wd === 0 || wd === 6) return true;
  }
  return false;
}

// Horas de descanso entre el final de una jornada y el principio de la
// siguiente. Si la salida es menor o igual que la entrada, esa jornada cruzó
// medianoche y terminó al día siguiente.
export function restGapH(prevDate, prevIn, prevOut, curDate, curIn) {
  const pIn = t2m(prevIn), pOut = t2m(prevOut);
  const salida = new Date(prevDate + 'T00:00:00');
  if (pOut <= pIn) salida.setDate(salida.getDate() + 1);
  const salidaMs = salida.getTime() + pOut * 60000;
  const entradaMs = new Date(curDate + 'T00:00:00').getTime() + t2m(curIn) * 60000;
  return (entradaMs - salidaMs) / 3600000;
}

// Devuelve null si el descanso es suficiente; si no, cuánto hay y cuánto exige.
export function restCheck(prev, cur, esActor = false) {
  const gapH = restGapH(prev.date, prev.citedIn, prev.citedOut, cur.date, cur.citedIn);
  if (gapH < 0) return null;
  const finde = weekendBetween(prev.date, cur.date);
  const reqH = finde
    ? (esActor ? REST_WEEKEND_ACTOR_H : REST_WEEKEND_H)
    : (esActor ? REST_DAY_ACTOR_H : REST_DAY_H);
  return gapH < reqH ? { gapH, reqH, finde, prevDate: prev.date } : null;
}
