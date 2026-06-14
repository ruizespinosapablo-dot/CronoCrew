import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Orígenes permitidos: producción + dominio de transición + local
const ALLOWED_ORIGINS = [
  'https://claptime.clapsuite.com',
  'https://cronocrew.vercel.app',
  'http://localhost:5173',
]

// Remitente del comprobante (dominio verificado en Resend).
const RECEIPT_FROM = Deno.env.get('RECEIPT_FROM') ?? 'ClapTime <no-reply@send.clapsuite.com>'
// Logo de ClapTime (imagen, para que no se "traduzca" el texto en algunos clientes).
const LOGO_URL = Deno.env.get('LOGO_URL') ?? 'https://claptime.clapsuite.com/logo.png'

const corsHeadersFor = (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const t2m = (t: string) => {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const fmtH = (min: number) => {
  const a = Math.max(0, min), h = Math.floor(a / 60), mm = a % 60
  return `${h}h ${String(mm).padStart(2, '0')}m`
}
const fmtDate = (d: string) => {
  if (!d) return ''
  const [y, mo, dy] = d.split('-')
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(dy)} ${M[parseInt(mo) - 1]} ${y}`
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token } = await req.json()
    if (!token) {
      return new Response(JSON.stringify({ error: 'token requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: link, error } = await supabaseAdmin
      .from('express_links').select('*').eq('id', token).single()

    if (error || !link) {
      return new Response(JSON.stringify({ error: 'enlace no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sin email → nada que enviar (no es un error).
    if (!link.email) {
      return new Response(JSON.stringify({ ok: true, sent: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'envío de email no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Nombre del proyecto (producción) y de la productora (empresa)
    let prodName = '', companyName = ''
    if (link.production_id) {
      const { data: prod } = await supabaseAdmin
        .from('productions').select('name, company_id').eq('id', link.production_id).single()
      if (prod) {
        prodName = prod.name || ''
        if (prod.company_id) {
          const { data: comp } = await supabaseAdmin
            .from('companies').select('name').eq('id', prod.company_id).single()
          companyName = comp?.name || ''
        }
      }
    }

    const netMin = (link.entry && link.exit)
      ? Math.max(0, t2m(link.exit) - t2m(link.entry) - (link.brk || 60))
      : 0
    const filedAt = link.filed_at ? new Date(link.filed_at).toLocaleString('es-ES') : new Date().toLocaleString('es-ES')

    const row = (k: string, v: string) =>
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">${esc(k)}</td>` +
      `<td style="padding:6px 0;color:#1a1d29;font-size:14px;font-weight:600;text-align:right;">${esc(v)}</td></tr>`

    const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;margin:0;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(16,16,24,0.08);">
      <tr><td style="background:#0e1018;padding:20px 32px;">
        <img src="${LOGO_URL}" alt="ClapTime" height="30" style="display:block;height:30px;border:0;outline:none;text-decoration:none;" />
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;color:#1a1d29;">Comprobante de fichaje</h1>
        <p style="margin:0 0 18px;font-size:14px;color:#3f4453;">Hola, ${esc(link.name)}. Este es el resguardo de tu jornada registrada con Fichaje Express.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececed;border-bottom:1px solid #ececed;margin:0 0 18px;">
          ${companyName ? row('Productora', companyName) : ''}
          ${prodName ? row('Proyecto', prodName) : ''}
          ${row('Fecha', fmtDate(link.date))}
          ${row('Puesto', [link.role, link.dept].filter(Boolean).join(' · ') || '—')}
          ${row('Citación', `${link.cited_in}–${link.cited_out}`)}
          ${row('Entrada real', link.entry || '—')}
          ${row('Salida real', link.exit || '—')}
          ${row('Descanso', `${link.brk || 0} min`)}
          ${row('Horas netas', fmtH(netMin))}
          ${link.km_applied ? row('Kilometraje', link.km_count ? `${link.km_count} km (importe a fijar por producción)` : 'Aplicado (importe a fijar)') : ''}
          ${link.obs ? row('Observaciones', link.obs) : ''}
          ${row('Enviado', filedAt)}
        </table>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa0ac;">Conserva este correo como justificante. Si algún dato no es correcto, contacta con producción.</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#b6bac3;">© ClapTime · by ClapSuite</p>
  </td></tr>
</table>`

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RECEIPT_FROM,
        to: [link.email],
        subject: `Tu comprobante de fichaje · ${fmtDate(link.date)}`,
        html,
      }),
    })

    if (!send.ok) {
      const detail = await send.text()
      console.error('[Resend]', detail)
      return new Response(JSON.stringify({ error: 'no se pudo enviar el email' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'error inesperado' }), {
      status: 500, headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
    })
  }
})
