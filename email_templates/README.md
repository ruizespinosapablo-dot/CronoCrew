# Plantillas de email · ClapTime

Pega el contenido de cada archivo en **Supabase → Authentication → Emails → Templates**.
El nombre del archivo no coincide con el de Supabase; usa este mapeo:

| Plantilla en Supabase | Archivo | ¿Se envía en el flujo actual? |
|---|---|---|
| **Invite user** | `invite.html` | **Sí** — al dar de alta un empleado (lo más importante) |
| **Reset password** | `recovery.html` | **Sí** — al pulsar «He olvidado mi contraseña» |
| Magic link or OTP | `magic_link.html` | No por defecto (disponible si activas acceso por enlace) |
| Change email address | `email_change.html` | Solo si un usuario cambia su email |
| Confirm sign up | `confirm_signup.html` | No (los empleados se crean por invitación, no por registro público) |
| Reauthentication | `reauthentication.html` | No (solo si se exige código antes de una operación sensible) |

## Prioridad
Si solo quieres pegar lo imprescindible ahora, pega **Invite user** y **Reset password**.
Las otras cuatro puedes pegarlas para que ningún correo salga jamás sin la marca, pero
en el día a día no se disparan.

## Asuntos sugeridos
- Invite user → `Te damos la bienvenida a ClapTime`
- Reset password → `Restablece tu contraseña de ClapTime`
- Magic link or OTP → `Tu enlace de acceso a ClapTime`
- Change email address → `Confirma tu nuevo email en ClapTime`
- Confirm sign up → `Confirma tu cuenta de ClapTime`
- Reauthentication → `Tu código de verificación de ClapTime`

## Variables
Las plantillas usan las variables de Supabase (Go templates): `{{ .ConfirmationURL }}`,
`{{ .Token }}` (código), `{{ .Email }}`, `{{ .NewEmail }}` y `{{ .Data.name }}` (nombre,
que enviamos al invitar para personalizar el saludo).
