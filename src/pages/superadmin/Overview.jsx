import { useState, useMemo } from 'react';
import { useSuperAdmin } from '../../context/SuperAdminContext';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const monthLabel = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return `${MONTHS[parseInt(mo) - 1]} ${y}`;
};
// ¿El contrato del empleado está activo durante el mes seleccionado?
const activeInMonth = (emp, month) => {
  const first = `${month}-01`, last = `${month}-31`;
  return (!emp.c_start || emp.c_start <= last) && (!emp.c_end || emp.c_end >= first);
};

export default function Overview() {
  const { companies, productions, emps, deleteUser } = useSuperAdmin();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterCompany, setFilterCompany] = useState('');
  const [filterType, setFilterType] = useState('all'); // all | fijo | refuerzo

  // Opciones de mes con nombre (24 meses atrás → 2 adelante)
  const monthOptions = useMemo(() => {
    const now = new Date(), opts = [];
    for (let i = 2; i >= -23; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = MONTHS[d.getMonth()];
      opts.push({ value, label: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${d.getFullYear()}` });
    }
    return opts;
  }, []);

  const prodToCompany = useMemo(() => {
    const m = {};
    productions.forEach(p => { m[p.id] = p.company_id; });
    return m;
  }, [productions]);

  const passType = (e) => filterType === 'all'
    || (filterType === 'refuerzo' ? e.is_reinforcement : !e.is_reinforcement);
  const passCompany = (e) => !filterCompany || prodToCompany[e.production_id] === filterCompany;

  // Empleados activos en el mes (con filtros aplicados)
  const activeEmps = useMemo(
    () => emps.filter(e => !e.archived && activeInMonth(e, month) && passType(e) && passCompany(e)),
    [emps, month, filterType, filterCompany, prodToCompany],
  );

  const handleDelete = async (e) => {
    if (!window.confirm(`¿Borrar a ${e.name}?\n\nSe elimina su cuenta de acceso y su ficha. Sus fichajes se CONSERVAN (obligación legal de registro horario). Esta acción no se puede deshacer.`)) return;
    await deleteUser(e.id);
  };
  const fijos = activeEmps.filter(e => !e.is_reinforcement).length;
  const refuerzos = activeEmps.filter(e => e.is_reinforcement).length;

  const activeProds = productions.filter(p => p.active);
  const visibleProds = filterCompany ? productions.filter(p => p.company_id === filterCompany) : productions;

  const empName = (e) => e.name || '—';
  const companyName = (id) => companies.find(c => c.id === id)?.name || '—';

  return (
    <>
      <div className="ph">
        <div>
          <h1>Vista global</h1>
          <p>Usuarios activos en <strong style={{ color: 'var(--accent)' }}>{monthLabel(month)}</strong> · para facturación</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="fb">
        <select value={month} onChange={e => setMonth(e.target.value)} title="Mes">
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">Todas las productoras</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">Fijos y refuerzos</option>
          <option value="fijo">Solo fijos</option>
          <option value="refuerzo">Solo refuerzos</option>
        </select>
      </div>

      {/* Tarjetas */}
      <div className="sg" style={{ marginBottom: '1.5rem' }}>
        <div className="sc"><div className="sc-label">Productoras</div><div className="sc-val cy">{companies.length}</div></div>
        <div className="sc"><div className="sc-label">Producciones activas</div><div className="sc-val ct">{activeProds.length}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{productions.length} totales</div></div>
        <div className="sc">
          <div className="sc-label">Usuarios activos · {monthLabel(month)}</div>
          <div className="sc-val" style={{ color: 'var(--accent)' }}>{activeEmps.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{fijos} fijos · {refuerzos} refuerzos</div>
        </div>
      </div>

      {/* Producciones */}
      <div className="tc" style={{ marginBottom: '1.5rem' }}>
        <div className="tch"><h3>Producciones</h3><span style={{ fontSize: 12, color: 'var(--text3)' }}>activos en {monthLabel(month)}</span></div>
        <table>
          <thead>
            <tr><th>Producción</th><th>Temporada</th><th>Productora</th><th>Activos (mes)</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {visibleProds.map(p => {
              const list = activeEmps.filter(e => e.production_id === p.id);
              const f = list.filter(e => !e.is_reinforcement).length;
              const r = list.filter(e => e.is_reinforcement).length;
              return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td style={{ color: 'var(--text2)' }}>{p.season || '—'}</td>
                  <td style={{ color: 'var(--text2)' }}>{companyName(p.company_id)}</td>
                  <td>
                    <b style={{ color: 'var(--accent)' }}>{list.length}</b>
                    {list.length > 0 && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{f} fijos · {r} ref.</span>}
                  </td>
                  <td>{p.active
                    ? <span className="b bg">Activa</span>
                    : <span className="b bc">Inactiva</span>}</td>
                </tr>
              );
            })}
            {visibleProds.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Sin producciones</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detalle de usuarios activos */}
      <div className="tc">
        <div className="tch"><h3>Usuarios activos</h3><span style={{ fontSize: 12, color: 'var(--text3)' }}>{activeEmps.length} en {monthLabel(month)}</span></div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Productora</th><th>Cargo / Depto.</th><th>Tipo</th><th></th></tr>
            </thead>
            <tbody>
              {activeEmps.map(e => (
                <tr key={e.id}>
                  <td><strong>{empName(e)}</strong></td>
                  <td style={{ color: 'var(--text2)' }}>{companyName(prodToCompany[e.production_id])}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>{[e.role, e.dept].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{e.is_reinforcement
                    ? <span className="b ba">⚡ Refuerzo</span>
                    : <span className="b bt">Fijo</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-danger" onClick={() => handleDelete(e)} title="Borrar usuario (conserva fichajes)">🗑 Borrar</button>
                  </td>
                </tr>
              ))}
              {activeEmps.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Nadie activo con estos filtros en {monthLabel(month)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
