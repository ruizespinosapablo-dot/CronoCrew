import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcRecForEmp, fmt, fmtDate, t2m } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/constants';
import EditRecordModal from '../../components/modals/EditRecordModal';

export default function Records() {
  const { emps, recs, paid, festivos, updateRec } = useApp();
  const [filterEmp, setFilterEmp] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [order, setOrder] = useState('desc');
  const [editRecId, setEditRecId] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const festivoSet = new Set(festivos.map(f => f.date));
  const absLabels = { baja: '🏥 Baja', vacaciones: '🌴 Vacaciones', festivo: '🎉 Festivo', permiso: '📋 Permiso' };

  const visibleEmps = filterDept ? emps.filter(e => e.dept === filterDept) : emps;
  const visibleEmpIds = new Set(visibleEmps.map(e => e.id));

  // Los borradores (status 'draft') son el día en curso del empleado sin confirmar:
  // no se muestran al admin hasta que el empleado pulsa "Confirmar fichaje".
  let filtered = recs.filter(r => visibleEmpIds.has(r.eid) && r.status !== 'draft');
  if (filterEmp) filtered = filtered.filter(r => r.eid === filterEmp);
  if (filterStatus) filtered = filtered.filter(r => r.status === filterStatus);
  if (filterDateFrom) filtered = filtered.filter(r => r.date >= filterDateFrom);
  if (filterDateTo) filtered = filtered.filter(r => r.date <= filterDateTo);
  filtered.sort((a, b) => a.date.localeCompare(b.date) * (order === 'asc' ? 1 : -1));

  const clearFilters = () => {
    setFilterEmp(''); setFilterDept(''); setFilterStatus('');
    setFilterDateFrom(''); setFilterDateTo('');
    setPage(1);
  };

  // Reset page when any filter changes
  const handleFilter = (fn) => { fn(); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="ph">
        <div><h1>Registro de fichajes</h1><p>Revisión y aprobación</p></div>
        <button className="btn-accent" onClick={() => {
          const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const rows = [
            ['Empleado', 'Departamento', 'Fecha', 'Entrada', 'Salida', 'Descanso (min)', 'Netas', 'Total día', 'Estado', 'Obs.'].map(escape).join(','),
            ...filtered.map(r => {
              const emp = emps.find(e => e.id === r.eid);
              const c = (r.entry && r.exit) ? calcRecForEmp(r, emp) : null;
              return [
                emp?.name ?? r.eid, emp?.dept ?? '', r.date,
                r.entry || '', r.exit || '', r.brk ?? '',
                c ? Math.round(c.net) : '', c ? Math.round(c.total) : '',
                r.status === 'approved' ? 'Aprobado' : 'Pendiente',
                r.obs || '',
              ].map(escape).join(',');
            }),
          ];
          const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'claptime_registros.csv'; a.click();
          URL.revokeObjectURL(url);
        }}><i className="ti ti-download" /> Exportar CSV</button>
      </div>
      <div className="fb">
        <select value={filterDept} onChange={e => { handleFilter(() => { setFilterDept(e.target.value); setFilterEmp(''); }); }}>
          <option value="">Todos los departamentos</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filterEmp} onChange={e => handleFilter(() => setFilterEmp(e.target.value))}>
          <option value="">Todos los empleados</option>
          {visibleEmps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => handleFilter(() => setFilterStatus(e.target.value))}>
          <option value="">Todos estados</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobado</option>
        </select>
        <input type="date" value={filterDateFrom} onChange={e => handleFilter(() => setFilterDateFrom(e.target.value))} title="Desde" />
        <input type="date" value={filterDateTo} onChange={e => handleFilter(() => setFilterDateTo(e.target.value))} title="Hasta" />
        <select value={order} onChange={e => handleFilter(() => setOrder(e.target.value))}>
          <option value="desc">Más reciente primero</option>
          <option value="asc">Más antiguo primero</option>
        </select>
        <button className="btn-sm" onClick={clearFilters}>Limpiar</button>
      </div>
      <div className="tc">
        <div className="tch">
          <h3>Jornadas registradas</h3>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {filtered.length} registros · página {page}/{totalPages}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Empleado</th><th>Depto.</th><th>Fecha</th>
              <th>Entrada</th><th>Salida</th><th>Descanso</th><th>Netas</th><th>TOTAL día</th><th>Estado</th><th>Obs.</th><th></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(rec => {
              const emp = emps.find(e => e.id === rec.eid);
              if (!emp) return null;
              const workedOnFestivo = festivoSet.has(rec.date) && rec.entry && !rec.absence;
              const rowStyle = workedOnFestivo ? { background: 'rgba(251,191,36,0.08)', outline: '1px solid var(--amber)' } : {};

              if (rec.absence) {
                return (
                  <tr key={rec.id} style={rowStyle}>
                    <td style={{ fontSize: 12 }}>{emp.alias || emp.name}</td>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.dept}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(rec.date)}</td>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', fontStyle: 'italic' }}>{absLabels[rec.absence] || rec.absence}</td>
                    <td><span className="b bg">Aprobado</span></td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{rec.obs || '—'}</td>
                    <td></td>
                  </tr>
                );
              }
              const isActorRec = emp.dept === 'Actores';
              const c = ((isActorRec ? rec.actorEnd : rec.exit) || rec.libranza) ? calcRecForEmp(rec, emp) : null;
              const dayPaidExt = paid.filter(p => p.eid === rec.eid && p.date === rec.date).reduce((a, p) => a + p.extMin, 0);
              const totalNet = c ? Math.round(c.total - (isActorRec ? 0 : dayPaidExt * 1.5)) : null;
              return (
                <tr key={rec.id} style={rowStyle}>
                  <td style={{ fontSize: 12 }}>
                    {workedOnFestivo && <span title="Trabajó en festivo" style={{ marginRight: 4 }}>🟡</span>}
                    {emp.alias || emp.name}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.dept}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(rec.date)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{rec.libranza ? '—' : (rec.entry || '—')}</td>
                  <td style={{ fontFamily: 'monospace' }}>{rec.libranza ? '—' : (rec.exit || '—')}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{rec.exit ? fmt(rec.brk != null ? rec.brk : emp.brk) : '—'}</td>
                  <td style={{ fontWeight: 700 }}>
                    {rec.libranza ? '—' : c ? fmt(c.net) : '—'}
                  </td>
                  <td>
                    {!rec.libranza && totalNet != null && <span style={{ color: totalNet > 0 ? 'var(--coral)' : 'var(--teal)' }}>{fmt(totalNet)}</span>}
                    {rec.libranza && <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{fmt(c.total)}</span>}
                    {' '}
                    {dayPaidExt > 0 && <span className="b bp" style={{ fontSize: 10 }}>💰{dayPaidExt}m</span>}
                    {rec.special && <span className="b ba" style={{ fontSize: 10 }}>⭐E</span>}
                    {rec.catUp && <span className="b bp" style={{ fontSize: 10 }}>⬆X</span>}
                    {rec.permMin > 0 && <span className="b bp" style={{ fontSize: 10 }} title={rec.permReason || ''}>🩺{Math.round(rec.permMin / 60 * 100) / 100}h</span>}
                    {rec.kmApplied && <span className="b bp" style={{ fontSize: 10 }} title={rec.kmCount ? `${rec.kmCount} km` : ''}>🚗 {rec.kmEur != null ? `${rec.kmEur}€` : 'sin valorar'}</span>}
                    {rec.libranza && <span className="b bt" style={{ fontSize: 10 }}>📅 Libranza</span>}
                    {workedOnFestivo && <span className="b by" style={{ fontSize: 10 }}>🟡 Festivo</span>}
                  </td>
                  <td>{rec.status === 'approved' ? <span className="b bg">Aprobado</span> : <span className="b by">Pendiente</span>}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.obs || '—'}</td>
                  <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {rec.status !== 'approved' && (
                      <button
                        title="Aprobar directamente"
                        style={{ background: 'var(--teal)', color: '#0a0b0f', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                        onClick={() => updateRec(rec.id, { status: 'approved' })}
                      >✓</button>
                    )}
                    <button className="btn-sm" onClick={() => setEditRecId(rec.id)}>Revisar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '1rem', borderTop: '1px solid var(--border)' }}>
            <button className="btn-sm" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 90, textAlign: 'center' }}>
              {page} / {totalPages}
            </span>
            <button className="btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Siguiente ›</button>
            <button className="btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        )}
      </div>
      {editRecId && <EditRecordModal recId={editRecId} onClose={() => setEditRecId(null)} />}
    </>
  );
}
