import { useState } from 'react';
import { useSuperAdmin } from '../../context/SuperAdminContext';
import { useApp } from '../../context/AppContext';

const EMPTY_CO = { name: '', nif: '' };
const EMPTY_PR = { name: '', season: '', company_id: '' };

export default function CompaniesPage() {
  const { companies, productions, createCompany, updateCompany, createProduction, updateProduction } = useSuperAdmin();
  const { switchProduction } = useApp();

  const [showCo, setShowCo]   = useState(false);   // modal nueva productora
  const [showPr, setShowPr]   = useState(null);     // company_id para nueva producción
  const [editCo, setEditCo]   = useState(null);     // company a editar
  const [editPr, setEditPr]   = useState(null);     // production a editar
  const [formCo, setFormCo]   = useState(EMPTY_CO);
  const [formPr, setFormPr]   = useState(EMPTY_PR);
  const [saving, setSaving]   = useState(false);
  const [expanded, setExpanded] = useState({});

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Handlers company ──────────────────────────────────────────────────────
  const openNewCo = () => { setFormCo(EMPTY_CO); setEditCo(null); setShowCo(true); };
  const openEditCo = (c) => { setFormCo({ name: c.name, nif: c.nif || '' }); setEditCo(c); setShowCo(true); };

  const saveCo = async () => {
    if (!formCo.name.trim()) return;
    setSaving(true);
    if (editCo) await updateCompany(editCo.id, { name: formCo.name, nif: formCo.nif || null });
    else await createCompany(formCo);
    setSaving(false);
    setShowCo(false);
  };

  // ── Handlers production ───────────────────────────────────────────────────
  const openNewPr = (company_id) => { setFormPr({ ...EMPTY_PR, company_id }); setEditPr(null); setShowPr(company_id); };
  const openEditPr = (p) => { setFormPr({ name: p.name, season: p.season || '', company_id: p.company_id }); setEditPr(p); setShowPr(p.company_id); };

  const savePr = async () => {
    if (!formPr.name.trim()) return;
    setSaving(true);
    if (editPr) await updateProduction(editPr.id, { name: formPr.name, season: formPr.season || null, active: editPr.active });
    else await createProduction(formPr);
    setSaving(false);
    setShowPr(null);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Productoras y producciones</h2>
        <button className="btn-primary" onClick={openNewCo}>+ Nueva productora</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {companies.map(c => {
          const cProds = productions.filter(p => p.company_id === c.id);
          const isOpen = expanded[c.id] ?? true;
          return (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                   onClick={() => toggle(c.id)}>
                <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ color: 'var(--text3)' }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{c.name}</strong>
                  {c.nif && <span style={{ marginLeft: 10, color: 'var(--text3)', fontSize: 12 }}>NIF: {c.nif}</span>}
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 12 }}>{cProds.length} producción{cProds.length !== 1 ? 'es' : ''}</span>
                <button className="btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEditCo(c); }}>
                  <i className="ti ti-edit" />
                </button>
              </div>

              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producción</th>
                        <th>Temporada</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cProds.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.season || '—'}</td>
                          <td>
                            <span className={`status-badge ${p.active ? 'approved' : 'rejected'}`}>
                              {p.active ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-ghost btn-sm" onClick={() => openEditPr(p)}>
                              <i className="ti ti-edit" />
                            </button>
                            <button className="btn-primary btn-sm"
                              onClick={() => switchProduction(p.id, c.id)}
                              title="Entrar como admin de esta producción">
                              <i className="ti ti-login" /> Entrar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {cProds.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ color: 'var(--text3)', textAlign: 'center' }}>
                            Sin producciones
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <button className="btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => openNewPr(c.id)}>
                    + Nueva producción
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {companies.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
            Sin productoras. Crea la primera.
          </div>
        )}
      </div>

      {/* Modal productora */}
      {showCo && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowCo(false)}>
          <div className="modal">
            <h3>{editCo ? 'Editar productora' : 'Nueva productora'}</h3>
            <div className="fg">
              <label>Nombre *</label>
              <input value={formCo.name} onChange={e => setFormCo(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Bambú Producciones" />
            </div>
            <div className="fg">
              <label>NIF</label>
              <input value={formCo.nif} onChange={e => setFormCo(p => ({ ...p, nif: e.target.value }))} placeholder="B12345678" />
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setShowCo(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveCo} disabled={saving || !formCo.name.trim()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal producción */}
      {showPr && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowPr(null)}>
          <div className="modal">
            <h3>{editPr ? 'Editar producción' : 'Nueva producción'}</h3>
            <div className="fg">
              <label>Nombre *</label>
              <input value={formPr.name} onChange={e => setFormPr(p => ({ ...p, name: e.target.value }))} placeholder="Ej: La Promesa" />
            </div>
            <div className="fg">
              <label>Temporada</label>
              <input value={formPr.season} onChange={e => setFormPr(p => ({ ...p, season: e.target.value }))} placeholder="Ej: 5T" />
            </div>
            {editPr && (
              <div className="fg">
                <label>Estado</label>
                <select value={editPr.active ? 'true' : 'false'}
                  onChange={e => setEditPr(prev => ({ ...prev, active: e.target.value === 'true' }))}>
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
            )}
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setShowPr(null)}>Cancelar</button>
              <button className="btn-primary" onClick={savePr} disabled={saving || !formPr.name.trim()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
