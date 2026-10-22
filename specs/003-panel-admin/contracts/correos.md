# Contrato: correos de invitación y recuperación

**Decisiones**: research D6, D7, D8, D22. **Spec**: RF-026, RF-027, casos borde de enlaces.

## Plantillas

| Archivo | Tipo de Auth | Asunto | Enlace |
|---|---|---|---|
| `supabase/templates/invitacion.html` | `invite` | "Te invitaron al panel del blog" | `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite` |
| `supabase/templates/recuperacion.html` | `recovery` | "Define una nueva contraseña" | `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery` |

Se registran en `supabase/config.toml`:

```toml
[auth.email.template.invite]
subject = "Te invitaron al panel del blog"
content_path = "./supabase/templates/invitacion.html"

[auth.email.template.recovery]
subject = "Define una nueva contraseña"
content_path = "./supabase/templates/recuperacion.html"
```

Contenido de cada correo: saludo con el nombre (en la invitación, el que cargó el admin), una frase que explica qué es y por qué le llega, **un único botón** con el enlace, el aviso "Este enlace sirve una sola vez y vence en 24 horas" y "Si no esperabas este correo, ignóralo". Español, HTML simple con estilos en línea (los clientes de correo no cargan hojas de estilo), colores tomados de `@blog/ui/identidad` (no hex nuevos en el código del panel; el HTML de correo es la excepción necesaria y se genera desde los tokens por un script de verificación, o se documenta el valor copiado). Texto alternativo en el pie con la URL del enlace.

`config.toml` además fija:

| Clave | Valor | Motivo |
|---|---|---|
| `[auth] site_url` | `http://127.0.0.1:3100` (local; en la nube, la URL del admin) | base del enlace |
| `[auth] additional_redirect_urls` | ya incluye `:3100` | `redirectTo` |
| `[auth] minimum_password_length` | `8` | `contrasenia_corta` (contracts/acciones.md) |
| `[auth.email] otp_expiry` | `86400` (24 h) | el aviso del correo y el supuesto de la spec |
| `[auth.email] enable_confirmations` | sin cambio | el alta es solo por invitación; `enable_signup = false` se mantiene |

Los cambios de `config.toml` valen para local. En la nube se aplican con `supabase config push` o desde el panel; queda en la lista manual de `quickstart.md`.

## Flujo de invitación

```text
Admin ── invitarMiembro ──► Admin API (service_role)
   inviteUserByEmail  ──► Auth crea el usuario (sin contraseña) ──► trigger crear_perfil (perfil inactivo)
   updateUserById(app_metadata.rol) ──► trigger de T063 ──► perfil activo con su rol
Auth ── SMTP ──► correo con enlace /auth/confirmar?token_hash=…&type=invite
Miembro ── abre el enlace ──► [Continuar] ──► verifyOtp ──► sesión ──► /definir-contrasena ──► updateUser({password}) ──► /articulos
```

Reenviar vuelve a emitir un token; el anterior deja de valer. Desactivar antes de aceptar: ver research D21.

## Flujo de recuperación

```text
Miembro ── pedirRecuperacion(correo) ──► mismo mensaje exista o no
Auth ── SMTP ──► correo con enlace type=recovery (solo si el correo existe)
Miembro ── [Continuar] ──► verifyOtp ──► /definir-contrasena
```

No se envía correo a cuentas inexistentes ni se revela si existen. Un miembro desactivado puede definir una contraseña pero `obtenerMiembro()` lo expulsa.

## Enlace inválido (usado o vencido)

`/auth/confirmar` muestra:

- **recuperación**: "Este enlace ya se usó o venció" + formulario para pedir uno nuevo;
- **invitación**: "Este enlace ya se usó o venció. Pídele a un administrador que te envíe otra invitación."

## Entornos

| Entorno | Envío | Revisión |
|---|---|---|
| Local | Mailpit incluido en `supabase start` | `http://127.0.0.1:56324` (API en `/api/v1/messages`, usada por los E2E) |
| Nube (hoy) | SMTP de Supabase: solo a miembros de la organización y pocos por hora | no apto para la demo con cuentas reales |
| Nube (objetivo) | SMTP propio configurado en Auth → *SMTP Settings* | proveedor y dominio a cargo del usuario |

## Pruebas

| Qué | Cómo |
|---|---|
| Las plantillas contienen `{{ .TokenHash }}` y el tipo correcto, y ningún enlace a otro dominio | Vitest sobre los archivos HTML (`apps/admin/src/lib/plantillas.test.ts`) |
| Invitar → correo en Mailpit → definir contraseña → ingresar | Playwright `e2e/admin/equipo-invitacion.spec.ts` |
| Recuperar con correo existente e inexistente: mismo mensaje; solo el primero genera correo | Playwright `e2e/admin/acceso.spec.ts` |
| Reutilizar un enlace ya usado muestra el aviso | Playwright (mismo archivo) |
