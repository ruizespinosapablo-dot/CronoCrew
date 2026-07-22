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
