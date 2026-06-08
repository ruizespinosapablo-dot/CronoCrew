import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { fmtDate } from '../../lib/utils';

const ACTION_LABEL = { create: '✅ Creado', update: '✏️ Modificado', delete: '🚫 Anulado' };
const ACTION_COLOR = { create: 'var(--teal)', update: 'var(--amber)', delete: 'var(--coral)' };

const FIELD_LABELS = {
  entry: 'Entrada', exit: 'Salida', brk: 'Descanso (min)',
  obs: 'Observación', status: 'Estado', absence: 'Ausencia',
  libranza: 'Libranza', special: 'Jornada especial', cat_up: 'Subida categoría',
  cited_in: 'Citada entrada', cited_out: 'Citada salida',
};

function DiffBadges({ prev, next }) {
  if (!prev && !next) return null;
  const diffs = Object.keys(FIELD_LABELS).filter(k => String(prev?.[k] ?? '') !== String(next?.[k] ?? ''));
  if (!diffs.length) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {diffs.map(k => (
        <div key={k} style={{ fontSize: 11, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--text3)' }}>{FIELD_LABELS[k]}:</span>
          {prev && <span style={{ color: 'var(--coral)', textDecoration: 'line-through' }}>{String(prev[k] ?? '—')}</span>}
          {prev && next && <span style={{ color: 'var(--text3)' }}>→</span>}
          {next && <span style={{ color: 'var(--teal)' }}>{String(next[k] ?? '—')}</span>}
        </div>
      ))}
    </div>
  );
}

export default function Audit() {
  const { emps } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterEmp, setFilterEmp] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    supabase
      .from('rec_audit')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(500)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, []);

  const empByRecId = {};
  logs.forEach(log => {
    const recId = log.rec_id;
    const data = log.new_data || log.prev_data;
    if (data?.eid && !empByRecId[recId]) empByRecId[recId] = data.eid;
  });

  let filtered = logs;
  if (filterAction) filtered = filtered.filter(l => l.action === filterAction);
  if (filterUser)   filtered = filtered.filter(l => l.changed_by?.toLowerCase().includes(filterUser.toLowerCase()));
  if (filterEmp)    filtered = filtered.filter(l => {
    const data = l.new_data || l.prev_data;
    return data?.eid === filterEmp;
  });
  if (filterFrom) filtered = filtered.filter(l => l.changed_at >= filterFrom);
  if (filterTo)   filtered = filtered.filter(l => l.changed_at <= filterTo + 'T23:59:59');

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const clearFilters = () => {
    setFilterAction(''); setFilterUser(''); setFilterEmp('');
    setFilterFrom(''); setFilterTo(''); setPage(0);
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Auditoría</h1>
          <p>Trazabilidad completa de cambios en fichajes</p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="fb" style={{ marginBottom: '1rem' }}>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
          <option value="">Todas las acciones</option>
          <option value="create">✅ Creados</option>
          <option value="update">✏️ Modificados</option>
          <option value="delete">🚫 Anulados</option>
        </select>
        <select value={filterEmp} onChange={e => { setFilterEmp(e.target.value); setPage(0); }}>
          <option value="">Todos los empleados</option>
          {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input
          type="text"
          placeholder="Usuario que hizo el cambio"
          value={filterUser}
          onChange={e => { setFilterUser(e.target.value); setPage(0); }}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
        />
        <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0); }} title="Desde" />
        <input type="date" value={filterTo}   onChange={e => { setFilterTo(e.target.value);   setPage(0); }} title="Hasta" />
        <button className="btn-sm" onClick={clearFilters}>Limpiar</button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '3rem' }}>Cargando auditoría…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '3rem', fontStyle: 'italic' }}>
          No hay registros de auditoría con los filtros seleccionados.
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="tc">
          <div className="tch"><h3>Historial de cambios</h3></div>
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Acción</th>
                <th>Empleado</th>
                <th>Fecha jornada</th>
                <th>Hecho por</th>
                <th>Cambios</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(log => {
                const data = log.new_data || log.prev_data;
                const emp = data?.eid ? emps.find(e => e.id === data.eid) : null;
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {new Date(log.changed_at).toLocaleString('es-ES')}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 12, color: ACTION_COLOR[log.action] }}>
                        {ACTION_LABEL[log.action] || log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {emp ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="avatar" style={{ background: emp.color, color: '#fff', width: 22, height: 22, fontSize: 9 }}>{emp.initials}</div>
                          {emp.alias || emp.name}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text3)' }}>{data?.eid || '—'}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {data?.date ? fmtDate(data.date) : '—'}
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{log.changed_by}</td>
                    <td><DiffBadges prev={log.prev_data} next={log.new_data} /></td>
                    <td style={{ fontSize: 12, color: 'var(--amber)' }}>{log.reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '1rem', alignItems: 'center' }}>
              <button className="btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Anterior</button>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Página {page + 1} de {totalPages}</span>
              <button className="btn-sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Siguiente →</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
