# Plan de implementación: Editor de notas estilo documento

**Rama**: `005-editor-estilo-documento` | **Fecha**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/005-editor-estilo-documento/spec.md`

**Revisión del plan**: `consistencia-codigo` y `revisor-ux-ui` emitieron CAMBIOS REQUERIDOS (7 y 9 bloqueantes) el 2026-10-22. Este plan ya los incorpora: ver "Revisión del plan" al final.

## Resumen

El cuerpo del artículo deja de ser una lista de tarjetas y pasa a ser un **documento de texto enriquecido** hecho con **Tiptap** (sobre ProseMirror): lienzo con la tipografía del sitio, barra de herramientas arriba, menú «/» y «Insertar», asa por elemento (arrastrar y menú), modo de selección de varios elementos y **panel de propiedades** (pestaña a la derecha desde 1280 px, hoja inferior por debajo). El contenido guardado **no cambia**: el documento se convierte, con funciones puras, a la misma lista de bloques de `packages/bloques` (y de vuelta) sin pérdida (CE-002).

Tres decisiones sostienen el plan:

1. **Una sola gramática de marcas en línea.** Hoy el sitio interpreta `**negrita**`, `_cursiva_`, `` `código` `` y `[texto](url)` dentro de un componente React. El análisis pasa a un árbol puro en `packages/bloques` (`analizarEnLinea`, `serializarEnLinea`, `normalizarMarcas`); el sitio, el editor y `textoPlano` usan el mismo analizador. El editor se **autocorrige a lo que el sitio puede mostrar**, así lo que se ve es lo que se guarda.
2. **El documento es la fuente de verdad mientras se edita; el reductor guarda el resultado.** Tiptap conserva el documento (y su historial único); cada cambio se convierte a bloques y llega al reductor como un solo campo `contenido`. Dirty, validación, guardado, conflicto y limpieza de imágenes siguen como hoy. `guardado` no toca el documento; solo la carga inicial y `adoptar_vigente` lo recrean.
3. **Los elementos especiales son nodos atómicos con el bloque entero como atributo**, vistos con el renderer del sitio y editados en el panel con los editores de campos que ya existen. Identidad por `bloqueId` (los errores, las propiedades y las subidas apuntan por id, no por posición).

Antes de construir, una **Fase 0** (prueba de concepto con umbrales escritos antes de medir) valida lo que depende del navegador y de la librería: peso, arrastre con el dedo, lectores de pantalla, teclados móviles, atajos, escritura con 200 elementos y descubribilidad. Su decisión se registra en [research.md](research.md#d17-fase-0-prueba-de-concepto-umbrales-y-regla-de-decisión) y puede cambiar la lista de dependencias (asa propia) o llevar a comparar con Lexical.

## Contexto técnico

**Apps / paquetes afectados**: `apps/admin` (editor), `packages/bloques` (análisis en línea, partir y unir párrafos, clases de bloque exportadas; se retiran operaciones y marcas sin uso), `packages/ui` (estado activo de la terciaria y tres tokens). `apps/web` cambia **solo por el refactor de `TextoEnLinea` y `Parrafo`** (misma salida; riesgo R1). `packages/db` y `supabase/` no cambian.

**Dependencias nuevas** (runtime de `apps/admin`, MIT, versión exacta **3.31.4** del 2026-09-30; justificación y estado de cada una en [research.md D1](research.md#d1-librería-de-edición-tiptap)):

| Paquete | Para qué | Estado |
|---|---|---|
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/react` | motor, ProseMirror y enlace con React | pedida su aprobación |
| `@tiptap/starter-kit` | extensiones base (con medición; si pesa, extensiones individuales) | pedida su aprobación |
| `@tiptap/extensions` | `Placeholder`, `TrailingNode`, `CharacterCount` e historial | pedida su aprobación |
| `@tiptap/suggestion` | menú «/» | pedida su aprobación |
| ~~`@tiptap/extension-drag-handle*`, `@tiptap/extension-node-range`~~ | asa y arrastre | **descartadas por la Fase 0** (traen `yjs` al cliente, +50 KB gzip): el asa es propia y no suma dependencias |

`@floating-ui/dom` **no se importa** (es *peer* de `suggestion`; el menú se posiciona con el `clientRect` y `visualViewport`). La Fase 0 se hizo con `pnpm add` en una rama descartable (`005-spike-tiptap`): el `package.json` definitivo lleva **seis paquetes** (core, pm, react, starter-kit, extensions y suggestion). Tras el merge se enmienda la tabla de §II de la constitución con la fila "Editor de texto: Tiptap 3.31".

**Almacenamiento**: N/A (sin cambios en tablas ni en buckets; las imágenes siguen el flujo de hoy).

**Rutas públicas afectadas**: ninguna cambia de estrategia ni de salida (R1 lo verifica).

**Rutas admin afectadas**: `/articulos/nuevo` y `/articulos/[id]` (el editor). La vista previa usa `Bloques` y no cambia.

**Revalidación**: sin cambios.

**Metas de rendimiento**: menú «/» y «Insertar» en menos de 200 ms con 50 elementos (CE-006); latencia de escritura < 100 ms con 200 elementos; el editor se carga con importación dinámica solo en las dos rutas del editor; tope de peso **≤ 250 KB gzip** adicionales y sin `yjs` en el cliente (Fase 0); Lighthouse Accesibilidad ≥ 95 en 360, 768, 1024 y 1440 px (CE-004).

## Verificación constitucional

*GATE: debe pasar antes de la Fase 0 y volver a verificarse después del diseño (Fase 1).*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado (sin deps no aprobadas) | [x] | Los paquetes de la tabla están justificados en D1; `consistencia-codigo` aprobó el núcleo y condicionó el asa a la Fase 0. El usuario autorizó la librería el 2026-10-22. Versión exacta; solo en `apps/admin`. Enmienda de la tabla de §II después del merge |
| III. Límites de arquitectura (sin imports entre apps, datos vía packages/db) | [x] | El editor importa de `@blog/bloques`; la gramática en línea y la partición de párrafos viven en el paquete que usan el sitio y el panel. Sin acceso a datos nuevo |
| IV. SEO primero (pre-render, JS mínimo, metadatos) | [x] | El panel sigue con `noindex` y carga diferida. El sitio no suma JS; el refactor se verifica con salida idéntica (R1) |
| V. Datos (migraciones, RLS + pgTAP, nomenclatura en español) | [x] | Sin cambios de base |
| VI. Bloques (esquema único en packages/bloques) | [x] | El esquema Zod no cambia y sigue validando en el servidor y en el navegador. La gramática en línea pasa de estar en el renderer a una sola definición en el paquete |
| VII. Design system (solo tokens, WCAG AA) | [x] | Tres tokens nuevos en `packages/ui` (`--container-panel-propiedades`, `--carril-asa`, `--alto-hoja-propiedades`) y el estado activo de la terciaria con borde; el lienzo reutiliza las clases del renderer (exportadas, no copiadas) |
| VIII. No duplicación (sección Reutilización completa) | [x] | Ver abajo: una sola vista de elemento especial, un solo panel con variantes, una sola regla de tramos de párrafo, una sola gramática y los anuncios en `anuncios.ts` |
| IX. Testing (cada criterio de aceptación → test) | [x] | Ver "Plan de pruebas" con cada RF y CE |

**Re-verificación después del diseño (Fase 1)**: cumple. El diseño retira todo el código del editor anterior (D18) y no deja código muerto para knip.

## Reutilización *(obligatorio — constitucion.md §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Gramática de marcas en línea | `packages/bloques/src/render/TextoEnLinea.tsx` (analizador mezclado con React) y la expresión regular de `textoPlano` en `utilidades.ts` | `packages/bloques/src/en-linea.ts` (`analizarEnLinea`, `serializarEnLinea`, `normalizarMarcas`, `NodoEnLinea`); `TextoEnLinea` y `textoPlano` pasan a usarlo | Una sola gramática para el sitio, el editor y los extractos (§VI.3). Con pruebas de caracterización de la salida actual antes de moverla (R1) |
| Partir un párrafo en tramos | La regla de `Parrafo.tsx` (`/\n{2,}/`, salto simple, descartar tramos en blanco) | `partirParrafos` y `unirParrafos` en `packages/bloques` (con el separador exacto) | La usan el sitio y la conversión; evita una segunda regla (§VIII.3) |
| Clases de tipografía de los bloques | Cadenas sueltas en `Parrafo.tsx`, `Titulo.tsx`, `Cita.tsx`, `Lista.tsx`, `Codigo.tsx` | `packages/bloques/src/render/clases.ts` (constantes exportadas desde `render/index.ts`) | El lienzo se ve igual que el sitio sin copiar clases |
| Vista de cada elemento especial en el lienzo | `Bloques` (renderer) y `ImagenAdmin` de la vista previa | **Un** `documento/nodos/NodoBloque.tsx` con una fábrica por tipo (imagen, galería, llamada a la acción, video) | No se escribe cuatro veces la misma vista (jscpd) |
| Campos de cada tipo de bloque | `componentes/editor/bloques/Editor{Imagen,Galeria,Cta,Video,Cita,Codigo,Titulo,Lista}.tsx`, `EditorDeBloque.tsx`, `CampoBloque.tsx` | Prop `soloPropiedades` en los editores de texto y **un** `PropiedadesDelElemento.tsx` con variante lateral u hoja | Composición con props, no copias (§VIII.2) |
| Subida y confirmación de imágenes | `SelectorImagen.tsx`, `ImagenEditable.tsx`, `ContextoEditor.tsx` (`subiendo`, `imagenGuardada`, `anunciar`) | Se renombra `useEditor` de `ContextoEditor` a `useContextoEditor` (choca con el de Tiptap) | Sin cambios de comportamiento (RF-013) |
| Cambios de un bloque sumables (dos subidas simultáneas) | `CambiosDeBloque` de `reductor.ts` | Se mueve a `bloques/tipos.ts` y el comando `actualizarBloque(bloqueId, cambios)` lo usa | El reductor deja de saber de bloques sueltos |
| Mensajes y nombres accesibles | `anuncios.ts` (`nombreDeTipo`, `resumenDeErrores`…) | Se **extiende** con los mensajes de [contracts/atajos.md](contracts/atajos.md) y se reemplazan `etiquetaDeBloque`, `nombreDeBoton`, `anuncioDeMovimiento` y `anuncioDeQuitado`; la palabra "bloque" pasa a "elemento" (CE-007) | Un solo módulo puro con sus pruebas |
| Lista y filtro del menú «/» | `nombreDeTipo` de `anuncios.ts` | `documento/menu-insercion.ts` (los nombres salen de `nombreDeTipo`; solo se agrega la descripción y el grupo) | Sin tabla de nombres paralela |
| Menú que abre, cierra con Esc, clic afuera y al navegar | `lib/desplegable.ts` (`useDesplegable`, spec 004) | `lib/menu-teclado.ts` (`useMenuTeclado`: flechas, `Inicio`, `Fin`, letra, `Tab`, `Esc`) | `useDesplegable` solo abre y cierra y cierra al mover el foco; los menús del asa, del estilo y de «Insertar» necesitan navegación por teclado |
| Barra que se reacomoda en pantallas angostas | `MasAcciones.tsx` y el patrón de *container query* de `BarraEditor` (spec 004) | `MasAcciones` se **modifica**: dirección de apertura y corte por props | Hoy abre hacia arriba y con corte fijo; la barra de herramientas va pegada arriba |
| Botones y niveles | `ui/button.tsx`, `clasesBoton` (spec 004) | El estado activo de la terciaria suma borde de marca (`packages/ui`) | WCAG 1.4.1 y 1.4.11: no solo tinte |
| Avisos, títulos, estados vacíos, hoja de barra | `AvisoEstado`, `TituloSeccion`, `EstadoVacio`, `BarraAcciones`, `BarraEditor` (spec 004) | — | Sin cambios |
| Estado del artículo, validación y errores por bloque | `reductor.ts`, `datos.ts` (`validarEditor`), `lib/errores-campo.ts` | Acción `contenido` del reductor; los errores se llevan a los nodos por `bloqueId` | El reductor deja de saber de bloques sueltos |
| Comandos sobre uno o varios elementos | `operaciones.ts` de `packages/bloques` (opera sobre listas, no sobre el documento vivo) | `documento/comandos.ts` y `documento/proteger.ts` (mover, duplicar, quitar, convertir sobre el rango; una sola ruta de borrado) | El documento vivo no puede pasar por listas sin perder cursor e historial; `operaciones.ts` queda sin uso y se **elimina** con sus pruebas (§VIII.4) |
| Ids estables | — | `documento/ids.ts` (plugin `asignarIds`) | Asigna una vez y deduplica; sin sumar `unique-id` y `uuid` |
| Formato de la selección | `BarraMarcas.tsx`, `TextoConMarcas.tsx`, `aplicarMarca` | Marcas y atajos de la librería | Quedan sin uso: se **eliminan** (también `ListaBloques.tsx` y `EditorParrafo.tsx`) |
| Íconos | `componentes/Icono.tsx` | Íconos nuevos: negrita, cursiva, código, enlace, listas, deshacer, rehacer, asa, insertar, acciones, propiedades | Los que faltan |
| Ayudas de E2E | `e2e/admin/ayudas/editor.ts` | Ayudas nuevas sobre el lienzo y el panel en el mismo archivo | Se adaptan los specs que usan el editor viejo |

## Impacto en base de datos

No aplica ([data-model.md](data-model.md#base-de-datos)). No se consulta a `arquitecto-db`.

## Impacto en UI y tokens

- **Componentes nuevos/modificados**: [contracts/componentes.md](contracts/componentes.md); correspondencia del documento con los bloques en [contracts/documento.md](contracts/documento.md); atajos, roles, foco y anuncios en [contracts/atajos.md](contracts/atajos.md).
- **Tokens nuevos** (`packages/ui/src/tokens.css`): `--container-panel-propiedades`, `--carril-asa` (= `--tactil-min`) y `--alto-hoja-propiedades` (45 dvh). **Cambio de clases**: la terciaria con `aria-pressed` suma `aria-pressed:border-marca`.
- **Disposición**: una columna por debajo de 1280 px; desde 1280 px, lienzo y columna lateral con **Publicación** fija y las pestañas «Artículo» y «Elemento» (a 1024 px con la navegación lateral quedarían unos 340 px para el lienzo).
- **Estados**: vacío (*placeholder* con contraste), carga (esqueleto) y error de carga con «Reintentar», error de validación (texto en el elemento), no editable (`setEditable(false)`), subida en curso, sin resultados del menú «/», modo elementos, arrastrando con texto de destino y límite de 200 elementos.
- **Accesibilidad**: lienzo con el `contenteditable` nativo y rol fijo; barra `role="toolbar"`; menú «/» con `aria-activedescendant` y «Insertar» con foco en el listbox; islas de los elementos especiales con nombre; asa solo para ratón y toque y botón «Acciones» para teclado y lectores; anuncios con *debounce*; foco definido por acción; `forced-colors`, zoom de 400 % y `prefers-reduced-motion`.

## Plan de pruebas

Primero se escriben las pruebas de la lógica pura (rojo), como en la 004. La interacción se prueba con Playwright; no se agrega jsdom ni Testing Library (research D16).

| Criterio (spec) | Tipo | Archivo de test |
|---|---|---|
| RF-009, RF-012, CE-002: análisis y serialización en línea inversos, normalización y salida idéntica del sitio | Vitest | `packages/bloques/src/en-linea.test.ts` (propiedades sobre corpus y al azar) y `render/texto-en-linea.test.tsx` (salida idéntica) |
| RF-012, CE-002 (H5 esc. 1 y 2): ida y vuelta de los diez tipos, de párrafos con líneas en blanco y de textos con marcas propias | Vitest | `documento/conversion.test.ts` con el corpus de `packages/bloques/src/pruebas/corpus-contenido.ts` |
| CE-002 con artículos reales: abrir y guardar sin tocar no sube la versión | Playwright | `e2e/admin/editor-documento.spec.ts` |
| RF-002, RF-010 (H1 esc. 1 a 3, H4 esc. 1 y 2): Enter, Retroceso y atajos tipo Markdown | Vitest (`detectarAtajo`, reglas de partir) y Playwright (las reglas de entrada, con teclado) | `documento/atajos.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-005 (H1 esc. 5): menú «/», filtro sin tildes, «Sin resultados», no se abre en medio de un texto | Vitest y Playwright | `documento/menu-insercion.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-003 (H1 esc. 3 y 4), RF-014: barra (estado activo, reacomodo, un solo tope de tabulación, campo de enlace) | Vitest (render estático) y Playwright | `documento/BarraHerramientas.test.tsx`, `e2e/admin/editor-documento.spec.ts` |
| RF-004, RF-020 (H2): insertar los diez tipos, panel y hoja, errores por elemento y foco por tipo | Playwright | `e2e/admin/editor-documento.spec.ts`, `e2e/admin/articulo-editor.spec.ts` |
| H2 esc. 7: nombre "Imagen, 3 de 8" y alcance del panel con teclado | Playwright (árbol de accesibilidad) | `e2e/admin/accesibilidad.spec.ts` |
| RF-006, RF-007, RF-019 (H3): mover, duplicar, quitar y convertir uno o varios elementos, modo elementos y selección de texto frente a elementos | Vitest (comandos sobre el rango y los ids) y Playwright (teclado, menú y arrastre) | `documento/comandos.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| H3 esc. 4: el desplazamiento táctil no arrastra | Playwright (emulación táctil) y Fase 0 en dispositivo real | `e2e/admin/editor-documento.spec.ts` |
| RF-008: foco y anuncios tras cada acción | Vitest (`anuncios.ts`) y Playwright | `anuncios.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-011 (H4 esc. 3): un solo historial; `guardado` no lo reinicia; `adoptar_vigente` sí | Playwright | `e2e/admin/editor-documento.spec.ts`, `e2e/admin/articulo-conflicto.spec.ts` |
| RF-015 (H4 esc. 4 y 5): pegado, marcas permitidas y sobrante por límite | Vitest (partir texto) y Playwright | `documento/pegado.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-016, D20: aviso de conversión con pérdida (lista, cita con autor, marcas a título o código) | Vitest y Playwright | `documento/comandos.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| RF-013, RF-018 (H5): validación, errores por elemento, cambios sin guardar, conflicto, subidas, publicación | Playwright | los specs existentes, adaptados |
| Ids estables y sin duplicados al copiar, pegar y arrastrar (R10) | Vitest (plugin) y Playwright | `documento/ids.test.ts`, `e2e/admin/editor-documento.spec.ts` |
| Casos borde: siempre queda un párrafo, dos elementos especiales seguidos, «/» en medio del texto, quitar o mover con subida en curso | Playwright | `e2e/admin/editor-documento.spec.ts` |
| CE-003: los diez tipos y el reordenamiento solo con teclado | Playwright (sin ratón) | `e2e/admin/editor-documento.spec.ts` |
| CE-004: accesibilidad y 360 a 1440 px | Playwright (axe) + Lighthouse | `e2e/admin/accesibilidad.spec.ts`; Lighthouse según [quickstart.md](quickstart.md) |
| CE-005: flujos de punta a punta de la 003 y la 004 | Playwright | todos los `e2e/admin/*.spec.ts` |
| CE-006, RF-017: menús en menos de 200 ms con 50 elementos y comportamiento en el máximo de 200 | Playwright | `e2e/admin/editor-documento.spec.ts` |
| CE-001, CE-007: tiempo y comprensión con personas | Manual | [quickstart.md](quickstart.md#prueba-con-personas) |

**Pruebas existentes a adaptar** (hoy dependen de «Agregar bloque», «Subir bloque N», `data-bloque` y los grupos por bloque):

| Archivo | Qué cambia |
|---|---|
| `e2e/admin/ayudas/editor.ts` | `agregarBloque` pasa a insertar desde «Insertar» o «/»; `grupoDeBloque` ubica el elemento en el lienzo; `completarBloque` completa los campos en el panel |
| `e2e/admin/articulo-editor.spec.ts` | Los 10 tipos, errores por elemento, extremos de mover (con teclado) y cambios sin guardar |
| `e2e/admin/casos-borde.spec.ts` | Subida fallida, slug repetido y publicado sin bloques sobre el lienzo y el panel |
| `e2e/admin/articulo-conflicto.spec.ts` | La comparación y «Reemplazar con la vigente» reinician el documento y el historial |
| `e2e/admin/accesibilidad.spec.ts` | axe sobre el editor nuevo, con el menú «/» y el panel abiertos |
| `e2e/admin/jerarquia.spec.ts` y `contracts/matriz-acciones.md` de la 004 | Las filas «Editor — barra de marcas» y «Editor — bloques (provisorio)» se reemplazan por la barra de herramientas, «Acciones» y el asa |

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/005-editor-estilo-documento/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── componentes.md
│   ├── documento.md
│   └── atajos.md
├── checklists/requirements.md
├── tasks.md         # /speckit-tasks
└── validacion.md    # /validar
```

### Código fuente (afectado por esta feature)

```text
packages/bloques/src/
├── en-linea.ts (+ test)          # nuevo: analizarEnLinea, serializarEnLinea, normalizarMarcas
├── parrafos.ts (+ test)          # nuevo: partirParrafos, unirParrafos
├── pruebas/corpus-contenido.ts   # nuevo: corpus de CE-002
├── render/clases.ts              # nuevo: clases de tipografía de los bloques
├── render/TextoEnLinea.tsx, Parrafo.tsx, utilidades.ts (textoPlano)   # usan lo nuevo
├── operaciones.ts, marcas.ts (+ tests)   # se eliminan
└── index.ts                      # exports nuevos y se quitan los de lo eliminado
packages/ui/src/                  # clases.ts (terciaria con aria-pressed) y tokens.css (3 tokens)
apps/admin/src/
├── lib/menu-teclado.ts           # nuevo: useMenuTeclado
├── componentes/estructura/MasAcciones.tsx   # modificado: dirección y corte por props
└── componentes/editor/
    ├── EditorArticulo.tsx        # sección "Contenido" = EditorDocumento + panel; columna lateral con pestañas
    ├── reductor.ts, anuncios.ts, ContextoEditor.tsx   # acción `contenido`; mensajes nuevos; useContextoEditor
    ├── documento/                # nuevo
    │   ├── EditorDocumento.tsx  BarraHerramientas.tsx  MenuInsertar.tsx  MenuAcciones.tsx  AsaDeElemento.tsx  AyudaAtajos.tsx
    │   ├── PropiedadesDelElemento.tsx
    │   ├── extensiones.ts  conversion.ts  comandos.ts  proteger.ts  ids.ts  atajos.ts  pegado.ts  limites.ts  mapa-errores.ts  menu-insercion.ts
    │   └── nodos/NodoBloque.tsx
    ├── bloques/                  # editores de campos: prop `soloPropiedades`; tipos.ts gana CambiosDeBloque
    └── (se eliminan ListaBloques, BarraMarcas, TextoConMarcas, EditorParrafo y lo que quede sin uso)
e2e/admin/
├── editor-documento.spec.ts      # nuevo
└── ayudas/editor.ts              # adaptado
```

**Decisión de estructura**: todo lo que depende de Tiptap vive en `apps/admin/src/componentes/editor/documento/` (la dependencia no sale de `apps/admin`). Las funciones puras (conversión, comandos sobre el rango, ids, atajos, pegado, filtro del menú) no importan React y se prueban con Vitest en entorno `node`. La gramática en línea y la partición de párrafos, que usan el sitio y el editor, viven en `packages/bloques`.

## Revisión del plan (2026-10-22)

| Origen | Hallazgo | Resolución |
|---|---|---|
| Consistencia B1 | `@floating-ui/dom` es *peer*, no dependencia; peers obligatorios del asa; `extension-placeholder` es un envoltorio; antigüedad no comprobable; peso sin umbral | `@floating-ui/dom` no se importa; peers listados y asa condicionada; se usa `@tiptap/extensions`; antigüedad reformulada; umbral de 250 KB gzip y medición de `starter-kit` (D1, D17) |
| Consistencia B2 | La ida y vuelta no vale para todo contenido válido (3+ saltos, tramos en blanco, marcas que el sitio no lee) | Separador exacto por tramo, `normalizarMarcas` y autocorrección del editor, pruebas de propiedades (D3, D4) |
| Consistencia B3 | `guardado` reinicia o no el documento (contradicción) | `guardado` no toca el documento; solo la carga y `adoptar_vigente` (D6, D11) |
| Consistencia B4 | Ids inestables, duplicados por el portapapeles, errores por posición, `updateAttributes` por selección | `asignarIds`, ids fuera del portapapeles, errores y cambios por `bloqueId`, forma funcional de los cambios (D6, D12, D21) |
| Consistencia B5 | Duplicación: cuatro vistas, panel y hoja, regla de tramos, tabla de nombres, anuncios | `NodoBloque` único, `PropiedadesDelElemento` con variante, `partirParrafos` en el paquete, nombres desde `nombreDeTipo`, `anuncios.ts` extendido |
| Consistencia B6 | Retiro de código muerto incompleto | D18 completo |
| Consistencia B7 | Criterios sin prueba (CE-003, CE-005, RF-008, RF-016, RF-017, H2 esc. 7, H3 esc. 4, casos borde) y reglas de entrada sin DOM | Filas nuevas en "Plan de pruebas"; reglas de entrada en Playwright y la parte pura en `atajos.ts` |
| Consistencia menores | `MasAcciones`, `useEditor`, U+200B, `textoPlano`, RF-016 con marcas, configuración explícita de extensiones, íconos, `next/dynamic`, enmienda de §II, tarea de la Fase 0, «bloque» en los mensajes | Incorporados en D1, D3, D8, D15, D18, D20 y en la tabla de Reutilización |
| UX B1 y B2 | Lienzo de 340 px a 1024 px; hoja y barras fijas, apilado, foco y apertura | Segunda columna desde 1280 px; Publicación fuera de las pestañas; reglas de la hoja (D9) |
| UX B3 y B4 | `role="textbox"` aplana lo de adentro; el rol del lienzo no debe cambiar | Rol nativo y fijo, `aria-activedescendant`, dos modelos de foco, plan B (D7, D14) |
| UX B5 | Atajos con conflictos del navegador, del sistema y del teclado español | Esquema nuevo sin `Alt+Shift` ni `Mod+Shift`, con camino visible para cada acción y tabla de colisiones en la Fase 0 ([atajos.md](contracts/atajos.md)) |
| UX B6 y B7 | Texto frente a elementos; vías que saltean los comandos | Modo elementos; plugin `proteger` (D10, D19) |
| UX B8 | Asa a 360 px y alcance con teclado | Asa flotante única; botón «Acciones» de la barra (D10) |
| UX B9 | Estado activo de la terciaria solo con tinte | Borde de marca en `packages/ui` (D8) |
| UX menores y sugerencias | Anuncios, foco por tipo, campo de enlace, «Más», error de carga, no editable, subida, arrastre, *placeholder*, menú en móvil, criterios de la Fase 0 | Incorporados en [atajos.md](contracts/atajos.md), [componentes.md](contracts/componentes.md) y D14 y D17 |

## Riesgos

| Id | Riesgo | Mitigación |
|---|---|---|
| R1 | El refactor de `TextoEnLinea`, `Parrafo` y `textoPlano` cambia la salida del sitio o los extractos | Pruebas de caracterización de la salida actual sobre un corpus **antes** de mover el analizador; `texto-en-linea.test.tsx`, `seguridad.test.tsx` y los E2E del sitio pasan sin cambios |
| R2 | Texto plano que el sitio leería como formato (la gramática no tiene escape) | Reglas de entrada, normalización y autocorrección del editor y U+200B como último recurso (D3) |
| R3 | El asa de la librería arrastra `yjs` al cliente | **Resuelto** en la Fase 0 (2026-10-22): asa propia, sin la extensión (D10) |
| R4 | El arrastre con el dedo no funciona con el asa de la librería | Fase 0 en dispositivos reales; eventos de puntero; si no, volver a consultar |
| R5 | Accesibilidad de un editor de texto enriquecido con lector de pantalla | Fase 0 con guion y varios lectores; roles de [atajos.md](contracts/atajos.md); axe y Lighthouse en CI; un fallo crítico dispara Lexical |
| R6 | Peso del editor en el panel | Importación dinámica, medición y tope de 250 KB gzip (D17) |
| R7 | Párrafos con líneas en blanco | Separador exacto por tramo y pruebas de propiedades (D4) |
| R8 | Límites medidos sobre el texto serializado | Contador sobre el texto serializado y aviso al cruzar el 90 % y el 100 % (D13) |
| R9 | Latencia al escribir con 200 elementos por convertir y despachar en cada tecla | Medición en la Fase 0 y conversión diferida si hace falta (D6) |
| R10 | Ids duplicados por copiar, pegar o arrastrar | `asignarIds` deduplica y los ids no viajan por el portapapeles (D21) |
| R11 | Teclados móviles y composición (IME) rompen las reglas de entrada | Fase 0 con Gboard, iOS y dictado; reglas con `beforeinput` si hace falta |
| R12 | La autocorrección de marcas mueve el cursor o confunde | Se aplica sin historial y se prueba con teclado; si molesta, se avisa en lugar de corregir |

## Seguimiento de complejidad

No hay excepciones a la constitución. La dependencia nueva está justificada en D1: el núcleo aprobado por `consistencia-codigo` y el asa condicionada a la Fase 0.
