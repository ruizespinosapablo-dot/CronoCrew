import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calcRecForEmp, fmt, fmtDate } from '../../lib/utils';

// Vista del jefe de equipo. Da el VISTO BUENO (no la aprobación final) a los
// fichajes y permisos de SU departamento. La firma final, y todo lo de dinero,
// es del admin: la base de datos lo impide aunque se intente por la API.
export default function TeamReview({ emp }) {
  const { emps, recs, empRequests, updateRec, updateEmpRequest } = useApp();

  const dept = emp.dept;
  const miEquipo = useMemo(
    () => new Set(emps.filter(e => e.dept === dept && !e.archived).map(e => e.id)),
    [emps, dept]);
  const nombre = (eid) => emps.find(e => e.id === eid)?.name || eid;

  const recsPend = useMemo(
    () => recs.filter(r => miEquipo.has(r.eid) && r.status === 'pending')
      .sort((a, b) => b.date.localeCompare(a.date)),
    [recs, miEquipo]);
  const recsRev = useMemo(
    () => recs.filter(r => miEquipo.has(r.eid) && r.status === 'reviewed')
      .sort((a, b) => b.date.localeCompare(a.date)),
    [recs, miEquipo]);

  const reqsPend = useMemo(
    () => empRequests.filter(r => miEquipo.has(r.eid) && r.status === 'pending')
      .sort((a, b) => (b.start || '').localeCompare(a.start || '')),
    [empRequests, miEquipo]);
  const reqsRev = useMemo(
    () => empRequests.filter(r => miEquipo.has(r.eid) && r.status === 'reviewed')
      .sort((a, b) => (b.start || '').localeCompare(a.start || '')),
    [empRequests, miEquipo]);

  const visarTodos = () => {
    if (!recsPend.length) return;
    if (window.confirm(`Dar el visto bueno a los ${recsPend.length} fichajes pendientes de ${dept}?`)) {
      recsPend.forEach(r => updateRec(r.id, { status: 'reviewed' }, 'Visto bueno jefe de equipo'));
    }
  };

  const filaFichaje = (r, revisado) => {
    const e = emps.find(x => x.id === r.eid);
    const c = (r.exit || r.libranza) ? calcRecForEmp(r, e) : null;
    return (
      <tr key={r.id}>
        <td style={{ fontSize: 13 }}>{nombre(r.eid)}</td>
        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(r.date)}</td>
        <td style={{ fontFamily: 'monospace' }}>{r.libranza ? '📅' : (r.entry || '—')}</td>
        <td style={{ fontFamily: 'monospace' }}>{r.libranza ? 'Libranza' : (r.exit || '—')}</td>
        <td style={{ fontWeight: 700 }}>{r.libranza ? '—' : (c ? fmt(c.net) : '—')}</td>
        <td>
          {revisado ? (
            <button className="btn-sm" onClick={() => updateRec(r.id, { status: 'pending' }, 'Visto bueno retirado')}>
              Quitar visto bueno
            </button>
          ) : (
            <button className="btn-teal" onClick={() => updateRec(r.id, { status: 'reviewed' }, 'Visto bueno jefe de equipo')}>
              ✓ Dar visto bueno
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Mi equipo · {dept}</h1>
          <p>Da el visto bueno a los fichajes y permisos de tu departamento. La aprobación final, y todo lo de pagos, lo hace administración.</p>
        </div>
      </div>

      {/* ── Fichajes por revisar ── */}
      <div className="tc" style={{ marginBottom: '1.5rem' }}>
        <div className="tch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Por revisar</h3>
          {recsPend.length > 0 && (
            <button className="btn-accent" style={{ padding: '5px 12px', fontSize: 12 }} onClick={visarTodos}>
              <i className="ti ti-checks" /> Visto bueno a {recsPend.length}
            </button>
          )}
        </div>
        <table>
          <thead>
            <tr><th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Netas</th><th></th></tr>
          </thead>
          <tbody>
            {!recsPend.length && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Nada por revisar. Tu equipo está al día.</td></tr>
            )}
            {recsPend.map(r => filaFichaje(r, false))}
          </tbody>
        </table>
      </div>

      {/* ── Fichajes ya con visto bueno (esperando al admin) ── */}
      {recsRev.length > 0 && (
        <div className="tc" style={{ marginBottom: '1.5rem' }}>
          <div className="tch"><h3>Con tu visto bueno · pendientes de administración</h3></div>
          <table>
            <thead>
              <tr><th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Netas</th><th></th></tr>
            </thead>
            <tbody>{recsRev.map(r => filaFichaje(r, true))}</tbody>
          </table>
        </div>
      )}

      {/* ── Solicitudes de permiso ── */}
      <div className="tc">
        <div className="tch"><h3>Solicitudes de permiso</h3></div>
        <table>
          <thead>
            <tr><th>Empleado</th><th>Tipo</th><th>Fechas</th><th>Días</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {!reqsPend.length && !reqsRev.length && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Sin solicitudes.</td></tr>
            )}
            {reqsPend.map(req => (
              <tr key={req.id}>
                <td style={{ fontSize: 13 }}>{nombre(req.eid)}</td>
                <td><span className="b bp">{req.type}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(req.start)} → {fmtDate(req.end)}</td>
                <td>{req.days}</td>
                <td><span className="b by">Pendiente</span></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-teal" onClick={() => updateEmpRequest(req.id, { status: 'reviewed' })} title="Recomendar aprobación">✓ Visto bueno</button>
                  <button className="btn-danger" onClick={() => updateEmpRequest(req.id, { status: 'rejected' })}>✗</button>
                </td>
              </tr>
            ))}
            {reqsRev.map(req => (
              <tr key={req.id}>
                <td style={{ fontSize: 13 }}>{nombre(req.eid)}</td>
                <td><span className="b bp">{req.type}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(req.start)} → {fmtDate(req.end)}</td>
                <td>{req.days}</td>
                <td><span className="b bt">✓ Recomendada · falta admin</span></td>
                <td>
                  <button className="btn-sm" onClick={() => updateEmpRequest(req.id, { status: 'pending' })}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
