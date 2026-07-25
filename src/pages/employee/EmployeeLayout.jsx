import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import logo from '../../assets/logo.svg';
import Clock from './Clock';
import ActorClock from './ActorClock';
import Hours from './Hours';
import History from './History';
import Leave from './Leave';
import TeamReview from './TeamReview';

const BASE_PAGES = [
  { id: 'fich', label: 'Fichar', icon: 'ti-fingerprint' },
  { id: 'hrs',  label: 'Mis horas', icon: 'ti-clock' },
  { id: 'hist', label: 'Historial', icon: 'ti-calendar' },
  { id: 'perm', label: 'Permisos', icon: 'ti-beach' },
];

export default function EmployeeLayout() {
  const { currentUser, emps, logout } = useApp();
  const emp = emps.find(e => e.id === currentUser.eid);
  const [page, setPage] = useState('fich');

  // El jefe de equipo es un empleado más, con una pestaña extra para aprobar
  // lo de su departamento.
  const esJefe = currentUser.role === 'dept_head';
  const PAGES = esJefe
    ? [...BASE_PAGES, { id: 'team', label: 'Mi equipo', icon: 'ti-users-group' }]
    : BASE_PAGES;

  // Si el usuario TIENE un EID pero su ficha aún no aparece, normalmente es que
  // los datos todavía no han cargado (p. ej. al abrir una segunda ventana, que
  // dispara una recarga de sesión). Eso NO es "cuenta sin vincular": mostramos
  // un estado de carga con opción de recargar, en vez del mensaje de error.
  if (!emp && currentUser.eid) return (
    <div className="login-screen">
      <div className="login-box" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <h2 style={{ marginBottom: 8 }}>Cargando tu información…</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
          Estamos recuperando los datos de tu producción.<br />
          Si tienes otra ventana de ClapTime abierta, ciérrala y recarga.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-accent" onClick={() => window.location.reload()}>Recargar</button>
          <button className="btn-ghost" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  );

  // EID ausente de verdad → cuenta no vinculada a ningún empleado.
  if (!emp) return (
    <div className="login-screen">
      <div className="login-box" style={{ textAlign: 'center' }}>
        <i className="ti ti-user-off" style={{ fontSize: 48, color: 'var(--text3)', display: 'block', marginBottom: 12 }} />
        <h2 style={{ marginBottom: 8 }}>Cuenta sin vincular</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
          Tu usuario aún no está vinculado a ningún empleado de la producción.<br />
          Contacta con tu administrador para que te asigne un EID.
        </p>
        <button className="btn-ghost" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-logo">
          <img src={logo} alt="ClapTime" />
          <span className="topbar-title">Clap<span className="wm-suffix">Time</span> <span className="topbar-sub">· Mi Espacio</span></span>
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
          {page === 'fich' && (emp.dept === 'Actores' ? <ActorClock emp={emp} /> : <Clock emp={emp} />)}
          {page === 'hrs'  && <Hours emp={emp} />}
          {page === 'hist' && <History emp={emp} />}
          {page === 'perm' && <Leave emp={emp} />}
          {page === 'team' && esJefe && <TeamReview emp={emp} />}
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
