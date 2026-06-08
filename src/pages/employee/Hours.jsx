import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calcPeriod, fmt } from '../../lib/utils';

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
  const monthOptions = useMemo(() => buildMonthOptions(emp.cStart), [emp.cStart]);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const defaultMonth = monthOptions.find(o => o.value === currentMonth)
    ? currentMonth
    : monthOptions[monthOptions.length - 2]?.value || 'all';
  const [month, setMonth] = useState(defaultMonth);

  const filterFn = month === 'all' ? null : (r => r.date.startsWith(month));
  const s = calcPeriod(emp.id, emps, recs, filterFn);
  const empPaid = paid.filter(p => p.eid === emp.id && (month === 'all' || p.month === month));
  const pOrd = empPaid.reduce((a, p) => a + p.ordMin, 0);
  const pExt = empPaid.reduce((a, p) => a + p.extMin, 0);
  const totalNet = s.total - (pOrd + pExt * 1.5);

  const allS = calcPeriod(emp.id, emps, recs);
  const allPaid = paid.filter(p => p.eid === emp.id);
  const allPOrd = allPaid.reduce((a, p) => a + p.ordMin, 0);
  const allPExt = allPaid.reduce((a, p) => a + p.extMin, 0);
  const allTotal = allS.total - (allPOrd + allPExt * 1.5);

  return (
    <>
      <div className="ph">
        <div><h1>Mis horas</h1><p>Saldo acumulado</p></div>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', padding: '6px 11px', fontSize: 13, fontFamily: 'var(--fb)', outline: 'none' }}>
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="hs">
        <div className="hsc"><div className="hsl">Compensadas</div><div className="hsv cc">{s.comp > 0 ? '−' + fmt(s.comp) : '—'}</div><div className="hss">a recuperar</div></div>
        <div className="hsc"><div className="hsl">Acumuladas</div><div className="hsv ct">{s.accum > 0 ? '+' + fmt(s.accum) : '—'}</div><div className="hss">sobre contrato</div></div>
        <div className="hsc"><div className="hsl">Extras (sin ×1.5)</div><div className="hsv cp">{s.extra > 0 ? '+' + fmt(s.extra) : '—'}</div><div className="hss">sobre lo citado</div></div>
        <div className="hsc" style={{ borderColor: totalNet >= 0 ? 'rgba(45,212,191,.35)' : 'rgba(255,107,71,.35)' }}>
          <div className="hsl">TOTAL periodo</div>
          <div className="hsv" style={{ color: totalNet >= 0 ? 'var(--teal)' : 'var(--coral)' }}>{fmt(Math.round(totalNet))}</div>
          <div className="hss">acum + ext×1.5 − comp − pag.</div>
        </div>
        {month !== 'all' && (
          <div className="hsc" style={{ borderColor: 'rgba(232,255,71,.25)' }}>
            <div className="hsl">TOTAL histórico</div>
            <div className="hsv cy">{fmt(Math.round(allTotal))}</div>
            <div className="hss">todo el tiempo</div>
          </div>
        )}
      </div>
      <div className="tc">
        <div className="tch"><h3>Pagos registrados</h3></div>
        <div style={{ padding: '1rem 1.4rem', fontSize: 13 }}>
          {!empPaid.length ? (
            <p style={{ color: 'var(--text3)' }}>No hay pagos para este periodo.</p>
          ) : empPaid.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              {p.ordMin > 0 && <span className="b bt">{fmt(p.ordMin)} ordinarias</span>}
              {p.extMin > 0 && <span className="b bp">{p.extMin}min extra</span>}
              <span style={{ color: 'var(--text2)', fontSize: 12 }}>{p.note}</span>
              {p.date && <span style={{ color: 'var(--text3)', fontSize: 11 }}>{p.date}</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
