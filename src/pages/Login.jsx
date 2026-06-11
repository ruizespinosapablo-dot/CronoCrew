import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !pass) { setError('Introduce tu email y contraseña.'); return; }
    setError('');
    setLoading(true);
    const err = await login(email.trim(), pass);
    if (err) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) { setError('Introduce tu email para continuar.'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: import.meta.env.VITE_APP_URL || window.location.origin,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setResetSent(true);
  };

  const onKey = (e) => { if (e.key === 'Enter') resetMode ? handleReset() : handleLogin(); };

  return (
    <div className="login-screen">
      <div className="login-logo">
        <img src={logo} alt="ClapTime" />
        <span className="wordmark">Clap<span className="wm-suffix">Time</span></span>
      </div>
      <div className="login-by">by ClapSuite</div>
      <div className="login-box">
        {resetSent ? (
          <>
            <h2>Revisa tu email</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
              Te hemos enviado un enlace a <strong>{email}</strong>. Haz clic en él para establecer tu nueva contraseña.
            </p>
            <button className="btn-ghost" onClick={() => { setResetMode(false); setResetSent(false); }}>
              Volver al login
            </button>
          </>
        ) : resetMode ? (
          <>
            <h2>Recuperar contraseña</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 8 }}>
              Introduce tu email y te enviaremos un enlace para cambiar tu contraseña.
            </p>
            <div className="fg">
              <label>Email</label>
              <input type="email" placeholder="tu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={loading} />
            </div>
            {error && <p className="err-msg">{error}</p>}
            <button className="btn-primary" onClick={handleReset} disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
            <button className="btn-ghost" style={{ marginTop: 8 }}
              onClick={() => { setResetMode(false); setError(''); }}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <h2>Bienvenido</h2>
            <p>Sistema de gestión horaria — Producción Audiovisual</p>
            <div className="fg">
              <label>Email</label>
              <input type="email" placeholder="tu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={loading} />
            </div>
            <div className="fg">
              <label>Contraseña</label>
              <input type="password" placeholder="••••••••" value={pass}
                onChange={e => setPass(e.target.value)} onKeyDown={onKey} disabled={loading} />
            </div>
            {error && <p className="err-msg">{error}</p>}
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
            <button className="btn-ghost" style={{ marginTop: 8, fontSize: 13 }}
              onClick={() => { setResetMode(true); setError(''); }}>
              He olvidado mi contraseña
            </button>
          </>
        )}
      </div>
    </div>
  );
}
