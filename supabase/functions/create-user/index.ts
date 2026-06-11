import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Orígenes permitidos: producción + dominio de transición de Vercel + local
const ALLOWED_ORIGINS = [
  'https://claptime.clapsuite.com',
  'https://cronocrew.vercel.app',
  'http://localhost:5173',
]

// URL pública de la app (para el enlace de invitación). Configurable por env.
const APP_URL = Deno.env.get('APP_URL') ?? 'https://claptime.clapsuite.com'

const corsHeadersFor = (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// Errores cuyo mensaje es seguro devolver al cliente
class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      email, name,
      alias, dni, position, dept,
      role,
      company_id, production_id,
      // Horario y contrato (los fija el super admin; el empleado queda activado)
      start_time, end_time, brk, ch,
      c_start, c_end,
    } = await req.json()

    if (!email || !name) {
      throw new ApiError('email y name son obligatorios')
    }
    if (role && !['employee', 'admin', 'super_admin'].includes(role)) {
      throw new ApiError('Rol no válido')
    }

    const isActor = (dept || '') === 'Actores'
    const timeRe = /^\d{2}:\d{2}$/
    if (!isActor) {
      if (!timeRe.test(start_time || '') || !timeRe.test(end_time || '')) {
        throw new ApiError('Indica una hora de entrada y de salida válidas')
      }
    }
    if (!c_start) {
      throw new ApiError('Indica la fecha de inicio de contrato')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar que el usuario que llama es super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new ApiError('No autorizado', 401)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new ApiError('No autenticado', 401)

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', caller.id).single()

    if (callerProfile?.role !== 'super_admin') {
      throw new ApiError('Solo los super_admin pueden crear usuarios', 403)
    }

    // 1. Invitar al usuario por email. NO se fija contraseña: el empleado la
    //    crea él mismo desde el enlace, así nadie (ni el admin) la conoce.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { name },                       // metadata para personalizar el email más adelante
        redirectTo: `${APP_URL}/set-password`, // página donde el empleado crea su contraseña
      }
    )
    // Mensajes de auth (p.ej. "User already registered") son útiles para el admin
    if (authError) throw new ApiError(authError.message)
    if (!authData?.user) throw new ApiError('No se pudo invitar al usuario')

    // 2. Generar iniciales, color e ID para el registro de empleado
    const empId = crypto.randomUUID()
    const initials = name.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    const hue = Math.floor(Math.random() * 360)
    const color = `hsl(${hue}, 55%, 50%)`

    // 3. Crear registro en emps ya completo: el super admin aporta horario y
    //    contrato, por lo que el empleado queda activado (setup_complete = true)
    //    y el admin de proyecto no necesita activarlo, solo editarlo si quiere.
    const { data: empData, error: empError } = await supabaseAdmin
      .from('emps')
      .insert({
        id: empId,
        name,
        alias: alias || null,
        dni: dni || null,
        role: position || null,   // puesto/cargo
        dept: dept || 'Producción',
        email,
        initials,
        color,
        production_id: production_id || null,
        setup_complete: true,
        start_time: isActor ? null : start_time,
        end_time:   isActor ? null : end_time,
        brk: isActor ? 0 : (Number.isFinite(+brk) ? Math.trunc(+brk) : 60),
        ch:  Number.isFinite(+ch) ? +ch : 8,
        c_start: c_start,
        c_end: c_end || null,
      })
      .select()
      .single()

    if (empError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw empError
    }

    // 4. Crear perfil vinculado al empleado via eid
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      name,
      role: role || 'employee',
      eid: empData.id,            // vinculado automáticamente
      company_id: company_id || null,
      production_id: production_id || null,
    })

    if (profileError) {
      // Rollback completo
      await supabaseAdmin.from('emps').delete().eq('id', empData.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    return new Response(
      JSON.stringify({ id: authData.user.id, email: authData.user.email, empId: empData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    // Solo se devuelven al cliente los mensajes de ApiError;
    // los errores internos (BD, etc.) se registran pero no se filtran.
    console.error('[create-user]', err)
    const isApi = err instanceof ApiError
    return new Response(
      JSON.stringify({ error: isApi ? err.message : 'Error interno al crear el usuario' }),
      { status: isApi ? err.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
