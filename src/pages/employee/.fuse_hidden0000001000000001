import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcRecForEmp, fmt, fmtDate, weekDates, weekLabel, getToday, DAY_NAMES, MONTHS, ABS_MAP } from '../../lib/utils';
import EditDayModal from '../../components/modals/EditDayModal';

export default function History({ emp }) {
  const { recs, paid, festivos } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [editDay, setEditDay] = useState(null);

  const isActor = emp.dept === 'Actores';
  const dates = weekDates(weekOffset);
  let weekNet = 0, weekSaldo = 0;

  // Nombre del festivo para una fecha (o null si no lo es)
  const festivoName = (ds) => {
    const f = festivos.find(x => x.date === ds);
    return f ? (f.name || 'Festivo') : null;
  };

  return (
    <>
      <div className="ph">
        <div><h1>Historial de jornadas</h1><p>Edita días pasados — los cambios requieren aprobación</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-sm" onClick={() => setWeekOffset(w => w - 1)}>◀ Semana ant.</button>
          <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{weekLabel(weekOffset)}</span>
          <button className="btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Semana sig. ▶</button>
        </div>
      </div>

      <div className="ws">
        {DAY_NAMES.map((d, i) => {
          const ds = dates[i];
          const rec = recs.find(r => r.eid === emp.id && r.date === ds);
          const isT = ds === getToday(), isW = i >= 5;
          const fest = festivoName(ds);
          const hasdata = rec && ((isActor ? rec.actorEnd : rec.exit) || rec.libranza || rec.absence);
          let lbl = '—';
          if (rec) {
            if (rec.absence) lbl = rec.absence.slice(0, 4).toUpperCase();
            else if (rec.libranza) lbl = '📅';
            else if (isActor ? rec.actorEnd : rec.exit) lbl = fmt(calcRecForEmp(rec, emp).net);
            else if (rec.entry) lbl = rec.entry;
          }
          const showFest = !hasdata && fest;
          return (
            <div key={ds} className={`wd${isT ? ' today' : ''}${isW ? ' wknd' : ''}${hasdata ? ' hasdata' : ''}`}>
              <div className="wdn">{d}</div>
              <div className="wdnum">{parseInt(ds.split('-')[2])}<span style={{ fontSize: 11, fontWeight: 500, opacity: .7, marginLeft: 3 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></div>
              <div className="wdh" style={showFest ? { color: 'var(--amber)', fontSize: 11, fontWeight: 600 } : undefined}>{showFest ? 'Festivo' : lbl}</div>
            </div>
          );
        })}
      </div>

      <div className="tc">
        <div className="tch"><h3>Detalle semanal</h3></div>
        {isActor ? (
          <table>
            <thead>
              <tr><th>Día</th><th>Citación</th><th>Fin</th><th>Caract.</th><th>Viaje I.</th><th>Viaje V.</th><th>Descanso</th><th>Efectivo</th><th>Saldo</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {DAY_NAMES.map((d, i) => {
                const ds = dates[i];
                const rec = recs.find(r => r.eid === emp.id && r.date === ds);
                const isT = ds === getToday(), isW = i >= 5;
                const c = (rec?.actorEnd || rec?.libranza) ? calcRecForEmp(rec, emp) : null;
                if (c?.net) weekNet += c.net;
                if (c?.total) weekSaldo += c.total;

                const festA = festivoName(ds);
                if (!rec) {
                  if (festA) {
                    return (
                      <tr key={ds}>
                        <td><b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b>{isT && <span className="b by" style={{ fontSize: 10, marginLeft: 4 }}>Hoy</span>}</td>
                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--amber)', fontWeight: 600 }}>🎉 Festivo · {festA}</td>
                        <td>{!isT && <button className="btn-sm" onClick={() => setEditDay(ds)}>Editar</button>}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={ds} style={isW ? { opacity: .35 } : {}}>
                      <td><b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b>{isT && <span className="b by" style={{ fontSize: 10, marginLeft: 4 }}>Hoy</span>}</td>
                      <td colSpan={isW ? 10 : 9} style={{ color: 'var(--text3)' }}>{isW ? '—' : 'Sin fichaje'}</td>
                      {!isW && <td>{!isT && <button className="btn-sm" onClick={() => setEditDay(ds)}>Editar</button>}</td>}
                    </tr>
                  );
                }
                if (rec.absence) {
                  return (
                    <tr key={ds} style={{ opacity: .7 }}>
                      <td><b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b></td>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', fontStyle: 'italic' }}>{ABS_MAP[rec.absence] || rec.absence}</td>
                      <td><span className="b bg">Aprobado</span></td>
                      <td></td>
                    </tr>
                  );
                }
                const lib = rec.libranza;
                return (
                  <tr key={ds} style={isT ? { outline: '1px solid rgba(232,255,71,.25)' } : {}}>
                    <td>
                      <b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b>
                      {isT && <span className="b by" style={{ fontSize: 10, marginLeft: 4 }}>Hoy</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{lib ? '—' : (rec.actorCited || '—')}</td>
                    <td style={{ fontFamily: 'monospace' }}>{lib ? '—' : (rec.actorEnd || '—')}</td>
                    <td style={{ fontSize: 12 }}>{lib ? '—' : `${rec.actorMakeup ?? '—'}min`}</td>
                    <td style={{ fontSize: 12 }}>{lib ? '—' : `${rec.actorTravelIn ?? '—'}min`}</td>
                    <td style={{ fontSize: 12 }}>{lib ? '—' : `${rec.actorTravelOut ?? '—'}min`}</td>
                    <td style={{ fontSize: 12 }}>{lib ? '—' : `${rec.actorBreak ?? '—'}min`}</td>
                    <td style={{ fontWeight: 700 }}>{lib ? '📅 Libranza' : (c ? fmt(c.net) : '—')}</td>
                    <td>
                      {lib && <span style={{ color: 'var(--coral)' }}>−{fmt(emp.ch * 60)}</span>}
                      {!lib && c && c.accum > 0 && <span style={{ color: 'var(--teal)', fontWeight: 600 }}>+{fmt(c.accum)}</span>}
                      {!lib && c && c.comp > 0 && <span style={{ color: 'var(--coral)', fontWeight: 600 }}>−{fmt(c.comp)}</span>}
                      {!lib && c && c.accum === 0 && c.comp === 0 && <span style={{ color: 'var(--text3)' }}>0</span>}
                    </td>
                    <td>{rec.status === 'approved' ? <span className="b bg">Aprobado</span> : rec.status === 'draft' ? <span className="b" style={{ background: 'var(--bg4)', color: 'var(--text2)' }}>📝 Borrador</span> : <span className="b by">Pendiente</span>}</td>
                    <td>{!isT && <button className="btn-sm" onClick={() => setEditDay(ds)}>Editar</button>}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} style={{ color: 'var(--text3)' }}>Total semana</td>
                <td style={{ color: 'var(--teal)', fontWeight: 700 }}>{weekNet ? fmt(weekNet) : '—'}</td>
                <td style={{ color: 'var(--teal)', fontWeight: 700 }}>{weekSaldo ? `${weekSaldo >= 0 ? '+' : ''}${fmt(Math.round(weekSaldo))}` : '—'}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table>
            <thead>
              <tr><th>Día</th><th>Entrada</th><th>Salida</th><th>Descanso</th><th>Netas</th><th>Saldo</th><th>Estado</th><th>Obs.</th><th></th></tr>
            </thead>
            <tbody>
              {DAY_NAMES.map((d, i) => {
                const ds = dates[i];
                const rec = recs.find(r => r.eid === emp.id && r.date === ds);
                const isT = ds === getToday(), isW = i >= 5;
                const c = (rec?.exit || rec?.libranza) ? calcRecForEmp(rec, emp) : null;
                const dayPaid = paid.filter(p => p.eid === emp.id && p.date === ds);
                const dayPaidExtMin = dayPaid.reduce((a, p) => a + p.extMin, 0);
                const dayPaidOrdMin = dayPaid.reduce((a, p) => a + p.ordMin, 0);
                const dayPaidDeduction = dayPaidExtMin * 1.5 + dayPaidOrdMin;
                if (c?.net) weekNet += c.net;
                if (c?.total) weekSaldo += c.total;
                if (dayPaidDeduction > 0) weekSaldo -= dayPaidDeduction;

                const fest = festivoName(ds);
                if (!rec) {
                  if (fest) {
                    return (
                      <tr key={ds}>
                        <td><b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b>{isT && <span className="b by" style={{ fontSize: 10, marginLeft: 4 }}>Hoy</span>}</td>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--amber)', fontWeight: 600 }}>🎉 Festivo · {fest}</td>
                        <td>{!isT && <button className="btn-sm" onClick={() => setEditDay(ds)}>Editar</button>}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={ds} style={isW ? { opacity: .35 } : {}}>
                      <td><b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b>{isT && <span className="b by" style={{ fontSize: 10, marginLeft: 4 }}>Hoy</span>}</td>
                      <td colSpan={isW ? 8 : 7} style={{ color: 'var(--text3)' }}>{isW ? '—' : 'Sin fichaje'}</td>
                      {!isW && <td>{!isT && <button className="btn-sm" onClick={() => setEditDay(ds)}>Editar</button>}</td>}
                    </tr>
                  );
                }
                if (rec.absence) {
                  return (
                    <tr key={ds} style={{ opacity: .7 }}>
                      <td><b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b></td>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', fontStyle: 'italic' }}>{ABS_MAP[rec.absence] || rec.absence}</td>
                      <td><span className="b bg">Aprobado</span></td>
                      <td></td>
                    </tr>
                  );
                }
                const realBrk = rec.brk != null ? rec.brk : emp.brk;
                const lib = rec.libranza;
                const remainingExtra = Math.max(0, (c?.extra ?? 0) - dayPaidExtMin);
                let saldoEl = <span>—</span>;
                if (lib) saldoEl = <span style={{ color: 'var(--teal)' }}>−{fmt(emp.ch * 60)}</span>;
                else if (rec.exit && c) {
                  const parts = [];
                  if (c.comp > 0) parts.push(<span key="c" style={{ color: 'var(--teal)' }}>−{fmt(c.comp)}</span>);
                  if (c.accum > 0) parts.push(<span key="a" style={{ color: 'var(--teal)' }}>+{fmt(c.accum)}</span>);
                  if (remainingExtra > 0) parts.push(<span key="e" style={{ color: 'var(--purple)' }}>+{fmt(remainingExtra)} ext</span>);
                  saldoEl = (
                    <>
                      {parts.length ? parts.map((p, idx) => <span key={idx}>{p} </span>) : <span style={{ color: 'var(--text3)' }}>0</span>}
                      {dayPaidExtMin > 0 && <span className="b bp" style={{ fontSize: 10, marginLeft: 4 }}>💰{fmt(dayPaidExtMin)}</span>}
                      {dayPaidOrdMin > 0 && <span className="b bp" style={{ fontSize: 10, marginLeft: 4 }}>💰{fmt(dayPaidOrdMin)} ord</span>}
                    </>
                  );
                }
                return (
                  <tr key={ds} style={isT ? { outline: '1px solid rgba(232,255,71,.25)' } : {}}>
                    <td>
                      <b>{d} {parseInt(ds.split('-')[2])} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{MONTHS[parseInt(ds.split('-')[1]) - 1]}</span></b>
                      {isT && <span className="b by" style={{ fontSize: 10, marginLeft: 4 }}>Hoy</span>}
                      {fest && <span style={{ fontSize: 10, marginLeft: 3, padding: '1px 6px', borderRadius: 6, background: 'rgba(230,166,58,.15)', color: 'var(--amber)', fontWeight: 600 }}>Festivo</span>}
                      {rec.permMin > 0 && <span className="b bp" style={{ fontSize: 10, marginLeft: 3 }} title={rec.permReason || ''}>🩺 {Math.round(rec.permMin / 60 * 100) / 100}h just.</span>}
                      {rec.kmApplied && <span className="b bp" style={{ fontSize: 10, marginLeft: 3 }} title={rec.kmCount ? `${rec.kmCount} km` : ''}>🚗 {rec.kmEur != null ? `${rec.kmEur} €` : 'km'}</span>}
                      {rec.extraDay && <span className="b bt" style={{ fontSize: 10, marginLeft: 3 }} title="Jornada no habitual: todo al acumulado">🗓️</span>}
                      {rec.special && <span className="b ba" style={{ fontSize: 10, marginLeft: 3 }}>⭐E</span>}
                      {rec.catUp && <span className="b bp" style={{ fontSize: 10, marginLeft: 3 }}>⬆</span>}
                      {dayPaidExtMin > 0 && <span className="b bp" style={{ fontSize: 10, marginLeft: 3 }}>💰{fmt(dayPaidExtMin)}</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{lib ? '—' : (rec.entry || '—')}</td>
                    <td style={{ fontFamily: 'monospace' }}>{lib ? '—' : (rec.exit || '—')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{rec.exit ? fmt(realBrk) : '—'}</td>
                    <td style={{ fontWeight: 700 }}>{lib ? '📅 Libranza' : (rec.exit ? fmt(c.net) : '—')}</td>
                    <td>{saldoEl}</td>
                    <td>{rec.status === 'approved' ? <span className="b bg">Aprobado</span> : rec.status === 'draft' ? <span className="b" style={{ background: 'var(--bg4)', color: 'var(--text2)' }}>📝 Borrador</span> : <span className="b by">Pendiente</span>}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{rec.obs || '—'}</td>
                    <td>{!isT && <button className="btn-sm" onClick={() => setEditDay(ds)}>Editar</button>}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ color: 'var(--text3)' }}>Total semana</td>
                <td style={{ color: 'var(--teal)', fontWeight: 700 }}>{weekNet ? fmt(weekNet) : '—'}</td>
                <td style={{ color: 'var(--teal)', fontWeight: 700 }}>{weekSaldo ? `${weekSaldo >= 0 ? '+' : ''}${fmt(Math.round(weekSaldo))}` : '—'}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      {editDay && <EditDayModal empId={emp.id} date={editDay} onClose={() => setEditDay(null)} />}
    </>
  );
}
