import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtDate, getToday } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/constants';
import EditEmployeeModal from '../../components/modals/EditEmployeeModal';

export default function Employees() {
  const { emps } = useApp();
  const [editEmpId, setEditEmpId] = useState(null);

  const today = getToday();

  // Empleados activos a día de hoy (según fechas de contrato)
  const activeEmps = emps.filter(e =>
    (!e.cStart || e.cStart <= today) &&
    (!e.cEnd || e.cEnd >= today)
  );

  const activeDepts = DEPARTMENTS.filter(d => activeEmps.some(e => e.dept === d));
  const getSorted = (dept) =>
    activeEmps.filter(e => e.dept === dept).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <>
      <div className="ph">
        <div>
          <h1>Empleados</h1>
          <p>Plantilla activa a día de hoy — {activeEmps.length} empleados</p>
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
                  <th>Empleado</th><th>Alias</th><th>DNI</th><th>Puesto</th>
                  <th>Horario</th><th>Contrato</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(emp => {
                  const contractStr = emp.cEnd
                    ? `${fmtDate(emp.cStart)} → ${fmtDate(emp.cEnd)}`
                    : `Desde ${fmtDate(emp.cStart)}`;
                  return (
                    <tr key={emp.id}>
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

      {activeEmps.length === 0 && pendingSetup.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
          <i className="ti ti-users" style={{ fontSize: 40, display: 'block', marginBottom: 8 }} />
          No hay empleados en esta producción aún.
        </div>
      )}

      {editEmpId && <EditEmployeeModal empId={editEmpId} onClose={() => setEditEmpId(null)} />}
    </>
  );
}
