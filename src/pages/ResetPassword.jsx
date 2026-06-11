import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';

export default function ResetPassword({ invite = false }) {
  const { setNeedsPasswordReset } = useApp();
  const [pass, setPass]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const handleSave = async () => {
    if (pass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (pass !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    // En invitación venimos de /set-password: navegamos a la app ya con sesión.
    // En recuperación basta con salir de la pantalla de reset.
    setTimeout(() => {
      if (invite) window.location.replace('/');
      else setNeedsPasswordReset(false);
    }, 2000);
  };

  return (
    <div className="login-screen">
      <div className="login-logo">
        <img src={logo} alt="ClapTime" />
        ClapTime
      </div>
      <div className="login-box">
        {done ? (
          <>
            <h2>¡Contraseña actualizada!</h2>
            <p style={{ color: 'var(--text2)' }}>Redirigiendo a la aplicación…</p>
          </>
        ) : (
          <>
            <h2>{invite ? 'Crea tu contraseña' : 'Nueva contraseña'}</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 8 }}>
              {invite
                ? 'Te damos la bienvenida a ClapTime. Elige una contraseña para tu cuenta.'
                : 'Elige una contraseña segura para tu cuenta.'}
            </p>
            <div className="fg">
              <label>{invite ? 'Contraseña' : 'Nueva contraseña'}</label>
              <input type="password" placeholder="Mín. 8 caracteres" value={pass}
                onChange={e => setPass(e.target.value)} disabled={loading} />
            </div>
            <div className="fg">
              <label>Confirmar contraseña</label>
              <input type="password" placeholder="Repite la contraseña" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                disabled={loading} />
            </div>
            {error && <p className="err-msg">{error}</p>}
            <button className="btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
