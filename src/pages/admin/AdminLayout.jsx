import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import logo from '../../assets/logo.svg';
import Dashboard from './Dashboard';
import Employees from './Employees';
import Records from './Records';
import Requests from './Requests';
import Permissions from './Permissions';
import Reports from './Reports';

const PAGES = [
  { id: 'dash', label: 'Panel',       icon: 'ti-layout-dashboard' },
  { id: 'emps', label: 'Empleados',   icon: 'ti-users' },
  { id: 'reg',  label: 'Registro',    icon: 'ti-clock', badge: true },
  { id: 'req',  label: 'Solicitudes', icon: 'ti-inbox', badge: true },
  { id: 'perm', label: 'Permisos',    icon: 'ti-calendar-off' },
  { id: 'rep',  label: 'Informes',    icon: 'ti-chart-bar' },
];

export default function AdminLayout() {
  const { logout, recs, empRequests } = useApp();
  const [page, setPage] = useState('reg');

  const badgeCount = {
    reg: recs.filter(r => r.status === 'pending').length,
    req: empRequests.filter(r => r.status === 'pending').length,
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-logo">
          <img src={logo} alt="CronoCrew" />
          <span className="topbar-title">CronoCrew · Gestión Horaria</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="avatar" style={{ background: 'var(--accent)', color: '#0a0b0f' }}>AD</div>
            <span style={{ display: 'var(--name-display, inline)' }}>Administrador</span>
          </div>
          <button className="btn-logout" onClick={logout}>Salir</button>
        </div>
      </div>

      {/* Tabs horizontales — visible solo en móvil */}
      <div className="admin-mobile-tabs">
        {PAGES.map(p => (
          <button key={p.id} className={`amt-item${page === p.id ? ' active' : ''}`} onClick={() => setPage(p.id)}>
            <i className={`ti ${p.icon}`} style={{ fontSize: 14 }} />
            {p.label}
            {p.badge && badgeCount[p.id] > 0 && <span className="amt-badge">{badgeCount[p.id]}</span>}
          </button>
        ))}
      </div>

      <div className="app-layout">
        {/* Sidebar — visible solo en escritorio */}
        <div className="sidebar">
          <div className="sb-section">
            <div className="sb-label">Principal</div>
            {PAGES.map(p => (
              <div key={p.id} className={`sb-item${page === p.id ? ' active' : ''}`} onClick={() => setPage(p.id)}>
                <i className={`ti ${p.icon}`} />
                {p.label}
                {p.badge && badgeCount[p.id] > 0 && <span className="sb-badge">{badgeCount[p.id]}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="main">
          {page === 'dash' && <Dashboard onNavigate={setPage} />}
          {page === 'emps' && <Employees />}
          {page === 'reg'  && <Records />}
          {page === 'req'  && <Requests />}
          {page === 'perm' && <Permissions />}
          {page === 'rep'  && <Reports />}
        </div>
      </div>
    </div>
  );
}
