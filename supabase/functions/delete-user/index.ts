import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://claptime.clapsuite.com',
  'https://cronocrew.vercel.app',
  'http://localhost:5173',
]

const corsHeadersFor = (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

// Borra a una persona CONSERVANDO sus fichajes (obligación legal de registro horario):
//  - elimina su cuenta de acceso (auth) y su perfil, si los tiene (fijo)
//  - marca su ficha de empleado como archivada (no se borra; los recs siguen)
Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { empId } = await req.json()
    if (!empId) throw new ApiError('empId es obligatorio')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Autorización: solo super_admin
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new ApiError('No autenticado', 401)
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'super_admin') {
      throw new ApiError('Solo los super_admin pueden borrar usuarios', 403)
    }

    // 1. ¿Tiene perfil/cuenta de acceso vinculada a esta ficha? (fijo)
    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('id').eq('eid', empId)
    for (const p of profiles ?? []) {
      // borra la cuenta de auth y el perfil
      await supabaseAdmin.auth.admin.deleteUser(p.id).catch(() => {})
      await supabaseAdmin.from('profiles').delete().eq('id', p.id)
    }

    // 2. Archivar la ficha (NO se borra: los fichajes deben conservarse)
    const { error: empErr } = await supabaseAdmin
      .from('emps').update({ archived: true }).eq('id', empId)
    if (empErr) throw new ApiError('No se pudo archivar la ficha: ' + empErr.message, 500)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const err = e as ApiError
    return new Response(JSON.stringify({ error: err.message || 'error inesperado' }), {
      status: err.status || 500, headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
    })
  }
})
