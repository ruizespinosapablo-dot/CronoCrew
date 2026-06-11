import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fmtDate, fmt, t2m } from '../lib/utils';
import logo from '../assets/logo.svg';

const S = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', padding: '1.5rem',
  },
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 420,
  },
  label: {
    display: 'block', fontSize: 11, color: 'var(--text2)',
    textTransform: 'uppercase', letterSpacing: '.07em',
    fontWeight: 600, marginBottom: 6,
  },
  input: {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '10px 13px', color: 'var(--text)',
    fontSize: 15, fontFamily: 'var(--fb)', outline: 'none',
    boxSizing: 'border-box',
  },
  badge: {
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--text2)',
  },
};

export default function ExpressClock({ token }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [filed, setFiled] = useState(false);
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [obs, setObs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validErr, setValidErr] = useState('');

  useEffect(() => {
    (async () => {
      if (!token || !supabase) { setFetchError('Enlace no válido.'); setLoading(false); return; }
      // RPC con el UUID como token: anon no tiene acceso directo a la tabla
      const { data: rows, error } = await supabase.rpc('get_express_link', { p_id: token });
      const data = rows?.[0];
      if (error || !data) {
        setFetchError('Enlace no válido o expirado.'); setLoading(false); return;
      }
      if (data.status === 'filed' || data.status === 'imported') {
        setFiled(true); setLoading(false); return;
      }
      if (new Date(data.expires_at) < new Date()) {
        setFetchError('Este enlace ha caducado. Contacta con administración.'); setLoading(false); return;
      }
      setLink(data);
      setEntry(data.cited_in || '');
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async () => {
    setValidErr('');
    if (!entry) { setValidErr('Indica la hora de entrada.'); return; }
    if (!exit)  { setValidErr('Indica la hora de salida.'); return; }
    if (t2m(exit) <= t2m(entry)) { setValidErr('La salida debe ser posterior a la entrada.'); return; }
    setSubmitting(true);
    const { data: ok, error } = await supabase.rpc('file_express_link', {
      p_id: token,
      p_entry: entry,
      p_exit: exit,
      p_obs: obs.trim() || null,
    });
    if (error || !ok) { setValidErr('Error al enviar. Inténtalo de nuevo.'); setSubmitting(false); return; }
    setFiled(true);
    setSubmitting(false);
  };

  const netMins = (entry && exit && link)
    ? Math.max(0, t2m(exit) - t2m(entry) - (link.brk || 60))
    : null;

  if (loading) return (
    <div style={S.page}>
      <div style={{ color: 'var(--text2)', fontSize: 14 }}>Cargando…</div>
    </div>
  );

  if (fetchError) return (
    <div style={S.page}>
      <img src={logo} alt="ClapTime" style={{ width: 44, marginBottom: 20 }} />
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: 'var(--coral)', fontSize: 15, fontWeight: 600 }}>{fetchError}</div>
      </div>
    </div>
  );

  if (filed) return (
    <div style={S.page}>
      <img src={logo} alt="ClapTime" style={{ width: 44, marginBottom: 20 }} />
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>
          ¡Fichaje enviado!
        </div>
        <div style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.6 }}>
          Tu jornada ha sido registrada correctamente.<br />
          Puedes cerrar esta página.
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <img src={logo} alt="ClapTime" style={{ width: 44, marginBottom: 20 }} />
      <div style={S.card}>
        {/* Cabecera */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 4 }}>
            Fichaje del día
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)' }}>{link.name}</div>
          {(link.role || link.dept) && (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>
              {[link.role, link.dept].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* Info del día */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <span style={S.badge}>{fmtDate(link.date)}</span>
          <span style={S.badge}>Citado {link.cited_in}–{link.cited_out}</span>
          <span style={S.badge}>{link.ch}h · {link.brk}min descanso</span>
        </div>

        {/* Formulario */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={S.label}>Hora de entrada real</label>
            <input type="time" value={entry} onChange={e => setEntry(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Hora de salida real</label>
            <input type="time" value={exit} onChange={e => setExit(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Observaciones <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text3)' }}>(opcional)</span></label>
            <input type="text" value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ej: rodaje exterior, espera por producción…"
              style={S.input} />
          </div>
        </div>

        {/* Preview horas netas */}
        {netMins !== null && (
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>Netas: <b style={{ color: 'var(--teal)' }}>{fmt(netMins)}</b></span>
            {netMins > link.ch * 60 && (
              <span style={{ color: 'var(--purple)' }}>+{fmt(netMins - link.ch * 60)} extras</span>
            )}
          </div>
        )}

        {/* Error de validación */}
        {validErr && (
          <div style={{ color: 'var(--coral)', fontSize: 12, marginBottom: '0.75rem' }}>{validErr}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', background: 'var(--accent)', color: '#0a0b0f',
            border: 'none', borderRadius: 10, padding: '13px',
            fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 15,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1, transition: 'opacity .15s',
          }}
        >
          {submitting ? 'Enviando…' : 'Enviar fichaje'}
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
        Enlace válido hasta el {new Date(link.expires_at).toLocaleDateString('es-ES')} · Uso único
      </div>
    </div>
  );
}
