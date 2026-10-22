# Plan de implementación: Jerarquía visual del panel

**Rama**: `004-jerarquia-visual-panel` | **Fecha**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/004-jerarquia-visual-panel/spec.md`

**Revisión del plan**: `revisor-ux-ui` y `consistencia-codigo` emitieron CAMBIOS REQUERIDOS (7 + 4 bloqueantes) el 2026-10-21. Este plan ya los incorpora: ver "Revisión del plan" al final.

## Resumen

El panel gana una jerarquía de acciones (cuatro niveles con sus estados y dos tamaños de 44 px) y una estructura común de pantalla (encabezado, títulos de sección, espaciado y estados). La base es extender `clasesBoton` de `@blog/ui` sin cambiar lo que devuelve para el sitio, volver obligatoria la `variante` del `Button` y de `ConfirmarAccion`, y crear componentes de estructura en `apps/admin`. El cambio más grande es el editor: "Guardar" y las acciones de estado se juntan en una barra fija con posiciones fijas, cuyo contenido y acción principal salen de funciones puras; "Programar" pasa a un diálogo con fecha y, en anchos angostos, el resto va a "Más acciones". Sin cambios de base de datos ni dependencias nuevas.

## Contexto técnico

**Apps / paquetes afectados**: `packages/ui` (clases y tokens), `apps/admin` (componentes, pantallas y `lib/`), `e2e/admin`. `apps/web` y `packages/bloques` siguen usando `clasesBoton` sin cambios en su resultado.

**Dependencias nuevas**: Ninguna. El diálogo de programar extiende `ConfirmarAccion` (Radix AlertDialog, ya instalado); "Más acciones" es un *disclosure* propio; las pruebas interactivas van en Playwright y no se agregan jsdom ni Testing Library (research D9, D10 y D13).

**Almacenamiento**: N/A.

**Rutas públicas afectadas**: ninguna (RF-016). Nota: `apps/web` hace `@source` de `packages/ui/src`, así que las utilidades nuevas de `clases.ts` entran en su CSS; son pocos bytes y se verifica que Lighthouse del sitio no baje.

**Rutas admin afectadas**: todas (RF-015): `/ingreso`, `/olvide-contrasena`, `/auth/confirmar`, `/definir-contrasena`, `/articulos`, `/articulos/nuevo`, `/articulos/[id]`, `/articulos/[id]/vista-previa`, `/categorias`, `/etiquetas`, `/equipo`, `/perfil`, 404 y 403.

**Revalidación**: sin cambios.

**Metas de rendimiento**: Lighthouse Accesibilidad ≥ 95 en las pantallas del panel en los cuatro anchos (CE-004). La navegación sigue por debajo de 1 s (CE-007 de la spec 003).

## Verificación constitucional

*GATE: debe pasar antes de la Fase 0 y volver a verificarse después del diseño (Fase 1).*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado (sin deps no aprobadas) | [x] | Sin dependencias nuevas (D9, D10, D13). |
| III. Límites de arquitectura (sin imports entre apps, datos vía packages/db) | [x] | La primitiva sigue en `packages/ui`; lo demás es del panel. Sin acceso a datos nuevo. |
| IV. SEO primero (pre-render, JS mínimo, metadatos) | [x] | No toca `apps/web`; el panel sigue con `noindex`. |
| V. Datos (migraciones, RLS + pgTAP, nomenclatura en español) | [x] | Sin cambios de base. |
| VI. Bloques (esquema único en packages/bloques) | [x] | El esquema no cambia; `Cta.tsx` sigue llamando a `clasesBoton(bloque.variante)`. |
| VII. Design system (solo tokens, WCAG AA) | [x] | Un token nuevo (`--spacing-panel-seccion`); una sola primitiva de botón (D1); 44 px en los dos tamaños (D3); se quitan los `w-[calc(100%-2rem)]` de los diálogos que se tocan. |
| VIII. No duplicación (sección Reutilización completa) | [x] | Ver abajo. `useDesplegable` y `useCambioDeEstado` se extraen pero quedan en `apps/admin` porque solo los usa el panel (§VIII.3 pide `packages/*` para lógica compartida entre apps). |
| IX. Testing (cada criterio de aceptación → test) | [x] | Ver "Plan de pruebas". |

**Re-verificación después del diseño (Fase 1)**: cumple. La revisión agregó piezas (funciones puras, `AvisoEstado` ampliado, `cn` extendido) sin dependencias, rutas públicas ni datos.

## Reutilización *(obligatorio — constitucion.md §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Definición del botón | `packages/ui/src/clases.ts` (`clasesBoton`) | Variante `terciaria`, `OpcionesBoton` y estados | Una sola primitiva para sitio y panel (§VII.3); sin opciones devuelve lo de hoy (D1). |
| Botón del panel | `componentes/ui/button.tsx` | `variante` obligatoria; `tamanio`, `soloIcono`, `ocupado`, `textoOcupado` | RF-004, RF-006, RF-007 y RF-010 (D2, D3, D12). |
| Paginación | `componentes/articulo/Paginacion.tsx` (arma el botón a mano) | — | Pasa a `clasesBoton('secundaria', { tamanio: 'compacto' })` (§VII.3). |
| Combinar clases | `lib/cn.ts` | `extendTailwindMerge` con `text-titulo-*` | Sin eso `cn` descarta los tamaños de título (D5). |
| Diálogos de confirmación | `componentes/ConfirmarAccion.tsx`, `ui/alert-dialog.tsx` | Props `cuerpo`, `focoInicial`, modo controlado, `onConfirmar` que puede no cerrar | Así `DialogoProgramar` no crea un tercer andamiaje (D9). |
| Diálogo de programar | `ConfirmarAccion` extendido, `CampoFormulario`, `ui/input.tsx` | `componentes/articulo/DialogoProgramar.tsx` (composición fina) | Aclaración 2, RF-018. |
| Fecha mínima local | `ahoraLocal()` dentro de `AccionesEstado.tsx` | Se muda a `lib/fechas.ts` (junto a `aIsoUtc`) | La usa el diálogo; con test. |
| Avisos de estado | `componentes/AvisoEstado.tsx` (`exito`/`error`, texto) | `tipo: 'advertencia'`, `children: ReactNode`, `acciones` | Unifica los avisos de `DialogoEdicion`, el resumen de errores del editor, `AvisoConflicto` y la vista previa (RF-014, D6). |
| Estado vacío | Cuatro implementaciones: lista, `GestorTaxonomias`, `TablaEquipo`, etiquetas del editor | `componentes/estructura/EstadoVacio.tsx` | Una sola presentación (RF-014). El sitio tiene su `EstadoVacio.astro`; no es duplicación entre apps (tecnologías distintas). |
| Carga | `app/(panel)/articulos/(lista)/loading.tsx` | — | Se ajusta para imitar `EncabezadoPagina`; un solo consumidor, no amerita componente. |
| Encabezado de pantalla | 11 `h1` sueltos (`PaginaTaxonomias` cubre categorías y etiquetas) | `componentes/estructura/EncabezadoPagina.tsx` | RF-011. La vista previa queda afuera. |
| Barra de acciones y pies de diálogo | `div.flex.flex-wrap.gap-3` repetido, `AlertDialogFooter`, pie de `DialogoEdicion` | `componentes/estructura/BarraAcciones.tsx` | RF-008 y RF-009; reemplaza a los tres (D4). |
| Títulos de sección y de diálogo | `h2` con `text-xl`, `legend` del tamaño del cuerpo, `AlertDialogTitle` | `componentes/estructura/TituloSeccion.tsx` | RF-012: una sola escala (D5). |
| Desplegable (Esc, foco, cierre al navegar) | Lógica dentro de `NavegacionPanel.tsx` | `lib/desplegable.ts` (`useDesplegable`, extraído) | La usan `NavegacionPanel` y `MasAcciones` (§VIII). |
| "Más acciones" | — | `componentes/estructura/MasAcciones.tsx` | RF-019; *disclosure* sin dependencias (D10). |
| Acciones del editor | `componentes/articulo/acciones-disponibles.ts` | `accionPrincipalEditor`, `guardarHabilitado`, `distribuirBarraEditor`; `ETIQUETAS` y `ANUNCIOS` mudados | Lógica pura con test (D7). |
| Cambio de estado y eliminación | `ejecutar` y `eliminar` en `AccionesEstado.tsx` | `componentes/articulo/cambio-de-estado.ts` (`useCambioDeEstado`) | Lo usan la barra y los diálogos (D8). |
| Barra fija y recuadro "Publicación" | Barra de "Guardar" en `EditorArticulo.tsx`, `AccionesEstado.tsx` | `BarraEditor.tsx`, `InfoPublicacion.tsx`; **se borra** `AccionesEstado.tsx` | Aclaración 1 (D8). |
| Íconos | `componentes/Icono.tsx` | `mas` (puntos suspensivos), `papelera` | "Más acciones" y el ícono de las destructivas (D2, D10). |
| Ayudas de E2E | `e2e/admin/ayudas/estado.ts`, `editor.ts`, `sesion.ts`; `ANCHOS` y `PANTALLAS` en `accesibilidad.spec.ts` | `e2e/admin/ayudas/jerarquia.ts`; `ayudas/pantallas.ts` (con `ANCHOS` y `PANTALLAS` mudados) | Contar acciones por nivel y medir grupos sin clones (D13). |

## Impacto en base de datos

No aplica ([data-model.md](data-model.md#base-de-datos)). No se consulta a `arquitecto-db`.

## Impacto en UI y tokens

- **Componentes nuevos/modificados**: [contracts/componentes.md](contracts/componentes.md); nivel y ubicación por pantalla en [contracts/matriz-acciones.md](contracts/matriz-acciones.md).
- **Tokens nuevos**: `--spacing-panel-seccion: clamp(1.5rem, 1rem + 2vw, 2.5rem)`. No se agrega un título de subsección (D5).
- **Estados**: vacío (`EstadoVacio`), carga (`loading.tsx`), error, éxito y advertencia (`AvisoEstado`); del botón: reposo, puntero, foco, presionado, activo, deshabilitado y ocupado (D2, D12).
- **Accesibilidad**: `aria-disabled` que bloquea el envío; ocupado anunciado con `role="status"`; foco gestionado al cambiar de estado (D11); "Más acciones" con `aria-expanded`, Esc y devolución del foco; diálogo de programar con foco en el campo y error con `role="alert"`; terciaria en color de marca (≥ 4,6:1); ícono en las destructivas; secciones del editor con `h2` para la navegación por encabezados; nombres accesibles de las filas sin cambios (sufijo `sr-only`).

## Plan de pruebas

| Criterio de aceptación (spec) | Tipo | Archivo de test |
|---|---|---|
| RF-016 / CE-005: el sitio no cambia | Vitest | `packages/ui/src/clases.test.ts` (texto exacto con `()`, `(undefined)` y las tres variantes de hoy) |
| RF-001, RF-006, RF-007, RF-010: niveles, tamaños y estados | Vitest | `packages/ui/src/clases.test.ts` |
| RF-004: nivel explícito | typecheck | `apps/admin` (`variante` obligatoria en `Button` y `ConfirmarAccion`) |
| RF-005, RF-019 / H1 esc. 2 y 3: acción principal, "Guardar" habilitado y distribución de la barra | Vitest | `apps/admin/src/componentes/articulo/acciones-disponibles.test.ts` |
| RF-018: fecha mínima | Vitest | `apps/admin/src/lib/fechas.test.ts` |
| RF-007, RF-010, RF-011, RF-012, RF-014: estructura y atributos | Vitest (render estático) | `apps/admin/src/componentes/ui/button.test.tsx`, `componentes/estructura/estructura.test.tsx`, `componentes/AvisoEstado.test.tsx` |
| CE-001 / CE-002 / H1: una principal por contexto según la matriz | Playwright | `e2e/admin/jerarquia.spec.ts` |
| CE-003 / H2 esc. 1, 2, 3 y 6: alturas, alineación, área táctil y ancho estable al ocupar, en 4 anchos | Playwright | `e2e/admin/jerarquia.spec.ts` |
| H2 esc. 4 / RF-019: una línea a 360 px en los 4 estados (rol admin) y "Más acciones" con teclado | Playwright | `e2e/admin/jerarquia.spec.ts` |
| H2 esc. 5 / RF-008 / RF-009: orden de las barras y reacomodo a 360 px fuera del editor | Playwright | `e2e/admin/jerarquia.spec.ts` |
| RF-018 / aclaración 2: diálogo de programar (foco, fecha inválida, cancelar, éxito) | Playwright | `e2e/admin/programacion.spec.ts` |
| Foco después de un cambio de estado (research D11) | Playwright | `e2e/admin/jerarquia.spec.ts` |
| H3 esc. 1 a 4 / RF-011 a RF-014: encabezado, títulos, espaciado, texto de apoyo y estados | Playwright | `e2e/admin/jerarquia.spec.ts` |
| Casos borde: rol editor sin huecos, textos largos a 360 px, zoom al 200 %, programar con cambios sin guardar | Playwright | `e2e/admin/jerarquia.spec.ts`, `e2e/admin/programacion.spec.ts` |
| CE-004: accesibilidad | Playwright (axe) + Lighthouse | `e2e/admin/accesibilidad.spec.ts`; Lighthouse según [quickstart.md](quickstart.md#accesibilidad-y-rendimiento) |
| CE-006: sin regresiones de flujo | Playwright | todos los `e2e/admin/*.spec.ts` |

**Pruebas existentes a adaptar** (los botones de estado salen del grupo "Publicación" y van al grupo "Acciones del artículo"; programar abre un diálogo):

| Archivo | Qué cambia |
|---|---|
| `e2e/admin/ayudas/estado.ts` | `panelPublicacion`, `botonDeEstado`, `campoFechaProgramada`, `errorDelPanel` y `accionesVisibles` buscan en la barra; programar abre el diálogo y confirma; en anchos angostos abren "Más acciones". |
| `e2e/admin/programacion.spec.ts` | La secuencia de programar (abrir, completar, confirmar) y la lectura del `min` del campo, que ahora está en el diálogo. |
| `e2e/admin/publicacion.spec.ts` | El campo de fecha usado directamente, `accionesVisibles` y los errores "Para publicar falta…". |
| `e2e/admin/permisos.spec.ts` | La aserción "Eliminar no existe para el editor" se reescribe sobre la barra nueva (si no, pasaría en falso verde). |
| `e2e/admin/casos-borde.spec.ts` | Los usos de la ayuda de estado y del aviso de cambios sin guardar. |
| `e2e/admin/accesibilidad.spec.ts` | `ANCHOS` y `PANTALLAS` se mudan a `ayudas/pantallas.ts`; "Guardar" en un artículo nuevo sigue habilitado. Se agregan el diálogo de programar y "Más acciones" abiertos. |
| `e2e/admin/lista-articulos.spec.ts` | "Quitar filtros" sigue siendo un enlace dentro de `EstadoVacio`. |
| `e2e/admin/articulo-editor.spec.ts` | El aviso "Cambios sin guardar" pasa a la línea de estado de la barra. |

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/004-jerarquia-visual-panel/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── componentes.md
│   └── matriz-acciones.md
├── checklists/requirements.md
├── tasks.md         # /speckit-tasks
└── validacion.md    # /validar
```

### Código fuente (afectado por esta feature)

```text
packages/ui/src/
├── clases.ts                 # terciaria, OpcionesBoton, estados
├── clases.test.ts            # nuevo
└── tokens.css                # --spacing-panel-seccion
apps/admin/src/
├── lib/                      # cn.ts (extendTailwindMerge), fechas.ts (ahoraLocal), desplegable.ts (nuevo)
├── componentes/ui/           # button, alert-dialog (pie con BarraAcciones, título con TituloSeccion)
├── componentes/estructura/   # nuevo: EncabezadoPagina, BarraAcciones, TituloSeccion, EstadoVacio, MasAcciones
├── componentes/articulo/     # BarraEditor, InfoPublicacion, DialogoProgramar, cambio-de-estado.ts,
│                             # acciones-disponibles.ts, Paginacion; se borra AccionesEstado.tsx
├── componentes/editor/       # EditorArticulo (barra, secciones con h2), AvisoConflicto, niveles explícitos
├── componentes/{acceso,equipo,taxonomia,perfil,salida}/  # niveles, tamaños y sufijos sr-only
├── componentes/{AvisoEstado,ConfirmarAccion,Icono,NavegacionPanel}.tsx
└── app/                      # pantallas con EncabezadoPagina; loading.tsx
e2e/admin/
├── jerarquia.spec.ts         # nuevo
├── ayudas/                   # estado.ts, jerarquia.ts (nuevo), pantallas.ts (nuevo)
└── (los 7 specs de la tabla "Pruebas existentes a adaptar")
```

**Decisión de estructura**: los componentes de estructura viven en `apps/admin/src/componentes/estructura/` porque solo los usa el panel; los hooks que no son componentes van en kebab-case (`lib/desplegable.ts`, `componentes/articulo/cambio-de-estado.ts`), como `lib/hidratado.ts`.

## Revisión del plan (2026-10-21)

| Origen | Hallazgo | Resolución |
|---|---|---|
| UX B1 / Consistencia B2 | Falta el artículo nuevo | `guardado` en la entrada; fila propia en data-model y matriz; "Guardar" habilitado (D7); spec RF-005 ajustado. |
| UX B2 | Foco perdido y diálogos que se desmontan | Diálogos controlados fuera del menú y foco explícito (D9, D10, D11). |
| UX B3 | Ocupado mudo | `role="status"` y etiqueta con `opacity-0` (D12). |
| UX B4 | Terciaria irreconocible y sin estado presionado | Terciaria en color de marca; tabla de estados (D2). |
| UX B5 / Consistencia M10 | El compacto corta textos | `min-h` + `text-balance` + `items-stretch`; sufijos `sr-only` en las filas (D3). |
| UX B6 | La principal no siempre está en el encabezado | Regla de ubicación por tipo de acción; spec H3 esc. 1 y RF-011 ajustados; columna "Ubic." en la matriz. |
| UX B7 | La barra no entra a 360 px | Compacta, "Más acciones" solo ícono, línea de estado aparte (D8, D10). |
| Consistencia B1 | Sin entorno para tests de componente | Render estático en Vitest e interacción en Playwright; sin dependencias nuevas (D13). |
| Consistencia B3 | `AvisoEstado` sin advertencia | Se amplía y se migran los avisos sueltos (D6). |
| Consistencia B4 | Pruebas existentes que se rompen o dan falso verde | Tabla "Pruebas existentes a adaptar"; grupo "Acciones del artículo" (D8, D13). |
| UX menores 1 a 14 / Consistencia M1 a M9 | Contextos faltantes, menú con texto, posiciones fijas, motivo de "Guardar" deshabilitado, `preventDefault`, container query, panel del menú, una sola renderización, escala tipográfica, vista previa, pies de diálogo, valores arbitrarios, ícono en peligro, `cn`, nombres de archivo, omisiones de reutilización, duplicación con `ConfirmarAccion` | Incorporados en research D1 a D13, contratos y matriz. |
| Sugerencias no adoptadas | Captura de pantalla del sitio para CE-005; ayuda de zona horaria; "Publicar" deshabilitado con cambios | La primera es redundante con el test de texto exacto; las otras dos cambian el flujo (RF-017) y quedan para otra spec. |

## Seguimiento de complejidad

No hay excepciones a la constitución.
