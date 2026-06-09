import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calcPeriod, fmt, fmtDate } from '../../lib/utils';

const fmtMin = (min) => {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const TYPE_META = {
  ext:     { icon: '💰', label: 'Extras pagadas',           color: 'var(--amber)' },
  ord:     { icon: '💰', label: 'Horas ordinarias pagadas', color: 'var(--teal)'  },
  special: { icon: '⭐', label: 'Jornada especial',         color: 'var(--amber)' },
  catup:   { icon: '⬆', label: 'Subida de categoría',      color: 'var(--purple)'},
};

function buildMonthOptions(cStart) {
  const options = [];
  const start = cStart ? new Date(cStart + 'T12:00:00') : new Date();
  const now = new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= now) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const label = cur.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    options.push({ value: `${y}-${m}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
    cur.setMonth(cur.getMonth() + 1);
  }
  options.push({ value: 'all', label: 'Todo el tiempo' });
  return options;
}

export default function Hours({ emp }) {
  const { recs, paid, emps } = useApp();
  const isActor = emp.dept === 'Actores';
  const monthOptions = useMemo(() => buildMonthOptions(emp.cStart), [emp.cStart]);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const defaultMonth = monthOptions.find(o => o.value === currentMonth)
    ? currentMonth
    : monthOptions[monthOptions.length - 2]?.value || 'all';
  const [month, setMonth] = useState(defaultMonth);

  const filterFn = month === 'all' ? null : (r => r.date.startsWith(month));
  const s = calcPeriod(emp.id, emps, recs, filterFn);
  const empPaid = paid.filter(p => p.eid === emp.id && (month === 'all' || p.date?.startsWith(month)));
  const pOrd = empPaid.reduce((a, p) => a + p.ordMin, 0);
  const pExt = empPaid.reduce((a, p) => a + p.extMin, 0);
  const totalNet = isActor ? s.total : s.total - (pOrd + pExt * 1.5);

  const specRecs = recs
    .filter(r => r.eid === emp.id && r.special && (month === 'all' || r.date?.startsWith(month)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const catUpRecs = recs
    .filter(r => r.eid === emp.id && r.catUp && (month === 'all' || r.date?.startsWith(month)))
    .sort((a, b) => a.date.localeCompare(b.date));

  const allItems = [];
  if (!isActor) {
    empPaid.forEach(p => {
      if (p.extMin > 0) allItems.push({ type: 'ext', date: p.date, note: p.note, amount: fmtMin(p.extMin) });
      if (p.ordMin > 0) allItems.push({ type: 'ord', date: p.date, note: p.note, amount: fmtMin(p.ordMin) });
    });
    specRecs.forEach(r => allItems.push({ type: 'special', date: r.date, note: r.specialNote }));
    catUpRecs.forEach(r => allItems.push({ type: 'catup', date: r.date, note: r.catUpNote }));
    allItems.sort((a, b) => a.date.localeCompare(b.date));
  }

  const allS = calcPeriod(emp.id, emps, recs);
  const allPaid = paid.filter(p => p.eid === emp.id);
  const allPOrd = allPaid.reduce((a, p) => a + p.ordMin, 0);
  const allPExt = allPaid.reduce((a, p) => a + p.extMin, 0);
  const allTotal = isActor ? allS.total : allS.total - (allPOrd + allPExt * 1.5);

  return (
    <>
      <div className="ph">
        <div><h1>Mis horas</h1><p>Saldo acumulado{isActor ? ' · Actor' : ''}</p></div>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', padding: '6px 11px', fontSize: 13, fontFamily: 'var(--fb)', outline: 'none' }}>
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="hs">
        <div className="hsc"><div className="hsl">Compensadas</div><div className="hsv cc">{s.comp > 0 ? '−' + fmt(s.comp) : '—'}</div><div className="hss">a recuperar</div></div>
        <div className="hsc"><div className="hsl">Acumuladas</div><div className="hsv ct">{s.accum > 0 ? '+' + fmt(s.accum) : '—'}</div><div className="hss">sobre contrato</div></div>
        {!isActor && (
          <div className="hsc"><div className="hsl">Extras (sin ×1.5)</div><div className="hsv cp">{s.extra > 0 ? '+' + fmt(s.extra) : '—'}</div><div className="hss">sobre lo citado</div></div>
        )}
        <div className="hsc" style={{ borderColor: totalNet >= 0 ? 'rgba(45,212,191,.35)' : 'rgba(255,107,71,.35)' }}>
          <div className="hsl">TOTAL periodo</div>
          <div className="hsv" style={{ color: totalNet >= 0 ? 'var(--teal)' : 'var(--coral)' }}>{fmt(Math.round(totalNet))}</div>
          <div className="hss">{isActor ? 'acum − comp' : 'acum + ext×1.5 − comp − pag.'}</div>
        </div>
        {month !== 'all' && (
          <div className="hsc" style={{ borderColor: 'rgba(232,255,71,.25)' }}>
            <div className="hsl">TOTAL histórico</div>
            <div className="hsv cy">{fmt(Math.round(allTotal))}</div>
            <div className="hss">todo el tiempo</div>
          </div>
        )}
      </div>
      {!isActor && (
        <div className="tc">
          <div className="tch"><h3>Pagos registrados</h3></div>
          {allItems.length === 0 ? (
            <div style={{ padding: '1rem 1.2rem', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
              No hay pagos para este periodo.
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Tipo</th><th>Fecha</th><th>Nota</th></tr>
              </thead>
              <tbody>
                {allItems.map((item, i) => {
                  const meta = TYPE_META[item.type];
                  return (
                    <tr key={i}>
                      <td>
                        <span style={{ color: meta.color, fontWeight: 600, fontSize: 12 }}>
                          {meta.icon} {meta.label}{item.amount ? <span style={{ fontWeight: 400, color: 'var(--text2)' }}> · {item.amount}</span> : null}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(item.date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>{item.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {isActor && (
        <div style={{ padding: '1rem 1.2rem', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text3)' }}>
          Los actores solo acumulan y compensan horas — no aplica el concepto de horas extra ni pagos por extras.
        </div>
      )}
    </>
  );
}
