# Plan de implementación: Jerarquía visual del panel

**Rama**: `004-jerarquia-visual-panel` | **Fecha**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/004-jerarquia-visual-panel/spec.md`

## Resumen

El panel gana una jerarquía de acciones (cuatro niveles y dos tamaños) y una estructura común de pantalla (encabezado, títulos de sección, espaciado y estados). La base es extender `clasesBoton` de `@blog/ui` sin cambiar lo que hoy devuelve para el sitio, volver obligatoria la `variante` del `Button` del panel y crear cinco componentes de estructura en `apps/admin`. El cambio más grande es el editor: "Guardar" y las acciones de estado se juntan en la barra fija, con la acción principal según el estado (función pura `accionPrincipalEditor`), "Programar" pasa a un diálogo con la fecha y, por debajo de 768 px, el resto va a "Más acciones". Sin cambios de base de datos ni dependencias nuevas.

## Contexto técnico

**Apps / paquetes afectados**: `packages/ui` (clases y tokens), `apps/admin` (componentes y pantallas), `e2e/admin`. `apps/web` y `packages/bloques` siguen usando `clasesBoton` sin cambios en su resultado.

**Dependencias nuevas**: Ninguna. El diálogo de programar reutiliza `@radix-ui/react-alert-dialog` (ya instalado) y "Más acciones" es un *disclosure* propio (research D9 y D10).

**Almacenamiento**: N/A.

**Rutas públicas afectadas**: ninguna. El aspecto de los botones del sitio y del bloque CTA no cambia (RF-016).

**Rutas admin afectadas**: todas las pantallas (RF-015): `/ingreso`, `/olvide-contrasena`, `/auth/confirmar`, `/definir-contrasena`, `/articulos`, `/articulos/nuevo`, `/articulos/[id]`, `/articulos/[id]/vista-previa`, `/categorias`, `/etiquetas`, `/equipo`, `/perfil`, y las pantallas de 404 y 403.

**Revalidación**: sin cambios.

**Metas de rendimiento**: Lighthouse Accesibilidad ≥ 95 en las pantallas del panel en los cuatro anchos (CE-004). La navegación sigue por debajo de 1 s (CE-007 de la spec 003): la feature no agrega pedidos ni JavaScript de peso.

## Verificación constitucional

*GATE: debe pasar antes de la Fase 0 y volver a verificarse después del diseño (Fase 1).*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado (sin deps no aprobadas) | [x] | Sin dependencias nuevas (D9, D10). |
| III. Límites de arquitectura (sin imports entre apps, datos vía packages/db) | [x] | La primitiva sigue en `packages/ui`; los componentes de estructura son del panel. No hay acceso a datos nuevo. |
| IV. SEO primero (pre-render, JS mínimo, metadatos) | [x] | No toca `apps/web`; el panel sigue con `noindex`. |
| V. Datos (migraciones, RLS + pgTAP, nomenclatura en español) | [x] | Sin cambios de base. |
| VI. Bloques (esquema único en packages/bloques) | [x] | El esquema no cambia; `Cta.tsx` sigue llamando a `clasesBoton` igual. |
| VII. Design system (solo tokens, WCAG AA) | [x] | Tokens nuevos `--text-titulo-4`, `--spacing-panel-seccion` y `--spacing-panel-grupo` (D5). La primitiva del botón sigue siendo una sola (D1). Área táctil de 44 px en los dos tamaños (D3). |
| VIII. No duplicación (sección Reutilización completa) | [x] | Ver abajo: se reutilizan las primitivas existentes y se extraen `useDesplegable` y `useCambioDeEstado` para no duplicar lógica. |
| IX. Testing (cada criterio de aceptación → test) | [x] | Ver "Plan de pruebas". |

**Re-verificación después del diseño (Fase 1)**: sin cambios; los contratos no agregan dependencias, rutas públicas ni datos.

## Reutilización *(obligatorio — constitucion.md §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Definición del botón | `packages/ui/src/clases.ts` (`clasesBoton`) | Variante `terciaria` y opción `tamanio` | Una sola primitiva para sitio y panel (§VII.3); sin opciones devuelve lo de hoy (D1). |
| Botón del panel | `apps/admin/src/componentes/ui/button.tsx` | Props `tamanio`, `soloIcono`, `ocupado`; `variante` obligatoria | RF-004, RF-006, RF-007 y RF-010. |
| Diálogo de confirmación | `componentes/ConfirmarAccion.tsx` y `ui/alert-dialog.tsx` | `componentes/articulo/DialogoProgramar.tsx` | Necesita un campo y no cerrarse con una fecha inválida; reutiliza las primitivas de `alert-dialog`. |
| Campo de formulario | `componentes/CampoFormulario.tsx`, `ui/input.tsx` | — | El campo de fecha del diálogo usa los mismos. |
| Avisos de estado | `componentes/AvisoEstado.tsx` | — | Cubre error, éxito y advertencia (RF-014). |
| Estado vacío | Los `div` armados a mano en la lista y en taxonomías | `componentes/estructura/EstadoVacio.tsx` | Unifica dos implementaciones distintas en una (RF-014). |
| Esqueleto de carga | `app/(panel)/articulos/(lista)/loading.tsx` | `componentes/estructura/EsqueletoPantalla.tsx` | Lo usan los `loading.tsx` del panel; imita el encabezado. |
| Encabezado de pantalla | 12 `h1` sueltos | `componentes/estructura/EncabezadoPagina.tsx` | RF-011: misma estructura en todas las pantallas. |
| Barra de acciones | `div className="flex flex-wrap gap-3"` repetido | `componentes/estructura/BarraAcciones.tsx` | RF-009: orden y separación de destructivas. |
| Títulos de sección | `h2` con `text-xl` y `legend` con `font-semibold` | `componentes/estructura/TituloSeccion.tsx` | RF-012: una sola escala. |
| Desplegable con Esc y foco | Lógica dentro de `NavegacionPanel.tsx` | `componentes/estructura/useDesplegable.ts` (extraído) | La usan `NavegacionPanel` y `MasAcciones`; extraerla evita duplicarla (§VIII.3). |
| "Más acciones" | — | `componentes/estructura/MasAcciones.tsx` | RF-019; *disclosure* sin dependencias (D10). |
| Transiciones de estado | `componentes/articulo/acciones-disponibles.ts` (`accionesDisponibles`, `destinoDe`) | `accionPrincipalEditor` en el mismo archivo | RF-005; lógica pura junto a la existente (D7). |
| Cambio de estado y eliminación | `ejecutar` y `eliminar` en `AccionesEstado.tsx` | `componentes/articulo/useCambioDeEstado.ts` (extraído) | Lo usan la barra y el menú; evita duplicar la lógica (D8). |
| Barra fija del editor | Barra de "Guardar" en `EditorArticulo.tsx` | `componentes/articulo/BarraEditor.tsx` | Junta "Guardar" y las acciones de estado (aclaración 1). |
| Recuadro "Publicación" | `componentes/articulo/AccionesEstado.tsx` | Se renombra a `InfoPublicacion.tsx` y pierde los botones | Queda solo informativo (aclaración 1). |
| Ayudas de E2E | `e2e/admin/ayudas/estado.ts`, `editor.ts`, `sesion.ts` | `e2e/admin/ayudas/jerarquia.ts` | Contar acciones por nivel y medir grupos (CE-001, CE-003). |

## Impacto en base de datos

No aplica: la feature no toca `supabase/` ni `packages/db` ([data-model.md](data-model.md#base-de-datos)). No se consulta a `arquitecto-db`.

## Impacto en UI y tokens

- **Componentes nuevos/modificados**: ver [contracts/componentes.md](contracts/componentes.md). Pantallas que cambian: todas las de RF-015, según [contracts/matriz-acciones.md](contracts/matriz-acciones.md).
- **Tokens nuevos**: `--text-titulo-4: 1.125rem`, `--spacing-panel-seccion: 2.5rem`, `--spacing-panel-grupo: 1rem` (D5).
- **Estados**: vacío con `EstadoVacio`, carga con `EsqueletoPantalla`, error, éxito y advertencia con `AvisoEstado`; botón deshabilitado y ocupado (D11).
- **Accesibilidad**: `aria-disabled` en lugar de `disabled`; `aria-busy` con texto accesible estable; "Más acciones" con `aria-expanded` y `aria-controls`, Esc y devolución del foco; diálogo de programar con foco inicial en el campo y errores asociados con `aria-describedby`; contraste AA de la variante terciaria (texto `texto` sobre `fondo` y `superficie`); el indicador de ocupado respeta `prefers-reduced-motion`.

## Plan de pruebas

| Criterio de aceptación (spec) | Tipo | Archivo de test |
|---|---|---|
| RF-016 / CE-005: el sitio no cambia | Vitest | `packages/ui/src/clases.test.ts` (texto exacto sin opciones) |
| RF-001, RF-006, RF-007: niveles y tamaños | Vitest | `packages/ui/src/clases.test.ts` |
| RF-004: nivel explícito | typecheck | `apps/admin` (`variante` obligatoria) |
| RF-005 / H1 esc. 2 y 3: acción principal del editor | Vitest | `apps/admin/src/componentes/articulo/acciones-disponibles.test.ts` |
| RF-010: estados del botón | Vitest | `apps/admin/src/componentes/ui/button.test.tsx` |
| RF-011, RF-012: encabezado y títulos | Vitest | `apps/admin/src/componentes/estructura/estructura.test.tsx` |
| RF-018 / aclaración 2: diálogo de programar | Vitest + Playwright | `apps/admin/src/componentes/articulo/DialogoProgramar.test.tsx`, `e2e/admin/programacion.spec.ts` |
| RF-019 / H2 esc. 4: "Más acciones" en 360 px | Vitest + Playwright | `apps/admin/src/componentes/estructura/MasAcciones.test.tsx`, `e2e/admin/jerarquia.spec.ts` |
| CE-001 / CE-002 / H1: una principal por contexto, según la matriz | Playwright | `e2e/admin/jerarquia.spec.ts` |
| CE-003 / H2 esc. 1, 2, 3 y 6: alturas, alineación y área táctil en 4 anchos | Playwright | `e2e/admin/jerarquia.spec.ts` |
| H3 esc. 1 a 3: estructura y estados | Playwright | `e2e/admin/jerarquia.spec.ts` |
| CE-004: accesibilidad | Playwright (axe) + Lighthouse | `e2e/admin/accesibilidad.spec.ts`; Lighthouse según [quickstart.md](quickstart.md#accesibilidad-y-rendimiento) |
| CE-006: sin regresiones de flujo | Playwright | todos los `e2e/admin/*.spec.ts`, con `e2e/admin/ayudas/estado.ts` actualizado |

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
├── clases.ts                 # variante terciaria y opción tamanio
├── clases.test.ts            # nuevo
└── tokens.css                # titulo-4, spacing-panel-*
apps/admin/src/
├── componentes/ui/           # button, alert-dialog
├── componentes/estructura/   # nuevo: EncabezadoPagina, BarraAcciones, TituloSeccion, EstadoVacio,
│                             #        EsqueletoPantalla, MasAcciones, useDesplegable
├── componentes/articulo/     # BarraEditor, InfoPublicacion, DialogoProgramar, useCambioDeEstado,
│                             # acciones-disponibles (accionPrincipalEditor)
├── componentes/editor/       # EditorArticulo (barra fija), niveles explícitos en el resto
├── componentes/{acceso,equipo,taxonomia,perfil}/  # niveles y tamaños
├── componentes/NavegacionPanel.tsx                # usa useDesplegable
└── app/                      # pantallas con EncabezadoPagina y loading.tsx
e2e/admin/
├── jerarquia.spec.ts         # nuevo
└── ayudas/                   # estado.ts (programar en diálogo, "Más acciones"), jerarquia.ts (nuevo)
```

**Decisión de estructura**: los componentes de estructura viven en `apps/admin/src/componentes/estructura/` porque solo los usa el panel; el sitio tiene sus propios layouts en Astro. Si en el futuro el sitio los necesitara, se moverían a `packages/ui` en una spec propia.

## Seguimiento de complejidad

No hay excepciones a la constitución.
