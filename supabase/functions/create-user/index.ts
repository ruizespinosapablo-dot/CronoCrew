import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      email, password, name,
      alias, dni, position, dept,
      role,
      company_id, production_id,
    } = await req.json()

    if (!email || !password || !name) {
      throw new Error('email, password y name son obligatorios')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar que el usuario que llama es super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No autorizado')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new Error('No autenticado')

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', caller.id).single()

    if (callerProfile?.role !== 'super_admin') {
      throw new Error('Solo los super_admin pueden crear usuarios')
    }

    // 1. Crear usuario en Supabase Auth (email ya confirmado)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) throw authError

    // 2. Generar iniciales y color para el registro de empleado
    const initials = name.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    const hue = Math.floor(Math.random() * 360)
    const color = `hsl(${hue}, 55%, 50%)`

    // 3. Crear registro en emps con los datos básicos (setup_complete = false)
    const { data: empData, error: empError } = await supabaseAdmin
      .from('emps')
      .insert({
        name,
        alias: alias || null,
        dni: dni || null,
        role: position || null,   // puesto/cargo
        dept: dept || 'Producción',
        email,
        initials,
        color,
        production_id: production_id || null,
        setup_complete: false,
        // defaults hasta que el admin configure el horario
        start_time: '09:00',
        end_time: '18:00',
        brk: 60,
        ch: 8,
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
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
