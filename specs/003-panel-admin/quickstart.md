# Guía de validación: Panel de administración

**Rama**: `003-panel-admin` | Contratos: [acciones](contracts/acciones.md) · [rutas](contracts/rutas.md) · [correos](contracts/correos.md) | Modelo: [data-model.md](data-model.md)

Guía para comprobar de punta a punta que la feature funciona. No contiene código de implementación.

## Requisitos previos

- Node 24, pnpm 12, Docker en marcha y Supabase CLI 2.121 (ver CLAUDE.md, "Retomar en otra PC").
- `.env.local` en `apps/admin` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (de `supabase status`) `NEXT_PUBLIC_URL_ADMIN=http://localhost:3100` y `NEXT_PUBLIC_URL_SITIO=http://localhost:4321`. En `apps/web`, las variables de la spec 002.
- Windows: ver `specs/002-sitio-publico/quickstart.md` ("En Windows").

## Puesta en marcha

```bash
pnpm install
pnpm db:start && pnpm db:reset      # aplica 20261021120000_panel_admin.sql y el seed
pnpm db:tipos                       # regenera packages/db/src/tipos.ts
pnpm dev                            # web :4321 y admin :3100
```

Usuarios de demo (`@demo.local`, ver `supabase/seed.sql` para las contraseñas locales): 1 admin y 2 editores. Los correos de Auth se leen en Mailpit: http://127.0.0.1:56324.

## Verificación automática

| Comando | Qué cubre |
|---|---|
| `pnpm lint && pnpm typecheck` | todos los workspaces, incluido `apps/admin` |
| `pnpm test` | Vitest: operaciones de bloques, `detectarImagen`, permisos, mensajes, sesión vencida, plantillas, acciones (con base local) |
| `pnpm test:db` | pgTAP: las funciones nuevas, el bucket sin GIF y los privilegios |
| `pnpm test:e2e` | Playwright `e2e/admin` (flujos de abajo) y `e2e/web` (regresión del sitio) |
| `pnpm calidad && pnpm build` | jscpd ≤ 3 %, knip y compilación de web y admin |

## Recorrido manual (equivale a los E2E críticos)

Cada paso indica la historia y el resultado esperado.

### A. Ingreso (H1)
1. Abrir http://localhost:3100/articulos sin sesión → redirige a `/ingreso?volver=/articulos`.
2. Ingresar con una contraseña mala → mensaje genérico, el correo se conserva.
3. Ingresar como editor → llega a `/articulos` con su nombre y rol. Al cerrar sesión, `/articulos` vuelve a pedir ingreso.
4. Como admin, desactivar al otro editor (paso F); con la sesión abierta del editor, hacer cualquier acción → sale a `/ingreso?motivo=desactivada`.
5. "Olvidé mi contraseña" con un correo del seed y con uno inexistente → mismo mensaje; solo el primero genera un correo en Mailpit. Abrir el enlace → botón "Continuar" → definir contraseña → ingresa.

### B. Redactar (H2)
1. `Nuevo artículo`: escribir un título → aparece el slug sugerido; cambiarlo.
2. Agregar los 10 tipos de bloque, reordenar con "subir/bajar", duplicar y quitar uno.
3. Subir una imagen (JPEG/PNG/WebP/AVIF ≤ 5 MB) como destacada y otra en un bloque; pide texto alternativo o "decorativa".
4. Probar un `.gif`, un `.svg` y un archivo de más de 5 MB → cada uno se rechaza con su motivo y el resto del artículo no se pierde.
5. Dejar una imagen sin alternativo y guardar → se rechaza todo, se marca ese bloque y campo, y lo escrito se conserva.
6. Guardar como borrador, cerrar, reabrir → mismo contenido y orden. Abrir la vista previa → mismos bloques que el sitio.
7. Con dos pestañas abiertas en el mismo artículo, guardar en una y luego en la otra → la segunda ve el aviso y conserva su texto.
8. Editar y tratar de navegar sin guardar → aviso de cambios sin guardar.

### C. Publicar y programar (H3)
1. Publicar el borrador completo → estado "publicado", enlace al sitio, y en menos de 60 s aparece en http://localhost:4321/blog.
2. Intentar publicar uno sin categoría → el panel dice qué falta.
3. Programar otro para dentro de 2 minutos (fecha local) → "programado" con su fecha; se publica solo. Una fecha pasada se rechaza.
4. Archivar el primero → desaparece del sitio en menos de 60 s. Como editor no aparece "Eliminar"; como admin sí, con confirmación.

### D. Lista (H4)
Filtrar por "programado", por categoría y por autor (combinables), buscar por una palabra del título con y sin tildes, paginar. Copiar la dirección en otra pestaña → mismos resultados. Sin coincidencias → estado vacío con "Quitar filtros".

### E. Categorías y etiquetas (H5)
Crear, renombrar (el cambio se ve en el sitio), intentar eliminar una categoría en uso (mensaje con el conteo), eliminar una etiqueta con confirmación, cambiar el slug de una con artículos publicados (aviso de redirección).

### F. Equipo (H6)
Como admin: invitar a un editor nuevo → aparece "invitado" y llega un correo a Mailpit → abrir el enlace, "Continuar", definir la contraseña → puede ingresar. Reenviar una invitación (el enlace anterior ya no sirve). Cambiar rol, desactivar y reactivar. Intentar degradar al único admin → mensaje de último admin. Como editor, `/equipo` da "No tienes permiso". Editar el perfil propio (foto con texto alternativo): se ve en la ficha de autor del sitio en menos de 60 s.

## Rendimiento y accesibilidad

- Lighthouse (Accesibilidad ≥ 95) sobre `/ingreso`, `/articulos`, `/articulos/[id]` y `/equipo` en 360, 768, 1024 y 1440 px (CE-006). Recorrer cada pantalla solo con teclado, incluido el editor de bloques.
- Navegación entre pantallas < 1 s con los datos de demo (CE-007).
- `curl -I http://localhost:3100/ingreso` incluye `X-Robots-Tag: noindex, nofollow`; `/robots.txt` devuelve `Disallow: /`.

## Pasos manuales para la nube (a cargo del usuario)

1. Vercel `blog-admin`: agregar `SUPABASE_SERVICE_ROLE_KEY` (sensitive), `NEXT_PUBLIC_URL_ADMIN` y `NEXT_PUBLIC_URL_SITIO` (la URL de producción de `blog-web`).
2. Supabase (proyecto `blog-demo`): fijar *Site URL* y *Redirect URLs* a la URL del admin; subir las plantillas de `supabase/templates/` (o `supabase config push`); **fijar *Email OTP expiration* en 86400 s (24 h; el valor por defecto de la nube es 1 h y las plantillas dicen 24 horas) y la *longitud mínima de contraseña* en 8** (RF-028).
3. Configurar un SMTP propio en Auth → *SMTP Settings* (research D8). Hasta entonces, las invitaciones solo llegan a miembros de la organización de Supabase.
4. Aplicar la migración `20261021120000_panel_admin.sql` (ver el aviso sobre el historial de migraciones en CLAUDE.md).
5. Probar el recorrido F en la nube con una cuenta real.
