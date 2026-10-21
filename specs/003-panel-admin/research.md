# Investigación: Panel de administración

**Rama**: `003-panel-admin` | **Spec**: [spec.md](spec.md) | **Fecha**: 2026-10-21

Cada decisión indica qué pregunta de la spec resuelve. Los datos de la spec 001 (`data-model`, `contracts/db.md`) y de la 002 no se rediscuten: se reutilizan.

## D1. Sesión: cookies con `@supabase/ssr`, fábrica en `@blog/db`
- **Decisión**: `packages/db` gana el subpath `@blog/db/servidor` con `crearClienteServidor({ url, claveAnon, cookies })` (envuelve `createServerClient` de `@supabase/ssr`) y `crearClienteAdmin(url, claveServicio)` (service role, sin sesión). El índice `@blog/db` no los exporta, así `apps/web` no puede importar la `service_role` por accidente (constitución §III.2 y §III.4). El navegador usa `crearClienteNavegador`, solo para subir archivos con una URL firmada (D8).
- **Razón**: §III.2 prohíbe clientes Supabase sueltos en las apps; hoy `@blog/db` solo tiene `crearClientePublico`, sin sesión. `@supabase/ssr` ya figura en la tabla de §II: no es una dependencia nueva del stack.
- **Alternativas**: crear el cliente dentro de `apps/admin` (viola §III.2); iron-session o JWT propio (duplica lo que ya hace Supabase Auth).

## D2. Capa de acceso a la sesión (DAL) y papel de `proxy.ts`
- **Decisión**:
  - `apps/admin/src/proxy.ts` solo hace dos cosas baratas: refrescar los tokens (`getClaims`) y aplicar la inactividad (D3). Redirige a `/ingreso?volver=<ruta>` si no hay sesión (comprobación optimista).
  - La autorización real vive en `obtenerMiembro()` (`apps/admin/src/lib/sesion.ts`): `getClaims()` + lectura de `perfiles` (`activo`, `rol`, `nombre`). Lo llaman cada página, layout de zona y Server Action. **No cierra la sesión**: en un Server Component las cookies no se pueden escribir (solo en Server Functions, Route Handlers y el proxy). Si el perfil no existe o `activo = false`, devuelve `motivo: 'desactivada'`; el layout redirige a `/salir?motivo=desactivada` y las Server Actions devuelven `no_autenticado` con ese motivo para que el cliente navegue a `/salir`. `GET /salir` es un Route Handler que hace `signOut`, borra `blog_actividad` y redirige a `/ingreso?motivo=…`.
  - El acceso a datos de esta capa (leer el perfil propio, operaciones de Storage, Auth Admin) vive en `@blog/db` (§III.2): `obtenerPerfilPropio`, `crearSubidaFirmada`, `descargarMedio`, `borrarMedios`, y en `@blog/db/servidor` `invitarMiembroPorCorreo` y `reenviarInvitacionPorCorreo`. Las acciones y el DAL solo orquestan.
  - La base es la verdad: aunque la app falle en ocultar un botón, RLS y los triggers de la 001 rechazan (`sin_permiso`). La matriz `puede(rol, accion)` (D16) existe para ocultar acciones y devolver un mensaje claro antes de ir a la base.
- **Razón**: la guía de Next 16 (`guides/authentication`, `guides/data-security`) dice que el proxy no es una solución de autorización. RF-002: un miembro desactivado pierde el acceso en su siguiente acción, y `perfiles.activo` se lee en cada una.
- **Alternativas**: confiar solo en el JWT (un desactivado seguiría con acceso hasta que venza el token, hasta 1 hora).

## D3. Vencimiento por inactividad (8 horas) en la aplicación
- **Decisión**: una cookie `blog_actividad` (httpOnly, `sameSite=lax`, `secure` en producción) guarda la hora de la última acción. `proxy.ts` la renueva en cada petición de página; si pasaron más de 8 h cierra la sesión (`signOut`) y redirige a `/ingreso?motivo=inactividad`. La regla es una función pura `sesionVencida(ultimaActividad, ahora, limite)` con su test.
- **Razón**: el vencimiento por inactividad de Supabase (`[auth.sessions] inactivity_timeout`) es una función de planes de pago y la nube del proyecto es gratuita; además el refresh token de Supabase no vence por sí solo. Hacerlo en la app funciona igual en local y en la nube. Los 8 h salen de la clarificación del 2026-10-21.
- **Alternativas**: `inactivity_timeout` de Supabase (no disponible en el plan gratuito); `jwt_expiry` corto (no es inactividad: renueva siempre).
- **Verificar al implementar (T-spike)**: que el plan de la nube siga sin la función; si estuviera disponible, se agrega como refuerzo, no como reemplazo.

## D4. Next.js: sin `cacheComponents` en `apps/admin`
- **Decisión**: se quitan `cacheComponents` y `partialPrefetching` de `apps/admin/next.config.ts`. Todas las pantallas del panel son dinámicas y están detrás del ingreso.
- **Razón**: con `cacheComponents` toda lectura de `cookies()` debe quedar dentro de `<Suspense>` o la ruta marca `instant = false`; el panel no tiene nada que prerenderizar (está tras el login) y esa restricción sería ruido en cada página. Se descarta la caché con sesión para no mezclar datos de dos usuarios.
- **Alternativas**: dejarlo activo y marcar `instant = false` en cada ruta (más configuración sin beneficio).
- **Pendiente de lectura**: antes de escribir código en `apps/admin` se leen `01-app/01-getting-started/07-mutating-data.md`, `02-guides/forms.md`, `02-guides/server-actions.md` y `02-guides/authentication.md` (CLAUDE.md, `apps/admin/AGENTS.md`).

## D5. Mutaciones: Server Actions con resultado tipado
- **Decisión**: cada mutación es una Server Action que (1) llama a `obtenerMiembro()`, (2) comprueba `puede(rol, accion)`, (3) valida la entrada con Zod, (4) llama a `@blog/db` con el cliente de la sesión y (5) devuelve `ResultadoAccion<T>`:
  `{ ok: true, datos } | { ok: false, codigo: CodigoError | 'no_autenticado', mensaje: string, errores?: ErrorBloque[] }`.
  Los códigos son los de `ErrorDominio` (spec 001). `mensajeDeError(codigo, detalle)` (en `apps/admin/src/lib/mensajes.ts`, pura, con test) los traduce a español no técnico (RF-023).
- **Razón**: la 001 ya devuelve `ErrorDominio` con códigos estables; solo falta traducirlos a la interfaz. Los formularios usan `useActionState`.
- **Alternativas**: Route Handlers REST (más código sin ventaja: no hay otros clientes).

## D6. Invitaciones y alta de miembros
- **Decisión**: la acción `invitarMiembro` (solo admin) usa el cliente `service_role` **en el servidor**:
  1. `auth.admin.inviteUserByEmail(correo, { data: { nombre }, redirectTo })`. Esto crea el usuario sin contraseña y dispara `crear_perfil`, que lo deja **inactivo** (la 001/D3: sin rol del servidor, la cuenta nace inactiva).
  2. `auth.admin.updateUserById(id, { app_metadata: { rol } })`: el trigger de T063 (spec 001) detecta que `rol` pasó de nulo a un valor, escribe `perfiles.rol` y pone `activo = true`.
  - El estado **"invitado"** no se guarda: lo deriva `public.listar_equipo()` (data-model) de `auth.users` (`invited_at` con `email_confirmed_at` nulo).
  - Reenviar: `reenviarInvitacion(id)` repite la invitación para esa cuenta; el enlace anterior deja de valer porque el proveedor emite un token nuevo.
  - Si el paso 1 funciona y el 2 falla, queda una cuenta inactiva "invitada" sin rol: el admin la ve en la lista y reintenta con "Reenviar". Se documenta en el contrato.
- **Razón**: spec 003 RF-027. `user_metadata` lo puede escribir el propio usuario, por eso el rol va en `app_metadata`, que solo escribe el servidor.
- **Riesgo (spike en T-correos)**: confirmar que `inviteUserByEmail` sobre una cuenta **aún no confirmada** reenvía el correo en lugar de fallar. Alternativa si falla: `auth.admin.generateLink({ type: 'invite' })` más envío por el SMTP propio, o `resetPasswordForEmail` para la cuenta sin confirmar.
- **Alternativas**: `createUser` con contraseña temporal (viola RF-027: el admin conocería la contraseña); registro público (prohibido por la 001, RF-022).

## D7. Enlaces de correo: confirmación con un botón, no al abrir
- **Decisión**: las plantillas apuntan a `/auth/confirmar?token_hash={{ .TokenHash }}&type=invite|recovery`. Esa pantalla **muestra un botón "Continuar"**; recién al pulsarlo se llama a `verifyOtp` (Server Action), se abre la sesión y se redirige a `/definir-contrasena`, donde se llama a `updateUser({ password })`.
- **Razón**: algunos antivirus y clientes de correo abren los enlaces para inspeccionarlos y, si el enlace consumiera el token al abrirse, se gastaría antes de que la persona llegue. Con el botón el `GET` no tiene efectos (RF-026/RF-027, "enlace de un solo uso").
- **Caso de enlace vencido o usado**: `verifyOtp` devuelve error → la pantalla lo explica y ofrece pedir uno nuevo (recuperación) o avisa que debe pedírselo al admin (invitación), como pide la spec.
- **Alternativas**: `GET /auth/confirmar` que verifica directo (el riesgo de arriba).

## D8. Correo: SMTP propio en la nube, plantillas en español, Mailpit en local
- **Decisión**: en producción, Supabase Auth envía por un **SMTP propio** configurado en el panel del proyecto (proveedor a elegir por el usuario; el plan lo deja como tarea manual de `quickstart.md`). El remitente y las plantillas (`invite`, `recovery`, `magic_link` no se usa) se versionan en `supabase/templates/*.html` y se registran en `supabase/config.toml` (`[auth.email.template.*]` con `content_path`). En local los correos caen en Mailpit (:56324).
- **Razón**: el SMTP incluido por Supabase solo envía a miembros de la organización y con un tope de pocos correos por hora (supuesto de la spec). No hay dependencia de código: es configuración.
- **Dependencia nueva**: ninguna.
- **Pendiente manual (usuario)**: elegir proveedor SMTP, verificar dominio de envío y cargar las credenciales en Supabase. Mientras no esté, en la nube las invitaciones solo llegan a miembros de la organización de Supabase; se anota en `CLAUDE.md` al cerrar.
- **Alternativas**: enviar los correos desde Next con una API de correo (agrega dependencia y un segundo camino de envío).

## D9. Subida de imágenes: URL firmada desde el navegador + verificación en el servidor
- **Decisión**: dos Server Actions en `apps/admin`:
  1. `firmarSubidaMedio({ nombre, bytes })`: comprueba el rol (equipo), rechaza si `bytes > 5 MB`, genera la ruta `articulos/AAAA/MM/<uuid>.<ext>` (la extensión solo orienta) y devuelve la URL firmada de subida (`createSignedUploadUrl`) con el cliente de la sesión.
  2. El navegador sube el archivo **directo a Storage** con esa URL (no pasa por Vercel).
  3. `registrarMedio({ ruta })`: el servidor descarga el objeto con la sesión del usuario, **lee los primeros bytes** (D10), confirma que es JPEG, PNG, WebP o AVIF y obtiene ancho y alto reales. Si no lo es, **borra el objeto** y devuelve `imagen_invalida`. Si lo es, devuelve `{ ruta, ancho, alto }` para el esquema `Imagen` de `@blog/bloques`.
- **Razón**: Vercel limita el cuerpo de una función a 4,5 MB y la spec permite 5 MB; subir por una función rompería archivos válidos. El bucket valida el tipo por la cabecera que declara el cliente, que se puede falsear: la spec exige comprobar el tipo real (RF-007), de ahí `registrarMedio`.
- **Migración**: el bucket `medios` hoy acepta `image/gif`. La clarificación del 2026-10-21 lo excluye: `UPDATE` del bucket sin GIF (data-model).
- **Alternativas**: subir por un Route Handler (límite 4,5 MB); subir directo sin verificación (tipo falseable).

## D10. Lectura de tipo y dimensiones de imagen: función pura, sin dependencia
- **Decisión**: `detectarImagen(bytes: Uint8Array)` en `@blog/bloques` (`src/imagen-archivo.ts`): reconoce por firma JPEG (`FF D8`, ancho y alto del marcador SOF), PNG (IHDR), WebP (`RIFF…WEBP`, cuadros VP8, VP8L y VP8X) y AVIF (caja `ftyp` con `avif`/`avis` y caja `ispe`) y devuelve `{ tipo, ancho, alto } | null`. Es función pura con tests con archivos mínimos de cada formato.
- **Razón**: son ~80 líneas y evitan una dependencia (`image-size`, `sharp`). Vive en `@blog/bloques` junto a `esquemaImagen`, que es donde se define qué es una imagen válida.
- **Alternativas**: `image-size` (dependencia nueva para algo acotado); `sharp` (pesado, ya lo usa Next internamente pero no es una dependencia del workspace).

## D11. Borrado de imágenes sin uso
- **Decisión**: al **guardar** un artículo (o su imagen destacada), al **eliminarlo** y al cambiar la foto de perfil, la acción calcula las rutas que ya no están (diferencia entre lo guardado antes y lo nuevo, con una función pura `rutasDeImagenes(articulo)`), pregunta a `public.rutas_en_uso(rutas)` cuáles siguen usadas por algún artículo o perfil y borra el resto con la Storage API. El borrado es **mejor esfuerzo**: si falla, se registra y no revierte el guardado. Solo ocurre **después** de que el guardado tuvo éxito.
- **Razón**: clarificación del 2026-10-21 (se borran, salvo que otro contenido las use). La política `medios_delete_equipo` ya permite el borrado al equipo.
- **Límite conocido**: una imagen subida y nunca guardada (el usuario cierra el editor) queda huérfana. Se acepta en el MVP y se anota como pendiente (limpieza programada, spec posterior). Un `rutas_en_uso` recorre `articulos.contenido` como texto; con los datos de una demo es instantáneo y no justifica un índice.
- **Alternativas**: contador de referencias en una tabla (más tablas y disparadores por un caso que la demo no necesita); limpieza programada (spec posterior).

## D12. Editor de bloques: estado en el cliente, operaciones puras en `@blog/bloques`
- **Decisión**: el editor es un componente de cliente con `useReducer`. Las operaciones sobre la lista (`agregarBloque`, `moverBloque(indice, destino)`, `duplicarBloque`, `quitarBloque`, `actualizarBloque`) son funciones puras en `@blog/bloques/src/operaciones.ts`, con tests primero (constitución §III.5, §IX.1). `crearBloque` ya existe. Reordenar es con botones "subir" y "bajar" (RF-025: sin arrastrar). Los textos de párrafo, cita y lista son `textarea` con una barra de botones que insertan las cuatro marcas (`**`, `_`, `` ` ``, enlace); no hay WYSIWYG ni HTML (clarificación del 2026-10-21).
- **Validación**: la misma `validarContenido` de `@blog/bloques` en el cliente (antes de enviar) y en `@blog/db` (al guardar). `ErrorBloque { indice, campo, mensaje }` se traduce al `id` del campo `bloque-<indice>-<campo>` para señalar el error y enfocarlo (RF-006, CE-004).
- **Alternativas**: Tiptap o ProseMirror (dependencias pesadas y un modelo de documento que duplicaría el esquema de bloques, que debe ser único: §VI.3).

## D13. Edición concurrente y cambios sin guardar
- **Decisión**:
  - Conflicto (`conflicto_version`): el formulario **no se recarga**. Un aviso explica que hay cambios más nuevos y ofrece "Ver la versión vigente", que carga la versión del servidor en una vista de solo lectura junto a lo escrito por la persona (que sigue editable y copiable); "Reemplazar con la vigente" descarta lo propio solo si la persona lo confirma (CE-005).
  - Cambios sin guardar: el formulario mantiene un indicador `sucio`. `beforeunload` avisa al cerrar o recargar; para la navegación interna, los enlaces del panel pasan por `EnlaceConAviso` (envoltura de `next/link`) que muestra el diálogo de confirmación si `sucio`. Un contexto `ProveedorSalida` comparte el estado.
- **Detalle de diseño** (revisión de `revisor-ux-ui`, 2026-10-21): el conflicto se muestra como un `role="alert"` persistente con una región de dos columnas "Tu versión" / "Versión vigente" (apiladas en móvil); "Reemplazar con la vigente" va en un `AlertDialog` con foco inicial en "Cancelar"; el aviso de salida ofrece "Seguir editando", "Salir sin guardar" y, si es viable, "Guardar y salir". Criterios completos en T060 y T061 de `tasks.md`.
- **Alternativas**: guardado automático (fuera de alcance de la spec).

## D14. Lista de artículos: función SQL y filtros en la dirección
- **Decisión**: `public.listar_articulos_panel(...)` (security invoker, data-model) devuelve la página y el total en una consulta, con filtros combinables por estado, categoría, autor y título (sin tildes ni mayúsculas, con `unaccent`), ordenada por `actualizado_en desc, id`. Los filtros viajan en `searchParams` (`?estado=&categoria=&autor=&q=&pagina=`); la página es un Server Component que lee `searchParams` y los valida con Zod (valores inválidos se ignoran).
- **Razón**: PostgREST no puede aplicar `unaccent` a un filtro; una función SQL es la forma estándar en el proyecto (ya se hizo con `buscar_articulos` en la 001). Orden por `actualizado_en` obliga a un índice (§V.8).
- **Alternativas**: filtrar en memoria en Node (no escala); `pg_trgm` (spec posterior, ya anotada en la 001).

## D15. Vista previa dentro del panel
- **Decisión**: ruta `/articulos/[id]/vista-previa` (Server Component, solo equipo) que lee el artículo con la sesión y lo renderiza con `Bloques` de `@blog/bloques/render` y un componente `Imagen` propio del admin que usa `<img>` con la URL pública de Storage. La URL se arma con `urlImagen(ruta, supabaseUrl)`, que **se mueve de `apps/web/src/lib/imagenes.ts` a `@blog/db`** (solo esa función; el resto de `imagenes.ts` depende de `astro:assets` y se queda en web) para que web y admin compartan una sola (§VIII.3). Tailwind del admin escanea `packages/bloques/src` (`@source`) para que las clases de los renderers existan.
- **SEO**: la ruta lleva `robots: noindex, nofollow`, no tiene `canonical` y vive bajo `/articulos/...`, nunca bajo `/blog/...` (RSEO-002).
- **Razón**: la spec lo fija así (Supuestos). Reutiliza los renderers de la 002 sin copias.

## D16. Permisos: matriz pura y verificable
- **Decisión**: `packages/db/src/permisos.ts` exporta `ACCIONES` (las filas de la tabla de permisos de la spec) y `puede(rol: RolMiembro | null, accion): boolean`; `null` es anónimo o desactivado. Se usa para ocultar la interfaz y como primera barrera de cada acción. Un test recorre la matriz completa (acción × {anónimo, editor, admin}) contra la tabla de la spec (CE-002) y un E2E comprueba que la base rechaza lo que la interfaz oculta.
- **Razón**: §III.5 pide que los permisos sean lógica pura en `packages/*`. No sustituye a RLS: es una comodidad y un mensaje claro.

## D17. UI: shadcn/ui sobre los tokens, componentes mínimos
- **Decisión**: se siguen las reglas de §II y §VII.3: shadcn/ui tematizado con `@blog/ui`. Los componentes se **copian** a `apps/admin/src/componentes/ui/` (shadcn no es una librería) y solo los necesarios: `Button` (sus clases salen de `clasesBoton` de `@blog/ui/clases`: no se redefine el botón), `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Badge`, `Table` y `AlertDialog`.
- **Dependencias nuevas** (solo `apps/admin`, versiones fijadas al instalar respetando `minimumReleaseAge`): `@radix-ui/react-alert-dialog` (diálogo de confirmación accesible) y `@radix-ui/react-slot`, `class-variance-authority`, `clsx@2.1.1` y `tailwind-merge` (variantes y composición de clases de shadcn). `select` y `checkbox` son los nativos. Íconos: SVG en línea (`lucide-react` descartada por `consistencia-codigo`: son pocos íconos). Aprobadas por `consistencia-codigo` el 2026-10-21 (§II).
- **Razón**: foco, teclado y lectores de pantalla (RF-025, CE-006) vienen resueltos en los primitivos de Radix; rehacerlos con elementos nativos costaría más tiempo y más errores de accesibilidad.
- **Alternativas**: elementos nativos y `<dialog>` (cumple pero es una desviación de §II y lleva más trabajo propio); Material UI u otra librería (fuera del stack).

## D18. Hora de programación
- **Decisión**: un `<input type="datetime-local">` en el cliente; al enviar se convierte a ISO UTC con `new Date(valor).toISOString()`. La base valida que sea futura (`fecha_no_futura`). Las fechas se muestran con `Intl.DateTimeFormat('es', …)` en un componente de cliente (`<FechaLocal>`) para usar la zona del navegador y no producir diferencias entre servidor y cliente.
- **Alternativas**: elegir zona horaria en el panel (fuera de alcance: spec, Supuestos).

## D19. Actualización del sitio público: sin trabajo en el admin
- **Decisión**: el admin no llama a ningún endpoint de revalidación. Los triggers de la base de las specs 001 y 002 ya emiten el aviso firmado ante cualquier cambio público (artículos, taxonomías, autores). El panel solo escribe en la base. CE-003 se verifica con un E2E que publica desde el panel y espera el cambio en el sitio.
- **Razón**: RSEO-003 y la constitución §III.6 (el aviso lo puede emitir la base). Evita un segundo camino de invalidación.

## D20. Que ningún buscador entre al panel (RSEO-001)
- **Decisión**: tres capas: `metadata.robots = { index: false, follow: false }` en el layout raíz (ya está), `app/robots.ts` con `Disallow: /`, y encabezado `X-Robots-Tag: noindex, nofollow` para todas las rutas desde `next.config.ts` (`headers()`). Un test (Vitest para `robots.ts`, Playwright para el encabezado) lo comprueba.

## D21. Desactivar a un miembro
- **Decisión**: desactivar es `perfiles.activo = false` (ya soportado por `cambiarActivo`). Para que el efecto sea inmediato (RF-002) no hace falta revocar sesiones de Supabase: RLS usa `es_equipo()`, que lee `perfiles.activo` en cada consulta, y `obtenerMiembro()` cierra la sesión local del desactivado en su siguiente petición. No se usa `ban_duration` de Auth para no tener dos fuentes de verdad que sincronizar al reactivar.
- **Caso borde**: un invitado desactivado antes de aceptar puede definir su contraseña pero `obtenerMiembro()` lo expulsa (spec, casos borde).

## D22. Pruebas de extremo a extremo con correo
- **Decisión**: los E2E de invitación y recuperación leen el correo desde la API de Mailpit (`http://127.0.0.1:56324/api/v1/messages`), extraen el enlace y lo abren. Se usa una cuenta nueva por corrida (`correo+<timestamp>@demo.local`) y se limpia con `service_role` en el `afterAll`.
- **Razón**: es la única forma de probar RF-026 y RF-027 de punta a punta sin un proveedor real.

## D23. Variables de entorno y despliegue
- **Decisión**: `blog-admin` en Vercel gana `SUPABASE_SERVICE_ROLE_KEY` (**sensitive**, solo servidor) y `NEXT_PUBLIC_URL_ADMIN` (para construir `redirectTo`). `.env.example` se actualiza. En la nube, `site_url` y `additional_redirect_urls` de Auth se fijan a la URL del admin (hoy el proyecto usa los valores locales).
- **Pendiente manual (usuario)**: cargar la clave de servicio en Vercel, ajustar la URL del sitio de Auth y configurar el SMTP (D8).

## Resumen de dependencias nuevas

| Dependencia | Dónde | Por qué | Estado |
|---|---|---|---|
| `@supabase/ssr` 0.12 | `packages/db` | Sesión por cookies (D1) | Ya aprobada en la tabla de §II |
| `@radix-ui/react-alert-dialog`, `@radix-ui/react-slot` | `apps/admin` | Diálogo de confirmación accesible de shadcn (D17) | Aprobadas |
| `class-variance-authority`, `clsx`, `tailwind-merge` | `apps/admin` | Variantes y composición de clases de shadcn | Ídem |
| `zod@4.6.7` | `apps/admin` | Validar las entradas de las Server Actions | Del stack (§II), misma versión que `@blog/db` |
