import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DEPARTMENTS } from '../../lib/constants';
import { useEnterKey } from '../../lib/useEnterKey';

export default function NewEmployeeModal({ onClose }) {
  const { addEmp } = useApp();
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [dept, setDept] = useState(DEPARTMENTS[0]);
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [brk, setBrk] = useState(60);
  const [ch, setCh] = useState(8);
  const [cStart, setCStart] = useState(new Date().toISOString().slice(0, 10));
  const [cEnd, setCEnd] = useState('');

  const isActor = dept === 'Actores';

  const handleCreate = () => {
    if (!name || !username || !alias) return;
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const colors = ['#a78bff', '#2dd4bf', '#ff6b47', '#fbbf24', '#4ade80'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    addEmp({
      id: username, name, alias, dni, email, role, dept,
      initials, color,
      start: isActor ? '' : start,
      end: isActor ? '' : end,
      brk: isActor ? 0 : parseInt(brk),
      ch: parseFloat(ch),
      cStart, cEnd: cEnd || null,
    });
    onClose();
  };
  useEnterKey(handleCreate);

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Nuevo empleado</h3>
        <div className="frow">
          <div className="fg"><label>Nombre completo</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Laura Fernández" autoComplete="off" /></div>
          <div className="fg"><label>Alias (se mostrará en la app)</label><input type="text" value={alias} onChange={e => setAlias(e.target.value)} placeholder="Laura" autoComplete="off" /></div>
        </div>
        <div className="frow">
          <div className="fg"><label>DNI</label><input type="text" value={dni} onChange={e => setDni(e.target.value)} placeholder="12345678A" /></div>
          <div className="fg"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="laura@email.com" /></div>
        </div>
        <div className="frow">
          <div className="fg"><label>Puesto</label><input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="Editora de vídeo" /></div>
          <div className="fg">
            <label>Departamento</label>
            <select value={dept} onChange={e => setDept(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="frow">
          <div className="fg"><label>Usuario</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="laura" /></div>
          <div className="fg"><label>Contraseña</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" /></div>
        </div>
        {!isActor && (
          <div className="frow">
            <div className="fg"><label>Entrada asignada</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div className="fg"><label>Salida asignada</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
        )}
        <div className="frow">
          {!isActor && <div className="fg"><label>Descanso (min)</label><input type="number" value={brk} min={0} step={15} onChange={e => setBrk(e.target.value)} /></div>}
          <div className="fg"><label>Horas/día contrato</label><input type="number" value={ch} min={1} step={0.5} onChange={e => setCh(e.target.value)} /></div>
        </div>
        {isActor && (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '.5rem .75rem', background: 'var(--bg3)', borderRadius: 8, marginBottom: '.5rem' }}>
            Los actores no tienen horario fijo — sus jornadas se registran día a día con caracterización y tiempos de viaje.
          </div>
        )}
        <div className="frow">
          <div className="fg"><label>Inicio de contrato</label><input type="date" value={cStart} onChange={e => setCStart(e.target.value)} /></div>
          <div className="fg"><label>Fin de contrato (opcional)</label><input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} /></div>
        </div>
        <div className="modal-foot">
          <button className="btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" onClick={handleCreate}>Crear empleado</button>
        </div>
      </div>
    </div>
  );
}
