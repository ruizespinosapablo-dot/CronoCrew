import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtDate, getToday } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/data';
import EditEmployeeModal from '../../components/modals/EditEmployeeModal';
import NewEmployeeModal from '../../components/modals/NewEmployeeModal';

const STORAGE_KEY = 'cronocrew_emp_order';

const loadOrders = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};

export default function Employees() {
  const { emps } = useApp();
  const [editEmpId, setEditEmpId] = useState(null);
  const [showNewEmp, setShowNewEmp] = useState(false);
  const [deptOrders, setDeptOrders] = useState(loadOrders);

  const today = getToday();
  const activeEmps = emps.filter(e =>
    (!e.cStart || e.cStart <= today) && (!e.cEnd || e.cEnd >= today)
  );

  const activeDepts = DEPARTMENTS.filter(d => activeEmps.some(e => e.dept === d));

  const getSorted = (dept) => {
    const deptEmps = activeEmps.filter(e => e.dept === dept);
    const order = deptOrders[dept];
    if (!order) return deptEmps;
    return [...deptEmps].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  };

  const move = (dept, empId, dir) => {
    const sorted = getSorted(dept);
    const idx = sorted.findIndex(e => e.id === empId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const newOrder = sorted.map(e => e.id);
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    const updated = { ...deptOrders, [dept]: newOrder };
    setDeptOrders(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <>
      <div className="ph">
        <div><h1>Empleados</h1><p>Plantilla activa a día de hoy — {activeEmps.length} empleados</p></div>
        <button className="btn-accent" onClick={() => setShowNewEmp(true)}>
          <i className="ti ti-plus" /> Nuevo empleado
        </button>
      </div>

      {activeDepts.map(dept => {
        const sorted = getSorted(dept);
        return (
          <div key={dept} className="tc" style={{ marginBottom: '1.25rem' }}>
            <div className="tch">
              <h3 style={{ margin: 0 }}>{dept}</h3>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{sorted.length} empleado{sorted.length !== 1 ? 's' : ''}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}></th>
                  <th>Empleado</th><th>Alias</th><th>DNI</th><th>Puesto</th>
                  <th>Horario</th><th>Contrato</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((emp, idx) => {
                  const contractStr = emp.cEnd
                    ? `${fmtDate(emp.cStart)} → ${fmtDate(emp.cEnd)}`
                    : `Desde ${fmtDate(emp.cStart)}`;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                          <button
                            disabled={idx === 0}
                            onClick={() => move(dept, emp.id, -1)}
                            style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--text3)' : 'var(--text2)', fontSize: 12, padding: '1px 4px', lineHeight: 1 }}
                          >▲</button>
                          <button
                            disabled={idx === sorted.length - 1}
                            onClick={() => move(dept, emp.id, 1)}
                            style={{ background: 'none', border: 'none', cursor: idx === sorted.length - 1 ? 'default' : 'pointer', color: idx === sorted.length - 1 ? 'var(--text3)' : 'var(--text2)', fontSize: 12, padding: '1px 4px', lineHeight: 1 }}
                          >▼</button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div className="avatar" style={{ background: emp.color, color: '#fff', width: 26, height: 26, fontSize: 10 }}>{emp.initials}</div>
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
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }}>{emp.ch}h · {emp.brk}min desc.</span>
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

      {editEmpId && <EditEmployeeModal empId={editEmpId} onClose={() => setEditEmpId(null)} />}
      {showNewEmp && <NewEmployeeModal onClose={() => setShowNewEmp(false)} />}
    </>
  );
}
