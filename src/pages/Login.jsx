import { useState } from 'react';
import { useApp } from '../context/AppContext';
import logo from '../assets/logo.svg';

export default function Login() {
  const { login } = useApp();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = () => {
    setError(false);
    if (!login(user.trim(), pass)) setError(true);
  };

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
          <label>Usuario</label>
          <input
            type="text"
            placeholder="tu.usuario"
            value={user}
            onChange={e => setUser(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="fg">
          <label>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <p className="err-msg">Usuario o contraseña incorrectos.</p>}
        <button className="btn-primary" onClick={handleLogin}>Entrar</button>
      </div>
    </div>
  );
}
