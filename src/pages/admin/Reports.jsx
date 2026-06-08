import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcPeriod, calcRec, fmt, fmtDate } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/data';
import PayModal from '../../components/modals/PayModal';

const TOG = (active) => ({
  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', border: '1px solid',
  background: active ? 'var(--bg4)' : 'transparent',
  borderColor: active ? 'var(--border3)' : 'var(--border2)',
  color: active ? 'var(--text)' : 'var(--text3)',
  transition: 'all .15s',
});

const SectionHead = ({ color, children }) => (
  <div style={{
    padding: '.45rem 1.2rem', borderTop: '1px solid var(--border2)',
    borderBottom: '1px solid var(--border2)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.07em', color,
    background: 'var(--bg3)',
  }}>{children}</div>
);

export default function Reports() {
  const { emps, recs, paid } = useApp();
  const [filterEmp, setFilterEmp] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showPaid, setShowPaid] = useState(true);
  const [showSpecial, setShowSpecial] = useState(true);
  const [showCatUp, setShowCatUp] = useState(true);
  const [payEid, setPayEid] = useState(null);

  const filterFn = (r) => {
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  };

  let visibleEmps = emps;
  if (filterDept) visibleEmps = visibleEmps.filter(e => e.dept === filterDept);
  if (filterEmp) visibleEmps = visibleEmps.filter(e => e.id === filterEmp);

  return (
    <>
      <div className="ph">
        <div><h1>Informes de horas</h1><p>Desglose por empleado y período</p></div>
        <button className="btn-accent" onClick={() => {
          const visibleRecs = recs.filter(r => {
            const emp = emps.find(e => e.id === r.eid);
            if (!emp) return false;
            if (filterDept && emp.dept !== filterDept) return false;
            if (filterEmp && r.eid !== filterEmp) return false;
            if (dateFrom && r.date < dateFrom) return false;
            if (dateTo && r.date > dateTo) return false;
            return true;
          });
          const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const rows = [
            ['Empleado', 'Departamento', 'Fecha', 'Entrada', 'Salida', 'Descanso (min)', 'Horas netas', 'Total día', 'Estado'].map(escape).join(','),
            ...visibleRecs.sort((a, b) => a.date.localeCompare(b.date)).map(r => {
              const emp = emps.find(e => e.id === r.eid);
              const c = (r.entry && r.exit) ? calcRec(r, emp) : null;
              return [
                emp?.name ?? r.eid,
                emp?.dept ?? '',
                r.date,
                r.entry || '',
                r.exit || '',
                r.brk ?? '',
                c ? Math.round(c.net) : '',
                c ? Math.round(c.total) : '',
                r.status === 'approved' ? 'Aprobado' : 'Pendiente',
              ].map(escape).join(',');
            }),
          ];
          const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'cronocrew_registros.csv'; a.click();
          URL.revokeObjectURL(url);
        }}><i className="ti ti-download" /> Exportar CSV</button>
      </div>

      <div className="fb">
        <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setFilterEmp(''); }}>
          <option value="">Todos los departamentos</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="">Todos los empleados</option>
          {(filterDept ? emps.filter(e => e.dept === filterDept) : emps).map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Desde" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Hasta" />
        <button className="btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setFilterEmp(''); setFilterDept(''); }}>Limpiar</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>Mostrar:</span>
        <button style={TOG(showPaid)} onClick={() => setShowPaid(v => !v)}>💰 Extras pagadas</button>
        <button style={TOG(showSpecial)} onClick={() => setShowSpecial(v => !v)}>⭐ Jornadas especiales</button>
        <button style={TOG(showCatUp)} onClick={() => setShowCatUp(v => !v)}>⬆ Subidas de categoría</button>
      </div>

      {visibleEmps.map(emp => {
        const s = calcPeriod(emp.id, emps, recs, filterFn);
        const empPaid = paid.filter(p => p.eid === emp.id && (!dateFrom || p.date >= dateFrom) && (!dateTo || p.date <= dateTo));
        const pOrd = empPaid.reduce((a, p) => a + p.ordMin, 0);
        const pExt = empPaid.reduce((a, p) => a + p.extMin, 0);
        const totalNet = s.total - (pOrd + pExt * 1.5);

        const specRecs = recs.filter(r => r.eid === emp.id && r.special && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo))
          .sort((a, b) => a.date.localeCompare(b.date));
        const catUpRecs = recs.filter(r => r.eid === emp.id && r.catUp && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo))
          .sort((a, b) => a.date.localeCompare(b.date));

        const hasContent = empPaid.length > 0 || specRecs.length > 0 || catUpRecs.length > 0;

        return (
          <div key={emp.id} className="tc" style={{ marginBottom: '1.5rem' }}>
            <div className="tch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar" style={{ background: emp.color, color: '#fff', width: 30, height: 30, fontSize: 11 }}>{emp.initials}</div>
                <div>
                  <h3 style={{ margin: 0 }}>{emp.name}</h3>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.dept} · {emp.role}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Días: <b>{s.days}</b></span>
                {s.accum > 0 && <span style={{ fontSize: 12, color: 'var(--teal)' }}>+{fmt(s.accum)} acum.</span>}
                {s.extra > 0 && <span style={{ fontSize: 12, color: 'var(--purple)' }}>+{fmt(s.extra)} extras</span>}
                {specRecs.length > 0 && <span className="b ba" style={{ fontSize: 11 }}>⭐ ×{specRecs.length}</span>}
                {catUpRecs.length > 0 && <span className="b bp" style={{ fontSize: 11 }}>⬆ ×{catUpRecs.length}</span>}
                {(pOrd > 0 || pExt > 0) && <span style={{ fontSize: 12, color: 'var(--amber)' }}>💰 {pExt > 0 ? `${pExt}min ext` : ''}{pOrd > 0 ? ` ${fmt(pOrd)} ord` : ''}</span>}
                <span style={{ fontWeight: 700, fontSize: 13, color: totalNet >= 0 ? 'var(--coral)' : 'var(--teal)' }}>TOTAL: {fmt(Math.round(totalNet))}</span>
                <button className="btn-accent" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setPayEid(emp.id)}>Pagar</button>
              </div>
            </div>

            {showPaid && empPaid.length > 0 && (
              <>
                <SectionHead color="var(--amber)">💰 Extras pagadas</SectionHead>
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Extras pagados</th><th>Ordinarias pagadas</th><th>Nota</th></tr>
                  </thead>
                  <tbody>
                    {empPaid.slice().sort((a, b) => a.date.localeCompare(b.date)).map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(p.date)}</td>
                        <td>{p.extMin > 0 ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>💰 {p.extMin} min</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>{p.ordMin > 0 ? <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{fmt(p.ordMin)}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{p.note || '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--bg3)' }}>
                      <td style={{ fontWeight: 700, fontSize: 12 }}>TOTAL</td>
                      <td style={{ color: 'var(--amber)', fontWeight: 700 }}>{pExt > 0 ? `${pExt} min` : '—'}</td>
                      <td style={{ color: 'var(--teal)', fontWeight: 700 }}>{pOrd > 0 ? fmt(pOrd) : '—'}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {showSpecial && specRecs.length > 0 && (
              <>
                <SectionHead color="var(--amber)">⭐ Jornadas especiales</SectionHead>
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Nota</th></tr>
                  </thead>
                  <tbody>
                    {specRecs.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(r.date)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.entry || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.exit || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{r.specialNote || '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--bg3)' }}>
                      <td colSpan={4} style={{ fontWeight: 700, fontSize: 12, color: 'var(--amber)' }}>
                        ⭐ {specRecs.length} jornada{specRecs.length !== 1 ? 's' : ''} especial{specRecs.length !== 1 ? 'es' : ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {showCatUp && catUpRecs.length > 0 && (
              <>
                <SectionHead color="var(--purple)">⬆ Subidas de categoría</SectionHead>
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Categoría / motivo</th></tr>
                  </thead>
                  <tbody>
                    {catUpRecs.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(r.date)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.entry || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.exit || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{r.catUpNote || '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--bg3)' }}>
                      <td colSpan={4} style={{ fontWeight: 700, fontSize: 12, color: 'var(--purple)' }}>
                        ⬆ {catUpRecs.length} subida{catUpRecs.length !== 1 ? 's' : ''} de categoría
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {!hasContent && (
              <div style={{ padding: '1rem 1.2rem', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
                Sin registros en el período seleccionado.
              </div>
            )}
          </div>
        );
      })}

      {payEid && <PayModal empId={payEid} onClose={() => setPayEid(null)} />}
    </>
  );
}
