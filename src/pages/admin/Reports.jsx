import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcPeriod, fmt, fmtDate } from '../../lib/utils';
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

export default function Reports() {
  const { emps, recs, paid, deletePaidById, updateRec } = useApp();
  const [filterEmp, setFilterEmp] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExt, setShowExt] = useState(true);
  const [showOrd, setShowOrd] = useState(true);
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
  if (filterEmp)  visibleEmps = visibleEmps.filter(e => e.id === filterEmp);

  return (
    <>
      <div className="ph">
        <div><h1>Informes de horas</h1><p>Desglose por empleado y período</p></div>
        <button className="btn-accent" onClick={() => {
          const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const allRows = [];
          visibleEmps.forEach(emp => {
            const empPaid = paid.filter(p => p.eid === emp.id && (!dateFrom || p.date >= dateFrom) && (!dateTo || p.date <= dateTo));
            const specRecs = recs.filter(r => r.eid === emp.id && r.special && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo));
            const catUpRecs = recs.filter(r => r.eid === emp.id && r.catUp && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo));
            const items = [];
            empPaid.forEach(p => {
              if (showExt && p.extMin > 0) items.push({ type: 'Extras pagadas', date: p.date, note: p.note, amount: fmtMin(p.extMin) });
              if (showOrd && p.ordMin > 0) items.push({ type: 'Horas ordinarias pagadas', date: p.date, note: p.note, amount: fmtMin(p.ordMin) });
            });
            if (showSpecial) specRecs.forEach(r => items.push({ type: 'Jornada especial', date: r.date, note: r.specialNote, amount: '' }));
            if (showCatUp)   catUpRecs.forEach(r => items.push({ type: 'Subida de categoría', date: r.date, note: r.catUpNote, amount: '' }));
            items.sort((a, b) => a.date.localeCompare(b.date));
            items.forEach(item => allRows.push([emp.name, emp.dept, item.date, item.type, item.note || '', item.amount].map(escape).join(',')));
          });
          const rows = [['Empleado', 'Departamento', 'Fecha', 'Tipo', 'Nota', 'Cantidad'].map(escape).join(','), ...allRows];
          const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'cronocrew_pagos.csv'; a.click();
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
        <button style={TOG(showExt)}     onClick={() => setShowExt(v => !v)}>💰 Extras pagadas</button>
        <button style={TOG(showOrd)}     onClick={() => setShowOrd(v => !v)}>💰 Horas ordinarias</button>
        <button style={TOG(showSpecial)} onClick={() => setShowSpecial(v => !v)}>⭐ Jornadas especiales</button>
        <button style={TOG(showCatUp)}   onClick={() => setShowCatUp(v => !v)}>⬆ Subidas de categoría</button>
      </div>

      {visibleEmps.map(emp => {
        const s = calcPeriod(emp.id, emps, recs, filterFn);
        const empPaid = paid
          .filter(p => p.eid === emp.id && (!dateFrom || p.date >= dateFrom) && (!dateTo || p.date <= dateTo));
        const pOrd = empPaid.reduce((a, p) => a + p.ordMin, 0);
        const pExt = empPaid.reduce((a, p) => a + p.extMin, 0);
        const totalNet = s.total - (pOrd + pExt * 1.5);

        const specRecs = recs
          .filter(r => r.eid === emp.id && r.special && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo))
          .sort((a, b) => a.date.localeCompare(b.date));
        const catUpRecs = recs
          .filter(r => r.eid === emp.id && r.catUp && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Lista unificada cronológica
        const allItems = [];
        empPaid.forEach(p => {
          if (showExt && p.extMin > 0) allItems.push({ type: 'ext', date: p.date, note: p.note, amount: fmtMin(p.extMin), _dbId: p._dbId });
          if (showOrd && p.ordMin > 0) allItems.push({ type: 'ord', date: p.date, note: p.note, amount: fmtMin(p.ordMin), _dbId: p._dbId });
        });
        if (showSpecial) specRecs.forEach(r => allItems.push({ type: 'special', date: r.date, note: r.specialNote }));
        if (showCatUp)   catUpRecs.forEach(r => allItems.push({ type: 'catup', date: r.date, note: r.catUpNote, recId: r.id }));
        allItems.sort((a, b) => a.date.localeCompare(b.date));

        const hasData = empPaid.length > 0 || specRecs.length > 0 || catUpRecs.length > 0;

        return (
          <div key={emp.id} className="tc" style={{ marginBottom: '1.5rem' }}>
            {/* Cabecera empleado */}
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
                {s.accum !== 0 && <span style={{ fontSize: 12, color: 'var(--coral)'  }}>{s.accum > 0 ? '+' : ''}{fmt(s.accum)} acum.</span>}
                {s.comp  >  0 && <span style={{ fontSize: 12, color: 'var(--teal)'   }}>−{fmt(s.comp)} comp.</span>}
                {s.extra >  0 && <span style={{ fontSize: 12, color: 'var(--purple)' }}>+{fmt(s.extra)} extras</span>}
                {pExt    >  0 && <span style={{ fontSize: 12, color: 'var(--amber)'  }}>💰 {fmtMin(pExt)} ext. pag.</span>}
                {pOrd    >  0 && <span style={{ fontSize: 12, color: 'var(--amber)'  }}>💰 {fmtMin(pOrd)} ord. pag.</span>}
                {specRecs.length > 0 && <span className="b ba" style={{ fontSize: 11 }}>⭐ ×{specRecs.length}</span>}
                {catUpRecs.length > 0 && <span className="b bp" style={{ fontSize: 11 }}>⬆ ×{catUpRecs.length}</span>}
                <span style={{ fontWeight: 700, fontSize: 13, color: totalNet >= 0 ? 'var(--coral)' : 'var(--teal)' }}>
                  TOTAL: {fmt(Math.round(totalNet))}
                </span>
                <button className="btn-accent" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setPayEid(emp.id)}>Pagar</button>
              </div>
            </div>

            {/* Lista unificada */}
            {allItems.length > 0 && (
              <table>
                <thead>
                  <tr><th>Tipo</th><th>Fecha</th><th>Nota</th><th></th></tr>
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
                        <td style={{ textAlign: 'right' }}>
                          {(item._dbId || item.recId) && (
                            <button
                              title="Eliminar"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--coral)', padding: '2px 6px', fontSize: 13, opacity: 0.7 }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                              onClick={() => {
                                if (item._dbId && window.confirm(`¿Eliminar este pago del ${fmtDate(item.date)}? Esta acción no se puede deshacer.`)) {
                                  deletePaidById(item._dbId);
                                } else if (item.recId && window.confirm(`¿Quitar la subida de categoría del ${fmtDate(item.date)}?`)) {
                                  updateRec(item.recId, { catUp: false, catUpNote: '' });
                                }
                              }}
                            ><i className="ti ti-trash" /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {!hasData && (
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
