import { useSuperAdmin } from '../../context/SuperAdminContext';

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', employee: 'Empleado' };

export default function Overview() {
  const { companies, productions, users } = useSuperAdmin();

  const activeProds = productions.filter(p => p.active);

  const stats = [
    { label: 'Productoras', value: companies.length, icon: 'ti-building' },
    { label: 'Producciones activas', value: activeProds.length, icon: 'ti-video', sub: `${productions.length} totales` },
    { label: 'Usuarios', value: users.length, icon: 'ti-users' },
  ];

  return (
    <div className="page-content">
      <h2 className="page-title">Vista global</h2>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon"><i className={`ti ${s.icon}`} /></div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      <h3 style={{ marginBottom: 12, color: 'var(--text1)' }}>Producciones</h3>
      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Producción</th>
              <th>Temporada</th>
              <th>Productora</th>
              <th>Usuarios asignados</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {productions.map(p => {
              const company = companies.find(c => c.id === p.company_id);
              const assignedUsers = users.filter(u => u.production_id === p.id);
              return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.season || '—'}</td>
                  <td>{company?.name || '—'}</td>
                  <td>{assignedUsers.length}</td>
                  <td>
                    <span className={`status-badge ${p.active ? 'approved' : 'rejected'}`}>
                      {p.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {productions.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)' }}>Sin producciones</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
