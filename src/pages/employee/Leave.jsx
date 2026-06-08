import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { fmtDate } from '../../lib/utils';

const TYPE_CLASS = { 'Vacaciones': 'bp', 'Enfermedad': 'bc', 'Asunto personal': 'bx', 'Maternidad/Paternidad': 'bt', 'Otro': 'bx' };

export default function Leave({ emp }) {
  const { currentUser, emps, empRequests, addEmpRequest } = useApp();
  const { showToast } = useToast();
  const [type, setType] = useState('Vacaciones');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');

  const myRequests = empRequests.filter(r => r.eid === currentUser.eid);

  const submit = () => {
    if (!start || !end) { showToast('Indica las fechas de inicio y fin.', 'warning'); return; }
    const days = Math.round((new Date(end) - new Date(start)) / 864e5) + 1;
    addEmpRequest({
      id: crypto.randomUUID(),
      eid: currentUser.eid,
      empName: emp?.name || currentUser.eid,
      type, start, end, days,
      reason: reason.trim(),
      status: 'pending',
    });
    setStart(''); setEnd(''); setReason('');
    showToast('Solicitud enviada al administrador.', 'success');
  };

  return (
    <>
      <div className="ph"><div><h1>Permisos y ausencias</h1></div></div>
      <div className="card-section">
        <h3 style={{ marginBottom: '1rem' }}>Nueva solicitud</h3>
        <div className="fg">
          <label>Tipo</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            {Object.keys(TYPE_CLASS).map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="frow">
          <div className="fg"><label>Fecha inicio</label><input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div className="fg"><label>Fecha fin</label><input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div className="fg">
          <label>Motivo</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe brevemente..." />
        </div>
        <button className="btn-accent" onClick={submit}>Enviar solicitud</button>
      </div>
      <div className="tc">
        <div className="tch"><h3>Mis solicitudes</h3></div>
        <table>
          <thead><tr><th>Tipo</th><th>Fechas</th><th>Días</th><th>Motivo</th><th>Estado</th></tr></thead>
          <tbody>
            {myRequests.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>Sin solicitudes</td></tr>
            )}
            {myRequests.map(r => (
              <tr key={r.id}>
                <td><span className={`b ${TYPE_CLASS[r.type] || 'bx'}`}>{r.type}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(r.start)}{r.start !== r.end ? ` → ${fmtDate(r.end)}` : ''}</td>
                <td>{r.days}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.reason || '—'}</td>
                <td>
                  {r.status === 'approved' ? <span className="b bg">Aprobado</span>
                    : r.status === 'rejected' ? <span className="b bc">Rechazado</span>
                    : <span className="b by">Pendiente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
