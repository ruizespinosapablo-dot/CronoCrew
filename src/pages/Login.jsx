import { useState } from 'react';
import { useApp } from '../context/AppContext';
import logo from '../assets/logo.svg';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !pass) { setError('Introduce tu email y contraseña.'); return; }
    setError('');
    setLoading(true);
    const err = await login(email.trim(), pass);
    if (err) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
    }
    // Si no hay error, onAuthStateChange dispara SIGNED_IN y la app cambia de pantalla
  };

  const onKey = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div className="login-screen">
      <div className="login-logo">
        <img src={logo} alt="CronoCrew" />
        CronoCrew
      </div>
      <div className="login-box">
        <h2>Bienvenido</h2>
        <p>Sistema de gestión horaria — Producción Audiovisual</p>
        <div className="fg">
          <label>Email</label>
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={onKey}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
          />
        </div>
        <div className="fg">
          <label>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={onKey}
            disabled={loading}
          />
        </div>
        {error && <p className="err-msg">{error}</p>}
        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
