import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { USERS } from '../lib/data';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastContext';

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
const mapEmp = row => ({
  id: row.id, name: row.name, alias: row.alias, role: row.role,
  dept: row.dept, dni: row.dni, email: row.email, initials: row.initials,
  color: row.color, start: row.start_time, end: row.end_time,
  brk: row.brk, ch: row.ch, cStart: row.c_start, cEnd: row.c_end,
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
  deletedAt: row.deleted_at || null, deletedBy: row.deleted_by || null,
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
  deleted_at: r.deletedAt || null, deleted_by: r.deletedBy || null,
});

const toEmpRow = e => ({
  id: e.id, name: e.name, alias: e.alias, role: e.role, dept: e.dept,
  dni: e.dni, email: e.email, initials: e.initials, color: e.color,
  start_time: e.start, end_time: e.end, brk: e.brk, ch: e.ch,
  c_start: e.cStart || null, c_end: e.cEnd || null,
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

export function AppProvider({ children }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const currentUserRef = useRef(null);
  const [emps, setEmps] = useState([]);
  const [recs, setRecs] = useState([]);
  const [paid, setPaid] = useState([]);
  const [adminPerms, setAdminPerms] = useState([]);
  const [festivos, setFestivos] = useState([]);
  const [empRequests, setEmpRequests] = useState([]);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setDbError('La conexión con la base de datos no está configurada. Revisa las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
        setLoading(false);
        return;
      }
      try {
        const { data: empsData, error: empsErr } = await supabase.from('emps').select('*');
        if (empsErr) throw empsErr;

        const fetchAllRecs = async () => {
          const PAGE = 1000;
          let all = [], from = 0;
          while (true) {
            const { data, error } = await supabase.from('recs').select('*').is('deleted_at', null).range(from, from + PAGE - 1);
            if (error) throw error;
            all = all.concat(data);
            if (data.length < PAGE) break;
            from += PAGE;
          }
          return all;
        };

        const [recsData, paidData, festivosData, reqsData, permsData] = await Promise.all([
          fetchAllRecs(),
          supabase.from('paid').select('*').then(({ data, error }) => { if (error) throw error; return data; }),
          supabase.from('festivos').select('*').order('date').then(({ data, error }) => { if (error) throw error; return data; }),
          supabase.from('requests').select('*').then(({ data, error }) => { if (error) throw error; return data ?? []; }),
          supabase.from('admin_perms').select('*').then(({ data, error }) => { if (error) throw error; return data ?? []; }),
        ]);

        setEmps(empsData.map(mapEmp));
        setRecs(recsData.map(mapRec));
        setPaid(paidData.map(mapPaid));
        setFestivos(festivosData);
        setEmpRequests(reqsData.map(mapReq));
        setAdminPerms(permsData.map(mapPerm));
      } catch (err) {
        console.error('Error cargando datos desde Supabase:', err);
        setDbError(err.message || 'Error de conexión');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback((username, password) => {
    const user = USERS[username];
    if (user && user.pass === password) {
      const u = { username, role: user.role, eid: user.eid || null };
      setCurrentUser(u);
      currentUserRef.current = u;
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    currentUserRef.current = null;
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
    setRecs(prev => [...prev, rec]);
    sb(supabase.from('recs').insert(toRecRow(rec)));
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
    setRecs(prev => {
      const existing = prev.find(r => r.id === rec.id);
      if (existing) {
        logAudit(rec.id, 'update', toRecRow(existing), toRecRow(rec));
        return prev.map(r => r.id === rec.id ? rec : r);
      }
      logAudit(rec.id, 'create', null, toRecRow(rec));
      return [...prev, rec];
    });
    sb(supabase.from('recs').upsert(toRecRow(rec), { onConflict: 'id' }));
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
    setEmps(prev => [...prev, emp]);
    sb(supabase.from('emps').insert(toEmpRow(emp)));
  }, []);

  const upsertPaid = useCallback((entry) => {
    setPaid(prev => {
      const existing = prev.find(p => p.eid === entry.eid && p.date === entry.date);
      if (existing?._dbId) {
        sb(supabase.from('paid').update({ ord_min: entry.ordMin || 0, ext_min: entry.extMin || 0, note: entry.note || null }).eq('id', existing._dbId));
        return prev.map(p => p.eid === entry.eid && p.date === entry.date ? { ...entry, _dbId: p._dbId } : p);
      }
      supabase.from('paid')
        .insert({ eid: entry.eid, date: entry.date, month: entry.month, ord_min: entry.ordMin || 0, ext_min: entry.extMin || 0, note: entry.note || null })
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
    const today = new Date().toISOString().slice(0, 10);
    const entryWithDate = { ...entry, date: entry.date || today };
    supabase.from('paid')
      .insert({ eid: entryWithDate.eid, date: entryWithDate.date, month: entryWithDate.month, ord_min: entryWithDate.ordMin || 0, ext_min: entryWithDate.extMin || 0, note: entryWithDate.note || null })
      .select().single()
      .then(({ data, error }) => {
        if (error) console.error('[Supabase addPaid]', error.message);
        setPaid(prev => [...prev, { ...entryWithDate, _dbId: data?.id }]);
      });
  }, []);

  const addAdminPerm = useCallback((perm) => {
    const withId = { ...perm, id: perm.id || crypto.randomUUID() };
    setAdminPerms(prev => [...prev, withId]);
    sb(supabase.from('admin_perms').insert(toPermRow(withId)));
  }, []);

  const addFestivo = useCallback((festivo) => {
    setFestivos(prev => {
      if (prev.find(f => f.date === festivo.date)) return prev;
      return [...prev, festivo].sort((a, b) => a.date.localeCompare(b.date));
    });
    sb(supabase.from('festivos').insert({ date: festivo.date, name: festivo.name }));
  }, []);

  const removeFestivo = useCallback((date) => {
    setFestivos(prev => prev.filter(f => f.date !== date));
    sb(supabase.from('festivos').delete().eq('date', date));
  }, []);

  const addEmpRequest = useCallback((req) => {
    setEmpRequests(prev => [...prev, req]);
    sb(supabase.from('requests').insert(toReqRow(req)));
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg1)', color: 'var(--text1)', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 24 }}>⏳</div>
        <div style={{ fontSize: 15, color: 'var(--text2)' }}>Cargando datos…</div>
      </div>
    );
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
      currentUser, login, logout,
      emps, updateEmp, addEmp,
      recs, updateRec, addRec, upsertRec, deleteRec,
      paid, upsertPaid, removePaid, addPaid, deletePaidById,
      adminPerms, addAdminPerm,
      festivos, addFestivo, removeFestivo,
      empRequests, addEmpRequest, updateEmpRequest,
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
