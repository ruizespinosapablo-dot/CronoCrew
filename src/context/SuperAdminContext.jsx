import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastContext';

const SuperAdminContext = createContext(null);

export function SuperAdminProvider({ children }) {
  const { showToast } = useToast();
  const [companies, setCompanies]     = useState([]);
  const [productions, setProductions] = useState([]);
  const [users, setUsers]             = useState([]);
  const [emps, setEmps]               = useState([]);
  const [loading, setLoading]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes, uRes, eRes] = await Promise.all([
        supabase.from('companies').select('*').order('name'),
        supabase.from('productions').select('*').order('name'),
        supabase.from('profiles').select('*').order('name'),
        supabase.from('emps').select('id, name, role, dept, production_id, c_start, c_end, is_reinforcement').order('name'),
      ]);
      setCompanies(cRes.data || []);
      setProductions(pRes.data || []);
      setUsers(uRes.data || []);
      setEmps(eRes.data || []);
    } catch (err) {
      showToast('Error cargando datos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, []);

  // ── Companies ──────────────────────────────────────────────────────────────
  const createCompany = useCallback(async ({ name, nif }) => {
    const { data, error } = await supabase.from('companies')
      .insert({ name, nif: nif || null }).select().single();
    if (error) { showToast('Error: ' + error.message, 'error'); return null; }
    setCompanies(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    showToast('Productora creada.', 'success');
    return data;
  }, [showToast]);

  const updateCompany = useCallback(async (id, changes) => {
    const { error } = await supabase.from('companies').update(changes).eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
    showToast('Productora actualizada.', 'success');
  }, [showToast]);

  // ── Productions ────────────────────────────────────────────────────────────
  const createProduction = useCallback(async ({ company_id, name, season }) => {
    const { data, error } = await supabase.from('productions')
      .insert({ company_id, name, season: season || null }).select().single();
    if (error) { showToast('Error: ' + error.message, 'error'); return null; }
    setProductions(prev => [...prev, data]);
    showToast('Producción creada.', 'success');
    return data;
  }, [showToast]);

  const updateProduction = useCallback(async (id, changes) => {
    const { error } = await supabase.from('productions').update(changes).eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    setProductions(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
    showToast('Producción actualizada.', 'success');
  }, [showToast]);

  // ── Users (profiles) ───────────────────────────────────────────────────────
  const createProfile = useCallback(async ({ id, name, role, eid, company_id, production_id }) => {
    const { data, error } = await supabase.from('profiles')
      .insert({ id, name, role, eid: eid || null, company_id: company_id || null, production_id: production_id || null })
      .select().single();
    if (error) { showToast('Error: ' + error.message, 'error'); return null; }
    setUsers(prev => [...prev, data]);
    showToast('Perfil creado.', 'success');
    return data;
  }, [showToast]);

  const updateProfile = useCallback(async (id, changes) => {
    const { error } = await supabase.from('profiles').update(changes).eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...changes } : u));
    showToast('Usuario actualizado.', 'success');
  }, [showToast]);

  // Invita al usuario por email + crea empleado y perfil vía Edge Function.
  // No se envía contraseña: el empleado la crea desde el enlace de invitación.
  const createUser = useCallback(async ({ email, name, alias, dni, position, dept, role, eid, company_id, production_id, start_time, end_time, brk, ch, c_start, c_end }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showToast('Sesión expirada.', 'error'); return null; }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, name, alias, dni, position, dept, role, eid, company_id, production_id, start_time, end_time, brk, ch, c_start, c_end }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      const result = await res.json();
      if (result.error) { showToast('Error: ' + result.error, 'error'); return null; }

      const newProfile = {
        id: result.id, email, name, role,
        eid: result.empId || eid || null,
        company_id: company_id || null,
        production_id: production_id || null,
      };
      setUsers(prev => [...prev, newProfile]);
      showToast(`${name} invitado. Recibirá un email para crear su contraseña.`, 'success');
      return result;
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'Tiempo de espera agotado. Comprueba que la Edge Function está desplegada.' : err.message;
      showToast('Error: ' + msg, 'error');
      return null;
    }
  }, [showToast]);

  return (
    <SuperAdminContext.Provider value={{
      companies, productions, users, emps, loading, reload: load,
      createCompany, updateCompany,
      createProduction, updateProduction,
      createProfile, updateProfile, createUser,
    }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export const useSuperAdmin = () => {
  const ctx = useContext(SuperAdminContext);
  if (!ctx) throw new Error('useSuperAdmin debe usarse dentro de SuperAdminProvider');
  return ctx;
};
