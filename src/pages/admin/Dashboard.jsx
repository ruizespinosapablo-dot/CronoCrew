import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calcRec, calcPeriod, fmt, fmtDate, getToday, sortByOrder } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/constants';
import EditRecordModal from '../../components/modals/EditRecordModal';

export default function Dashboard({ onNavigate }) {
  const { emps, recs, paid, empRequests } = useApp();
  const [editRecId, setEditRecId] = useState(null);

  const today = getToday();
  const isActive = e => !e.archived && (!e.cStart || e.cStart <= today) && (!e.cEnd || e.cEnd >= today);
  // Mismo orden que la pestaña Empleados: por departamento y, dentro, el orden
  // manual. Así "Situación hoy" no baila respecto al resumen de abajo. Quien
  // tenga un departamento fuera de la lista estándar se añade al final, para no
  // desaparecer del recuento.
  const base = emps.filter(isActive);
  const activeEmps = [
    ...DEPARTMENTS.flatMap(dept => sortByOrder(base.filter(e => e.dept === dept))),
    ...sortByOrder(base.filter(e => !DEPARTMENTS.includes(e.dept))),
  ];
  const todayRecs = recs.filter(r => r.date === today);
  const present = todayRecs.filter(r => r.entry && !r.absence && r.status !== 'draft').length;
  const pending = recs.filter(r => r.status === 'pending').length;
  const pendingRequests = empRequests.filter(r => r.status === 'pending').length;

  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const absLabels = { baja: '🏥 Baja', vacaciones: '🌴 Vacaciones', festivo: '🎉 Festivo', permiso: '📋 Permiso' };

  return (
    <>
      <div className="ph">
        <div><h1>Panel de control</h1><p>{dateStr}</p></div>
      </div>
      <div className="sg">
        <div className="sc"><div className="sc-label">Empleados activos</div><div className="sc-val cy">{activeEmps.length}</div></div>
        <div className="sc"><div className="sc-label">Presentes hoy</div><div className="sc-val ct">{present}</div></div>
        <div className="sc"><div className="sc-label">Pend. revisión</div><div className="sc-val" style={{ color: 'var(--amber)' }}>{pending}</div></div>
        <div className="sc"><div className="sc-label">Solicitudes</div><div className="sc-val cc">{pendingRequests}</div></div>
      </div>
      <div className="tc">
        <div className="tch"><h3>Situación hoy</h3></div>
        <table>
          <thead>
            <tr>
              <th>Empleado</th><th>Horario citado</th><th>Entrada</th><th>Salida</th><th>Netas</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {activeEmps.map(emp => {
              const rec = recs.find(r => r.eid === emp.id && r.date === today);
              // Un borrador (sin confirmar por el empleado) no es un fichaje enviado:
              // no se muestra como registro ni se puede revisar hasta que lo confirme.
              const isDraft = rec && rec.status === 'draft' && !rec.absence;
              const c = rec && !isDraft && !rec.absence && rec.exit ? calcRec(rec, emp) : null;
              let badge;
              if (!rec) badge = <span className="b bx">Sin fichaje</span>;
              else if (isDraft) badge = <span className="b bx">✍️ Sin confirmar</span>;
              else if (rec.absence) badge = <span className="b bp">{absLabels[rec.absence] || rec.absence}</span>;
              else if (rec.status === 'approved') badge = <span className="b bg">Aprobado</span>;
              else badge = <span className="b by">Pendiente</span>;
              return (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div className="avatar" style={{ background: emp.color, color: '#fff', width: 26, height: 26, fontSize: 10 }}>{emp.initials}</div>
                      {emp.name}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{emp.start}–{emp.end}</td>
                  <td style={{ fontFamily: 'monospace' }}>{isDraft ? '—' : (rec?.entry || '—')}</td>
                  <td style={{ fontFamily: 'monospace' }}>{isDraft ? '—' : (rec?.exit || '—')}</td>
                  <td style={{ fontWeight: 700, color: 'var(--teal)' }}>{c ? fmt(c.net) : '—'}</td>
                  <td>{badge}</td>
                  <td>{rec && !isDraft && <button className="btn-sm" onClick={() => setEditRecId(rec.id)}>Revisar</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 style={{ margin: '2rem 0 1rem', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Resumen por departamento</h2>
      {DEPARTMENTS.filter(dept => emps.some(e => e.dept === dept && !e.archived)).map(dept => {
        const deptEmps = sortByOrder(emps.filter(e => e.dept === dept && !e.archived));
        return (
          <div key={dept} className="tc" style={{ marginBottom: '1.25rem' }}>
            <div className="tch"><h3 style={{ margin: 0 }}>{dept}</h3></div>
            <table>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th>Inicio contrato</th>
                  <th>Días fichados</th>
                  <th>Total horas acumuladas</th>
                </tr>
              </thead>
              <tbody>
                {deptEmps.map(emp => {
                  const s = calcPeriod(emp.id, emps, recs);
                  const empPaid = paid.filter(p => p.eid === emp.id);
                  const pOrd = empPaid.reduce((a, p) => a + p.ordMin, 0);
                  const pExt = empPaid.reduce((a, p) => a + p.extMin, 0);
                  const totalNet = Math.round(s.total - (pOrd + pExt * 1.5));
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div className="avatar" style={{ background: emp.color, color: '#fff', width: 26, height: 26, fontSize: 10 }}>{emp.initials}</div>
                          {emp.name}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{emp.role}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(emp.cStart)}</td>
                      <td style={{ fontSize: 13, color: 'var(--text2)' }}>{s.days}</td>
                      <td style={{ fontWeight: 700, color: totalNet >= 0 ? 'var(--coral)' : 'var(--teal)' }}>
                        {totalNet >= 0 ? '+' : '−'}{fmt(Math.abs(totalNet))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {editRecId && <EditRecordModal recId={editRecId} onClose={() => setEditRecId(null)} />}
    </>
  );
}
