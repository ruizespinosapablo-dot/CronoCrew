import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcRecForEmp, fmt, fmtDate, getToday } from '../../lib/utils';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Últimos 12 meses como opciones 'YYYY-MM'.
const mesesRecientes = () => {
  const out = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
};
const etiquetaMes = (m) => { const [y, mo] = m.split('-'); return `${MESES[+mo - 1]} ${y}`; };

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

  // ── Cómo va cada persona ── periodo '' = TODO (toda la contratación).
  const [periodo, setPeriodo] = useState(getToday().slice(0, 7));

  const porPersona = useMemo(() => {
    const acc = {};
    [...miEquipo].forEach(id => { acc[id] = { saldo: 0, especiales: 0, libranzas: 0 }; });
    recs.forEach(r => {
      if (!miEquipo.has(r.eid) || r.status === 'draft' || r.absence) return;
      if (periodo && !(r.date || '').startsWith(periodo)) return;
      const a = acc[r.eid]; if (!a) return;
      const e = emps.find(x => x.id === r.eid);
      if (r.libranza) { a.libranzas++; a.saldo += calcRecForEmp(r, e).total || 0; return; }
      if (r.exit) {
        const c = calcRecForEmp(r, e);
        a.saldo += c.total || 0;
        if ((c.net || 0) > 555) a.especiales++;   // más de 9h15 de trabajo neto
      }
    });
    return acc;
  }, [recs, miEquipo, emps, periodo]);

  const totPeriodo = useMemo(() => {
    const t = { saldo: 0, especiales: 0, libranzas: 0 };
    Object.values(porPersona).forEach(a => {
      t.saldo += a.saldo; t.especiales += a.especiales; t.libranzas += a.libranzas;
    });
    return t;
  }, [porPersona]);

  // Saldo del equipo en TODA su contratación (siempre, sin filtro de mes).
  const saldoEquipoTotal = useMemo(() => {
    let s = 0;
    recs.forEach(r => {
      if (!miEquipo.has(r.eid) || r.status === 'draft' || r.absence) return;
      if (!r.libranza && !r.exit) return;
      s += calcRecForEmp(r, emps.find(x => x.id === r.eid)).total || 0;
    });
    return s;
  }, [recs, miEquipo, emps]);

  const equipoOrdenado = useMemo(
    () => emps.filter(e => e.dept === dept && !e.archived)
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [emps, dept]);

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
        <td style={{ fontWeight: 700 }}>
          {r.libranza ? '—' : (c ? fmt(c.net) : '—')}
          {c && c.extra > 0 && <span className="b bp" style={{ fontSize: 10, marginLeft: 4 }} title="Trabajó más de lo citado">+{fmt(c.extra)} ext</span>}
          {r.special && <span className="b ba" style={{ fontSize: 10, marginLeft: 4 }}>⭐</span>}
        </td>
        <td style={{ color: 'var(--text2)' }}>{r.libranza ? '—' : (c ? fmt(c.citedNet) : '—')}</td>
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
            <tr><th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Netas</th><th>Citadas</th><th></th></tr>
          </thead>
          <tbody>
            {!recsPend.length && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Nada por revisar. Tu equipo está al día.</td></tr>
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
              <tr><th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Netas</th><th>Citadas</th><th></th></tr>
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

      {/* ── Cómo va el equipo ── */}
      <div className="tc" style={{ marginTop: '1.5rem' }}>
        <div className="tch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Cómo va el equipo · {periodo ? etiquetaMes(periodo) : 'toda la contratación'}</h3>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }}>
            <option value="">Todo · desde el inicio de contrato</option>
            {mesesRecientes().map(m => <option key={m} value={m}>{etiquetaMes(m)}</option>)}
          </select>
        </div>
        <table>
          <thead>
            <tr><th>Persona</th><th>Saldo</th><th>Jornadas especiales</th><th>Libranzas</th></tr>
          </thead>
          <tbody>
            {equipoOrdenado.map(e => {
              const a = porPersona[e.id] || { saldo: 0, especiales: 0, libranzas: 0 };
              const vacio = !a.saldo && !a.especiales && !a.libranzas;
              return (
                <tr key={e.id} style={vacio ? { opacity: .5 } : undefined}>
                  <td style={{ fontSize: 13 }}>{e.name}</td>
                  <td style={{ color: a.saldo > 0 ? 'var(--coral)' : 'var(--teal)', fontWeight: 600 }}>{a.saldo ? `${a.saldo >= 0 ? '+' : ''}${fmt(Math.round(a.saldo))}` : '—'}</td>
                  <td>{a.especiales ? <span className="b ba" style={{ fontSize: 11 }}>⭐ {a.especiales}</span> : '—'}</td>
                  <td>{a.libranzas || '—'}</td>
                </tr>
              );
            })}
            {!equipoOrdenado.length && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>No hay nadie en tu departamento.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ color: 'var(--text3)' }}>Total {dept} · {periodo ? etiquetaMes(periodo) : 'todo'}</td>
              <td style={{ color: totPeriodo.saldo > 0 ? 'var(--coral)' : 'var(--teal)', fontWeight: 700 }}>{totPeriodo.saldo ? `${totPeriodo.saldo >= 0 ? '+' : ''}${fmt(Math.round(totPeriodo.saldo))}` : '—'}</td>
              <td style={{ fontWeight: 700 }}>{totPeriodo.especiales || '—'}</td>
              <td style={{ fontWeight: 700 }}>{totPeriodo.libranzas || '—'}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.9rem 1.2rem', borderTop: '1px solid var(--border2)', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Saldo del equipo desde el inicio de contrato</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: saldoEquipoTotal > 0 ? 'var(--coral)' : 'var(--teal)' }}>
            {saldoEquipoTotal >= 0 ? '+' : ''}{fmt(Math.round(saldoEquipoTotal))}
          </span>
        </div>
      </div>
    </>
  );
}
