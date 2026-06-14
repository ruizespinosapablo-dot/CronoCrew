import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { fmtDate, fmt, t2m } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/constants';

const STATUS_LABEL = {
  pending: { text: 'Esperando', cls: 'by' },
  filed:   { text: 'Fichado ✓', cls: 'bg' },
};

export default function ExpressFilings() {
  const { expressLinks, addExpressLink, importExpressLink, deleteExpressLink } = useApp();
  const { showToast } = useToast();

  // Formulario
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName]       = useState('');
  const [dni, setDni]         = useState('');
  const [dept, setDept]       = useState('Producción');
  const [role, setRole]       = useState('');
  const [date, setDate]       = useState(today);
  const [citedIn, setCitedIn] = useState('09:00');
  const [citedOut, setCitedOut] = useState('18:00');
  const [ch, setCh]           = useState(8);
  const [brk, setBrk]         = useState(60);
  const [creating, setCreating] = useState(false);
  const [newLinkId, setNewLinkId] = useState(null);
  const [copied, setCopied]   = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) { showToast('Indica el nombre del trabajador.', 'warning'); return; }
    if (!date)        { showToast('Indica la fecha.', 'warning'); return; }
    setCreating(true);
    const id = await addExpressLink({ name: name.trim(), dni, dept, role, date, citedIn, citedOut, ch: parseInt(ch), brk: parseInt(brk) });
    if (id) {
      setNewLinkId(id);
      setName(''); setDni(''); setRole('');
    }
    setCreating(false);
  };

  const copyLink = (id) => {
    const url = `${window.location.origin}/fichar/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2500);
    });
  };

  const pending  = expressLinks.filter(l => l.status === 'pending');
  const filed    = expressLinks.filter(l => l.status === 'filed');

  return (
    <>
      <div className="ph">
        <div>
          <h1>Fichaje Express</h1>
          <p>Envía un enlace de fichaje a refuerzos sin necesidad de cuenta</p>
        </div>
      </div>

      {/* Formulario nuevo enlace */}
      <div className="card-section">
        <h3>Nuevo enlace de fichaje</h3>
        <div className="frow" style={{ marginBottom: '1rem' }}>
          <div className="fg">
            <label>Nombre completo *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Pedro Ruiz García" autoComplete="off" />
          </div>
          <div className="fg">
            <label>DNI</label>
            <input type="text" value={dni} onChange={e => setDni(e.target.value)} placeholder="12345678J" />
          </div>
        </div>
        <div className="frow" style={{ marginBottom: '1rem' }}>
          <div className="fg">
            <label>Departamento</label>
            <select value={dept} onChange={e => setDept(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Cargo</label>
            <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="Auxiliar de producción" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="fg">
            <label>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="fg">
            <label>Citado entrada</label>
            <input type="time" value={citedIn} onChange={e => setCitedIn(e.target.value)} />
          </div>
          <div className="fg">
            <label>Citado salida</label>
            <input type="time" value={citedOut} onChange={e => setCitedOut(e.target.value)} />
          </div>
          <div className="fg">
            <label>Horas contrato</label>
            <input type="number" value={ch} min={1} max={24} step={0.5} onChange={e => setCh(e.target.value)} />
          </div>
          <div className="fg">
            <label>Descanso (min)</label>
            <input type="number" value={brk} min={0} step={5} onChange={e => setBrk(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-accent" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creando…' : '⚡ Generar enlace'}
          </button>
          {newLinkId && (
            <button
              className="btn-sm"
              style={{ color: copied === newLinkId ? 'var(--teal)' : undefined }}
              onClick={() => copyLink(newLinkId)}
            >
              {copied === newLinkId ? '✓ Copiado' : '📋 Copiar último enlace'}
            </button>
          )}
        </div>
      </div>

      {/* Fichados — listos para importar */}
      {filed.length > 0 && (
        <div className="tc" style={{ marginBottom: '1.25rem', outline: '1px solid var(--teal)', borderRadius: 'var(--r)' }}>
          <div className="tch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>✅ Listos para importar</h3>
            <span className="b bg">{filed.length} fichaje{filed.length !== 1 ? 's' : ''}</span>
          </div>
          <table>
            <thead>
              <tr><th>Trabajador</th><th>Depto.</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Netas</th><th>Obs.</th><th></th></tr>
            </thead>
            <tbody>
              {filed.map(l => {
                const net = (l.entry && l.exit) ? Math.max(0, t2m(l.exit) - t2m(l.entry) - (l.brk || 60)) : null;
                const extraMin = net !== null ? Math.max(0, net - (l.ch || 8) * 60) : 0;
                const hasExtras = extraMin > 0;
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.name}</div>
                      {l.dni && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.dni}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{l.dept || '—'}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(l.date)}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--teal)', fontWeight: 600 }}>{l.entry || '—'}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--coral)', fontWeight: 600 }}>{l.exit || '—'}</td>
                    <td style={{ fontWeight: 700 }}>
                      {net !== null ? fmt(net) : '—'}
                      {hasExtras && (
                        <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--purple)', fontWeight: 600 }}>
                          +{fmt(extraMin)} ext
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.obs || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <button
                          className={hasExtras ? 'btn-accent' : 'btn-teal'}
                          style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                          onClick={() => importExpressLink(l, hasExtras)}
                        >
                          {hasExtras ? '⚡ Importar y pagar extras' : 'Importar fichaje'}
                        </button>
                        <button
                          className="btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px', color: 'var(--coral)' }}
                          title="Eliminar"
                          onClick={() => deleteExpressLink(l.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pendientes — esperando al trabajador */}
      {pending.length > 0 && (
        <div className="tc" style={{ marginBottom: '1.25rem' }}>
          <div className="tch">
            <h3>⏳ Esperando fichaje</h3>
            <span className="b by">{pending.length}</span>
          </div>
          <table>
            <thead>
              <tr><th>Trabajador</th><th>Depto.</th><th>Fecha</th><th>Citado</th><th>Expira</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {pending.map(l => {
                const expired = new Date(l.expiresAt) < new Date();
                return (
                  <tr key={l.id} style={expired ? { opacity: 0.5 } : {}}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.name}</div>
                      {l.dni && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.dni}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{l.dept || '—'}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(l.date)}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{l.citedIn}–{l.citedOut}</td>
                    <td style={{ fontSize: 11, color: expired ? 'var(--coral)' : 'var(--text3)' }}>
                      {expired ? '⚠ Expirado' : new Date(l.expiresAt).toLocaleDateString('es-ES')}
                    </td>
                    <td><span className={`b ${expired ? 'bc' : 'by'}`}>{expired ? 'Expirado' : 'Esperando'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <button
                          className="btn-sm"
                          style={{ color: copied === l.id ? 'var(--teal)' : undefined, fontSize: 11 }}
                          onClick={() => copyLink(l.id)}
                        >
                          {copied === l.id ? '✓ Copiado' : '📋 Copiar enlace'}
                        </button>
                        <button
                          className="btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px', color: 'var(--coral)' }}
                          title="Eliminar"
                          onClick={() => deleteExpressLink(l.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expressLinks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
          Sin enlaces creados. Usa el formulario de arriba para generar tu primer fichaje express.
        </div>
      )}
    </>
  );
}
