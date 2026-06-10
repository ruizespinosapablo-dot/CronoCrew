import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import logo from '../../assets/logo.svg';
import Overview from './Overview';
import CompaniesPage from './CompaniesPage';
import UsersPage from './UsersPage';

const PAGES = [
  { id: 'overview',   label: 'Vista global',   icon: 'ti-layout-dashboard' },
  { id: 'companies',  label: 'Productoras',     icon: 'ti-building' },
  { id: 'users',      label: 'Usuarios',        icon: 'ti-users' },
];

export default function SuperAdminLayout() {
  const { currentUser, logout } = useApp();
  const [page, setPage] = useState('overview');

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-logo">
          <img src={logo} alt="CronoCrew" />
          <span className="topbar-title">CronoCrew · Super Admin</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="avatar" style={{ background: '#7c3aed', color: '#fff' }}>SA</div>
            <span style={{ display: 'var(--name-display, inline)' }}>{currentUser?.displayName || 'Super Admin'}</span>
          </div>
          <button className="btn-logout" onClick={logout}>Salir</button>
        </div>
      </div>

      {/* Tabs móvil */}
      <div className="admin-mobile-tabs">
        {PAGES.map(p => (
          <button key={p.id} className={`amt-item${page === p.id ? ' active' : ''}`} onClick={() => setPage(p.id)}>
            <i className={`ti ${p.icon}`} style={{ fontSize: 14 }} />
            {p.label}
          </button>
        ))}
      </div>

      <div className="app-layout">
        <div className="sidebar">
          <div className="sb-section">
            <div className="sb-label">Panel global</div>
            {PAGES.map(p => (
              <div key={p.id} className={`sb-item${page === p.id ? ' active' : ''}`} onClick={() => setPage(p.id)}>
                <i className={`ti ${p.icon}`} />
                {p.label}
              </div>
            ))}
          </div>
        </div>

        <div className="main">
          {page === 'overview'  && <Overview />}
          {page === 'companies' && <CompaniesPage />}
          {page === 'users'     && <UsersPage />}
        </div>
      </div>
    </div>
  );
}
