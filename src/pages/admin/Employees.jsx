import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtDate, getToday, sortByOrder, moveItem } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/constants';
import EditEmployeeModal from '../../components/modals/EditEmployeeModal';

export default function Employees() {
  const { emps, saveEmpOrder } = useApp();
  const [editEmpId, setEditEmpId] = useState(null);
  const [drag, setDrag] = useState(null);   // { dept, index }
  const [over, setOver] = useState(null);    // { dept, index }

  const today = getToday();

  // Empleados activos a día de hoy (según fechas de contrato)
  const activeEmps = emps.filter(e =>
    !e.archived &&
    (!e.cStart || e.cStart <= today) &&
    (!e.cEnd || e.cEnd >= today)
  );

  const activeDepts = DEPARTMENTS.filter(d => activeEmps.some(e => e.dept === d));
  const getSorted = (dept) => sortByOrder(activeEmps.filter(e => e.dept === dept));

  // El punto de suelta es el HUECO entre filas: la mitad inferior de una fila
  // significa "detrás", así se puede dejar a alguien el último (con "encima de
  // la fila i" la última posición era inalcanzable).
  const hueco = (ev, i) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return ev.clientY > r.top + r.height / 2 ? i + 1 : i;
  };
  const soltar = (dept, h) => {
    if (!drag || drag.dept !== dept) return;
    const list = getSorted(dept);
    const destino = drag.index < h ? h - 1 : h;
    const next = moveItem(list, drag.index, destino);
    if (next !== list) saveEmpOrder(next.map(e => e.id));
  };
  const isOver = (dept, i) => over && over.dept === dept && over.index === i;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Empleados</h1>
          <p>
            Plantilla activa a día de hoy — {activeEmps.length} empleados ·
            arrastra para ordenar; el resto de tablas respeta este orden
          </p>
        </div>
      </div>

      {/* ── Plantilla activa por departamentos ── */}
      {activeDepts.map(dept => {
        const sorted = getSorted(dept);
        return (
          <div key={dept} className="tc" style={{ marginBottom: '1.25rem' }}>
            <div className="tch">
              <h3 style={{ margin: 0 }}>{dept}</h3>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {sorted.length} empleado{sorted.length !== 1 ? 's' : ''}
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 24 }}></th>
                  <th>Empleado</th><th>Alias</th><th>DNI</th><th>Puesto</th>
                  <th>Horario</th><th>Contrato</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((emp, i) => {
                  const contractStr = emp.cEnd
                    ? `${fmtDate(emp.cStart)} → ${fmtDate(emp.cEnd)}`
                    : `Desde ${fmtDate(emp.cStart)}`;
                  return (
                    <tr key={emp.id} draggable
                      className={
                        `${isOver(dept, i) ? 'drop-before' : ''}` +
                        `${isOver(dept, i + 1) ? ' drop-after' : ''}` +
                        `${drag?.dept === dept && drag.index === i ? ' dragging' : ''}`}
                      onDragStart={() => setDrag({ dept, index: i })}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      onDragOver={ev => { ev.preventDefault(); setOver({ dept, index: hueco(ev, i) }); }}
                      onDrop={ev => { ev.preventDefault(); soltar(dept, hueco(ev, i)); setDrag(null); setOver(null); }}>
                      <td style={{ textAlign: 'center', cursor: 'grab', color: 'var(--text3)' }}>
                        <i className="ti ti-grip-vertical" />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div className="avatar" style={{ background: emp.color, color: '#fff', width: 26, height: 26, fontSize: 10 }}>
                            {emp.initials}
                          </div>
                          <div>
                            {emp.name}
                            {emp.email && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{emp.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--accent)', fontSize: 13 }}>{emp.alias || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{emp.dni || '—'}</td>
                      <td style={{ color: 'var(--text2)', fontSize: 13 }}>{emp.role}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg3)', padding: '2px 8px', borderRadius: 5, color: 'var(--accent)' }}>
                          {emp.start}–{emp.end}
                        </span>
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }}>
                          {emp.ch}h · {emp.brk}min desc.
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{contractStr}</td>
                      <td>
                        <button className="btn-sm" onClick={() => setEditEmpId(emp.id)}>
                          <i className="ti ti-pencil" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {activeEmps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
          <i className="ti ti-users" style={{ fontSize: 40, display: 'block', marginBottom: 8 }} />
          No hay empleados en esta producción aún.
        </div>
      )}

      {editEmpId && <EditEmployeeModal empId={editEmpId} onClose={() => setEditEmpId(null)} />}
    </>
  );
}
