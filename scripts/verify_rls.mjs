/**
 * verify_rls.mjs — Comprueba desde fuera (con la anon key pública) que RLS protege los datos.
 * Uso: node --env-file=.env.local scripts/verify_rls.mjs
 * Todo debe salir BLOQUEADO/vacío salvo la RPC, que debe existir.
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const NIL = '00000000-0000-0000-0000-000000000000';

const check = (label, error, data, expectRows = false) => {
  if (error) return console.log(`${label} → BLOQUEADO (OK)`);
  const n = data?.length ?? 0;
  if (n === 0) console.log(`${label} → 0 filas (RLS OK)`);
  else console.log(`${label} → ${n} filas ${expectRows ? '(OK)' : '⚠️ EXPUESTO — REVISAR RLS'}`);
};

let r = await sb.from('express_links').select('*').limit(5);
check('anon lista express_links', r.error, r.data);

r = await sb.from('emps').select('*').limit(5);
check('anon lee emps (salarios) ', r.error, r.data);

r = await sb.from('recs').select('*').limit(5);
check('anon lee recs (fichajes) ', r.error, r.data);

r = await sb.from('profiles').select('*').limit(5);
check('anon lee profiles        ', r.error, r.data);

r = await sb.from('express_links').update({ obs: 'x' }).eq('id', NIL).select();
check('anon modifica express    ', r.error, r.data);

r = await sb.rpc('get_express_link', { p_id: NIL });
console.log('rpc get_express_link      →', r.error ? `ERROR: ${r.error.message} ⚠️ ¿rls_policies_v2.sql ejecutado?` : 'existe y responde (OK)');
