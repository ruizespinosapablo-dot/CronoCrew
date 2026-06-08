import { useApp } from '../../context/AppContext';
import { fmtDate } from '../../lib/utils';

const TYPE_CLASS = { 'Vacaciones': 'bp', 'Enfermedad': 'bc', 'Asunto personal': 'bx', 'Maternidad/Paternidad': 'bt', 'Permiso': 'by', 'Otro': 'bx' };

export default function Requests() {
  const { empRequests, updateEmpRequest } = useApp();

  const pending = empRequests.filter(r => r.status === 'pending').length;

  return (
    <>
      <div className="ph"><div><h1>Solicitudes empleados</h1><p>Permisos pendientes de aprobación</p></div></div>
      <div className="tc">
        <div className="tch">
          <h3>Solicitudes</h3>
          {pending > 0 && <span className="b bc">{pending} pendientes</span>}
        </div>
        <table>
          <thead>
            <tr><th>Empleado</th><th>Tipo</th><th>Fechas</th><th>Días</th><th>Motivo</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {empRequests.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>Sin solicitudes</td></tr>
            )}
            {empRequests.map(req => (
              <tr key={req.id}>
                <td style={{ fontSize: 13 }}>{req.empName}</td>
                <td><span className={`b ${TYPE_CLASS[req.type] || 'bx'}`}>{req.type}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {fmtDate(req.start)}{req.start !== req.end ? ` → ${fmtDate(req.end)}` : ''}
                </td>
                <td>{req.days}</td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{req.reason || '—'}</td>
                <td>
                  {req.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-teal" onClick={() => updateEmpRequest(req.id, { status: 'approved' })}>✓ Aprobar</button>
                      <button className="btn-danger" onClick={() => updateEmpRequest(req.id, { status: 'rejected' })}>✗ Rechazar</button>
                    </div>
                  ) : req.status === 'approved' ? (
                    <span className="b bg">✓ Aprobado</span>
                  ) : (
                    <span className="b bc">✗ Rechazado</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
