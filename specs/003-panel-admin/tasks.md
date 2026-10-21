---

description: "Lista de tareas: panel de administración"
---

# Tareas: Panel de administración

**Entrada**: Documentos de diseño en `/specs/003-panel-admin/`: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (D1–D23), [data-model.md](data-model.md), [contracts/](contracts/) ([acciones](contracts/acciones.md), [rutas](contracts/rutas.md), [correos](contracts/correos.md)) y [quickstart.md](quickstart.md).

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: OBLIGATORIOS (constitucion.md §IX). En cada fase, las tareas de test van primero, las escribe el agente `escritor-tests` y **deben fallar** antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario (H1 a H6 de spec.md). La fase fundacional deja lista la base de datos, los paquetes compartidos, la sesión y el esqueleto del panel, que usan todas las historias.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Puede ejecutarse en paralelo: toca archivos distintos y no depende de tareas incompletas.
- **[Historia]**: H1 a H6, según spec.md.

## Convenciones de rutas

- Panel: `apps/admin/src/` (rutas en `app/`, Server Actions en `acciones/`, lecturas en `consultas/`, componentes en `componentes/`, helpers puros en `lib/`). Estructura completa en [contracts/rutas.md](contracts/rutas.md#estructura-de-carpetas).
- Compartido: `packages/db/src/`, `packages/bloques/src/`, `packages/ui/src/`. Ninguna página crea clientes Supabase ni escribe SQL (constitución §III.2).
- Migraciones: `supabase/migrations/20261021120000_panel_admin.sql`.
- pgTAP: `supabase/tests/<nombre>.test.sql`, con `begin; select plan(N);` … `select * from finish(); rollback;` y los helpers de `00_helpers.test.sql` (`pruebas.como_anon()`, `pruebas.como(email)`, `pruebas.como_postgres()`).
- Vitest: `packages/<pkg>/src/**/*.test.ts` y `apps/admin/src/**/*.test.ts(x)`.
- E2E: `e2e/admin/*.spec.ts` (proyecto `admin` de `playwright.config.ts`, Desktop Chrome, `http://localhost:3100`). Los que verifican el sitio público usan además `http://localhost:4321`.
- Reglas transversales:
  - Next 16: antes de escribir código en `apps/admin`, leer las guías de `apps/admin/node_modules/next/dist/docs/` indicadas en cada tarea (`apps/admin/AGENTS.md`).
  - SQL: `set search_path = ''`, nombres calificados, privilegios explícitos, ninguna función `definer` con las palabras `execute ` ni `net.http_` en su cuerpo (ni en comentarios).
  - UI: solo tokens de `packages/ui/src/tokens.css`, sin hex ni px sueltos (§VII.2); un `h1` por pantalla; todo texto de la interfaz en español con tuteo neutro (como el sitio público).
  - Antes de crear un archivo, revisar la tabla "Reutilización" de [plan.md](plan.md) (§VIII).
  - `service_role` solo en `apps/admin/src/acciones/equipo.ts` y `apps/admin/src/lib/servicio.ts`, con `import 'server-only'` (§III.4).

---

## Fase 1: Preparación

**Propósito**: Aprobar e instalar dependencias, configurar Next, Tailwind, Vitest y Playwright, y dejar el entorno de pruebas del panel.

- [ ] T001 Pedir al agente `consistencia-codigo` la aprobación de las dependencias nuevas (§II, plan.md "Dependencias nuevas"): `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge` y `lucide-react` en `apps/admin`. Anotar el veredicto y las versiones elegidas al final de research.md D17. **Si las rechaza**, usar el plan B de plan.md ("Riesgos"): elementos nativos y `<dialog>`; saltar T002 (parte de `apps/admin`) y T010 y registrar la desviación en "Seguimiento de complejidad".
- [ ] T002 Instalar y fijar sin `^` (§II): `@supabase/ssr` en `packages/db/package.json` (rama 0.12; lo que resuelva `minimumReleaseAge`, sin exclusiones) y las dependencias aprobadas en T001 en `apps/admin/package.json`. Agregar `@blog/db: workspace:*` y `@blog/bloques: workspace:*` a `apps/admin/package.json`. Ejecutar `pnpm install` y confirmar que `pnpm-lock.yaml` cambió solo en lo esperado.
- [ ] T003 [P] `apps/admin/next.config.ts` (research D4, D20): quitar `cacheComponents` y `partialPrefetching`; agregar `headers()` con `X-Robots-Tag: noindex, nofollow` para `/:path*`; si `forbidden()` lo requiere, habilitar el indicador de `authInterrupts`. Leer antes `01-app/03-api-reference/04-functions/forbidden.md`, `01-app/03-api-reference/03-file-conventions/forbidden.md` y `01-app/03-api-reference/03-file-conventions/proxy.md`, y confirmar los nombres exactos del indicador.
- [ ] T004 [P] Crear `apps/admin/vitest.config.ts` (entorno `node`, `include: src/**/*.test.ts(x)`) con un alias de `server-only` a un archivo vacío `apps/admin/src/test/server-only.ts`, para poder probar acciones y módulos de servidor. Mantener `--passWithNoTests`.
- [ ] T005 [P] `apps/admin/src/app/globals.css`: agregar `@source` hacia `packages/bloques/src/render` (la vista previa usa sus clases), la regla `@media (prefers-reduced-motion: reduce)` que anula transiciones y animaciones, y el estilo de `:focus-visible` con el token de foco de `@blog/ui` (si falta, agregarlo primero a `packages/ui/src/tokens.css`).
- [ ] T006 [P] Variables de entorno (contracts/rutas.md, "Variables de entorno"): en `.env.example` agregar `NEXT_PUBLIC_URL_ADMIN=http://localhost:3100` y aclarar que `SUPABASE_SERVICE_ROLE_KEY` es solo de `apps/admin`. Crear `apps/admin/.env.local` (ignorado por git) con los valores de `supabase status` (URL, clave anon, clave de servicio) como indica [quickstart.md](quickstart.md#requisitos-previos).
- [ ] T007 [P] Límites de importación (plan.md "Riesgos"): en las configuraciones de ESLint de `apps/web` y de `apps/admin` agregar `no-restricted-imports` para `@blog/db/servidor`: prohibido en todo `apps/web` y en `apps/admin/src/componentes/**`. Mensaje en español. Revisar `knip.json` para que `apps/admin` declare como entradas `src/proxy.ts` y `src/app/**` y no reporte exports falsos.
- [ ] T008 [P] Crear `e2e/admin/ayudas/` con los asistentes de los E2E: `sesion.ts` (ingresar por la interfaz con los usuarios `@demo.local` de `supabase/seed.sql`: admin, editor y editor 2), `mailpit.ts` (listar mensajes por la API `http://127.0.0.1:56324/api/v1/messages`, leer el último a un correo y extraer el primer enlace), `servicio.ts` (cliente `service_role` para crear y borrar miembros de prueba, desactivarlos y borrar artículos creados; usa `@blog/db/servidor`) y `datos.ts` (artículo, categoría y etiqueta de prueba con prefijo `e2e-` y limpieza en `afterAll`).
- [ ] T009 Inicializar los componentes de shadcn/ui en `apps/admin/src/componentes/ui/` (research D17): `button.tsx` (sus clases salen de `clasesBoton` de `@blog/ui/clases`; no se redefine el botón), `input.tsx`, `textarea.tsx`, `label.tsx`, `select.tsx`, `checkbox.tsx`, `badge.tsx`, `table.tsx` y `alert-dialog.tsx`, más `apps/admin/src/lib/cn.ts` (`clsx` + `tailwind-merge`). Solo tokens de `@blog/ui`: sin hex ni px sueltos. Alto mínimo de 44 px en controles táctiles (§VII.4). Sin `components.json` si el CLI exige variables propias del tema; se copian a mano.

---

## Fase 2: Fundacional (bloqueante)

**Propósito**: Migración y pruebas de base, paquetes compartidos (`@blog/db`, `@blog/bloques`), sesión y permisos, y el esqueleto de rutas del panel. Ninguna historia puede empezar antes.

### Tests (escribir primero, deben fallar)

- [ ] T010 [P] Crear `supabase/tests/panel_admin.test.sql` con la tabla "Pruebas pgTAP" de [data-model.md](data-model.md#pruebas-pgtap-supabasetestspanel_admintestsql): bucket `medios` exactamente `{image/jpeg, image/png, image/webp, image/avif}`; `privado.sin_tildes` (inmutable, `search_path` vacío, `Diseño` → `diseno`, `null` → cadena vacía); `listar_articulos_panel` (anónimo sin `execute`, miembro desactivado sin borradores, editor ve todos los estados, filtros por estado/categoría/autor y su combinación, texto sin tildes ni mayúsculas, los textos `%`, `_`, `100%` y `\` no actúan como comodines ni fallan, límite recortado a `[1, 100]`, desplazamiento negativo tratado como 0, `total` con varias páginas); `listar_equipo` (un editor recibe el error `sin_permiso`; el anónimo sin `execute`; el admin recibe correo y `acceso` correctos para activo, desactivado e invitado, este último creado dentro del test con `email_confirmed_at` nulo; ninguna columna extra de `auth.users`); `rutas_en_uso` (uso en contenido, imagen destacada y avatar; sin falso positivo con `%`, `_` ni prefijos como `a.jpg` vs `a.jpg.bak`; sin falso negativo con comillas o barra invertida en la ruta; `null` y `{}` devuelven `{}`; un anónimo no puede ejecutarla); privilegios (`function_privs_are` en las cuatro funciones; `prosecdef` false/true/true para las tres públicas; `PUBLIC` sin `execute`); `has_index('public', 'articulos', 'articulos_actualizado_idx')`.
- [ ] T011 [P] Actualizar `supabase/tests/storage.test.sql` (línea ~145: hoy espera `image/gif`; debe esperar `{jpeg, png, webp, avif}` sin GIF) y `supabase/tests/privilegios.test.sql` (agregar `sin_tildes` a las tres listas de excepciones del barrido, líneas ~101, 108 y 115, y recalcular `plan(132)`).
- [ ] T012 [P] Crear `packages/db/src/permisos.test.ts` (RF-003, CE-002, D16): un test recorre `ACCIONES` × {`null`, `'editor'`, `'admin'`} contra la tabla "Requisitos de permisos" de la spec (ver [spec.md](spec.md)); `puede(null, …)` es falso para todo lo interno; `transicionesDe` devuelve exactamente la tabla "Estados y transiciones" de [data-model.md](data-model.md#estados-y-transiciones) para `borrador`, `programado`, `publicado` y `archivado`.
- [ ] T013 [P] Crear `packages/db/src/medios.test.ts`: mover desde `apps/web/src/lib/imagenes.test.ts` los casos de `urlDeMedio` (misma salida, incluida la ruta con `/` inicial) y agregar `rutaDeMedio(url)` (de una URL pública de Storage a la ruta relativa al bucket; devuelve `null` si la URL no es del bucket `medios`).
- [ ] T014 [P] Crear `packages/bloques/src/imagen-archivo.test.ts` (RF-007, D10): `detectarImagen(bytes)` devuelve `{ tipo, ancho, alto }` para archivos mínimos válidos de JPEG, PNG, WebP (cuadros VP8, VP8L y VP8X) y AVIF (caja `ftyp` + `ispe`); devuelve `null` para GIF, SVG, un `.exe` o texto renombrado a `.jpg`, un archivo vacío y uno truncado; un PNG cuyo nombre diga `.jpg` se reconoce como PNG (la extensión no cuenta). Los fixtures son arreglos de bytes escritos en el test, sin archivos binarios en el repo.
- [ ] T015 [P] Crear `packages/bloques/src/operaciones.test.ts` (D12, H2-E2): `agregarBloque(contenido, tipo, posicion?)` (al final por defecto; usa `crearBloque`), `moverBloque(contenido, indice, destino)` (mover primero hacia arriba y último hacia abajo no cambia nada; destino fuera de rango se recorta), `duplicarBloque` (copia con `id` nuevo justo debajo), `quitarBloque`, `actualizarBloque(contenido, indice, cambios)`. Todas devuelven un arreglo nuevo (no mutan la entrada) y conservan el orden del resto.
- [ ] T016 [P] Crear `packages/bloques/src/imagenes-en-uso.test.ts` (D11): `rutasDeImagenes({ contenido, imagen_destacada })` devuelve las rutas sin repetir de los bloques `imagen`, `galeria` y de la imagen destacada; `rutasQuitadas(antes, despues)` devuelve las que estaban y ya no están; `rutasDeImagenes` ignora bloques sin imagen y la destacada nula.
- [ ] T017 [P] Crear `packages/db/src/consultas/panel.test.ts` (integración con la base local, patrón de `packages/db/src/pruebas/*`): `listarArticulosPanel` devuelve `Pagina` con filtros combinados y orden por `actualizado_en` descendente; "0 filas con página mayor que 1" no lanza error; `listarEquipo` solo funciona para el admin (un editor lanza `ErrorDominio('sin_permiso')`); `rutasEnUso`; `listarTaxonomiasConConteo` cuenta artículos por categoría y por etiqueta.
- [ ] T018 [P] Crear `apps/admin/src/lib/actividad.test.ts` (RF-002, D3): `sesionVencida(ultimaActividad, ahora, limiteMs)` es falso a 7 h 59 min, verdadero a más de 8 h, falso sin cookie (`undefined`) y verdadero con un valor ilegible; `limiteInactividad` es 8 h.
- [ ] T019 [P] Crear `apps/admin/src/lib/mensajes.test.ts` (RF-023): `mensajeDeError` tiene texto para cada `CodigoError` de `@blog/db` más `no_autenticado`, `imagen_invalida`, `credenciales_invalidas` y `cuenta_desactivada`; `requisitos_publicacion` incluye el detalle ("sin categoría", "sin bloques"); `categoria_en_uso` incluye el conteo; ningún mensaje contiene jerga ("RLS", "trigger", "uuid", códigos de Postgres).
- [ ] T020 [P] Crear `apps/admin/src/lib/volver.test.ts` (H1-E4): `rutaInterna(valor)` acepta `/articulos` y `/articulos/abc?x=1`; rechaza `//evil.com`, `https://evil.com`, `javascript:…`, cadenas vacías, `\\evil` y valores con saltos de línea, devolviendo `/articulos`.
- [ ] T021 [P] Crear `apps/admin/src/lib/errores-campo.test.ts` (RF-006, CE-004): `idDeCampo(error)` convierte `{ indice, campo }` en `bloque-<indice>-<campo>` (por ejemplo `bloque-2-imagen.alt`) y los de `indice: -1` en `campo-imagen_destacada`; `agruparPorBloque(errores)` devuelve un mapa por índice; `primerCampoInvalido(errores)` devuelve el `id` del primero por orden de pantalla.
- [ ] T022 [P] Crear `apps/admin/src/app/robots.test.ts` (RSEO-001): `robots()` devuelve `rules` con `userAgent: '*'` y `disallow: '/'` y no declara `sitemap`.

### Implementación

- [ ] T023 Crear `supabase/migrations/20261021120000_panel_admin.sql` exactamente como [data-model.md](data-model.md#migración), con las correcciones de `arquitecto-db` ya incorporadas:
  - `update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'] where id = 'medios'`;
  - `create index articulos_actualizado_idx on public.articulos (actualizado_en desc, id)`;
  - `privado.sin_tildes(texto text)`: `language sql immutable set search_path = ''`, `lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')))`; `grant execute … to authenticated`;
  - `public.listar_articulos_panel(p_estado public.estado_articulo default null, p_categoria_id uuid default null, p_autor_id uuid default null, p_texto text default null, p_limite integer default 20, p_desplazamiento integer default 0)`: **`language sql`**, `security invoker`, `stable`, `set search_path = ''`; devuelve `id, titulo, slug, estado, categoria_id, categoria_nombre, autor_id, autor_nombre, programado_para, publicado_en, actualizado_en, total bigint`; `left join` a categorías y perfiles; `p_texto` con `privado.sin_tildes(titulo) ilike '%' || <texto escapado> || '%' escape '\'` (escapar `\`, `%` y `_` en ese orden); `p_limite` recortado a `[1, 100]`; `p_desplazamiento` mínimo 0; `total` con `count(*) over ()`; orden `actualizado_en desc, id`;
  - `public.listar_equipo()`: `plpgsql`, `security definer`, `set search_path = ''`, `#variable_conflict use_column`, columnas calificadas con alias; primera instrucción `if not privado.es_admin() then raise exception using errcode = 'P0001', message = 'sin_permiso'; end if;`; devuelve `id, nombre, correo (auth.users.email), rol, activo, acceso text, creado_en`; `acceso` = `'desactivado'` si `not activo`, `'invitado'` si `email_confirmed_at is null`, `'activo'` en otro caso; orden `nombre, id`; ningún otro dato de `auth.users`;
  - `public.rutas_en_uso(p_rutas text[]) returns text[]`: `plpgsql`, `security definer`, `stable`, `set search_path = ''`, `#variable_conflict use_column`; `sin_permiso` si `not privado.es_equipo()`; `null` o `{}` devuelve `{}`; busca cada ruta (relativa al bucket, sin `/` inicial ni prefijo `medios/`) con `position(to_jsonb(ruta)::text in …::text) > 0` en `articulos.contenido`, `articulos.imagen_destacada` y `perfiles.avatar`;
  - privilegios explícitos en las tres públicas: `revoke execute … from public, anon, authenticated; grant execute … to authenticated;`;
  - ningún cuerpo `definer` contiene `execute ` ni `net.http_`, ni siquiera en comentarios.
- [ ] T024 Ejecutar `pnpm db:reset`, `pnpm db:tipos` y `pnpm test:db`. Los tests de T010 y T011 deben pasar; corregir la migración (no los tests) si algo falla. Revisar los advisors del proyecto local (`supabase db advisors`, si el CLI lo ofrece) y anotar las dos funciones `definer` nuevas como intencionales.
- [ ] T025 [P] `supabase/config.toml`: `[auth] minimum_password_length = 8`; `[auth.email] otp_expiry = 86400`. Sin cambios en `enable_signup` (sigue `false`). (Las plantillas de correo se registran en H1 y H6.)
- [ ] T026 [P] Crear `packages/db/src/medios.ts` con `urlDeMedio(supabaseUrl, ruta)` (mover el código y la firma tal cual de `apps/web/src/lib/imagenes.ts`) y `rutaDeMedio(url)`; en `apps/web` borrar `lib/imagenes.ts`/`imagenes.test.ts` si quedan vacíos o importar de `@blog/db` donde se usaba; exportar desde `packages/db/src/index.ts`. Los tests de `apps/web` deben seguir en verde.
- [ ] T027 [P] Crear `packages/db/src/permisos.ts` (D16): `ACCIONES` como unión de literales con una entrada por fila de la tabla de permisos de la spec (`articulo.crear`, `articulo.editar`, `articulo.vista_previa`, `articulo.cambiar_estado`, `articulo.eliminar`, `medio.subir`, `taxonomia.gestionar`, `perfil.editar_propio`, `equipo.ver`, `equipo.gestionar`, `panel.ver`), `puede(rol: RolMiembro | null, accion): boolean` y `transicionesDe(estado): EstadoArticulo[]`. Funciones puras, sin acceso a datos. Exportar desde el índice.
- [ ] T028 [P] Crear `packages/db/src/servidor.ts` y `packages/db/src/navegador.ts` (D1): `crearClienteServidor({ url, claveAnon, cookies })` con `createServerClient` de `@supabase/ssr` y el adaptador `getAll`/`setAll`; `crearClienteAdmin(url, claveServicio)` con `persistSession: false, autoRefreshToken: false`; `crearClienteNavegador(url, claveAnon)` con `createBrowserClient`. Agregar `"./servidor": "./src/servidor.ts"` a `exports` de `packages/db/package.json`; **no** exportar `servidor` desde el índice. Exportar `crearClienteNavegador` desde el índice.
- [ ] T029 Crear `packages/db/src/consultas/panel.ts` y exportar desde el índice: `listarArticulosPanel(c, filtros): Promise<Pagina<FilaArticuloPanel>>` (RPC `listar_articulos_panel`; mapea `total`; `pagina` de 20), `obtenerArticuloParaEditar(c, id)` (artículo completo con `etiquetas: string[]`; `null` si no existe), `listarEquipo(c): Promise<FilaEquipo[]>` (RPC `listar_equipo`, errores con `traducirError`), `rutasEnUso(c, rutas): Promise<string[]>`, `listarCategoriasPanel(c)` / `listarEtiquetasPanel(c)` (lista simple para selectores) y `listarTaxonomiasConConteo(c, tipo)` (`select=*,articulos(count)` para categorías y `select=*,articulos_etiquetas(count)` para etiquetas). Reutiliza `Pagina`, `traducirError` y los tipos generados.
- [ ] T030 [P] Crear `packages/bloques/src/imagen-archivo.ts` (D10): `detectarImagen(bytes: Uint8Array): { tipo: 'jpeg' | 'png' | 'webp' | 'avif'; ancho: number; alto: number } | null` por firma (JPEG `FF D8` con marcador SOF, PNG IHDR, WebP `RIFF…WEBP` con `VP8 `, `VP8L` y `VP8X`, AVIF `ftyp` con `avif`/`avis` y caja `ispe`). Función pura, sin dependencias, tolera archivos truncados devolviendo `null`. Exportar desde `packages/bloques/src/index.ts`.
- [ ] T031 [P] Crear `packages/bloques/src/operaciones.ts` (D12) con las funciones de T015 y exportarlas. Reutilizan `crearBloque`; no mutan.
- [ ] T032 [P] Crear `packages/bloques/src/imagenes-en-uso.ts` (D11) con `rutasDeImagenes` y `rutasQuitadas` y exportarlas.
- [ ] T033 [P] Crear en `apps/admin/src/lib/`: `actividad.ts` (`sesionVencida`, constante de 8 h y nombre de la cookie `blog_actividad`), `volver.ts` (`rutaInterna`), `errores-campo.ts` (`idDeCampo`, `agruparPorBloque`, `primerCampoInvalido`), `mensajes.ts` (`mensajeDeError` según la tabla de [contracts/acciones.md](contracts/acciones.md#códigos-y-mensajes)) y `resultado.ts` (tipo `ResultadoAccion<T>` y `envolverAccion(fn)` que captura `ErrorDominio` y errores inesperados según las "Reglas comunes" del contrato).
- [ ] T034 Crear `apps/admin/src/lib/sesion.ts` y `apps/admin/src/lib/supabase.ts` (`import 'server-only'`; leer antes `02-guides/authentication.md` y `02-guides/data-security.md`): `crearClienteDeSesion()` (con `cookies()` de `next/headers`) y `obtenerMiembro(): Promise<MiembroSesion | null>` (`getClaims()` + lectura de `perfiles`: `id`, `nombre`, `rol`, `activo` y correo de los claims; si no hay perfil o `activo = false`, hace `signOut` y devuelve `null` con el motivo `desactivada`). `exigirMiembro()` redirige a `/ingreso` y, si el motivo fue la desactivación, a `/ingreso?motivo=desactivada`. Reutilizar en layouts, páginas y acciones.
- [ ] T035 Crear `apps/admin/src/proxy.ts` (D2, D3; leer `01-app/01-getting-started/16-proxy.md`): refresca los tokens con el cliente de `@supabase/ssr` sobre `NextRequest`/`NextResponse`, aplica `sesionVencida` con la cookie `blog_actividad` (si venció: `signOut`, borra la cookie y redirige a `/ingreso?motivo=inactividad`), la renueva en cada petición de página, y redirige a `/ingreso?volver=<ruta>` cuando no hay sesión en una ruta interna. Rutas públicas: `/ingreso`, `/olvide-contrasena`, `/auth/confirmar`, `/definir-contrasena`, `/robots.txt`. `matcher` excluye `_next/*`, estáticos y `favicon.ico`.
- [ ] T036 Esqueleto de rutas (contracts/rutas.md): `app/layout.tsx` (mantener `lang="es"` y `robots`; agregar `title.template = '%s · Panel'`), grupo `app/(publico)/layout.tsx` (centrado, sin navegación), grupo `app/(panel)/layout.tsx` (llama a `exigirMiembro()`, muestra `NavegacionPanel` con "Artículos", "Categorías", "Etiquetas", "Equipo" solo si `puede(rol, 'equipo.ver')`, "Mi perfil", el nombre y rol de quien ingresó y un botón de cerrar sesión), `componentes/NavegacionPanel.tsx` (barra lateral desde 1024 px; menú desplegable accesible en pantallas angostas), `app/page.tsx` (redirige a `/articulos`), `app/not-found.tsx`, `app/forbidden.tsx` ("No tienes permiso para ver esta página") y `app/(panel)/loading.tsx`. La acción `cerrarSesion` queda en T046.
- [ ] T037 [P] Crear `apps/admin/src/app/robots.ts` (`Disallow: /`, sin sitemap).
- [ ] T038 [P] Crear componentes transversales en `apps/admin/src/componentes/`: `CampoFormulario.tsx` (etiqueta + control + ayuda + error con `aria-invalid`/`aria-describedby`), `AvisoEstado.tsx` (`role="status"` para éxito y `role="alert"` para error) y `ConfirmarAccion.tsx` (sobre `AlertDialog`, foco inicial en "Cancelar", texto que dice qué se pierde; RF-024).

**Punto de control**: `pnpm test:db`, los Vitest de T012–T022 y `pnpm typecheck` en verde; `pnpm dev` muestra el esqueleto del panel con `/ingreso` todavía vacío.

---

## Fase 3: Historia 1 - Ingresar al panel (Prioridad: P1) 🎯 MVP

**Objetivo**: Un miembro ingresa con correo y contraseña, ve su nombre y rol, cierra sesión, recupera su contraseña por correo y el panel expulsa a quien se desactiva o está inactivo.

**Prueba independiente**: Con los usuarios de demo, ingresar como editor, como admin y como un miembro desactivado, y comprobar a qué llega cada uno ([quickstart.md](quickstart.md) A).

### Tests de la Historia 1 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T039 [P] [H1] Crear `apps/admin/src/acciones/acceso.test.ts` (integración con la base local; [contracts/acciones.md](contracts/acciones.md#acceso-accionesaccesots)): `ingresar` con credenciales malas devuelve `credenciales_invalidas` con el mismo mensaje para correo o contraseña incorrectos; con un perfil desactivado devuelve `cuenta_desactivada` y deja la sesión cerrada; `pedirRecuperacion` devuelve el mismo resultado exista o no el correo; `definirContrasena` rechaza menos de 8 caracteres (`contrasenia_corta`) y repeticiones distintas (`no_coinciden`).
- [ ] T040 [P] [H1] Crear `apps/admin/src/lib/plantillas.test.ts` (RF-026): `supabase/templates/recuperacion.html` contiene `{{ .TokenHash }}`, `type=recovery`, `{{ .SiteURL }}/auth/confirmar`, el aviso de un solo uso y de 24 horas, y ningún enlace a otro dominio.
- [ ] T041 [P] [H1] Crear `e2e/admin/acceso.spec.ts` (H1-E1 a E7, casos borde de enlaces): ingreso correcto como editor y como admin (se ve nombre y rol); contraseña mala → mismo mensaje y el correo se conserva; miembro desactivado (creado con `servicio.ts`) → mensaje de cuenta desactivada y ninguna pantalla interna accesible; abrir `/articulos` sin sesión → `/ingreso?volver=/articulos` y, al ingresar, vuelve a `/articulos`; `?volver=//evil.com` no redirige fuera; cerrar sesión → `/articulos` vuelve a pedir ingreso; desactivar a un editor con sesión abierta (servicio) → su siguiente acción lo lleva a `/ingreso?motivo=desactivada`; recuperación con correo existente (correo en Mailpit → enlace → botón "Continuar" → definir contraseña → entra) y con uno inexistente (mismo mensaje, sin correo); reutilizar el enlace ya usado muestra "Este enlace ya se usó o venció" con la opción de pedir uno nuevo; sin hacer clic en "Continuar", abrir el enlace no consume el token.
- [ ] T042 [P] [H1] Crear `e2e/admin/seo.spec.ts` (RSEO-001): `/ingreso`, `/articulos` (con sesión) y una 404 llevan la cabecera `X-Robots-Tag: noindex, nofollow` y `<meta name="robots" content="noindex, nofollow">`; `/robots.txt` devuelve `Disallow: /`.

### Implementación de la Historia 1

- [ ] T043 [P] [H1] Crear `supabase/templates/recuperacion.html` según [contracts/correos.md](contracts/correos.md#plantillas): saludo, una frase, un único botón con `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery`, aviso "Este enlace sirve una sola vez y vence en 24 horas", "Si no esperabas este correo, ignóralo", estilos en línea y texto alternativo del enlace. Registrarla en `supabase/config.toml` como `[auth.email.template.recovery]` con asunto "Define una nueva contraseña".
- [ ] T044 [H1] Crear `apps/admin/src/acciones/acceso.ts` (`'use server'`): `ingresar`, `cerrarSesion` (borra `blog_actividad`), `pedirRecuperacion`, `confirmarEnlace` y `definirContrasena`, con Zod y `envolverAccion`, según [contracts/acciones.md](contracts/acciones.md#acceso-accionesaccesots). `ingresar` redirige a `rutaInterna(volver)`; si el perfil está inactivo cierra la sesión y devuelve `cuenta_desactivada`. `pedirRecuperacion` usa `redirectTo = NEXT_PUBLIC_URL_ADMIN + '/auth/confirmar'` y responde siempre lo mismo. Leer antes `02-guides/forms.md` y `02-guides/server-actions.md` de `apps/admin/node_modules/next/dist/docs/01-app/`.
- [ ] T045 [P] [H1] Pantallas públicas en `apps/admin/src/app/(publico)/`: `ingreso/page.tsx` (formulario con `useActionState`; lee `volver` y `motivo` y muestra el aviso que corresponda: desactivada, inactividad, sesión; enlace a "Olvidé mi contraseña"), `olvide-contrasena/page.tsx`, `auth/confirmar/page.tsx` (muestra el botón "Continuar" que llama a `confirmarEnlace`; enlace inválido → explicación y, según el tipo, formulario para pedir uno nuevo o indicación de pedirle al admin que reenvíe), `definir-contrasena/page.tsx` (contraseña y repetición; requiere sesión abierta). Cada una con `h1` único, `title` propio y estados de carga y error. Texto en español con tuteo.
- [ ] T046 [H1] Cablear en `(panel)/layout.tsx` el botón "Cerrar sesión" (formulario con `cerrarSesion`) y confirmar que `obtenerMiembro()` muestra nombre y rol. Ajustar `proxy.ts` si T041 revela redirecciones erróneas.
- [ ] T047 [H1] Hacer pasar T039–T042; ejecutar `pnpm --filter admin lint typecheck test` y `pnpm exec playwright test --project=admin acceso seo`.

**Punto de control**: el panel pide ingreso, deja entrar a editor y admin, expulsa a desactivados e inactivos, y recupera contraseñas por correo.

---

## Fase 4: Historia 2 - Redactar y editar un artículo con bloques (Prioridad: P1)

**Objetivo**: Un editor crea y edita artículos con los 10 tipos de bloque, sube imágenes, ve errores por bloque y campo, detecta ediciones concurrentes, es avisado antes de perder cambios y ve una vista previa fiel al sitio.

**Prueba independiente**: Crear un borrador con los 10 tipos de bloque y una imagen subida, guardarlo, cerrarlo, reabrirlo y comprobar que se conservó en orden; abrir su vista previa ([quickstart.md](quickstart.md) B).

### Tests de la Historia 2 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T048 [P] [H2] Crear `apps/admin/src/acciones/articulos.test.ts` (integración; H2-E1, E5, E8): `previsualizarSlugAccion` devuelve el slug normalizado por la base; `crearArticuloAccion` y `guardarArticulo` devuelven el slug definitivo (con sufijo si ya existe); `guardarArticulo` con contenido inválido devuelve `contenido_invalido` con `errores` por bloque y campo y no escribe; con una `version` vieja devuelve `conflicto_version` y no escribe; un editor que edita un artículo de otro autor no cambia `autor_id`; un anónimo recibe `no_autenticado`; al quitar una imagen de un artículo, esta se borra del bucket solo si `rutas_en_uso` dice que nadie más la usa (D11), y un fallo del borrado no revierte el guardado.
- [ ] T049 [P] [H2] Crear `apps/admin/src/acciones/medios.test.ts` (integración; H2-E4, D9): `firmarSubidaMedio` rechaza `bytes > 5242880` con `imagen_invalida` y devuelve ruta, token y URL firmada para uno válido; `registrarMedio` sobre un objeto PNG real devuelve `{ ruta, ancho, alto }`, y sobre un objeto de texto renombrado a `.jpg`, un GIF o un SVG **borra el objeto** y devuelve `imagen_invalida`; un anónimo recibe `no_autenticado`.
- [ ] T050 [P] [H2] Crear `e2e/admin/articulo-editor.spec.ts` (H2-E1 a E3, E6, CE-001, CE-004): el slug sugerido aparece al escribir el título y se puede reemplazar; agregar, reordenar con "subir/bajar", duplicar y quitar bloques de los 10 tipos y guardar → al reabrir, mismo contenido y orden; una imagen sin texto alternativo y sin marca decorativa → el guardado se rechaza completo, se señala ese bloque y campo, el foco va al primer campo inválido y el resto de lo escrito se conserva; para cada tipo de bloque, un campo obligatorio vacío se señala en el campo correcto; las barras de formato insertan solo `**`, `_`, `` ` `` y enlace (no hay HTML ni subrayado); salir con cambios sin guardar muestra el aviso (cerrar pestaña y navegar por un enlace del panel); sesión vencida o miembro desactivado al guardar → se cierra la sesión, se explica el motivo y se descarta lo no guardado.
- [ ] T051 [P] [H2] Crear `e2e/admin/medios.spec.ts` (H2-E4, RF-007, casos borde): subir un JPEG, PNG, WebP y AVIF pequeños como imagen destacada y en un bloque de imagen; el panel registra ancho y alto y pide el texto alternativo o la marca de decorativa; un `.gif`, un `.svg`, un archivo de más de 5 MB y un `.jpg` que en realidad es texto se rechazan con su motivo, el bloque queda sin imagen y el resto del artículo no se afecta; quitar la imagen y guardar la borra del almacenamiento si ningún otro contenido la usa y la conserva si otro artículo la usa.
- [ ] T052 [P] [H2] Crear `e2e/admin/articulo-conflicto.spec.ts` (H2-E5, CE-005): con dos contextos de navegador en el mismo artículo, guardar en uno y luego en el otro → el segundo guardado se rechaza, el aviso explica que hay cambios más nuevos, lo que el segundo escribió sigue visible y copiable, "Ver la versión vigente" muestra la guardada y "Reemplazar con la vigente" solo descarta lo propio tras confirmar.
- [ ] T053 [P] [H2] Crear `e2e/admin/vista-previa.spec.ts` (H2-E7, RSEO-002): la vista previa de un borrador con los 10 bloques muestra los mismos elementos y orden que la página pública de un artículo equivalente (comparar la estructura de `h2`, `figure`, `blockquote`, `ul/ol`, `pre`, `hr` y `iframe`); sin sesión redirige al ingreso; lleva `noindex`, no tiene `canonical` y su dirección no empieza con `/blog`; muestra el aviso "Vista previa" y el estado del artículo.

### Implementación de la Historia 2

- [ ] T054 [H2] Crear `apps/admin/src/acciones/articulos.ts` (`'use server'`): `crearArticuloAccion`, `guardarArticulo`, `previsualizarSlugAccion` según [contracts/acciones.md](contracts/acciones.md#artículos-accionesarticulosts). Entrada con Zod; llama a `crearArticulo`/`actualizarArticulo`/`asignarEtiquetas`; devuelve el artículo actualizado (con su `version` nueva); después de guardar, calcula `rutasQuitadas(antes, despues)`, consulta `rutasEnUso` y borra las libres con la Storage API (mejor esfuerzo: registra el fallo y no revierte). `revalidatePath` de `/articulos` y `/articulos/[id]`.
- [ ] T055 [H2] Crear `apps/admin/src/acciones/medios.ts` (`'use server'`; D9): `firmarSubidaMedio` (rol del equipo, límite de 5 242 880 bytes, ruta `articulos/AAAA/MM/<uuid>.<ext>` sin `medios/` ni `/` inicial, `createSignedUploadUrl`) y `registrarMedio` (descarga el objeto con la sesión, `detectarImagen`; si `null`, `remove` y `imagen_invalida` con "Solo se aceptan imágenes JPEG, PNG, WebP o AVIF"; si no, `{ ruta, ancho, alto }`).
- [ ] T056 [P] [H2] Crear `apps/admin/src/componentes/editor/CampoBloque.tsx` (envoltura común: etiqueta, control, error con `id` de `idDeCampo`) y `BarraMarcas.tsx` (botones accesibles que insertan `**texto**`, `_texto_`, `` `código` `` y `[texto](url)` en el `textarea` activo; no ofrece subrayado ni HTML), con ayudas puras en `lib/marcas.ts` (`aplicarMarca(texto, seleccion, marca)`) y su test `lib/marcas.test.ts`.
- [ ] T057 [P] [H2] Crear `apps/admin/src/componentes/editor/SelectorImagen.tsx` (D9): elige un archivo, valida tamaño en el cliente, llama a `firmarSubidaMedio`, sube con `uploadToSignedUrl` de `crearClienteNavegador`, llama a `registrarMedio`, muestra progreso y errores (`role="alert"`), pide `alt` o la marca `decorativa` y entrega un valor compatible con `esquemaImagen`. Permite quitar la imagen.
- [ ] T058 [P] [H2] Crear un editor por tipo de bloque en `apps/admin/src/componentes/editor/bloques/` (uno por archivo, todos sobre `CampoBloque`, con los campos exactos de `packages/bloques/src/esquema.ts`): `EditorParrafo`, `EditorTitulo` (nivel 2 a 4), `EditorImagen` (imagen + leyenda), `EditorCita` (texto, autor, fuente), `EditorLista` (ordenada o no, ítems agregables y quitables), `EditorGaleria` (2 o más imágenes y `columnas`), `EditorCta` (título, etiqueta del botón, URL), `EditorSeparador`, `EditorCodigo` (código y lenguaje) y `EditorVideo` (proveedor, id y título). Leer `esquema.ts` antes y no duplicar sus reglas: los mensajes salen de `validarContenido`.
- [ ] T059 [H2] Crear `apps/admin/src/componentes/editor/ListaBloques.tsx` (usa `operaciones` de `@blog/bloques`; "Agregar bloque" con los 10 tipos, "Subir", "Bajar", "Duplicar" y "Quitar" por bloque, cada botón con nombre accesible que incluye el tipo y la posición; reordenar sin arrastrar; anuncia cada cambio con `role="status"`).
- [ ] T060 [P] [H2] Crear `apps/admin/src/componentes/salida/ProveedorSalida.tsx`, `EnlaceConAviso.tsx` y `useAvisoSalida.ts` (D13): un contexto con el indicador `sucio`; `beforeunload` cuando hay cambios; `EnlaceConAviso` envuelve `next/link` y muestra `ConfirmarAccion` si `sucio`. Usar `EnlaceConAviso` en `NavegacionPanel`.
- [ ] T061 [H2] Crear `apps/admin/src/componentes/editor/EditorArticulo.tsx` (componente de cliente con `useReducer`): título, slug (sugerido con retardo de 300 ms vía `previsualizarSlugAccion` y editable), extracto, imagen destacada, categoría, etiquetas (selector múltiple), título y descripción SEO, y `ListaBloques`. Valida con `validarContenido` antes de enviar; los errores del servidor y del cliente se muestran junto al campo (`agruparPorBloque`) y el foco va al primer inválido. Maneja `conflicto_version` según D13 (aviso, "Ver la versión vigente", texto propio conservado con `textoPlano`, "Reemplazar con la vigente" con confirmación). Marca `sucio` en `ProveedorSalida`. Tras guardar muestra el slug definitivo y se resincroniza con la `version` nueva.
- [ ] T062 [H2] Crear páginas `apps/admin/src/app/(panel)/articulos/nuevo/page.tsx` y `.../articulos/[id]/page.tsx` (Server Components: leen con `obtenerArticuloParaEditar` y las listas de categorías y etiquetas, y pasan datos serializables a `EditorArticulo`; `notFound()` si no existe; título de pantalla y `h1` propios). Leer antes `01-app/01-getting-started/03-layouts-and-pages.md` y `06-fetching-data.md`.
- [ ] T063 [H2] Crear `apps/admin/src/app/(panel)/articulos/[id]/vista-previa/page.tsx` (D15): renderiza título, imagen destacada y `Bloques` de `@blog/bloques/render` con un componente `Imagen` del admin (`<img>` con `urlDeMedio` y `width`/`height`), banda "Vista previa: así se verá en el sitio" con el estado, `robots: noindex`, sin `canonical`. Crear `apps/admin/src/componentes/ImagenAdmin.tsx`.
- [ ] T064 [H2] Hacer pasar T048–T053; `pnpm --filter admin lint typecheck test` y `pnpm exec playwright test --project=admin articulo medios vista-previa`.

**Punto de control**: se puede crear, guardar, reabrir y previsualizar un artículo con los 10 bloques y con imágenes subidas, con errores por campo y manejo de conflictos.

---

## Fase 5: Historia 3 - Publicar, programar y retirar artículos (Prioridad: P1)

**Objetivo**: Publicar, programar, cancelar, volver a borrador, archivar y (admin) eliminar, con solo las acciones permitidas y el aviso de lo que falta.

**Prueba independiente**: Publicar un borrador completo y verlo en el sitio; programar otro para dentro de 2 minutos; archivar el primero ([quickstart.md](quickstart.md) C).

### Tests de la Historia 3 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T065 [P] [H3] Ampliar `apps/admin/src/acciones/articulos.test.ts` (integración; H3-E2, E4, E8): `cambiarEstadoAccion` publica un borrador completo; devuelve `requisitos_publicacion` con detalle "sin categoría" o "sin bloques"; con `programado` y una fecha pasada devuelve `fecha_no_futura`; `eliminarArticuloAccion` por un editor devuelve `sin_permiso` y por el admin elimina, y las imágenes del artículo se borran del bucket solo si nadie más las usa.
- [ ] T066 [P] [H3] Crear `apps/admin/src/lib/fechas.test.ts` (D18): `aIsoUtc('2026-10-22T15:30')` convierte la hora local del navegador a ISO UTC; `formatearFecha(iso, zona?)` produce el texto en español; un valor vacío o inválido devuelve `null`.
- [ ] T067 [P] [H3] Crear `e2e/admin/publicacion.spec.ts` (H3-E1, E2, E6, E7, CE-003): publicar un borrador completo → estado "publicado" con fecha y enlace al sitio, y el artículo aparece en `http://localhost:4321/blog` en menos de 60 s; un borrador sin categoría o sin bloques no se puede publicar y el panel dice qué falta; archivar o volver a borrador lo retira del sitio en menos de 60 s; cada estado muestra solo sus transiciones (tabla de [data-model.md](data-model.md#estados-y-transiciones)); editar un publicado actualiza el sitio en menos de 60 s.
- [ ] T068 [P] [H3] Crear `e2e/admin/programacion.spec.ts` (H3-E3 a E5): programar con una fecha futura → "programado" con la fecha visible en la hora local, y se publica solo a esa hora (programar a 1 minuto y esperar); una fecha pasada se rechaza con el mensaje claro; cancelar la programación devuelve a borrador y no se publica.
- [ ] T069 [P] [H3] Crear `e2e/admin/permisos.spec.ts` (H3-E8, CE-002; este archivo se amplía en H6): un editor no ve la acción "Eliminar" ni puede invocarla (la base rechaza el intento directo con la sesión del editor); el admin elimina con confirmación y el artículo desaparece del panel y del sitio.

### Implementación de la Historia 3

- [ ] T070 [H3] Ampliar `apps/admin/src/acciones/articulos.ts` con `cambiarEstadoAccion` y `eliminarArticuloAccion` ([contracts/acciones.md](contracts/acciones.md#artículos-accionesarticulosts)): `programadoPara` obligatorio con `programado` (ISO), comprobación con `puede` (`articulo.cambiar_estado`, `articulo.eliminar`), lectura de las rutas de imagen antes de eliminar y borrado posterior según D11. Devuelve el artículo actualizado.
- [ ] T071 [P] [H3] Crear `apps/admin/src/lib/fechas.ts` (`aIsoUtc`, `formatearFecha`) y `apps/admin/src/componentes/FechaLocal.tsx` (componente de cliente que formatea con `Intl.DateTimeFormat('es', …)` en la zona del navegador, sin diferencias de hidratación).
- [ ] T072 [H3] Crear `apps/admin/src/componentes/articulo/AccionesEstado.tsx`: según `transicionesDe(estado)` y `puede(rol, …)` muestra "Publicar", "Programar" (selector `datetime-local` con mínimo ahora), "Cancelar programación", "Volver a borrador", "Archivar" y "Eliminar" (solo admin, con `ConfirmarAccion`); muestra el estado, la fecha de publicación o la programada con `FechaLocal`, y el enlace "Ver en el sitio" (`PUBLIC_URL_SITIO/blog/<slug>`, requiere `NEXT_PUBLIC_URL_SITIO` en `.env.example`) cuando está publicado; errores con `mensajeDeError`. Integrarlo en `EditorArticulo` y, si hay cambios sin guardar, pedir guardar antes de cambiar el estado.
- [ ] T073 [H3] Hacer pasar T065–T069; `pnpm --filter admin lint typecheck test` y `pnpm exec playwright test --project=admin publicacion programacion permisos`. Verificar que no se llama a ningún endpoint de revalidación desde el admin (D19).

**Punto de control**: el flujo escribir → publicar → ver en el sitio funciona de punta a punta (H1 + H2 + H3 = MVP del panel).

---

## Fase 6: Historia 4 - Encontrar artículos en el panel (Prioridad: P2)

**Objetivo**: Lista de todos los artículos con filtros combinables por estado, categoría y autor, búsqueda por título y paginación, reflejados en la dirección.

**Prueba independiente**: Con los datos de demo, filtrar por "programado" y obtener exactamente los programados; buscar por una palabra del título ([quickstart.md](quickstart.md) D).

### Tests de la Historia 4 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T074 [P] [H4] Crear `apps/admin/src/lib/filtros.test.ts` (RF-016, RF-017): `leerFiltros(searchParams)` valida con Zod (`estado`, `categoria` uuid, `autor` uuid, `q` ≤ 100 caracteres, `pagina` entero ≥ 1 con 1 por defecto) e ignora valores inválidos; `aSearchParams(filtros)` omite los vacíos y es inverso de `leerFiltros`.
- [ ] T075 [P] [H4] Crear `e2e/admin/lista-articulos.spec.ts` (H4-E1 a E4, CE-007): la lista muestra todos los estados y autores ordenados por última modificación, con el estado distinguible por texto además del color; filtrar por estado, categoría y autor (combinados) deja solo los que cumplen todo y la dirección conserva el filtro (recargar y abrir en otra pestaña da lo mismo); buscar una palabra del título con y sin tildes ni mayúsculas; sin coincidencias → estado vacío con "Quitar filtros"; paginación de 20 (con más de 20 artículos de prueba); una página fuera de rango vuelve a la 1; la navegación entre pantallas tarda menos de 1 s con los datos de demo.

### Implementación de la Historia 4

- [ ] T076 [P] [H4] Crear `apps/admin/src/lib/filtros.ts` (`leerFiltros`, `aSearchParams`) y `apps/admin/src/consultas/articulos.ts` (`listarArticulosDelPanel(filtros)`: crea el cliente de sesión y llama a `listarArticulosPanel`; si hay 0 filas con `pagina > 1`, repite con la página 1).
- [ ] T077 [H4] Crear `apps/admin/src/componentes/articulo/TablaArticulos.tsx` (título que enlaza al editor, `Badge` de estado con texto, autor, categoría, fecha relevante con `FechaLocal`: programada o de publicación o de modificación, y paginación accesible) y `FiltrosArticulos.tsx` (formulario `GET` con estado, categoría, autor y búsqueda; el botón "Quitar filtros" limpia la dirección).
- [ ] T078 [H4] Crear `apps/admin/src/app/(panel)/articulos/page.tsx` (Server Component: `await searchParams`, `leerFiltros`, `listarArticulosDelPanel`, selectores de categorías y autores, botón "Nuevo artículo", estado vacío, `h1` y `title`). Leer `01-app/03-api-reference/03-file-conventions/page.md` para la forma de `searchParams` en Next 16.
- [ ] T079 [H4] Hacer pasar T074–T075; `pnpm --filter admin lint typecheck test` y `pnpm exec playwright test --project=admin lista-articulos`.

---

## Fase 7: Historia 5 - Gestionar categorías y etiquetas (Prioridad: P2)

**Objetivo**: Crear, renombrar, cambiar el slug, describir y eliminar categorías y etiquetas, viendo cuántos artículos tiene cada una.

**Prueba independiente**: Crear una categoría, asignarla a un artículo publicado, renombrarla y ver el nombre en el sitio; intentar eliminarla y recibir el rechazo por estar en uso ([quickstart.md](quickstart.md) E).

### Tests de la Historia 5 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T080 [P] [H5] Crear `apps/admin/src/acciones/taxonomias.test.ts` (integración; H5-E1 a E5): crear con nombre nuevo devuelve el slug sugerido; nombre repetido devuelve `validacion` con el mensaje "Ya existe …"; eliminar una categoría con artículos devuelve `categoria_en_uso` con el conteo en el detalle; eliminar una etiqueta con artículos la quita de ellos sin afectar nada más; cambiar el slug con artículos publicados devuelve `avisoRedireccion: true` y la redirección queda registrada; un anónimo recibe `no_autenticado`.
- [ ] T081 [P] [H5] Crear `e2e/admin/taxonomias.spec.ts` (H5-E1 a E5, RF-019): crear una categoría y asignarla en el editor; renombrarla y ver el nombre nuevo en el sitio (en menos de 60 s); intentar crear un nombre repetido; intentar eliminar una categoría en uso (mensaje con el número de artículos); eliminar una etiqueta con confirmación; cambiar el slug de una con artículos publicados muestra antes el aviso de que la dirección pública cambia y la anterior seguirá redirigiendo, y la URL vieja del sitio responde 301.

### Implementación de la Historia 5

- [ ] T082 [H5] Crear `apps/admin/src/acciones/taxonomias.ts` (`'use server'`): `crearTaxonomiaAccion`, `actualizarTaxonomiaAccion` (devuelve `avisoRedireccion` si cambia el slug y hay artículos publicados) y `eliminarTaxonomiaAccion` según [contracts/acciones.md](contracts/acciones.md#taxonomías-accionestaxonomiasts). Nombre duplicado (`slug_duplicado`/violación única) → `validacion` "Ya existe una categoría/etiqueta con ese nombre".
- [ ] T083 [P] [H5] Crear `apps/admin/src/componentes/taxonomia/GestorTaxonomias.tsx` (componente de cliente reutilizado por las dos pantallas, con la prop `tipo`): tabla con nombre, slug, descripción y número de artículos; alta, edición en línea o diálogo, y baja con `ConfirmarAccion`; antes de guardar un cambio de slug en una taxonomía con artículos publicados muestra el aviso de RF-019; slug sugerido mientras se escribe el nombre (`previsualizarSlugAccion`).
- [ ] T084 [H5] Crear `apps/admin/src/app/(panel)/categorias/page.tsx` y `apps/admin/src/app/(panel)/etiquetas/page.tsx` (Server Components que leen con `listarTaxonomiasConConteo` y renderizan `GestorTaxonomias`; `h1` y `title` propios).
- [ ] T085 [H5] Hacer pasar T080–T081; `pnpm --filter admin lint typecheck test` y `pnpm exec playwright test --project=admin taxonomias`.

---

## Fase 8: Historia 6 - Gestionar el equipo y el perfil propio (Prioridad: P2)

**Objetivo**: El admin invita a miembros por correo, reenvía invitaciones, cambia roles, desactiva y reactiva; cualquier miembro edita su perfil.

**Prueba independiente**: Como admin, invitar a un editor, abrir el correo, definir la contraseña y comprobar que ingresa; desactivarlo; intentar degradar al único admin ([quickstart.md](quickstart.md) F).

### Spike (antes de escribir las acciones)

- [ ] T086 [H6] Spike de D6, con Supabase local y `SUPABASE_SERVICE_ROLE_KEY`: con un script descartable en el directorio temporal (no en el repo) comprobar (1) que `inviteUserByEmail` crea el usuario, dispara `crear_perfil` (inactivo) y que `updateUserById({ app_metadata: { rol } })` activa el perfil con ese rol (trigger de T063 de la 001); (2) que `listar_equipo` lo muestra como `invitado`; (3) que `inviteUserByEmail` sobre una cuenta **aún no confirmada** reenvía el correo con un token nuevo y deja inválido el anterior. Si (3) falla, probar `generateLink({ type: 'invite' })` o `resetPasswordForEmail` y anotar la alternativa elegida en research.md D6 y en [contracts/acciones.md](contracts/acciones.md#equipo-accionesequipots--solo-admin) antes de seguir.

### Tests de la Historia 6 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T087 [P] [H6] Crear `apps/admin/src/acciones/equipo.test.ts` (integración con la base local; H6-E1 a E5): `invitarMiembro` crea el miembro como `invitado` con el rol pedido; un correo ya existente devuelve `validacion` "Ese correo ya pertenece al equipo"; `reenviarInvitacion` solo funciona sobre `acceso = 'invitado'`; `cambiarRolAccion` y `cambiarActivoAccion` devuelven `ultimo_admin` sobre el único admin activo (incluido a sí mismo); un editor recibe `sin_permiso` en todas; la clave de servicio no aparece en ningún resultado devuelto.
- [ ] T088 [P] [H6] Crear `apps/admin/src/acciones/perfil.test.ts` (H6-E7, E8): `guardarPerfil` actualiza nombre, biografía y avatar válido; el esquema descarta `rol` y `activo` enviados a propósito y la base los rechaza igual; un avatar sin `alt` y sin `decorativa` devuelve `contenido_invalido`; al cambiar o quitar el avatar se aplica el borrado de imágenes sin uso (D11).
- [ ] T089 [P] [H6] Ampliar `apps/admin/src/lib/plantillas.test.ts` con `supabase/templates/invitacion.html`: contiene `{{ .TokenHash }}`, `type=invite`, `{{ .SiteURL }}/auth/confirmar`, el saludo con el nombre, el aviso de un solo uso y 24 horas, y ningún enlace a otro dominio.
- [ ] T090 [P] [H6] Crear `e2e/admin/equipo-invitacion.spec.ts` (H6-E1 a E3, casos borde): el admin invita a un editor nuevo (correo único por corrida) → aparece "invitado" y llega el correo a Mailpit → abre el enlace, "Continuar", define la contraseña → ingresa y es editor; reenviar la invitación hace que el enlace anterior ya no sirva y el nuevo sí; invitar un correo existente se rechaza con mensaje claro; desactivar a un invitado antes de que acepte → define su contraseña pero no accede (lo expulsa con "cuenta desactivada"); el enlace usado o vencido indica pedirle al admin que reenvíe la invitación.
- [ ] T091 [P] [H6] Crear `e2e/admin/equipo.spec.ts` (H6-E4 a E6): el admin cambia el rol de un editor a admin y de vuelta; desactiva y reactiva (con confirmación al desactivar) y el efecto se ve en la lista y en lo que el miembro puede hacer desde su siguiente acción; intentar degradar o desactivar al único admin (incluido él mismo) muestra el mensaje de que siempre debe quedar un admin activo; un editor no ve "Equipo" en la navegación y `/equipo` responde con "No tienes permiso".
- [ ] T092 [P] [H6] Crear `e2e/admin/perfil.spec.ts` (H6-E7, E8): un miembro edita nombre, biografía y foto (con texto alternativo) y guarda; si tiene artículos publicados, el cambio se ve en `/blog/autor/<slug>` del sitio en menos de 60 s; el formulario no ofrece rol ni estado.

### Implementación de la Historia 6

- [ ] T093 [P] [H6] Crear `supabase/templates/invitacion.html` según [contracts/correos.md](contracts/correos.md#plantillas) (asunto "Te invitaron al panel del blog", saludo con el nombre, enlace con `type=invite`) y registrarla en `supabase/config.toml` como `[auth.email.template.invite]`.
- [ ] T094 [H6] Crear `apps/admin/src/lib/servicio.ts` (`import 'server-only'`; lee `SUPABASE_SERVICE_ROLE_KEY` y devuelve `crearClienteAdmin`) y `apps/admin/src/acciones/equipo.ts` (`'use server'`): `invitarMiembro`, `reenviarInvitacion` (según el resultado del spike T086), `cambiarRolAccion` y `cambiarActivoAccion`, según [contracts/acciones.md](contracts/acciones.md#equipo-accionesequipots--solo-admin). Cada una llama a `obtenerMiembro()` y `puede(rol, 'equipo.gestionar')` **antes** de crear el cliente de servicio. Si falla el paso 2 de la invitación, informa que el miembro quedó invitado sin rol y que puede reenviar.
- [ ] T095 [P] [H6] Crear `apps/admin/src/acciones/perfil.ts` (`guardarPerfil`; ver contrato) con Zod que solo admite `nombre` (1 a 80), `biografia` (≤ 500) y `avatar` (`esquemaImagen` o `null`).
- [ ] T096 [P] [H6] Crear `apps/admin/src/componentes/equipo/TablaEquipo.tsx` (nombre, correo, rol, estado con `Badge` y texto: invitado, activo, desactivado; acciones por fila: cambiar rol, desactivar o reactivar con `ConfirmarAccion`, reenviar invitación solo si es invitado) y `FormularioInvitacion.tsx` (nombre, correo, rol).
- [ ] T097 [H6] Crear `apps/admin/src/app/(panel)/equipo/page.tsx` (`puede(rol, 'equipo.ver')` o `forbidden()`; lee `listarEquipo`) y `apps/admin/src/app/(panel)/perfil/page.tsx` + `componentes/perfil/FormularioPerfil.tsx` (nombre, biografía y foto con `SelectorImagen`, sin rol ni estado).
- [ ] T098 [H6] Hacer pasar T087–T092; `pnpm --filter admin lint typecheck test` y `pnpm exec playwright test --project=admin equipo perfil`.

---

## Fase 9: Validación y cierre

**Propósito**: Permisos completos, casos borde, accesibilidad, responsive, calidad, documentación, gates y despliegue.

- [ ] T099 [P] Ampliar `e2e/admin/permisos.spec.ts` (CE-002): recorrer **todas** las filas de la tabla de permisos de la spec para anónimo, editor y admin, tanto por la interfaz como por intento directo (llamar a la Server Action o a la API de Supabase con la sesión del editor y comprobar que la base rechaza lo que la interfaz oculta); un miembro desactivado se comporta como anónimo en cada fila.
- [ ] T100 [P] Crear `e2e/admin/casos-borde.spec.ts` (casos borde de la spec): sesión vencida mientras se escribe (forzando la cookie de actividad) → aviso, cierre de sesión y descarte; subida fallida; guardar sobre un programado que se publicó mientras estaba abierto; autor desactivado (el artículo sigue editable); quitar todas las etiquetas de un publicado; slug manual repetido (se muestra el slug final con sufijo); quitar todos los bloques de un publicado y volver a publicar se rechaza.
- [ ] T101 [P] Crear `e2e/admin/accesibilidad.spec.ts` (CE-006, RF-025): con `@axe-core/playwright` (`wcag2a`, `wcag2aa`, `wcag21aa`), cero violaciones en `/ingreso`, `/articulos`, el editor con los 10 bloques, la vista previa, `/categorias`, `/equipo` y `/perfil`; un único `h1` por pantalla; recorrer cada pantalla solo con teclado, incluida la reordenación de bloques con "subir/bajar"; sin desborde horizontal en 360, 768, 1024 y 1440 px.
- [ ] T102 Ejecutar `pnpm formato && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm calidad && pnpm build && pnpm test:e2e`. Corregir lo que falle. knip no debe reportar exports ni dependencias muertas en `apps/admin` ni `packages/*`; jscpd ≤ 3 % (cuidar la duplicación entre los diez editores de bloques y entre `GestorTaxonomias` de categorías y etiquetas). Buscar colores y medidas literales (`#[0-9a-f]{3,8}`, `oklch(`, `rgb(`, `[0-9]+px`) en `apps/admin/src`: ninguno fuera de `tokens.css` (§VII.2).
- [ ] T103 Recorrer [quickstart.md](quickstart.md) (A a F) y confirmar cada resultado esperado; corregir el quickstart si algo cambió. Medir Lighthouse (Accesibilidad ≥ 95) en `/ingreso`, `/articulos`, el editor y `/equipo` en 360, 768, 1024 y 1440 px (CE-006) y la navegación < 1 s (CE-007); anotar las mediciones en `validacion.md`.
- [ ] T104 Ejecutar `/validar` (`arquitecto-db`, `revisor-ux-ui` y `consistencia-codigo`, que debe confirmar las dependencias de T002) y resolver todos los BLOQUEANTES en `specs/003-panel-admin/validacion.md`.
- [ ] T105 Actualizar `CLAUDE.md`: estado de la spec 003, las dos funciones `definer` nuevas como advisors intencionales, la regla de que `service_role` solo vive en `apps/admin/src/lib/servicio.ts`, el comando para correr los E2E del panel y los pendientes manuales de la nube (clave de servicio y `NEXT_PUBLIC_URL_ADMIN` en Vercel `blog-admin`, URL del sitio y plantillas de Auth, SMTP propio). Si hace falta, enmienda PARCHE de la constitución para registrar el subpath `@blog/db/servidor`.
- [ ] T106 Nube y producción ([quickstart.md](quickstart.md#pasos-manuales-para-la-nube-a-cargo-del-usuario)), después del merge a `main` y **a cargo del usuario**: aplicar `20261021120000_panel_admin.sql` (alinear antes el historial con `supabase migration repair`, ver CLAUDE.md), cargar las variables en Vercel, ajustar *Site URL* y *Redirect URLs* de Auth, subir las plantillas y configurar el SMTP; probar el recorrido F en producción con una cuenta real y anotar el resultado en `validacion.md`.

---

## Dependencias y orden de ejecución

### Entre fases

- **Preparación (F1)** → **Fundacional (F2)** → historias → **Validación (F9)**.
- T001 antes de T002; T002 antes de T009 y de cualquier código que importe `@supabase/ssr` o shadcn.
- Dentro de F2: tests (T010–T022) antes de la implementación; T023 → T024 antes de T026–T029 y de los tests de integración; T027 y T028 antes de T033–T036; T034 antes de T035 y T036.
- **H1 (P1)** solo depende de F2. Es el MVP del acceso.
- **H2 (P1)** depende de F2 y H1 (necesita sesión para probar). Sus E2E usan los asistentes de T008.
- **H3 (P1)** depende de H2 (`EditorArticulo`, `AccionesEstado` se integra en él).
- **H4 (P2)** depende de F2 y H2 (enlaza al editor); los tests de `filtros` no dependen de nada.
- **H5 (P2)** depende de F2; usa `previsualizarSlugAccion` de H2 (T054).
- **H6 (P2)** depende de F2 y H1 (plantillas y `/auth/confirmar` de la recuperación). T086 (spike) antes de T094.
- **No hay PR ni merge a `main` sin H1 a H3**: son el alcance mínimo de "autoadministrable" (spec, Contexto). H4 a H6 pueden entrar en el mismo PR o en uno siguiente, según el tiempo.

### Archivos compartidos (hacer en secuencia)

- `apps/admin/src/acciones/articulos.ts` y su test: T048/T054 → T065/T070.
- `apps/admin/src/componentes/editor/EditorArticulo.tsx`: T061 → T072 (integra `AccionesEstado`).
- `packages/db/src/index.ts`: T026, T027, T028, T029.
- `packages/bloques/src/index.ts`: T030, T031, T032.
- `apps/admin/src/lib/plantillas.test.ts`: T040 → T089.
- `e2e/admin/permisos.spec.ts`: T069 → T099.
- `supabase/config.toml`: T025 → T043 → T093.

### Dentro de cada historia

Tests (rojo) → datos y lógica pura en `packages/*` → acciones → componentes → páginas.

## Ejemplos de ejecución en paralelo

**Fundacional, tests** (todos [P], archivos distintos): T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021 y T022.

**Fundacional, implementación** (después de T023–T024): T025, T026, T027, T028, T030, T031, T032, T033, T037 y T038 en paralelo; T029 después de T028; T034 → T035 → T036.

**H2**: T048–T053 en paralelo; T056, T057, T058 y T060 en paralelo; después T059, T061, T062 y T063.

**H3**: T065–T069 en paralelo; T071 en paralelo con T070; T072 al final.

**H4 + H5** (si hay dos personas): H4 (T074–T079) y H5 (T080–T085) en paralelo después de H2.

**H6**: T087–T092 en paralelo tras el spike T086; T093, T095 y T096 en paralelo; T094 antes de T097.

## Estrategia

- **MVP primero**: F1 + F2 + H1 + H2 + H3. Un editor ingresa, escribe un artículo con bloques e imágenes, lo publica y lo ve en el sitio. Es el punto de control para mostrar el panel a un cliente.
- **Incremental**: H4 (encontrar artículos con volumen) → H5 (adaptar categorías y etiquetas) → H6 (altas de equipo y perfil). Cada historia suma valor sin romper las anteriores.
- **Correo**: en local se prueba todo con Mailpit; en la nube las invitaciones solo llegan a miembros de la organización de Supabase hasta que el usuario configure el SMTP propio (T106).
- **Con Docker**: los pgTAP, los Vitest de integración y los E2E necesitan Supabase local (`pnpm db:start`). Sin Docker se pueden avanzar solo las funciones puras (T012–T016, T018–T022, T027, T030–T033, T037, T038, T056, T060, T066, T071, T074, T076).

## Notas

- Commit por tarea o grupo lógico (Conventional Commits en español, por ejemplo `feat(admin): agrega el editor de bloques`).
- Cada tarea de test la escribe el agente `escritor-tests` a partir de los criterios de aceptación de la spec y debe verse fallar antes de implementar.
- Si el `/speckit-analyze` encuentra huecos entre spec, plan y tareas, se corrigen en estos archivos antes de empezar a implementar.
