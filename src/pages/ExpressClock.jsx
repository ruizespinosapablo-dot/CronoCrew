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
    borderRadius: 8, padding: '8px 14px', fontSize: 15, fontWeight: 600, color: 'var(--text)',
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
  const [kmOn, setKmOn] = useState(false);
  const [kmCount, setKmCount] = useState('');
  const [email, setEmail] = useState('');
  const [idConfirm, setIdConfirm] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
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
      setExit(data.cited_out || '');   // salida por defecto = fin de citación
      setLoading(false);
    })();
  }, [token]);

  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async () => {
    setValidErr('');
    if (!entry) { setValidErr('Indica la hora de entrada.'); return; }
    if (!exit)  { setValidErr('Indica la hora de salida.'); return; }
    if (t2m(exit) <= t2m(entry)) { setValidErr('La salida debe ser posterior a la entrada.'); return; }
    if (!emailValid) { setValidErr('Revisa el email: no parece válido.'); return; }
    if (!idConfirm) { setValidErr('Marca la casilla de confirmación para enviar.'); return; }
    setSubmitting(true);
    const cnt = parseFloat(kmCount);
    const cleanEmail = email.trim() || null;
    const { data: ok, error } = await supabase.rpc('file_express_link', {
      p_id: token,
      p_entry: entry,
      p_exit: exit,
      p_obs: obs.trim() || null,
      p_km_applied: kmOn,
      p_km_count: kmOn && cnt > 0 ? cnt : null,
      p_email: cleanEmail,
    });
    if (error || !ok) { setValidErr('Error al enviar. Inténtalo de nuevo.'); setSubmitting(false); return; }
    // Enviar comprobante por email (si dejó email). No bloquea el éxito del fichaje.
    if (cleanEmail) {
      try {
        const { data: res } = await supabase.functions.invoke('send-express-receipt', { body: { token } });
        if (res?.sent) setEmailSent(true);
      } catch { /* el PDF sigue disponible aunque falle el email */ }
    }
    setFiled(true);
    setSubmitting(false);
  };

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFillColor(14, 16, 24); doc.rect(0, 0, 595, 64, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('ClapTime', 40, 40);
    doc.setTextColor(26, 29, 41); doc.setFontSize(15);
    doc.text('Comprobante de fichaje', 40, 100);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(63, 68, 83);
    const rows = [
      ['Nombre', link.name],
      ['Puesto', [link.role, link.dept].filter(Boolean).join(' · ') || '—'],
      ['Fecha', fmtDate(link.date)],
      ['Citación', `${link.cited_in}–${link.cited_out}`],
      ['Entrada real', entry || '—'],
      ['Salida real', exit || '—'],
      ['Descanso', `${link.brk || 0} min`],
      ['Horas netas', netMins !== null ? fmt(netMins) : '—'],
      ...(kmOn ? [['Kilometraje', kmCount ? `${kmCount} km (importe a fijar por producción)` : 'Aplicado (importe a fijar)']] : []),
      ...(obs.trim() ? [['Observaciones', obs.trim()]] : []),
      ['Enviado', new Date().toLocaleString('es-ES')],
    ];
    let y = 140;
    rows.forEach(([k, v]) => {
      doc.setTextColor(107, 114, 128); doc.text(String(k), 40, y);
      doc.setTextColor(26, 29, 41); doc.setFont('helvetica', 'bold');
      doc.text(String(v), 200, y, { maxWidth: 350 });
      doc.setFont('helvetica', 'normal');
      y += 26;
    });
    doc.setTextColor(154, 160, 172); doc.setFontSize(9);
    doc.text('Conserva este comprobante como justificante. ClapTime · by ClapSuite', 40, y + 16);
    doc.save(`comprobante_fichaje_${link.date}.pdf`);
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

  if (filed) {
    const rRow = (k, v) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border2)' }}>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>{k}</span>
        <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{v}</span>
      </div>
    );
    return (
      <div style={S.page}>
        <img src={logo} alt="ClapTime" style={{ width: 44, marginBottom: 20 }} />
        <div style={S.card}>
          <div style={{ textAlign: 'center', marginBottom: '1.1rem' }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>¡Fichaje enviado!</div>
            <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>Este es tu comprobante. Guárdalo.</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            {rRow('Nombre', link.name)}
            {rRow('Fecha', fmtDate(link.date))}
            {rRow('Citación', `${link.cited_in}–${link.cited_out}`)}
            {rRow('Entrada real', entry || '—')}
            {rRow('Salida real', exit || '—')}
            {rRow('Descanso', `${link.brk || 0} min`)}
            {rRow('Horas netas', netMins !== null ? fmt(netMins) : '—')}
            {kmOn && rRow('Kilometraje', kmCount ? `${kmCount} km` : 'Aplicado')}
            {obs.trim() && rRow('Observaciones', obs.trim())}
          </div>
          {email.trim() && (
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '9px 13px', marginBottom: '1rem', fontSize: 12.5, color: emailSent ? 'var(--teal)' : 'var(--text2)' }}>
              {emailSent
                ? `📧 Te hemos enviado una copia a ${email.trim()}`
                : `Si no recibes la copia en ${email.trim()}, descarga el PDF.`}
            </div>
          )}
          <button onClick={downloadPdf} style={{
            width: '100%', background: 'var(--accent)', color: '#0a0b0f',
            border: 'none', borderRadius: 10, padding: '13px',
            fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}>
            ⬇ Descargar comprobante (PDF)
          </button>
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, marginTop: 12 }}>
            Puedes cerrar esta página.
          </div>
        </div>
      </div>
    );
  }

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
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 15, color: 'var(--text)' }}>
              <input type="checkbox" checked={kmOn} onChange={e => setKmOn(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              🚗 Aplicar kilometraje
            </label>
            {kmOn && (
              <input type="number" min={0} step={1} value={kmCount} onChange={e => setKmCount(e.target.value)}
                placeholder="Km (opcional)" style={{ ...S.input, marginTop: 8 }} />
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Producción le pondrá el importe en € al revisar.</div>
          </div>
          <div>
            <label style={S.label}>Tu email <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text3)' }}>(opcional · para recibir tu comprobante)</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com" style={S.input} autoCapitalize="off" autoCorrect="off" />
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

        {/* Declaración de identidad */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: '1rem', fontSize: 13, color: 'var(--text2)' }}>
          <input type="checkbox" checked={idConfirm} onChange={e => setIdConfirm(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, cursor: 'pointer', flexShrink: 0 }} />
          <span>Confirmo que soy <b style={{ color: 'var(--text)' }}>{link.name}</b> y que los datos del fichaje son correctos.</span>
        </label>

        {/* Error de validación */}
        {validErr && (
          <div style={{ color: 'var(--coral)', fontSize: 12, marginBottom: '0.75rem' }}>{validErr}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !idConfirm}
          style={{
            width: '100%', background: 'var(--accent)', color: '#0a0b0f',
            border: 'none', borderRadius: 10, padding: '13px',
            fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 15,
            cursor: (submitting || !idConfirm) ? 'not-allowed' : 'pointer',
            opacity: (submitting || !idConfirm) ? 0.6 : 1, transition: 'opacity .15s',
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
