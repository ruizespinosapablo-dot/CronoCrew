import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import logo from '../../assets/logo.svg';
import Clock from './Clock';
import Hours from './Hours';
import History from './History';
import Leave from './Leave';

const PAGES = [
  { id: 'fich', label: 'Fichar', icon: 'ti-fingerprint' },
  { id: 'hrs',  label: 'Mis horas', icon: 'ti-clock' },
  { id: 'hist', label: 'Historial', icon: 'ti-calendar' },
  { id: 'perm', label: 'Permisos', icon: 'ti-beach' },
];

export default function EmployeeLayout() {
  const { currentUser, emps, logout } = useApp();
  const emp = emps.find(e => e.id === currentUser.eid);
  const [page, setPage] = useState('fich');

  if (!emp) return null;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-logo">
          <img src={logo} alt="CronoCrew" />
          <span className="topbar-title">CronoCrew · Mi Espacio</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="avatar" style={{ background: emp.color, color: '#fff' }}>{emp.initials}</div>
            <span style={{ display: 'var(--name-display, inline)' }}>{emp.alias || emp.name}</span>
          </div>
          <button className="btn-logout" onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="app-layout">
        {/* Sidebar — visible solo en escritorio */}
        <div className="sidebar">
          <div className="sb-section">
            <div className="sb-label">Mi jornada</div>
            {PAGES.map(p => (
              <div key={p.id} className={`sb-item${page === p.id ? ' active' : ''}`} onClick={() => setPage(p.id)}>
                <i className={`ti ${p.icon}`} />
                {p.label}
              </div>
            ))}
          </div>
        </div>

        <div className="main">
          {page === 'fich' && <Clock emp={emp} />}
          {page === 'hrs'  && <Hours emp={emp} />}
          {page === 'hist' && <History emp={emp} />}
          {page === 'perm' && <Leave emp={emp} />}
        </div>
      </div>

      {/* Bottom nav — visible solo en móvil */}
      <nav className="bottom-nav">
        {PAGES.map(p => (
          <button key={p.id} className={`bn-item${page === p.id ? ' active' : ''}`} onClick={() => setPage(p.id)}>
            <i className={`ti ${p.icon}`} />
            {p.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
