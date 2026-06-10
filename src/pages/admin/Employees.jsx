import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtDate, getToday } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/data';
import EditEmployeeModal from '../../components/modals/EditEmployeeModal';
import NewEmployeeModal from '../../components/modals/NewEmployeeModal';

export default function Employees() {
  const { emps } = useApp();
  const [editEmpId, setEditEmpId] = useState(null);
  const [showNewEmp, setShowNewEmp] = useState(false);

  const today = getToday();

  // Empleados pendientes de configurar (creados desde Super Admin)
  const pendingSetup = emps.filter(e => !e.setupComplete);

  // Empleados activos y ya configurados
  const activeEmps = emps.filter(e =>
    e.setupComplete &&
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
        <button className="btn-accent" onClick={() => setShowNewEmp(true)}>
          <i className="ti ti-plus" /> Nuevo empleado
        </button>
      </div>

      {/* ── Pendientes de configurar ── */}
      {pendingSetup.length > 0 && (
        <div className="tc" style={{ marginBottom: '1.5rem', border: '1.5px solid var(--warning, #f59e0b)', borderRadius: 10 }}>
          <div className="tch" style={{ background: 'color-mix(in srgb, var(--warning, #f59e0b) 12%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-alert-triangle" style={{ color: 'var(--warning, #f59e0b)' }} />
              <h3 style={{ margin: 0, color: 'var(--warning, #f59e0b)' }}>Pendientes de configurar</h3>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {pendingSetup.length} empleado{pendingSetup.length !== 1 ? 's' : ''} necesitan horario y contrato
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Empleado</th><th>Departamento</th><th>Puesto</th><th>DNI</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pendingSetup.map(emp => (
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
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>{emp.dept || '—'}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>{emp.role || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{emp.dni || '—'}</td>
                  <td>
                    <button className="btn-sm" style={{ background: 'var(--warning, #f59e0b)', color: '#fff' }}
                      onClick={() => setEditEmpId(emp.id)}>
                      <i className="ti ti-settings" /> Configurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
      {showNewEmp && <NewEmployeeModal onClose={() => setShowNewEmp(false)} />}
    </>
  );
}
