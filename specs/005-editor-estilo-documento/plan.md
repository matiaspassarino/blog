# Plan de implementación: Editor de notas estilo documento

**Rama**: `005-editor-estilo-documento` | **Fecha**: 2026-10-22 (ampliado el mismo día con la constitución 2.0.0) | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/005-editor-estilo-documento/spec.md`

**Estado**: las Historias 1 a 3 están implementadas (T001–T069) sobre el formato de bloques y el editor anterior ya se retiró (T078). Este plan **amplía** el anterior: el documento pasa a ser lo que se guarda, con más formato, alineación, tablas, la conversión de lo existente y el corte en la nube. La revisión del plan anterior (`consistencia-codigo` y `revisor-ux-ui`, 2026-10-22) sigue incorporada; la de la ampliación está en "Revisión del plan".

## Resumen

El cuerpo del artículo se escribe en un **documento de texto enriquecido** hecho con **Tiptap** (sobre ProseMirror): lienzo con la tipografía del sitio, barra de herramientas, menú «/» e «Insertar», asa propia, modo elementos y **panel de propiedades**. Con la ampliación:

1. **Lo guardado es el documento** ([contracts/documento.md](contracts/documento.md)): JSON en forma canónica, validado contra una **lista permitida** (`esquemaDocumento`, Zod, en `packages/bloques`). El servidor y la base lo validan; el sitio lo dibuja con un renderer propio, sin Tiptap y sin HTML crudo (§VI).
2. **Más formato y tablas**: subrayado, tachado, resaltado, superíndice y subíndice; alineación de párrafos y títulos; tablas con celdas de varios párrafos y celdas combinadas (cinco extensiones oficiales más, D23).
3. **Conversión sin pérdida, de todo o nada**: un script de un solo uso reutiliza el conversor que ya existe (`bloquesADocumento`, con su ida y vuelta probada) y genera un SQL de una transacción que no cambia versiones ni avisa al sitio (D25). Una prueba de caracterización asegura que el sitio muestra y busca lo mismo que antes (D26).
4. **Corte coordinado en la nube** (RF-030): migración, conversión y merge en el mismo momento; hasta entonces todo se valida en local.

## Contexto técnico

**Apps / paquetes afectados**: `packages/bloques` (esquema, validación, normalización, renderer y conversión), `apps/admin` (editor, Server Actions, vista previa), `apps/web` (página de artículo: `Bloques` → `Documento`), `packages/db` (tipo `Contenido` → `Documento`), `packages/ui` (tokens del resaltado y de las tablas), `supabase/` (una migración, el seed y pgTAP).

**Dependencias de runtime** (solo en `apps/admin`, MIT, versión exacta **3.31.4**; detalle en [research.md D1 y D23](research.md#d23-extensiones-nuevas)):

| Paquete | Para qué | Estado |
|---|---|---|
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extensions`, `@tiptap/suggestion` | motor, extensiones base (con `underline`, `strike` y `link` ahora activos), historial, menú «/» | aprobados (2026-10-22), ya instalados (T040) |
| `@tiptap/extension-table` | tablas, selección de celdas, combinar y separar | **nueva, aprobada** (2026-10-22) |
| `@tiptap/extension-text-align` | alineación de párrafos y títulos | **nueva, aprobada** |
| `@tiptap/extension-highlight` | resaltado de un solo color | **nueva, aprobada** |
| `@tiptap/extension-subscript`, `@tiptap/extension-superscript` | subíndice y superíndice | **nuevas, aprobadas** |

Las cinco nuevas no tienen dependencias de runtime (solo *peers* `@tiptap/core` y, algunas, `@tiptap/pm`, en la misma versión) y su versión cumple `minimumReleaseAge`. `apps/web` **no** suma dependencias. **Dependencia de desarrollo**: `@types/node` en `@blog/bloques` (ya está en el stack, en `apps/admin`), para el script de conversión. Una regla `no-restricted-imports` de `@tiptap/*` en `packages/config/eslint.config.js` (desactivada en `apps/admin`) asegura que la librería no salga del panel.

**Almacenamiento**: `articulos.contenido` cambia de formato (migración `20261023120000_contenido_documento.sql`, ver [data-model.md](data-model.md)). Sin tablas, columnas, buckets ni políticas nuevas.

**Rutas públicas afectadas**: `/blog/[slug]` (renderer nuevo; misma estrategia de caché e invalidación). La búsqueda incluye las celdas de las tablas.

**Rutas admin afectadas**: `/articulos/nuevo`, `/articulos/[id]` y `/articulos/[id]/vista-previa`.

**Revalidación**: sin cambios. La conversión **no** avisa al sitio (D25); el corte se apoya en que las páginas cacheadas siguen sirviéndose (RF-030).

**Metas de rendimiento**: menú «/» e «Insertar» en menos de 200 ms con 50 elementos (CE-006); latencia de escritura < 100 ms con 200 elementos; peso adicional del editor ≤ 250 KB gzip incluidas las tablas y sin `yjs` en el cliente; Lighthouse Accesibilidad ≥ 95 en el editor (CE-004); en el sitio, las metas de §IV.8 con un artículo con tablas y los formatos nuevos (CE-009).

## Verificación constitucional

*GATE: debe pasar antes de la Fase 0 y volver a verificarse después del diseño (Fase 1).*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado (sin deps no aprobadas) | [x] | Tiptap figura en §II desde la 2.0.0. Las cinco extensiones nuevas están justificadas en D23 y **las aprobó `consistencia-codigo`** (2026-10-22) |
| III. Límites de arquitectura (sin imports entre apps, datos vía packages/db) | [x] | Esquema, validación, normalización, renderer y conversión en `packages/bloques`; Tiptap solo en `apps/admin`; el script de conversión no accede a datos (lee y escribe archivos) |
| IV. SEO primero (pre-render, JS mínimo, metadatos) | [x] | El sitio sigue pre-renderizado y sin JS nuevo; tablas semánticas; encabezados desde `h2`; CE-009 mide que no empeore |
| V. Datos (migraciones, RLS + pgTAP, nomenclatura en español) | [x] | Una migración con `search_path = ''`, nombres calificados y privilegios explícitos (con `execute` para las funciones del check); checks recreados `not valid` y validados; la conversión desactiva `a30`, `a90` y `z90_notificar_cambio`; pgTAP por función, por check y por la conversión. Revisado por `arquitecto-db` (D31) |
| VI. Documento (esquema único en packages/bloques) | [x] | `esquemaDocumento` es la lista permitida; extensiones, renderer, búsqueda e imágenes en uso se derivan de él y una prueba de contrato lo garantiza (D23); conversión con ida y vuelta y pgTAP (§VI.6) |
| VII. Design system (solo tokens, WCAG AA) | [x] | Cuatro tokens nuevos (resaltado y tabla) con contraste medido; subrayado distinto del enlace; tablas accesibles con desplazamiento propio |
| VIII. No duplicación (sección Reutilización completa) | [x] | Un solo esquema, un renderer, el conversor existente reutilizado para la conversión, los editores de campos reutilizados con un adaptador; `cuadricula` compartida por esquema, editor y renderer |
| IX. Testing (cada criterio de aceptación → test) | [x] | Ver "Plan de pruebas" (RF-001 a RF-030 y CE-001 a CE-010) |

**Re-verificación después del diseño (Fase 1)**: cumple. Las tres revisiones de la ampliación (CAMBIOS REQUERIDOS) están incorporadas en [research.md D31](research.md#d31-revisión-de-la-ampliación-2026-10-22), el [data-model.md](data-model.md) y los contratos.

## Reutilización *(obligatorio — constitucion.md §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Lista permitida del contenido | `esquema.ts` (`esquemaImagen`, campos de imagen, galería, llamada a la acción, video, cita, nivel, lenguaje) | `esquemaDocumento` en el mismo archivo; los esquemas de campos se **exportan** y los usan también el esquema de bloques de `conversion-anterior/` (sin copiar, D31 C1) | §VI.2: un solo esquema; los campos y sus mensajes no cambian |
| Validación y errores | `validar.ts` (`validarContenido`, `ErrorBloque`), `lib/errores-campo.ts`, `resumenDeErrores` y `nombreDeCampo` de `anuncios.ts` | `validarDocumento` y `ErrorElemento` con `id` | Mismo flujo de hoy, por elemento |
| Forma canónica | — | `normalizar.ts` (`normalizarDocumento`) | Abrir y guardar sin tocar no cambia nada (RF-012) |
| Conversión de lo existente | `documento/conversion.ts` (`bloquesADocumento`, `documentoABloques`, con su ida y vuelta probada), `en-linea.ts`, `parrafos.ts` | `conversion-anterior/` (movidos, no copiados) y `scripts/convertir-contenido.ts` | Reutiliza la gramática del sitio; se elimina tras el corte (D25) |
| Renderer del sitio | `render/Bloques.tsx`, `Galeria`, `Cta`, `Video`, `ImagenBloque`, `Codigo`, `Titulo`, `Cita`, `Lista`, `enlaces.ts`, `clases.ts`, `anclaDe` | `render/Documento.tsx`, `EnLinea.tsx`, `Tabla.tsx`; `Bloques`, `TextoEnLinea` y `Parrafo` se eliminan | Los componentes de elementos especiales y de texto se reutilizan con los `attrs` adaptados |
| Cuadrícula de tablas | — | `packages/bloques/src/tablas.ts` (`cuadricula`, `esRectangulo`, límites) | La usan el esquema (regularidad), el editor (combinar) y el renderer: una sola regla |
| Editores de campos | `bloques/Editor{Imagen,Galeria,Cta,Video,Cita,Codigo,Titulo,Lista}.tsx`, `EditorDeBloque`, `CampoBloque` | Adaptador `datosDeElemento`/`elementoDesdeDatos` para los ocho; `DatosDe<T>` y `CambiosDeElemento` | No se reescriben: reciben la forma de hoy (D31 C6) |
| Texto visible de un elemento | `textoPlano` de `utilidades.ts` (sobre bloques), `anclaDe` | `textoDeElemento` y `visibleDeDocumento` en `elementos.ts`; `visibleDeBloques` en `conversion-anterior/` | `ComparacionVersiones`, el resumen de errores y la verificación del script (sin JSX, D31 C2) |
| Imágenes en uso | `imagenes-en-uso.ts` (`rutasDeImagenes`, `rutasQuitadas`) y `public.rutas_en_uso` | Se adapta el recorrido en TS; la función SQL no cambia (busca en el texto del JSON) | — |
| Búsqueda | `privado.bloques_a_texto`, `privado.calcular_busqueda`, `documento_busqueda` | `privado.documento_a_texto` (reemplaza a `bloques_a_texto`) | Misma configuración, pesos y truncado |
| Esquema de ProseMirror en las pruebas | `documento/esquema-prueba.ts` (escrito a mano) | — | `comandos.test.ts` y `proteger.test.ts` pasan a `getSchema(extensiones)`; el archivo queda solo con los constructores (D31 C7) |
| Extensiones del editor | `extensiones.ts`, `ids.ts`, `proteger.ts`, `comandos.ts`, `acciones-elemento.ts`, `AsaDeElemento`, `MenuAcciones`, `menu-insercion.ts`, `MenuInsertar`, `BarraHerramientas`, `PropiedadesDelElemento`, `pegado.ts`, `limites.ts`, `mapa-errores.ts` (spec 005, H1–H3) | `documento/tablas.ts`, `BarraTabla.tsx` y `extensiones.test.ts` | Lo de las H1–H3 se adapta (D30); solo se crea lo propio de las tablas y la prueba de contrato |
| Menús con teclado, «Más», barra fija, avisos | `useMenuTeclado`, `MasAcciones`, `BarraEditor`, `AvisoEstado`, `ConfirmarAccion` (specs 004 y 005) | — | «Más formato» y el menú «Alineación» usan `useMenuTeclado` |
| Anuncios | `anuncios.ts` | Mensajes de tablas y formatos ([atajos.md](contracts/atajos.md)) | Un solo módulo puro |
| Íconos | `componentes/Icono.tsx` | subrayado, tachado, resaltado, superíndice, subíndice, cuatro alineaciones, tabla, filas, columnas, combinar y separar | Los que faltan |
| Seed y pgTAP | `seed.sql` (funciones `pg_temp.*`) y `supabase/tests/*` | `pg_temp.texto`, `pg_temp.tabla`; `contenido_documento.test.sql` y `conversion.test.sql` | Se adaptan las funciones de hoy |

## Impacto en base de datos

Ver [data-model.md](data-model.md). En resumen: `privado.contenido_valido` acepta solo el documento; `privado.tipos_elemento` y `privado.documento_tiene_contenido` nuevas; el check `articulos_requisitos_publicacion` y `a40_validar_estado` usan el requisito nuevo; `privado.documento_a_texto` reemplaza a `bloques_a_texto` en la búsqueda; el default de `contenido` pasa al documento vacío. La conversión no está en la migración: la aplica el SQL que genera el script (D25). **Se consulta a `arquitecto-db`** antes de cerrar el modelo (§X).

## Impacto en UI y tokens

- **Componentes**: [contracts/componentes.md](contracts/componentes.md) (incluida la sección de la ampliación); atajos, roles, foco y anuncios en [contracts/atajos.md](contracts/atajos.md).
- **Tokens** (`packages/ui/src/tokens.css`): nuevos `--color-resaltado` y `--color-resaltado-texto`; `--color-borde-tabla` y `--color-fondo-encabezado-tabla` como alias de tokens de hoy si cumplen 3:1 y 4,5:1 (contraste medido en `clases.test.ts`; el sitio no tiene modo oscuro). La selección de celdas usa `marca-suave` con `outline` de 2 px de marca (D31 U3). Los tres de la etapa anterior (`--container-panel-propiedades`, `--carril-asa`, `--alto-hoja-propiedades`) siguen.
- **Barra**: subrayado visible; «Alineación» como menú (`menuitemradio`) que muestra la vigente y no se oculta fuera de párrafos y títulos; «Más formato» (`menuitemcheckbox`) con tachado, resaltado, código, superíndice y subíndice; dentro de una celda, estilo, listas, alineación e «Insertar» `aria-disabled` con la razón; barra «Tabla» dentro de la barra fija, operable desde el modo elementos y con «Más» (D28, D29 y D31 U1, U5, U10 y U13).
- **Estados**: formato no disponible con código activo (`aria-disabled` y razón); tabla en el máximo (aviso); estructura de tabla no disponible por debajo de 768 px (texto visible, RF-029); pegado de una tabla que no cabe (aviso); error "La tabla no tiene contenido" al publicar.
- **Sitio**: `mark` con los tokens del resaltado; `u` distinto del enlace (aclaración del 2026-10-22); tabla dentro de una región con desplazamiento propio, alcanzable con el teclado y con nombre; alineación con utilidades de Tailwind.
- **Accesibilidad**: tablas con `caption` visible o nombre, `th scope="col"` y `headers`/`id` en las celdas combinadas; sin trampa de teclado en las tablas (`Esc`, anunciado y visible); anuncios de las acciones de tabla y de la selección de celdas; contraste del resaltado, del subrayado y de la selección de celdas, también en `forced-colors`.

## Plan de pruebas

Primero se escriben las pruebas de la lógica pura (rojo), como en la 004. La interacción se prueba con Playwright; no se agregan jsdom ni Testing Library (D16).

| Criterio (spec) | Tipo | Archivo de test |
|---|---|---|
| RF-022: la lista permitida acepta lo válido y rechaza nodos, marcas, atributos y claves de más, HTML y el formato anterior; mensajes por campo | Vitest | `packages/bloques/src/esquema.test.ts`, `validar.test.ts` |
| RF-012 (H5 esc. 4): forma canónica idempotente y estable al pasar por el editor | Vitest (propiedades) y Playwright (abrir y guardar sin tocar no sube la versión) | `normalizar.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| §VI.3: el esquema del editor coincide exactamente con la lista permitida | Vitest | `apps/admin/.../documento/extensiones.test.ts` |
| RF-023, CE-002 (H5 esc. 1 a 3): conversión sin pérdida, repetible, de todo o nada | Vitest | `conversion-anterior/*.test.ts`, `scripts/convertir-contenido.test.ts` (sobre el corpus, el seed anterior y casos que deben fallar) |
| RF-023, CE-002 (H5 esc. 2): el sitio muestra y busca lo mismo que antes (caracterización) | Vitest | `render/caracterizacion.test.tsx` contra `pruebas/salida-anterior.json` (se genera **antes** de cambiar el renderer) |
| RF-023: la conversión no cambia versión ni fecha, no encola avisos y se revierte entera si falla | pgTAP | `supabase/tests/conversion.test.sql` |
| RF-022, base: forma mínima, requisito de publicación, búsqueda con tablas, privilegios | pgTAP | `contenido_documento.test.sql`, `busqueda.test.sql`, `articulos_publicacion.test.sql`, `privilegios.test.sql` y los adaptados |
| RF-009 (H6 esc. 1 a 3): nueve formatos, combinaciones, exclusiones y `aria-disabled` con código | Vitest (esquema y normalización) y Playwright (barra, atajos `Mod+U`, `Mod+.`, `Mod+,`) | `esquema.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-024 (H6 esc. 4): alineación de párrafos y títulos, no ofrecida en el resto | Playwright | `e2e/admin/editor-documento.spec.ts` |
| RF-026, CE-008 (H6 esc. 5): el sitio muestra formatos, alineación y tablas; subrayado distinto del enlace (prueba visual); nada de HTML; sin JS (`javaScriptEnabled: false`); un solo `h1`; `forcedColors: 'active'`; CE-008 a 360 px también en el lienzo | Vitest (render estático) y Playwright | `render/documento.test.tsx`, `render/seguridad.test.tsx`, `e2e/web/articulo.spec.ts`, `e2e/web/accesibilidad.spec.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-015, D28 (H4 esc. 4 a 6, H6 esc. 6): pegado con formatos, sin colores, tablas dentro y fuera de los límites | Vitest (partir texto, tablas) y Playwright | `documento/pegado.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-025, RF-028 (H7 esc. 1 a 8): insertar, Tab, varios párrafos por celda, filas, columnas, combinar, separar, límites (descripción 150, celda 1000 sumando párrafos, 50 filas con Tab) y casos borde de celdas combinadas; barra «Tabla» desde el modo elementos; combinar con el dedo a 768 px (`hasTouch`); árbol de accesibilidad de la tabla en el editor | Vitest (`cuadricula`, reglas, esquema) y Playwright | `packages/bloques/src/tablas.test.ts`, `esquema.test.ts`, `documento/tablas.test.ts`, `e2e/admin/editor-tablas.spec.ts` (nuevo) |
| RF-029: por debajo de 768 px solo se escribe en las celdas | Playwright (360 px) | `e2e/admin/editor-tablas.spec.ts` |
| H7 esc. 9 y 10, RF-026: tabla en el sitio sin desbordar a 360 px, región con nombre y teclado, encabezados asociados | Playwright (sitio) y axe | `e2e/web/articulo.spec.ts`, `e2e/web/accesibilidad.spec.ts` |
| RF-027 (H7 esc. 11): la búsqueda encuentra palabras de una celda y de la descripción | pgTAP y Vitest de integración (`buscar_articulos`; el sitio aún no tiene página de búsqueda) | `busqueda.test.sql`, `packages/db/src/consultas/busqueda.test.ts` |
| CE-009: Lighthouse del sitio con el artículo del seed que tiene tablas y formatos | Lighthouse | según [quickstart.md](quickstart.md) |
| D31 U5 y U10: controles no aplicables en una celda y en código, menús de alineación y de formato | Vitest (render estático) y Playwright, con axe con una tabla, la selección de celdas y los menús abiertos | `documento/BarraHerramientas.test.tsx`, `e2e/admin/accesibilidad.spec.ts` |
| Adaptador y texto visible | Vitest | `packages/bloques/src/elementos.test.ts` |
| RF-030: no queda código del formato anterior | grep de cierre | `validacion.md` |
| RF-030, CE-010: corte en la nube | Manual, con la lista de [quickstart.md](quickstart.md#corte-en-la-nube) | `validacion.md` |
| RF-001 a RF-008, RF-010, RF-011, RF-013, RF-014, RF-016 a RF-020, CE-001, CE-003 a CE-007 | Las del plan anterior (siguen vigentes, ahora con `Documento`) | `documento/*.test.ts`, `anuncios.test.ts`, `e2e/admin/editor-documento.spec.ts`, `accesibilidad.spec.ts` y los E2E de 003 y 004 |

**Pruebas existentes a adaptar**: las Vitest de `packages/bloques` (esquema, validar, render, imágenes en uso), de `packages/db` (`pruebas/datos.ts`, consultas) y de `apps/admin` (`documento/*`, `reductor`, `datos`), los pgTAP que arman `contenido`, `e2e/admin/ayudas/articulos.ts` (las consultas a la base comparan el documento) y los E2E de las specs 003 y 004 (T057 a T059).

## Corte coordinado en la nube (RF-030)

Se hace al cerrar la spec, con `/validar` aprobado y el CI en verde. Orden (detalle en [quickstart.md](quickstart.md#corte-en-la-nube)):

1. Avisar del corte a quienes usan el panel de producción.
2. Exportar los artículos de la nube a JSON y correr el script: si un artículo no pasa la verificación, se corrige y se vuelve a empezar (no se toca nada).
3. Pausar el job `publicar-programados` y comprobar que ningún programado vence durante el corte.
4. Aplicar **en una sola ejecución del SQL Editor** la migración y el SQL de la conversión (una transacción: sin ventana en la que un guardado o el cron fallen); comprobar que los dos checks quedan `convalidated`.
5. Pushear el último commit, que elimina el script, `conversion-anterior/`, la caracterización, `conversion.test.sql` y sus *fixtures*.
6. Mergear el PR: Vercel despliega el sitio y el panel nuevos. Reactivar `publicar-programados`.
7. Comprobar CE-010 (los artículos publicados se ven igual) y los advisors; registrar la migración en la lista de desalineadas de `CLAUDE.md`.

Entre los pasos 4 y 6, el panel viejo no puede guardar contenido (lo rechaza la base, sin guardar nada inválido) y el sitio sirve las páginas en caché.

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/005-editor-estilo-documento/
├── plan.md
├── research.md      # D1–D21 (etapa anterior) y D22–D30 (ampliación)
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── documento.md     # lista permitida
│   ├── componentes.md
│   └── atajos.md
├── checklists/requirements.md
├── tasks.md         # /speckit-tasks (se regenera para la ampliación)
└── validacion.md    # /validar
```

### Código fuente (afectado por la ampliación)

```text
packages/bloques/
├── src/esquema.ts, validar.ts, normalizar.ts, elementos.ts, tablas.ts (+ tests)
├── src/imagenes-en-uso.ts (+ test)
├── src/render/Documento.tsx, EnLinea.tsx, Tabla.tsx, clases.ts (+ tests, caracterizacion.test.tsx)
├── src/pruebas/corpus-contenido.ts, salida-anterior.json
├── src/conversion-anterior/   # solo hasta el corte: bloques-a-documento, documento-a-bloques, en-linea, parrafos, esquema-bloques
├── scripts/convertir-contenido.ts (+ test)   # solo hasta el corte
└── (se eliminan render/Bloques.tsx, TextoEnLinea.tsx, Parrafo.tsx, utilidades.textoPlano, tipos-bloque.ts)
packages/db/src/                 # Contenido → Documento (tipos-publicos, mapeo, pruebas)
packages/ui/src/tokens.css       # 4 tokens
apps/admin/src/
├── acciones/articulos.ts        # normalizar y validarDocumento antes de escribir
├── app/(panel)/articulos/[id]/vista-previa/page.tsx   # Documento
└── componentes/editor/
    ├── EditorArticulo.tsx, reductor.ts, datos.ts, ComparacionVersiones.tsx, anuncios.ts
    └── documento/ extensiones.ts (+ extensiones.test.ts), tablas.ts, BarraTabla.tsx, BarraHerramientas.tsx,
        PropiedadesDelElemento.tsx, menu-insercion.ts, pegado.ts, limites.ts, mapa-errores.ts, comandos.ts, proteger.ts, ids.ts
apps/web/src/pages/blog/[slug].astro   # Documento
supabase/
├── migrations/20261023120000_contenido_documento.sql
├── seed.sql
└── tests/contenido_documento.test.sql, conversion.test.sql (+ adaptados)
e2e/admin/editor-tablas.spec.ts (nuevo), editor-documento.spec.ts, ayudas/*; e2e/web/articulo.spec.ts
```

**Decisión de estructura**: Tiptap no sale de `apps/admin/src/componentes/editor/documento/`. Lo que comparten el panel, el sitio, el servidor y la conversión (esquema, normalización, cuadrícula de tablas, texto visible, imágenes en uso y renderer) vive en `packages/bloques`, en funciones puras probadas en entorno `node`.

## Revisión del plan

### Etapa anterior (2026-10-22)

`consistencia-codigo` (7 bloqueantes) y `revisor-ux-ui` (9 bloqueantes) emitieron CAMBIOS REQUERIDOS; todos se incorporaron (dependencias y peso, ida y vuelta, `guardado`, ids estables, duplicación, retiro del editor anterior, criterios sin prueba, disposición desde 1280 px, roles del lienzo, atajos sin colisiones, modo elementos, asa y estado activo). El detalle está en el historial del repositorio (commit `9ab2da2`) y en research D1 a D21.

### Ampliación (2026-10-22)

`arquitecto-db` (4 bloqueantes), `consistencia-codigo` (4 bloqueantes; aprueba las cinco extensiones) y `revisor-ux-ui` (5 bloqueantes) emitieron CAMBIOS REQUERIDOS. Todos los hallazgos, bloqueantes y menores, están resueltos en [research.md D31](research.md#d31-revisión-de-la-ampliación-2026-10-22), el [data-model.md](data-model.md), los contratos y el [quickstart.md](quickstart.md). Lo más importante: privilegios de las funciones del check, migración y conversión en una sola transacción, SQL de conversión como bloque `do`, extractores puros para verificar sin el renderer, esquemas de campos compartidos en lugar de copiados, retiro completo tras el corte, barra «Tabla» operable desde el teclado y con el dedo, y controles no aplicables dentro de las celdas.

## Riesgos

| Id | Riesgo | Mitigación |
|---|---|---|
| R1 | El renderer nuevo muestra distinto lo que ya estaba publicado | Caracterización **antes** de cambiar el renderer (D26) y comparación en el script; E2E del sitio |
| R4 | El arrastre con el dedo no funciona | Asa propia con eventos de puntero; el menú «Acciones» y el modo elementos como camino principal en táctil (sin cambios) |
| R5 | Accesibilidad con lectores de pantalla reales, ahora también en tablas | axe y Lighthouse en CI, árbol de accesibilidad en Playwright y pasada con NVDA en T081 si es posible |
| R6 | Peso del editor con las tablas | Medición contra el tope de 250 KB gzip; carga diferida de la extensión de tablas si hace falta (D23) |
| R9 | Latencia al normalizar en cada transacción con 200 elementos | Medición (T081) y normalización diferida si hace falta (D24) |
| R10 | Ids duplicados | `asignarIds` y unicidad en el esquema (sin cambios) |
| R11 | Teclados móviles y composición | Sin cambios: pruebas de escritorio y riesgo asumido |
| R13 | La conversión pierde algo en un caso no cubierto | Verificación de ida y vuelta y caracterización sobre **todos** los artículos reales antes de aplicar; todo o nada |
| R14 | Alguien guarda en producción, o el cron publica, durante el corte | Aviso previo; `publicar-programados` en pausa; migración y conversión en una sola transacción; `where version = …` y conteo de filas |
| R15 | `prosemirror-tables` permite estructuras que la lista permitida rechaza (encabezado combinado con el cuerpo, anchos) | Plugin `reglasDeTabla`, `resizable: false`, normalización y prueba de contrato (D23, D29) |
| R16 | El historial de migraciones de la nube está desalineado | Aplicar con el SQL Editor o el MCP como hasta ahora, o alinear con `supabase migration repair` antes de un `db push` (CLAUDE.md) |

## Seguimiento de complejidad

| Excepción | Por qué | Alternativa más simple descartada |
|---|---|---|
| Código de un solo uso (`conversion-anterior/` y el script) que lee el formato anterior | La conversión necesita el analizador en línea del sitio; se elimina en el último commit antes del merge (RF-030) | Conversor en PL/pgSQL: duplicaría la gramática (§VIII.3) y arriesgaría pérdidas |
