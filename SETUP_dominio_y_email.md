# ClapTime · Configuración de dominio y email

Guía paso a paso para dejar **claptime.clapsuite.com** en marcha con correos de marca.
Hazlo en este orden. Marca cada paso al completarlo.

El código ya está adaptado: la app, los títulos y los emails dicen **ClapTime**, y la
URL de producción apunta a `https://claptime.clapsuite.com`.

---

## 1. Apuntar el subdominio de la app a Vercel

**En Vercel** (proyecto de ClapTime):
1. Settings → Domains → *Add* → escribe `claptime.clapsuite.com`.
2. Vercel te mostrará un registro **CNAME** (normalmente apuntando a `cname.vercel-dns.com`).

**En Cloudflare** (dominio clapsuite.com → DNS):
3. Add record → Type **CNAME**, Name `claptime`, Target el que te dio Vercel.
4. **Proxy status: DNS only** (nube gris, NO naranja). Vercel gestiona su propio SSL;
   si lo dejas proxied da error de certificado.
5. SSL/TLS → modo **Full (strict)**.

En unos minutos `https://claptime.clapsuite.com` cargará la app.

---

## 2. Verificar el dominio de envío en Resend

Enviaremos desde un **subdominio** (`send.clapsuite.com`) para aislar la reputación
del correo del dominio principal. Es la práctica recomendada.

**En Resend** (https://resend.com):
1. Crea la cuenta y entra en *Domains → Add Domain*.
2. Dominio: `send.clapsuite.com`. (También puedes usar `clapsuite.com` si prefieres que
   el remitente sea `@clapsuite.com`; entonces verifica ese.)
3. Resend te dará 3–4 registros DNS: **DKIM** (CNAME o TXT), **SPF** (TXT) y opcionalmente
   **DMARC** (TXT) y un MX para el bounce.

**En Cloudflare** → DNS:
4. Añade exactamente esos registros. Los TXT/MX van siempre **DNS only**.
5. Vuelve a Resend y pulsa *Verify*. Tarda de minutos a un par de horas.

> Atajo: Resend tiene una integración nativa "Connect to Supabase" que rellena el SMTP
> del paso 3 automáticamente. Si la usas, sáltate la parte manual de credenciales.

---

## 3. Configurar SMTP en Supabase

**En Supabase** → Authentication → Emails → **SMTP Settings** → *Enable custom SMTP*:

| Campo | Valor |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` (o `587`) |
| Username | `resend` |
| Password | tu **API key** de Resend |
| Sender email | `noreply@send.clapsuite.com` |
| Sender name | `ClapTime` |

Esto además **quita el límite de 2 correos/hora** del email gratis de Supabase.

---

## 4. Pegar las plantillas de marca

**En Supabase** → Authentication → **Email Templates**. Para cada plantilla, pega el HTML
del archivo correspondiente de la carpeta `email_templates/` y pon el asunto sugerido:

| Plantilla en Supabase | Archivo | Asunto |
|-----------------------|---------|--------|
| Invite user | `invite.html` | Te damos la bienvenida a ClapTime |
| Reset Password | `recovery.html` | Restablece tu contraseña de ClapTime |
| Magic Link | `magic_link.html` | Tu enlace de acceso a ClapTime |
| Change Email Address | `email_change.html` | Confirma tu nuevo email en ClapTime |

Las plantillas ya saludan por nombre cuando está disponible (`{{ .Data.name }}`),
que es el nombre que enviamos al invitar al empleado.

---

## 5. URLs de redirección permitidas

**En Supabase** → Authentication → URL Configuration:
- **Site URL**: `https://claptime.clapsuite.com`
- **Redirect URLs** (Add URL): añade
  - `https://claptime.clapsuite.com/set-password`
  - `https://claptime.clapsuite.com`
  - `http://localhost:5173/set-password` (para pruebas en local)

Sin esto, el enlace del email de invitación no redirige a crear contraseña.

---

## 6. Variables de entorno y redeploy

**En Vercel** → Settings → Environment Variables:
- `VITE_APP_URL` = `https://claptime.clapsuite.com`
- Redeploy del proyecto para que tome el cambio.

**Edge Function** (genera el enlace de invitación con el dominio correcto):
```bash
supabase secrets set APP_URL=https://claptime.clapsuite.com
supabase functions deploy create-user
```

---

## 7. Prueba de extremo a extremo

1. Entra como super admin en `claptime.clapsuite.com` → Usuarios → Invitar empleado
   (usa un email tuyo real con horario y contrato).
2. Comprueba que llega el correo **con la marca ClapTime** y remitente `@send.clapsuite.com`.
3. Pulsa "Crear mi contraseña" → debe abrir `/set-password` y dejarte definir la contraseña.
4. Entra con ese email + contraseña: debe verse el espacio del empleado con su horario.
5. Prueba "He olvidado mi contraseña" desde el login → debe llegar el correo de recovery.

---

## Notas

- El **logo** (`src/assets/logo.svg`) puede seguir mostrando la marca gráfica anterior.
  El texto ya dice ClapTime; si el logo lleva el wordmark "CronoCrew" dibujado, hay que
  rediseñarlo aparte. Avísame y lo regeneramos.
- Cuando quieras, el mismo `send.clapsuite.com` sirve para ClapCrew y ClapPay: un solo
  dominio de envío para toda la suite.
- Personalización avanzada (plantillas en código con React Email vía Send Email Hook)
  queda disponible si algún día necesitas contenido muy dinámico; hoy no hace falta.
