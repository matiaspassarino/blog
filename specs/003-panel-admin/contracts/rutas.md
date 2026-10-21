# Contrato: rutas, guardas y metadatos de `apps/admin`

**Decisiones**: research D2, D3, D4, D7, D15, D20. **Código**: `apps/admin/src/app/`. Next.js 16, App Router, sin `cacheComponents`.

## Rutas

| Ruta | Quién entra | Contenido | Historia |
|---|---|---|---|
| `/ingreso` | anónimo (si ya hay sesión activa → `/articulos`) | formulario de ingreso, enlace a "Olvidé mi contraseña"; lee `?volver=` y `?motivo=desactivada\|inactividad\|sesion` | H1 |
| `/olvide-contrasena` | anónimo | pide el correo; mensaje idéntico exista o no | H1.7 |
| `/auth/confirmar` | anónimo con `?token_hash&type` | muestra "Continuar" (botón que llama a `confirmarEnlace`); si el enlace no sirve, lo explica | H1.7, H6.1 |
| `/definir-contrasena` | sesión abierta por `confirmarEnlace` | contraseña y repetición | H1.7, H6.1 |
| `/` | cualquiera | redirige a `/articulos` (o a `/ingreso`) | H1 |
| `/articulos` | equipo | lista con filtros, búsqueda y paginación por `searchParams` | H4 |
| `/articulos/nuevo` | equipo | editor vacío | H2 |
| `/articulos/[id]` | equipo | editor, acciones de estado, enlace al sitio si está publicado | H2, H3 |
| `/articulos/[id]/vista-previa` | equipo | artículo renderizado con `Bloques` (D15) | H2.7 |
| `/categorias` | equipo | lista con conteos y alta/edición/baja | H5 |
| `/etiquetas` | equipo | ídem | H5 |
| `/equipo` | **admin** | lista, invitación, roles, activación | H6 |
| `/perfil` | equipo | nombre, biografía y foto propios | H6.7 |
| `/robots.txt` | todos | `Disallow: /` | RSEO-001 |

Un editor que abre `/equipo` recibe `forbidden()` (`403`, página "No tienes permiso") y no la lista. Una URL inexistente muestra la página `not-found` del panel.

## Estructura de carpetas

```text
apps/admin/src/
├── proxy.ts                          # refresco de tokens + inactividad (D2, D3)
├── app/
│   ├── layout.tsx                    # html lang="es", robots noindex (ya existe)
│   ├── robots.ts
│   ├── (publico)/                    # sin barra lateral
│   │   ├── ingreso/  olvide-contrasena/  auth/confirmar/  definir-contrasena/
│   └── (panel)/                      # layout con navegación; obtenerMiembro() aquí
│       ├── layout.tsx
│       ├── articulos/{page,nuevo/page,[id]/page,[id]/vista-previa/page}.tsx
│       ├── categorias/  etiquetas/  equipo/  perfil/
├── acciones/                         # Server Actions (contracts/acciones.md)
├── consultas/                        # lecturas para páginas (usan @blog/db)
├── componentes/
│   ├── ui/                           # shadcn (D17)
│   ├── editor/                       # EditorArticulo, ListaBloques, editores por tipo
│   └── …                             # tablas, filtros, confirmaciones
└── lib/                              # sesion.ts, mensajes.ts, actividad.ts, fechas.ts
```

## Guardas

| Capa | Qué hace | Falla con |
|---|---|---|
| `proxy.ts` (matcher: todo menos `_next/*`, estáticos y `favicon`) | refresca tokens; aplica `sesionVencida`; sin cookie de sesión en una ruta interna → `/ingreso?volver=<ruta>` | redirección 307 |
| `(panel)/layout.tsx` | `obtenerMiembro()`; perfil inactivo → `signOut` + `/ingreso?motivo=desactivada` | redirección |
| `equipo/page.tsx` | `puede(rol, 'equipo.ver')` | `forbidden()` |
| Server Action | misma comprobación + RLS | `ResultadoAccion` con error |

`volver` solo se acepta si es una ruta interna (empieza con `/` y no con `//`, sin esquema): evita redirecciones abiertas.

## Metadatos y SEO (RSEO-001, RSEO-002)

- Layout raíz: `metadata.robots = { index: false, follow: false }`, `title` con plantilla `%s · Panel` (ya existe parcialmente).
- `next.config.ts` → `headers()`: `X-Robots-Tag: noindex, nofollow` para `/:path*`.
- `robots.ts`: `rules: { userAgent: '*', disallow: '/' }`. Sin `sitemap`.
- La vista previa: sin `canonical`, nunca bajo `/blog/…`. Incluye un aviso visible "Vista previa: así se verá en el sitio" y el estado del artículo.
- Cada pantalla tiene un único `h1` y `title` propio (WCAG 2.4.2).

## Interfaz transversal

- **Navegación**: barra lateral en 1024 px o más; menú desplegable en pantallas angostas (≥ 44 px de área táctil, 360 px de ancho mínimo). "Equipo" solo aparece al admin.
- **Estados**: toda lista y formulario define vacío, carga (`loading.tsx` o `pending` de la acción), error y éxito (anunciado con `role="status"`; los errores con `role="alert"`).
- **Confirmaciones** (RF-024): `AlertDialog` con foco inicial en "Cancelar" para eliminar y desactivar; el texto dice qué se pierde.
- **Fechas**: `<FechaLocal valor=… />` (cliente) formatea en la zona del navegador (D18).
- **Cambios sin guardar**: `ProveedorSalida` + `EnlaceConAviso` + `beforeunload` (D13).
- **Campos con error**: `aria-invalid`, `aria-describedby` hacia el mensaje, y al fallar el guardado el foco va al primer campo inválido (`id = bloque-<indice>-<campo>` para bloques, `campo-<nombre>` para el resto).

## Variables de entorno de `apps/admin`

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente y servidor | sesión y Storage (subida firmada) |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor**, sensitive en Vercel | invitar y reenviar (acciones de Equipo) |
| `NEXT_PUBLIC_URL_ADMIN` | servidor | `redirectTo` de invitaciones y recuperación |

Las claves sin `NEXT_PUBLIC_` no se pueden importar desde un componente de cliente: el módulo que las lee lleva `import 'server-only'`.
