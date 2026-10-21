# Plan de implementación: Panel de administración

**Rama**: `003-panel-admin` | **Fecha**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/003-panel-admin/spec.md`

## Resumen

El panel (`apps/admin`, Next.js 16) deja a un editor escribir, publicar, programar y archivar artículos con bloques, administrar categorías y etiquetas, y a un admin gestionar el equipo, sin ayuda técnica. **Casi todas las reglas ya existen**: la spec 001 dejó en `@blog/db` las operaciones de escritura con bloqueo optimista, las transiciones de estado, la programación, las taxonomías y los roles, y la spec 002 muestra el resultado en el sitio con invalidación automática. Este plan agrega solo lo que falta:

1. **Sesión y permisos** con cookies de `@supabase/ssr` (fábrica en `@blog/db`), vencimiento por inactividad de 8 h en la app, y una matriz `puede(rol, accion)` pura.
2. **Editor de bloques** de cliente con operaciones puras en `@blog/bloques`, validación con el esquema único y errores por bloque y campo.
3. **Subida de imágenes** directa a Storage con URL firmada, verificada después en el servidor (tipo y dimensiones reales, sin dependencias).
4. **Una migración chica**: bucket sin GIF, un índice y tres funciones de lectura (lista del panel, equipo con correo, rutas de imagen en uso).
5. **Correos de invitación y recuperación** por Supabase Auth, con plantillas en español y SMTP propio en la nube.
6. **UI con shadcn/ui** sobre los tokens de `@blog/ui`, vista previa con los renderers de la 002 y todo marcado `noindex`.

El admin **no** invalida la caché del sitio: lo hacen los triggers de la base (D19).

## Contexto técnico

**Apps / paquetes afectados**: `apps/admin` (casi todo el trabajo), `packages/db` (cliente de servidor, permisos, lecturas del panel, `urlImagen` movida desde `apps/web`), `packages/bloques` (operaciones del editor, `detectarImagen`, `rutasDeImagenes`), `packages/ui` (solo si falta algún token), `apps/web` (solo importar `urlImagen` desde `@blog/db` (6 imports)), `supabase/` (migración, plantillas de correo, `config.toml`), `e2e/admin`.

**Dependencias nuevas**:
- `@supabase/ssr` 0.12 en `packages/db`: **ya aprobada** en la tabla de §II.
- En `apps/admin`: `zod@4.6.7` (del stack, misma versión que `@blog/db`), `@radix-ui/react-alert-dialog` y `@radix-ui/react-slot`, `class-variance-authority`, `clsx@2.1.1` y `tailwind-merge`: lo mínimo de shadcn/ui, exigido por §II ("UI admin: shadcn/ui"). Justificación en research D17. **Aprobadas por `consistencia-codigo` en la revisión del plan (2026-10-21)**, con las versiones fijadas respetando `minimumReleaseAge`. Se descarta `lucide-react` (íconos como SVG en línea) y el paquete paraguas `radix-ui`; `select` y `checkbox` son nativos. No se agrega `server-only`.
- Nada más: ni editor de texto enriquecido, ni librería de imágenes, ni cliente de correo (D10, D12, D8).

**Almacenamiento**: bucket `medios` (se restringe a JPEG, PNG, WebP y AVIF). Sin tablas nuevas. Funciones nuevas: `listar_articulos_panel`, `listar_equipo`, `rutas_en_uso`, `privado.sin_tildes`.

**Rutas públicas afectadas**: ninguna se modifica. Cambia el origen de `urlImagen` (refactor sin efecto, cubierto por sus tests de `apps/web`); `imagenes.ts` se queda en web con lo que depende de `astro:assets`.

**Rutas admin afectadas**: `/ingreso`, `/olvide-contrasena`, `/auth/confirmar`, `/definir-contrasena`, `/salir`, `/articulos` (+ `nuevo`, `[id]`, `[id]/vista-previa`), `/categorias`, `/etiquetas`, `/equipo`, `/perfil`, `/robots.txt` (contracts/rutas.md).

**Revalidación**: ninguna desde el admin; el aviso firmado de la base (001/002) ya cubre artículos, taxonomías y autores. Se verifica con CE-003.

**Metas de rendimiento**: navegación entre pantallas < 1 s con los datos de demo (CE-007); Lighthouse de Accesibilidad ≥ 95 en las pantallas del panel (CE-006). El panel no tiene metas de SEO: es `noindex`.

## Verificación constitucional

*GATE: debe pasar antes de la Fase 0 y volver a verificarse después del diseño (Fase 1).*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado (sin deps no aprobadas) | [x] con condición | `@supabase/ssr` ya está en la tabla; las dependencias de shadcn/ui son las que §II exige y quedan sujetas a la aprobación de `consistencia-codigo` |
| III. Límites de arquitectura (sin imports entre apps, datos vía packages/db) | [x] | El cliente con sesión sale de `@blog/db/servidor` y el de `service_role` de `@blog/db/servicio` (subpaths fuera del índice); `apps/web` no importa ninguno. La lógica de permisos, bloques e imágenes es pura y vive en `packages/*` |
| IV. SEO primero (pre-render, JS mínimo, metadatos) | [x] | No aplica a `apps/admin`; el panel es `noindex` en tres capas (D20). `apps/web` no cambia |
| V. Datos (migraciones, RLS + pgTAP, nomenclatura en español) | [x] | Una migración versionada, sin tablas nuevas, sin cambios de RLS; funciones con privilegios explícitos y pgTAP. Revisado por `arquitecto-db` (ver data-model) |
| VI. Bloques (esquema único en packages/bloques) | [x] | El editor y el servidor usan `validarContenido`; no hay esquema paralelo. Las 4 marcas en línea son las de D9 de la 001 |
| VII. Design system (solo tokens, WCAG AA) | [x] | Tokens de `@blog/ui`; `Button` reutiliza `clasesBoton`. Excepción acotada: el HTML de los correos lleva colores en línea (contracts/correos.md) |
| VIII. No duplicación (sección Reutilización completa) | [x] | Ver la sección siguiente |
| IX. Testing (cada criterio de aceptación → test) | [x] | Plan de pruebas abajo; lógica pura test-first |

**Re-verificación tras el diseño (Fase 1)**: sin cambios. Nada del diseño agrega una excepción. Queda la **condición** de §II (aprobación de dependencias), registrada como tarea de la fase 0 de `tasks.md`.

## Reutilización *(obligatorio — constitucion.md §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Crear/editar/estado/eliminar artículos con versión | `crearArticulo`, `actualizarArticulo`, `cambiarEstado`, `eliminarArticulo`, `previsualizarSlug` (`packages/db/src/consultas/equipo-articulos.ts`) | — | Ya cubren RF-004, RF-008, RF-009, RF-012, RF-013 |
| Taxonomías y etiquetas de un artículo | `crearTaxonomia`, `actualizarTaxonomia`, `eliminarTaxonomia`, `asignarEtiquetas` (`equipo-taxonomias.ts`) | Lecturas con conteo: `listarTaxonomiasConConteo` en `packages/db/src/consultas/panel.ts` | Las lecturas del equipo no existían (solo las públicas) |
| Perfil y equipo | `actualizarPerfilPropio`, `cambiarRol`, `cambiarActivo` (`equipo-perfiles.ts`) | `listarEquipo` (RPC `listar_equipo`) | Hace falta el correo y el estado de acceso, que `perfiles` no tiene |
| Leer el perfil propio y la lista de autores del filtro | `Perfil` (`packages/db/src/consultas/equipo-perfiles.ts`) | `obtenerPerfilPropio`, `listarAutores` en `packages/db/src/consultas/panel.ts` | Las lecturas del equipo no existían y la app no puede consultar tablas (§III.2) |
| Storage del bucket `medios` y Auth Admin | políticas `medios_*_equipo` (001) | `crearSubidaFirmada`, `descargarMedio`, `borrarMedios` en `packages/db/src/medios.ts`; `invitarMiembroPorCorreo`, `reenviarInvitacionPorCorreo` en `packages/db/src/servicio.ts` | §III.2: todo acceso a datos pasa por `@blog/db`; las acciones solo orquestan |
| Errores de dominio | `ErrorDominio`, `traducirError`, `CodigoError` (`errores.ts`) | `mensajeDeError` en `apps/admin/src/lib/mensajes.ts` | Es presentación en español; no pertenece a la capa de datos |
| Validación de bloques e imagen | `validarContenido`, `esquemaImagen`, `validarImagen` | — | Se usan igual en cliente y servidor |
| Crear un bloque vacío | `crearBloque` (`packages/bloques/src/utilidades.ts`) | `agregarBloque`, `moverBloque`, `duplicarBloque`, `quitarBloque`, `actualizarBloque` en `packages/bloques/src/operaciones.ts` | Operaciones de lista que el sitio nunca necesitó |
| Texto plano de bloques | `textoPlano` | — | Se usa para mostrar "tu texto sin guardar" tras un conflicto (D13) |
| Marcas en línea del editor | las 4 marcas de D9 (001) y `TextoEnLinea` (render) | `aplicarMarca` en `packages/bloques/src/marcas.ts` | El formato en línea lo define `@blog/bloques`; el editor y el renderer comparten su dueño |
| Renderizar el artículo (vista previa) | `Bloques` y `ComponentesBloques` de `@blog/bloques/render` | Componente `Imagen` del admin (`<img>`) | Cada app decide cómo muestra sus imágenes (contrato de la 002) |
| URL pública de una imagen | `urlImagen(ruta, supabaseUrl)` (hoy en `apps/web/src/lib/imagenes.ts`, usada en `AvatarAutor.astro`, `Seo.astro`, `TarjetaArticulo.astro`, `blog/[slug].astro` y `json-ld.ts`) | — (se **mueve solo esa función**, con su test, a `packages/db/src/medios.ts`; `imagenes.ts` conserva `precalcularVariantes` y `CALIDAD_IMAGEN`, que importan `astro:assets`) | Web y admin la necesitan; §VIII.3: una lógica usada en dos lugares se extrae |
| Botón | `clasesBoton` (`@blog/ui/clases`) | `Button` shadcn que la compone | Una sola definición del botón |
| Tokens y tema | `@blog/ui/tokens.css`, `identidad` | — | `apps/admin/src/app/globals.css` ya los importa |
| Cliente Supabase | `crearClientePublico` (sin sesión) | `crearClienteServidor`, `crearClienteNavegador`, `crearClienteAdmin` en `packages/db/src/servidor.ts`, `navegador.ts` y `servicio.ts` (la clave de servicio, aparte) | El panel necesita sesión por cookies; `crearClientePublico` desactiva la persistencia |
| Permisos por rol | RLS y triggers de la 001 (verdad) | `puede`, `ACCIONES`, `transicionesDe` en `packages/db/src/permisos.ts` | Ocultar acciones y dar mensajes claros antes de ir a la base (§III.5) |
| Tipo y dimensiones de imagen | — | `detectarImagen` en `packages/bloques/src/imagen-archivo.ts`; `rutasDeImagenes` | No existe; pura y sin dependencia (D10) |
| Paginación | `Pagina`, `OpcionesPagina` (`packages/db/src/paginacion.ts`) | — | `listarArticulosPanel` devuelve `Pagina<FilaArticuloPanel>` |
| Vencimiento de sesión | — | `sesionVencida` en `apps/admin/src/lib/actividad.ts` | Política del panel; no existe en otra parte |
| Lista de pruebas de integración con base | `packages/db/src/pruebas/*` (clientes, datos, afirmaciones) | extender con ayudas de miembro desactivado/invitado | Evita rehacer el andamiaje de la 001 |

Duplicación esperada: el editor de cada tipo de bloque comparte estructura (campo + etiqueta + error); se resuelve con un componente `CampoBloque` y composición, no con diez copias (§VIII.2). `jscpd` ≤ 3 % lo vigila.

## Impacto en base de datos *(revisado por `arquitecto-db` — ver data-model.md)*

- **Migraciones**: `supabase/migrations/20261021120000_panel_admin.sql`.
- **Tablas/columnas**: ninguna nueva. Cambia `storage.buckets.allowed_mime_types` de `medios` (sin GIF).
- **Índices**: `articulos_actualizado_idx (actualizado_en desc, id)`.
- **Políticas RLS**: ninguna nueva ni modificada. Las funciones `invoker` respetan las existentes; `listar_equipo` y `rutas_en_uso` son `definer` con chequeo interno de rol.
- **Funciones / triggers / cron**: `privado.sin_tildes`, `public.listar_articulos_panel`, `public.listar_equipo`, `public.rutas_en_uso`. Sin triggers ni jobs nuevos.
- **Seed**: sin cambios (los tests crean y limpian su miembro desactivado e invitado).
- **Tests existentes a actualizar**: `supabase/tests/storage.test.sql:145` (ya no hay GIF) y `supabase/tests/privilegios.test.sql` (excepciones del barrido y `plan(132)`).
- **Después**: `pnpm db:tipos`; sumar las dos funciones `definer` a los advisors "intencionales" de CLAUDE.md.

## Impacto en UI y tokens *(revisar con agente revisor-ux-ui)*

- **Componentes nuevos**: `componentes/ui/` (Button, Input, Textarea, Label, Select, Checkbox, Badge, Table, AlertDialog de shadcn); `componentes/editor/` (`EditorArticulo`, `ListaBloques`, un editor por tipo de bloque sobre `CampoBloque`, `BarraMarcas`, `SelectorImagen`); `FiltrosArticulos`, `TablaArticulos`, `AccionesEstado`, `FechaLocal`, `EnlaceConAviso`, `ProveedorSalida`, `NavegacionPanel`.
- **Tokens nuevos**: previstos solo los semánticos que falten para estados de formulario (error, éxito, advertencia). Se revisa `packages/ui/src/tokens.css` antes de agregar cualquiera; todo valor nuevo entra primero como token (§VII.2).
- **Estados**: cada lista y formulario define vacío, carga, error y éxito (contracts/rutas.md, "Interfaz transversal").
- **Accesibilidad**: `h1` único por pantalla; foco inicial y devuelto en diálogos; `aria-invalid` y `aria-describedby` en errores; anuncios con `role="status"`/`"alert"`; reordenar con botones; áreas táctiles ≥ 44 px; `prefers-reduced-motion`; verificación en 360, 768, 1024 y 1440 px.

## Plan de pruebas

La lógica pura se escribe **test-first** (agente `escritor-tests`) antes de implementar.

| Criterio de aceptación (spec) | Tipo | Archivo de test |
|---|---|---|
| H1 · 1 ingreso correcto | Playwright | `e2e/admin/acceso.spec.ts` |
| H1 · 2 mensaje genérico y correo conservado | Playwright + Vitest | `e2e/admin/acceso.spec.ts`, `apps/admin/src/acciones/acceso.test.ts` |
| H1 · 3 desactivado no entra | Playwright | `e2e/admin/acceso.spec.ts` |
| H1 · 4 redirección y `volver` (solo rutas internas) | Playwright + Vitest | `e2e/admin/acceso.spec.ts`, `apps/admin/src/lib/volver.test.ts` |
| H1 · 5 cerrar sesión | Playwright | `e2e/admin/acceso.spec.ts` |
| H1 · 6 desactivado con sesión abierta | Playwright | `e2e/admin/acceso.spec.ts` |
| H1 · 7 recuperación (mismo mensaje, enlace de un uso) | Playwright (Mailpit) | `e2e/admin/acceso.spec.ts` |
| RF-028 contraseña de al menos 8 caracteres | Vitest | `apps/admin/src/acciones/acceso.test.ts` |
| H1 · 6 el desactivado queda sin sesión (`/salir`) | Playwright | `e2e/admin/acceso.spec.ts` |
| Sesión: 8 h de inactividad (RF-002, caso borde) | Vitest | `apps/admin/src/lib/actividad.test.ts` |
| H2 · 1 slug sugerido | Vitest + Playwright | `apps/admin/src/acciones/articulos.test.ts`, `e2e/admin/articulo-editor.spec.ts` |
| H2 · 2 agregar, reordenar, duplicar, quitar | Vitest + Playwright | `packages/bloques/src/operaciones.test.ts`, `e2e/admin/articulo-editor.spec.ts` |
| H2 · 3 contenido inválido señala bloque y campo | Vitest + Playwright | `apps/admin/src/lib/errores-campo.test.ts`, `e2e/admin/articulo-editor.spec.ts` |
| H2 · 4 subir imagen con ancho y alto; rechazos (GIF, SVG, > 5 MB, falso tipo) | Vitest + Playwright + pgTAP | `packages/bloques/src/imagen-archivo.test.ts`, `apps/admin/src/acciones/medios.test.ts`, `e2e/admin/medios.spec.ts`, `supabase/tests/panel_admin.test.sql` |
| H2 · 5 edición concurrente | Vitest + Playwright | `apps/admin/src/acciones/articulos.test.ts`, `e2e/admin/articulo-conflicto.spec.ts` |
| H2 · 6 aviso de cambios sin guardar | Playwright | `e2e/admin/articulo-editor.spec.ts` |
| H2 · 7 vista previa idéntica al sitio y solo equipo | Playwright | `e2e/admin/vista-previa.spec.ts` |
| H2 · 8 el autor no cambia al editar | Vitest (integración con base) | `apps/admin/src/acciones/articulos.test.ts` |
| H3 · 1 publicar y verlo en el sitio < 60 s (CE-003) | Playwright (admin → web) | `e2e/admin/publicacion.spec.ts` |
| H3 · 2 requisitos faltantes | Vitest + Playwright | `apps/admin/src/acciones/articulos.test.ts`, `e2e/admin/publicacion.spec.ts` |
| H3 · 3 y 4 programar y fecha no futura | Vitest + Playwright | `apps/admin/src/lib/fechas.test.ts`, `e2e/admin/programacion.spec.ts` |
| H3 · 5 cancelar programación | Playwright | `e2e/admin/programacion.spec.ts` |
| H3 · 6 archivar y volver a borrador | Playwright | `e2e/admin/publicacion.spec.ts` |
| H3 · 7 solo transiciones permitidas | Vitest | `packages/db/src/permisos.test.ts` (`transicionesDe`) |
| H3 · 8 eliminar solo admin con confirmación | Playwright + Vitest | `e2e/admin/permisos.spec.ts`, `packages/db/src/permisos.test.ts` |
| H4 · 1 a 4 lista, filtros, búsqueda, vacío | pgTAP + Playwright | `supabase/tests/panel_admin.test.sql`, `e2e/admin/lista-articulos.spec.ts` |
| H5 · 1 a 5 taxonomías | Vitest + Playwright | `apps/admin/src/acciones/taxonomias.test.ts`, `e2e/admin/taxonomias.spec.ts` |
| H6 · 1 y 2 invitación y reenvío | Playwright (Mailpit) + Vitest | `e2e/admin/equipo-invitacion.spec.ts`, `apps/admin/src/acciones/equipo.test.ts` |
| H6 · 3 correo duplicado | Vitest | `apps/admin/src/acciones/equipo.test.ts` |
| H6 · 4 y 5 cambiar rol, desactivar, último admin | Playwright | `e2e/admin/equipo.spec.ts` |
| H6 · 6 editor no ve ni abre `/equipo` | Playwright | `e2e/admin/permisos.spec.ts` |
| H6 · 7 y 8 perfil propio, sin rol ni estado | Vitest + Playwright | `apps/admin/src/acciones/perfil.test.ts`, `e2e/admin/perfil.spec.ts` |
| Casos borde: sesión vencida o desactivado al guardar, subida fallida, enlace usado, invitado desactivado | Playwright | `e2e/admin/casos-borde.spec.ts` |
| Borrado de imágenes sin uso (RF-007, clarificación) | Vitest + pgTAP | `packages/bloques/src/imagenes-en-uso.test.ts`, `supabase/tests/panel_admin.test.sql` |
| CE-002 matriz acción × rol completa | Vitest + Playwright | `packages/db/src/permisos.test.ts`, `e2e/admin/permisos.spec.ts` |
| CE-004 y CE-005 (contenido inválido, concurrencia) | Playwright | `e2e/admin/articulo-editor.spec.ts`, `e2e/admin/articulo-conflicto.spec.ts` |
| CE-001 un editor nuevo publica 5 bloques en menos de 5 minutos | prueba cronometrada con una persona (manual) | `validacion.md` |
| CE-006 y CE-007 accesibilidad y rendimiento | Playwright (+ axe vía `webapp-testing`) y medición manual | `e2e/admin/accesibilidad.spec.ts`, `validacion.md` |
| RSEO-001 y RSEO-002 `noindex` | Vitest + Playwright | `apps/admin/src/app/robots.test.ts`, `e2e/admin/seo.spec.ts` |
| RSEO-003 el panel no publica páginas propias | revisión en `/validar` | `validacion.md` |
| Plantillas de correo | Vitest | `apps/admin/src/lib/plantillas.test.ts` |
| Mensajes: cada `CodigoError` tiene texto | Vitest | `apps/admin/src/lib/mensajes.test.ts` |
| Funciones SQL, bucket y privilegios | pgTAP | `supabase/tests/panel_admin.test.sql`, `storage.test.sql`, `privilegios.test.sql` |

Los E2E de `apps/admin` y `apps/web` corren con los dos servidores (ya configurados en `playwright.config.ts`); los que prueban correo necesitan Mailpit de `supabase start`. `vitest` en `apps/admin` ya existe (`--passWithNoTests`); se agrega su configuración con el `globalSetup` de `@blog/db/pruebas/entorno` para las pruebas de integración con la base local.

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/003-panel-admin/
├── plan.md          # Este archivo
├── research.md      # Fase 0 (decisiones D1–D23)
├── data-model.md    # Fase 1 (migración y revisión de arquitecto-db)
├── quickstart.md    # Fase 1
├── contracts/       # Fase 1
│   ├── acciones.md  # Server Actions, resultados y mensajes
│   ├── rutas.md     # rutas, guardas, metadatos, variables de entorno
│   └── correos.md   # plantillas e invitación/recuperación
├── checklists/      # calidad de la spec
├── tasks.md         # Fase 2 (/speckit-tasks)
└── validacion.md    # Informe de /validar
```

### Código fuente (afectado por esta feature)

```text
apps/
├── web/src/lib/imagenes.ts          # conserva lo de astro:assets; importa urlImagen de @blog/db
└── admin/
    ├── next.config.ts               # sin cacheComponents; X-Robots-Tag
    └── src/                         # ver contracts/rutas.md ("Estructura de carpetas")
packages/
├── db/src/
│   ├── servidor.ts                  # crearClienteServidor  (subpath ./servidor)
│   ├── servicio.ts                  # crearClienteAdmin, invitarMiembroPorCorreo, reenviarInvitacionPorCorreo  (subpath ./servicio)
│   ├── navegador.ts                 # crearClienteNavegador (subida firmada)
│   ├── permisos.ts                  # ACCIONES, puede, transicionesDe
│   ├── medios.ts                    # urlImagen, rutaDeMedio, crearSubidaFirmada, descargarMedio, borrarMedios
│   ├── consultas/panel.ts           # listarArticulosPanel, listarEquipo, listarAutores, obtenerPerfilPropio, rutasEnUso, taxonomías con conteo
│   └── index.ts                     # exporta lo nuevo (menos lo de servidor)
├── bloques/src/
│   ├── operaciones.ts               # operaciones puras del editor
│   ├── marcas.ts                    # aplicarMarca (formato en línea del editor)
│   ├── imagen-archivo.ts            # detectarImagen
│   └── imagenes-en-uso.ts           # rutasDeImagenes(articulo)
└── ui/                              # tokens semánticos que falten (si hace falta)
supabase/
├── migrations/20261021120000_panel_admin.sql
├── templates/{invitacion,recuperacion}.html
├── config.toml                      # plantillas, otp_expiry, longitud mínima de contraseña
└── tests/{panel_admin.test.sql, storage.test.sql, privilegios.test.sql}
e2e/admin/                           # specs listadas en el plan de pruebas
```

**Decisión de estructura**: se mantienen los límites de §III. El admin solo orquesta (sesión, formularios, acciones); la lógica de dominio es pura y está en `packages/db` y `packages/bloques`; la base sigue siendo la fuente de verdad de permisos, estados y bloqueo de versión.

## Riesgos y puntos a verificar al implementar

| Riesgo | Mitigación |
|---|---|
| `inviteUserByEmail` sobre una cuenta no confirmada podría no reenviar el correo (D6) | Tarea de spike al inicio de H6, con el fallback documentado (`generateLink` o recuperación) |
| El plan gratuito de Supabase podría ofrecer `inactivity_timeout` (D3) | Se sigue con la cookie propia; si está, se suma como refuerzo |
| Dependencias de shadcn/ui rechazadas por `consistencia-codigo` | Fallback: elementos nativos y `<dialog>`, registrado como desviación en "Seguimiento de complejidad" |
| El renderer de bloques usa clases Tailwind que el admin no escanea | `@source` hacia `packages/bloques/src` y un E2E de vista previa que compara la presentación |
| Imágenes subidas y nunca guardadas quedan huérfanas | Aceptado en el MVP (D11); se anota para una spec de limpieza programada |
| SMTP propio sin configurar en la nube | Paso manual del usuario (quickstart); mientras tanto, las invitaciones solo llegan a miembros de la organización de Supabase |
| `NEXT_PUBLIC_*` y `service_role` mezcladas por error | el test de límites de T007 (`packages/db/src/limites.test.ts`) más `no-restricted-imports` en `apps/admin`; prohíbe `@blog/db/servicio` y `lib/servicio` fuera de las acciones, y `@blog/db/servidor`/`navegador` en `apps/web`. No se agrega `server-only` (paquete fuera de §II) |

## Seguimiento de complejidad

> Completar SOLO si la verificación constitucional tiene excepciones justificadas.

| Excepción | Por qué es necesaria | Alternativa simple descartada porque |
|---|---|---|
| Vencimiento por inactividad implementado en la app (D3) | El de Supabase no está en el plan gratuito de la nube | `jwt_expiry` corto no mide inactividad y cierra sesiones activas |
| Subida firmada en dos pasos y verificación posterior (D9) | Vercel limita el cuerpo a 4,5 MB y la spec permite 5 MB; el tipo declarado se puede falsear | Subir por una función rompe archivos válidos; subir sin verificar acepta tipos falsos |
| Filtro por título sin índice (`ilike '%…%'` sobre `privado.sin_tildes(titulo)`; excepción a §V.8) | Un índice B-tree no sirve para `%texto%`; hace falta `pg_trgm` (extensión que hoy no está en la tabla de §II) y para una demo con pocas decenas de artículos un recorrido es instantáneo | Agregar `pg_trgm` y un índice GIN ahora: suma una extensión al stack sin necesidad para el volumen del MVP. Se hace en una spec posterior (ya anotado en la 001), cuando el volumen lo pida |
| Colores en línea en el HTML de los correos | Los clientes de correo no cargan hojas de estilo ni variables CSS | Sin estilos, el correo sería ilegible; se toman los valores de `identidad` |
