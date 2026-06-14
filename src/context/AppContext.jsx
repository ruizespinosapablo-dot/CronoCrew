import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastContext';
import { t2m } from '../lib/utils';

const AppContext = createContext(null);

const REQ_TYPE_MAP = {
  'Vacaciones': 'vacaciones',
  'Enfermedad': 'baja',
  'Asunto personal': 'permiso',
  'Maternidad/Paternidad': 'baja',
  'Permiso': 'permiso',
  'Otro': 'permiso',
};

// Supabase row → app object
const mapExpressLink = row => ({
  id: row.id,
  name: row.name,
  dni: row.dni || '',
  dept: row.dept || '',
  role: row.role || '',
  date: row.date,
  citedIn: row.cited_in || '',
  citedOut: row.cited_out || '',
  ch: row.ch || 8,
  brk: row.brk || 60,
  entry: row.entry || null,
  exit: row.exit || null,
  obs: row.obs || '',
  email: row.email || '',
  kmApplied: row.km_applied || false,
  kmCount: row.km_count ?? null,
  status: row.status || 'pending',
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  filedAt: row.filed_at || null,
});

const mapEmp = row => ({
  id: row.id, name: row.name, alias: row.alias, role: row.role,
  dept: row.dept, dni: row.dni, email: row.email, initials: row.initials,
  color: row.color, start: row.start_time, end: row.end_time,
  brk: row.brk, ch: row.ch, cStart: row.c_start, cEnd: row.c_end,
  setupComplete: row.setup_complete ?? false,
  isReinforcement: row.is_reinforcement ?? false,
});

const mapRec = row => ({
  id: row.id, eid: row.eid, date: row.date,
  entry: row.entry || '', exit: row.exit || '',
  brk: row.brk ?? 0, obs: row.obs || '', status: row.status,
  method: row.method || null,
  citedIn: row.cited_in || '', citedOut: row.cited_out || '',
  absence: row.absence || null, libranza: row.libranza || false,
  special: row.special || false, paidExtra: row.paid_extra || 0,
  specialNote: row.special_note || null,
  catUp: row.cat_up || false, catUpNote: row.cat_up_note || null,
  permMin: row.perm_min || 0, permReason: row.perm_reason || null,
  kmApplied: row.km_applied || false, kmCount: row.km_count ?? null, kmEur: row.km_eur ?? null,
  extraDay: row.extra_day || false,
  deletedAt: row.deleted_at || null, deletedBy: row.deleted_by || null,
  actorCited: row.actor_cited || null, actorEnd: row.actor_end || null,
  actorMakeup: row.actor_makeup ?? null, actorTravelIn: row.actor_travel_in ?? null,
  actorTravelOut: row.actor_travel_out ?? null, actorBreak: row.actor_break ?? null,
});

const mapPaid = row => ({
  _dbId: row.id, eid: row.eid, date: row.date, month: row.month,
  ordMin: row.ord_min, extMin: row.ext_min, note: row.note,
});

const mapReq = row => ({
  id: row.id, eid: row.eid, empName: row.emp_name || '',
  type: row.type || '', start: row.start_date || '', end: row.end_date || '',
  days: row.days || 0, reason: row.reason || '', status: row.status || 'pending',
});

const mapPerm = row => ({
  id: row.id, eid: row.eid, type: row.type || '', grantedAt: row.granted_at || null,
});

// App object → Supabase row
const toRecRow = r => ({
  id: r.id, eid: r.eid, date: r.date,
  entry: r.entry || null, exit: r.exit || null,
  brk: r.brk ?? 0, obs: r.obs || null,
  status: r.status || 'approved', method: r.method || null,
  cited_in: r.citedIn || null, cited_out: r.citedOut || null,
  absence: r.absence || null, libranza: r.libranza || false,
  special: r.special || false, paid_extra: r.paidExtra || 0,
  special_note: r.specialNote || null,
  cat_up: r.catUp || false, cat_up_note: r.catUpNote || null,
  perm_min: r.permMin || 0, perm_reason: r.permReason || null,
  km_applied: r.kmApplied || false, km_count: r.kmCount ?? null, km_eur: r.kmEur ?? null,
  extra_day: r.extraDay || false,
  deleted_at: r.deletedAt || null, deleted_by: r.deletedBy || null,
  actor_cited: r.actorCited || null, actor_end: r.actorEnd || null,
  actor_makeup: r.actorMakeup ?? null, actor_travel_in: r.actorTravelIn ?? null,
  actor_travel_out: r.actorTravelOut ?? null, actor_break: r.actorBreak ?? null,
});

const toEmpRow = e => ({
  id: e.id, name: e.name, alias: e.alias, role: e.role, dept: e.dept,
  dni: e.dni, email: e.email, initials: e.initials, color: e.color,
  start_time: e.start, end_time: e.end, brk: e.brk, ch: e.ch,
  c_start: e.cStart || null, c_end: e.cEnd || null,
  setup_complete: e.setupComplete ?? false,
});

const toReqRow = r => ({
  id: r.id, eid: r.eid, emp_name: r.empName || null,
  type: r.type || null, start_date: r.start || null, end_date: r.end || null,
  days: r.days || 0, reason: r.reason || null, status: r.status || 'pending',
});

const toPermRow = p => ({
  id: p.id, eid: p.eid, type: p.type || null,
  granted_at: p.grantedAt || new Date().toISOString(),
});

// Pantalla de carga con vía de escape: si tarda demasiado, permite cerrar sesión
// y volver al login (evita quedarse atrapado en "Iniciando…").
function LoadingScreen({ label }) {
  const [showEscape, setShowEscape] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowEscape(true), 6000);
    return () => clearTimeout(t);
  }, []);
  const reset = async () => {
    // Limpia el token local primero: si otra pestaña retiene el lock de Supabase,
    // signOut() puede colgarse y el botón no haría nada. Así forzamos el logout.
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
    } catch { /* ignora */ }
    try {
      await Promise.race([
        supabase?.auth.signOut({ scope: 'local' }),
        new Promise(res => setTimeout(res, 1500)),
      ]);
    } catch { /* ignora */ }
    window.location.replace('/');
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text)', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 24 }}>⏳</div>
      <div style={{ fontSize: 15, color: 'var(--text2)' }}>{label}</div>
      {showEscape && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>¿Tarda demasiado?</div>
          <button onClick={reset}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border3)', color: 'var(--text)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
            Cerrar sesión y volver al inicio
          </button>
        </div>
      )}
    </div>
  );
}

export function AppProvider({ children }) {
  const { showToast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const currentUserRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const [emps, setEmps] = useState([]);
  const [recs, setRecs] = useState([]);
  const [paid, setPaid] = useState([]);
  const [adminPerms, setAdminPerms] = useState([]);
  const [festivos, setFestivos] = useState([]);
  const [empRequests, setEmpRequests] = useState([]);
  const [expressLinks, setExpressLinks] = useState([]);

  // ── Carga de datos (se llama tras confirmar sesión) ──────────────────────
  const loadData = useCallback(async (productionId = null) => {
    if (!supabase) {
      setDbError('La conexión con la base de datos no está configurada. Revisa las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      return;
    }
    setLoading(true);
    setDbError(null);
    try {
      // Helper: añade filtro de producción si existe
      const withProd = (query) => productionId ? query.eq('production_id', productionId) : query;

      // Ejecuta una consulta con timeout y reintentos: si se cuelga (proyecto
      // despertando, microcorte de red…) aborta y reintenta en vez de quedarse
      // congelado para siempre. queryFn debe DEVOLVER una consulta nueva.
      const runQuery = async (queryFn, { retries = 2, ms = 15000 } = {}) => {
        let lastErr;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const { data, error } = await Promise.race([
              queryFn(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms)),
            ]);
            if (error) throw error;
            return data ?? [];
          } catch (e) {
            lastErr = e;
            if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
          }
        }
        throw lastErr;
      };

      const empsData = await runQuery(() => withProd(supabase.from('emps').select('*')));

      const fetchAllRecs = async () => {
        const PAGE = 1000;
        let all = [], from = 0;
        while (true) {
          const data = await runQuery(() =>
            withProd(supabase.from('recs').select('*').is('deleted_at', null)).range(from, from + PAGE - 1));
          all = all.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return all;
      };

      const [recsData, paidData, festivosData, reqsData, permsData, expressData] = await Promise.all([
        fetchAllRecs(),
        runQuery(() => withProd(supabase.from('paid').select('*'))),
        runQuery(() => withProd(supabase.from('festivos').select('*').order('date'))),
        runQuery(() => withProd(supabase.from('requests').select('*'))),
        runQuery(() => withProd(supabase.from('admin_perms').select('*'))),
        runQuery(() => withProd(supabase.from('express_links').select('*').neq('status', 'imported').order('created_at', { ascending: false }))),
      ]);

      setEmps(empsData.map(mapEmp));
      setRecs(recsData.map(mapRec));
      setPaid(paidData.map(mapPaid));
      setFestivos(festivosData);
      setEmpRequests(reqsData.map(mapReq));
      setAdminPerms(permsData.map(mapPerm));
      setExpressLinks(expressData.map(mapExpressLink));

      // Realtime: cuando un trabajador ficha, el admin lo ve al instante
      // Limpiar canal anterior si existe (evita error al re-llamar loadData)
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      realtimeChannelRef.current = supabase.channel('express_links_watch')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'express_links' }, ({ new: row }) => {
          setExpressLinks(prev => prev.map(l => l.id === row.id ? mapExpressLink(row) : l));
        })
        .subscribe();
    } catch (err) {
      console.error('Error cargando datos desde Supabase:', err);
      setDbError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auth: inicializar sesión con Supabase Auth ───────────────────────────
  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }

    const resolveSession = async (session) => {
      if (!session) {
        setCurrentUser(null);
        currentUserRef.current = null;
        setAuthChecked(true);
        return;
      }
      // Obtener perfil con timeout + reintentos: si la lectura se cuelga (Supabase
      // despertando, microcorte), NO debe dejar la app en "Iniciando" para siempre.
      let profile = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data } = await Promise.race([
            supabase.from('profiles').select('*').eq('id', session.user.id).single(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
          ]);
          profile = data;
          break;
        } catch {
          if (attempt < 2) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      // Si la lectura del perfil falló pero YA teníamos resuelto este mismo usuario,
      // no degradamos la sesión (evita "Cuenta sin vincular" tras un rato inactivo,
      // cuando la revalidación de Supabase relee el perfil y la consulta se cuelga).
      const prev = currentUserRef.current;
      if (!profile && prev && prev.id === session.user.id) {
        setAuthChecked(true);
        return;
      }
      const u = {
        id: session.user.id,
        email: session.user.email,
        username: session.user.email,
        displayName: profile?.name || session.user.email.split('@')[0],
        role: profile?.role === 'super_admin' ? 'super_admin'
            : profile?.role === 'admin' ? 'admin' : 'user',
        eid: profile?.eid || null,
        productionId: profile?.production_id || null,
        companyId: profile?.company_id || null,
      };
      setCurrentUser(u);
      currentUserRef.current = u;
      setAuthChecked(true); // siempre, aunque el perfil falle, para no bloquear la UI
    };

    // INITIAL_SESSION se dispara inmediatamente con la sesión actual (o null)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        await resolveSession(session);
      } else if (event === 'SIGNED_IN') {
        await resolveSession(session);
      } else if (event === 'PASSWORD_RECOVERY') {
        // Usuario llegó desde el enlace de reset — mostrar pantalla para nueva contraseña
        setNeedsPasswordReset(true);
        setAuthChecked(true);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        currentUserRef.current = null;
        setEmps([]); setRecs([]); setPaid([]);
        setFestivos([]); setEmpRequests([]); setAdminPerms([]); setExpressLinks([]);
        setDbError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Cargar datos cuando hay usuario confirmado ───────────────────────────
  useEffect(() => {
    if (!authChecked || !currentUser) return;
    // Super admin sin producción seleccionada: gestiona su propio panel, no carga datos de producción
    if (currentUser.role === 'super_admin' && !currentUser.productionId) return;
    loadData(currentUser.productionId);
  }, [authChecked, currentUser?.id]);

  // ── Login / Logout ────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null; // éxito → onAuthStateChange dispara SIGNED_IN
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Super admin: entrar a una producción concreta
  const switchProduction = useCallback(async (productionId, companyId) => {
    const updated = { ...currentUserRef.current, productionId, companyId };
    setCurrentUser(updated);
    currentUserRef.current = updated;
    await loadData(productionId);
  }, [loadData]);

  // Super admin: volver al panel propio
  const exitProduction = useCallback(() => {
    const base = { ...currentUserRef.current, productionId: null, companyId: null };
    setCurrentUser(base);
    currentUserRef.current = base;
    setEmps([]); setRecs([]); setPaid([]);
    setFestivos([]); setEmpRequests([]); setAdminPerms([]); setExpressLinks([]);
  }, []);

  const sb = (promise) => promise.then(({ error }) => {
    if (error) {
      console.error('[Supabase]', error.message, error);
      showToast('Error al guardar el cambio: ' + error.message, 'error');
    }
  });

  // Registra cada cambio en rec_audit para cumplir con la normativa de inmutabilidad
  const logAudit = (recId, action, prevData, newData, reason = null) => {
    const user = currentUserRef.current;
    supabase.from('rec_audit').insert({
      rec_id: recId,
      action,
      changed_by: user?.username || 'sistema',
      changed_at: new Date().toISOString(),
      prev_data: prevData || null,
      new_data: newData || null,
      reason: reason || null,
    }).then(({ error }) => {
      if (error) console.error('[Audit]', error.message);
    });
  };

  const updateRec = useCallback((id, changes, reason = null) => {
    setRecs(prev => {
      const original = prev.find(r => r.id === id);
      const updated = prev.map(r => r.id === id ? { ...r, ...changes } : r);
      const rec = updated.find(r => r.id === id);
      if (rec) {
        sb(supabase.from('recs').upsert(toRecRow(rec), { onConflict: 'id' }));
        logAudit(id, 'update', original ? toRecRow(original) : null, toRecRow(rec), reason);
      }
      return updated;
    });
  }, []);

  const addRec = useCallback((rec) => {
    const prodId = currentUserRef.current?.productionId;
    setRecs(prev => [...prev, rec]);
    sb(supabase.from('recs').insert({ ...toRecRow(rec), ...(prodId ? { production_id: prodId } : {}) }));
    logAudit(rec.id, 'create', null, toRecRow(rec));
  }, []);

  // Soft delete: nunca borra de la BD, solo marca deleted_at/deleted_by
  const deleteRec = useCallback((id, reason = null) => {
    const now = new Date().toISOString();
    const user = currentUserRef.current?.username || 'sistema';
    setRecs(prev => {
      const original = prev.find(r => r.id === id);
      if (original) logAudit(id, 'delete', toRecRow(original), null, reason);
      return prev.filter(r => r.id !== id); // lo quitamos de la UI
    });
    // En la BD solo se marca como borrado, nunca se elimina
    sb(supabase.from('recs').update({ deleted_at: now, deleted_by: user }).eq('id', id));
  }, []);

  const upsertRec = useCallback((rec) => {
    const prodId = currentUserRef.current?.productionId;
    setRecs(prev => {
      const existing = prev.find(r => r.id === rec.id);
      if (existing) {
        logAudit(rec.id, 'update', toRecRow(existing), toRecRow(rec));
        return prev.map(r => r.id === rec.id ? rec : r);
      }
      logAudit(rec.id, 'create', null, toRecRow(rec));
      return [...prev, rec];
    });
    // production_id explícito: las políticas RLS exigen que coincida con la del usuario
    sb(supabase.from('recs').upsert(
      { ...toRecRow(rec), ...(prodId ? { production_id: prodId } : {}) },
      { onConflict: 'id' }
    ));
  }, []);

  const updateEmp = useCallback((id, changes) => {
    setEmps(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...changes } : e);
      const emp = updated.find(e => e.id === id);
      if (emp) sb(supabase.from('emps').upsert(toEmpRow(emp), { onConflict: 'id' }));
      return updated;
    });
  }, []);

  const addEmp = useCallback((emp) => {
    const prodId = currentUserRef.current?.productionId;
    setEmps(prev => [...prev, emp]);
    sb(supabase.from('emps').insert({ ...toEmpRow(emp), ...(prodId ? { production_id: prodId } : {}) }));
  }, []);

  const upsertPaid = useCallback((entry) => {
    const prodId = currentUserRef.current?.productionId;
    setPaid(prev => {
      const existing = prev.find(p => p.eid === entry.eid && p.date === entry.date);
      if (existing?._dbId) {
        sb(supabase.from('paid').update({ ord_min: entry.ordMin || 0, ext_min: entry.extMin || 0, note: entry.note || null }).eq('id', existing._dbId));
        return prev.map(p => p.eid === entry.eid && p.date === entry.date ? { ...entry, _dbId: p._dbId } : p);
      }
      supabase.from('paid')
        .insert({ eid: entry.eid, date: entry.date, month: entry.month, ord_min: entry.ordMin || 0, ext_min: entry.extMin || 0, note: entry.note || null, ...(prodId ? { production_id: prodId } : {}) })
        .select().single()
        .then(({ data, error }) => {
          if (error) console.error('[Supabase paid insert]', error.message);
          if (data) setPaid(p2 => p2.map(p => p.eid === entry.eid && p.date === entry.date ? { ...p, _dbId: data.id } : p));
        });
      return [...prev, entry];
    });
  }, []);

  const removePaid = useCallback((eid, date) => {
    setPaid(prev => {
      const row = prev.find(p => p.eid === eid && p.date === date);
      if (row?._dbId) sb(supabase.from('paid').delete().eq('id', row._dbId));
      return prev.filter(p => !(p.eid === eid && p.date === date));
    });
  }, []);

  const deletePaidById = useCallback((dbId) => {
    setPaid(prev => {
      if (dbId) sb(supabase.from('paid').delete().eq('id', dbId));
      return prev.filter(p => p._dbId !== dbId);
    });
  }, []);

  const addPaid = useCallback((entry) => {
    const prodId = currentUserRef.current?.productionId;
    const today = new Date().toISOString().slice(0, 10);
    const entryWithDate = { ...entry, date: entry.date || today };
    supabase.from('paid')
      .insert({ eid: entryWithDate.eid, date: entryWithDate.date, month: entryWithDate.month, ord_min: entryWithDate.ordMin || 0, ext_min: entryWithDate.extMin || 0, note: entryWithDate.note || null, ...(prodId ? { production_id: prodId } : {}) })
      .select().single()
      .then(({ data, error }) => {
        if (error) console.error('[Supabase addPaid]', error.message);
        setPaid(prev => [...prev, { ...entryWithDate, _dbId: data?.id }]);
      });
  }, []);

  const addAdminPerm = useCallback((perm) => {
    const prodId = currentUserRef.current?.productionId;
    const withId = { ...perm, id: perm.id || crypto.randomUUID() };
    setAdminPerms(prev => [...prev, withId]);
    sb(supabase.from('admin_perms').insert({ ...toPermRow(withId), ...(prodId ? { production_id: prodId } : {}) }));
  }, []);

  const addFestivo = useCallback((festivo) => {
    const prodId = currentUserRef.current?.productionId;
    setFestivos(prev => {
      if (prev.find(f => f.date === festivo.date)) return prev;
      return [...prev, festivo].sort((a, b) => a.date.localeCompare(b.date));
    });
    sb(supabase.from('festivos').insert({ date: festivo.date, name: festivo.name, ...(prodId ? { production_id: prodId } : {}) }));
  }, []);

  const removeFestivo = useCallback((date) => {
    setFestivos(prev => prev.filter(f => f.date !== date));
    sb(supabase.from('festivos').delete().eq('date', date));
  }, []);

  const addExpressLink = useCallback(async (link) => {
    const prodId = currentUserRef.current?.productionId;
    const { data, error } = await supabase.from('express_links').insert({
      name: link.name, dni: link.dni || '', dept: link.dept || '',
      role: link.role || '', date: link.date,
      cited_in: link.citedIn, cited_out: link.citedOut,
      ch: link.ch, brk: link.brk,
      ...(prodId ? { production_id: prodId } : {}),
    }).select().single();
    if (error) { showToast('Error al crear el enlace: ' + error.message, 'error'); return null; }
    setExpressLinks(prev => [mapExpressLink(data), ...prev]);
    return data.id;
  }, [showToast]);

  const deleteExpressLink = useCallback(async (id) => {
    const { error } = await supabase.from('express_links').delete().eq('id', id);
    if (error) { showToast('Error al eliminar: ' + error.message, 'error'); return; }
    setExpressLinks(prev => prev.filter(l => l.id !== id));
    showToast('Enlace eliminado.', 'info');
  }, [showToast]);

  const importExpressLink = useCallback(async (link, withPayment = false) => {
    const prodId = currentUserRef.current?.productionId;
    // 1. Buscar o crear empleado — se enlaza por DNI (normalizado: mayúsculas y
    //    sin espacios/guiones), que es lo propio de cada persona. Así, aunque el
    //    nombre se escriba distinto entre días, los fichajes van al mismo empleado.
    const normDni = s => (s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    const linkDni = normDni(link.dni);
    let eid = linkDni ? emps.find(e => normDni(e.dni) === linkDni)?.id : undefined;
    if (!eid) {
      const slug = link.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 28);
      eid = slug + '_' + link.id.slice(0, 6);
      const empRow = {
        id: eid, name: link.name,
        alias: link.name.split(' ').filter(Boolean)[0] || link.name,
        role: link.role || 'Refuerzo', dept: link.dept || 'Sin departamento',
        dni: link.dni || '', email: link.email || '', initials:
          link.name.split(' ').filter(Boolean).map(p => p[0].toUpperCase()).join('').slice(0, 2) || 'XX',
        color: '#6b7191', start_time: link.citedIn || '09:00', end_time: link.citedOut || '18:00',
        brk: link.brk || 60, ch: link.ch || 8, c_start: link.date, c_end: link.date,
        is_reinforcement: true,
        ...(prodId ? { production_id: prodId } : {}),
      };
      const { error: empErr } = await supabase.from('emps').insert(empRow);
      if (empErr) { showToast('Error al crear empleado: ' + empErr.message, 'error'); return; }
      setEmps(prev => [...prev, mapEmp(empRow)]);
    }
    // 2. Crear registro
    const recId = `${eid}_${link.date}_exp`;
    const netMin = (link.entry && link.exit)
      ? Math.max(0, t2m(link.exit) - t2m(link.entry) - (link.brk || 60))
      : 0;
    const extraMin = Math.max(0, netMin - (link.ch || 8) * 60);
    const recRow = {
      id: recId, eid, date: link.date,
      entry: link.entry, exit: link.exit, brk: link.brk || 60,
      obs: link.obs || 'Fichaje Express', status: 'approved', method: 'Express',
      cited_in: link.citedIn, cited_out: link.citedOut,
      absence: null, libranza: false, special: false, cat_up: false,
      paid_extra: withPayment && extraMin > 0 ? extraMin : 0,
      km_applied: link.kmApplied || false, km_count: link.kmCount ?? null,
      ...(prodId ? { production_id: prodId } : {}),
    };
    const { error: recErr } = await supabase.from('recs').upsert(recRow, { onConflict: 'id' });
    if (recErr) { showToast('Error al crear registro: ' + recErr.message, 'error'); return; }
    setRecs(prev => [...prev, mapRec(recRow)]);
    logAudit(recId, 'create', null, recRow);
    // 3. Registrar pago de extras si procede
    if (withPayment && extraMin > 0) {
      const month = link.date.slice(0, 7);
      const { data: paidData, error: paidErr } = await supabase.from('paid')
        .insert({ eid, date: link.date, month, ord_min: 0, ext_min: extraMin, note: `Extras Fichaje Express · ${link.date}`, ...(prodId ? { production_id: prodId } : {}) })
        .select().single();
      if (paidErr) console.error('[paid insert]', paidErr.message);
      else setPaid(prev => [...prev, mapPaid(paidData)]);
    }
    // 4. Marcar como importado
    await supabase.from('express_links').update({ status: 'imported' }).eq('id', link.id);
    setExpressLinks(prev => prev.filter(l => l.id !== link.id));
    const msg = withPayment && extraMin > 0
      ? `Fichaje de ${link.name} importado con ${Math.round(extraMin / 60 * 10) / 10}h extras pagadas.`
      : `Fichaje de ${link.name} importado.`;
    showToast(msg, 'success');
  }, [emps, showToast]);

  const addEmpRequest = useCallback((req) => {
    const prodId = currentUserRef.current?.productionId;
    setEmpRequests(prev => [...prev, req]);
    sb(supabase.from('requests').insert({ ...toReqRow(req), ...(prodId ? { production_id: prodId } : {}) }));
  }, []);

  const updateEmpRequest = useCallback((id, changes) => {
    setEmpRequests(prev => {
      const req = prev.find(r => r.id === id);
      if (changes.status === 'approved' && req) {
        const absenceType = REQ_TYPE_MAP[req.type] || 'permiso';
        setRecs(prevRecs => {
          const toAdd = [];
          const endD = new Date(req.end + 'T12:00:00');
          const d = new Date(req.start + 'T12:00:00');
          while (d <= endD) {
            const dateStr = d.toISOString().slice(0, 10);
            const dow = d.getDay();
            if (!prevRecs.some(r => r.eid === req.eid && r.date === dateStr) && dow !== 0 && dow !== 6) {
              toAdd.push({
                id: crypto.randomUUID(),
                eid: req.eid, date: dateStr,
                entry: '', exit: '', brk: 0,
                obs: req.type, status: 'approved',
                method: 'Solicitud aprobada',
                citedIn: '', citedOut: '',
                absence: absenceType,
              });
            }
            d.setDate(d.getDate() + 1);
          }
          if (toAdd.length) {
            supabase.from('recs').upsert(toAdd.map(toRecRow), { onConflict: 'id' });
            return [...prevRecs, ...toAdd];
          }
          return prevRecs;
        });
      }
      sb(supabase.from('requests').update({ status: changes.status }).eq('id', id));
      return prev.map(r => r.id === id ? { ...r, ...changes } : r);
    });
  }, []);

  // Mostrar spinner mientras se comprueba auth o se cargan datos tras login
  if (!authChecked || (currentUser && loading)) {
    return <LoadingScreen label={!authChecked ? 'Iniciando…' : 'Cargando datos…'} />;
  }

  if (dbError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg1)', color: 'var(--coral)', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 24 }}>⚠️</div>
        <div style={{ fontSize: 15 }}>Error de conexión con la base de datos</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{dbError}</div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      currentUser, login, logout, switchProduction, exitProduction,
      needsPasswordReset, setNeedsPasswordReset,
      emps, updateEmp, addEmp,
      recs, updateRec, addRec, upsertRec, deleteRec,
      paid, upsertPaid, removePaid, addPaid, deletePaidById,
      adminPerms, addAdminPerm,
      festivos, addFestivo, removeFestivo,
      empRequests, addEmpRequest, updateEmpRequest,
      expressLinks, addExpressLink, importExpressLink, deleteExpressLink,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
};
