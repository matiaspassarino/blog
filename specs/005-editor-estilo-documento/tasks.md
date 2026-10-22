---

description: "Lista de tareas: editor de notas estilo documento"
---

# Tareas: Editor de notas estilo documento

**Entrada**: Documentos de diseño en `/specs/005-editor-estilo-documento/`: [plan.md](plan.md), [spec.md](spec.md) (con Aclaraciones), [research.md](research.md) (D1–D21), [data-model.md](data-model.md), [contracts/componentes.md](contracts/componentes.md), [contracts/documento.md](contracts/documento.md), [contracts/atajos.md](contracts/atajos.md) y [quickstart.md](quickstart.md).

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: OBLIGATORIOS (constitucion.md §IX). En cada fase, las tareas de test van primero, las escribe el agente `escritor-tests` y **deben fallar** antes de implementar. Sin jsdom ni Testing Library (research D16): la lógica pura se prueba con Vitest en entorno `node` (conversión, análisis en línea, comandos sobre el rango, ids, atajos, pegado, límites, filtro del menú y los anuncios); las reglas de entrada de ProseMirror y toda la interacción (teclado, arrastre, foco, panel, hoja, lectores) se prueban con Playwright.

**Organización**: Por historia de usuario de spec.md: H1 (escribir como documento, P1), H2 (elementos especiales y panel, P1), H5 (nada se pierde, P1), H3 (mover, duplicar, quitar y seleccionar varios, P2) y H4 (atajos, pegado y deshacer, P2). La Fase 0 es una prueba de concepto con **compuerta de decisión**; la fase fundacional deja listas la gramática en línea, la conversión, el reductor y las piezas que usan todas las historias. El editor anterior se retira en la fase final (no hay interruptor).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Puede ejecutarse en paralelo: toca archivos distintos y no depende de tareas incompletas.
- **[Historia]**: US1 (H1), US2 (H2), US3 (H3), US4 (H4) o US5 (H5), según spec.md.

## Convenciones de rutas

- Paquetes: `packages/bloques/src/` (gramática en línea, partición de párrafos, clases de bloque), `packages/ui/src/` (`clases.ts`, `tokens.css`).
- Editor: `apps/admin/src/componentes/editor/` (con `documento/` y `documento/nodos/` nuevos); `apps/admin/src/lib/`; `apps/admin/src/componentes/estructura/`.
- E2E: `e2e/admin/` (proyecto `admin` de `playwright.config.ts`, `http://localhost:3100`).
- Reglas transversales:
  - **Next 16**: antes de escribir código en `apps/admin`, leer las guías de `apps/admin/node_modules/next/dist/docs/` indicadas en la tarea (`apps/admin/AGENTS.md`).
  - **UI**: solo tokens de `packages/ui/src/tokens.css`, sin hex, px sueltos ni valores arbitrarios (`[...]`) (§VII.2); textos en español con tuteo; un `h1` por pantalla; la palabra **«elemento»** (nunca «bloque») en todo lo que ve la persona (mensajes, `aria-label`, errores).
  - **Esquema único**: el esquema de bloques (`packages/bloques/src/esquema.ts`) no cambia; ninguna tarea agrega un tipo ni un campo (§VI.5).
  - **Sitio público**: `apps/web` no se toca; la salida de `TextoEnLinea`, `Parrafo` y `textoPlano` no cambia (R1: pruebas de caracterización de T012 antes de mover nada).
  - **Dependencias**: solo las de la tabla del plan, en versión exacta 3.31.4 y solo en `apps/admin`; el asa depende del resultado de la compuerta (T011). Antes de crear un archivo, revisar "Reutilización" en [plan.md](plan.md) (§VIII).
  - **Memoria**: en una PC de 8 GB, correr Playwright contra el build (`pnpm --filter admin build && pnpm --filter admin exec next start -p 3100`) y con `--workers=1`. Los Vitest de `apps/admin` y `@blog/db` corren en serie (`--no-file-parallelism`).

---

## Fase 0: Prueba de concepto y compuerta de decisión

**Propósito**: Medir lo que depende del navegador y de la librería **antes** de construir (research D17). Se hace en una rama descartable (`005-spike-tiptap`, desde esta); nada de esta fase se mergea. Los umbrales están escritos en D17.

**Quién**: T004, T005, T006 y T010 necesitan dispositivos reales, lectores de pantalla o personas y están **a cargo del usuario**. Mínimo aceptable si no hay dispositivos: emulación táctil de Chromium, una pasada con NVDA y las reglas de entrada con teclado de escritorio; se registra en D17 qué quedó sin medir y el riesgo que se asume.

- [X] T001 Crear la rama descartable `005-spike-tiptap` e instalar con `pnpm add --filter admin --save-exact` los nueve paquetes del plan en 3.31.4 (`@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extensions`, `@tiptap/suggestion`, `@tiptap/extension-drag-handle`, `@tiptap/extension-drag-handle-react`, `@tiptap/extension-node-range`); anotar los pares que pnpm agregue al lockfile (`yjs`, `@tiptap/y-tiptap`, `@tiptap/extension-collaboration`…). Leer antes la guía de Next sobre `next/dynamic`.
- [X] T002 En esa rama, crear la pantalla descartable `apps/admin/src/app/(panel)/spike/page.tsx` con: el editor (importación dinámica, `immediatelyRender: false`), una barra mínima, el asa de la librería, un nodo atómico de imagen y la maqueta del panel (pestaña desde 1280 px) y de la hoja inferior (menos de 1280 px).
- [X] T003 [P] Medir el peso: análisis del *bundle* de Next de la ruta del spike con y sin `@tiptap/extension-drag-handle*`, y con `starter-kit` frente a las extensiones individuales; anotar KB gzip adicionales frente a la ruta actual del editor (umbral: ≤ 250 KB y sin `yjs` en el cliente).
- [ ] T004 [P] Probar el arrastre con el dedo en dispositivos reales (iOS Safari y Android Chrome) con un documento largo y desplazamiento automático: reordena con el asa y el desplazamiento vertical sobre el texto no dispara nada. **Medida parcialmente** (2026-10-22, teléfono del usuario): el asa de la librería **no arrastra con el dedo** (sí con ratón); confirma el asa propia (T067), que debe repetir esta prueba con el dedo; en móvil «Publicar» debe verse en la barra fija (ver research D17).
- [ ] T005 [P] Pasar el guion de lectores de pantalla (NVDA con Chrome y Firefox, VoiceOver iOS, TalkBack y, si hay Mac, VoiceOver macOS) con aprobado o reprobado: barra, títulos y listas del lienzo, menú `/` con la opción activa, insertar una imagen y su foco, mover con teclado, panel y vuelta, modo elementos y que `Esc` no saque del modo foco; comparar el lienzo con y sin `role="textbox"`. **Diferida** (sin lector real): solo se midió el árbol de accesibilidad de Chromium; riesgo R5 asumido en research D17; pasada con NVDA en T081 si es posible.
- [ ] T006 [P] Probar teclados móviles y composición (Gboard, iOS, dictado) y teclado español y latinoamericano: Enter, Retroceso, `## `, `- `, `1. `, `**x**`, `/`, `[`, `` ` `` y el acento muerto. **Parcial**: escritorio medido (reglas OK); teclados móviles y composición sin medir; riesgo R11 asumido en research D17.
- [X] T007 [P] Armar la tabla de colisiones de los atajos de [contracts/atajos.md](contracts/atajos.md) por plataforma (Windows, Mac, Linux) y distribución (es-ES, es-LA, en-US); cambiar los que choquen.
- [X] T008 [P] Medir la latencia de tecla (INP) con 200 elementos y nodos con imágenes en un equipo de gama baja (umbral < 100 ms) y el menú con 50 elementos (< 200 ms).
- [X] T009 [P] Probar `forced-colors`, zoom de 200 % y 400 % y la hoja de propiedades a 360 × 640 con el teclado virtual abierto.
- [ ] T010 Probar la descubribilidad con 2 o 3 personas y la maqueta: ¿encuentran «Insertar», el asa y el panel en menos de un minuto sin ayuda? **Diferida** (sin personas): riesgo asumido en research D17; entra en la prueba de T082 (CE-001 y CE-007).
- [X] T011 **COMPUERTA**: registrar en [research.md](research.md#d17-fase-0-prueba-de-concepto-umbrales-y-regla-de-decisión) los resultados y la decisión (asa de la librería o propia, `starter-kit` o extensiones individuales, con o sin `role="textbox"`, cambios de atajos, **Lexical sí o no**); actualizar la tabla de dependencias de [plan.md](plan.md) y los contratos si algo cambia; descartar la rama `005-spike-tiptap`. Si un fallo crítico de accesibilidad o dos o más criterios no se resuelven, comparar con Lexical (repetir T002 a T009) y decidir con el usuario **antes** de seguir. Pedir además a `consistencia-codigo` la **aprobación del asa** (`@tiptap/extension-drag-handle*` y `@tiptap/extension-node-range`, o del asa propia) según la constitución §II y registrarla en research.md: sin esa aprobación T040 no instala esos paquetes. T012, T013 y la parte pura de la fase 2 (T014 a T035) pueden adelantarse mientras se miden T003 a T010; **T040 en adelante empieza solo después de esta tarea**.

**Checkpoint**: decisión registrada; la lista de dependencias y la forma del asa quedan fijadas.

---

## Fase 1: Preparación

**Propósito**: Red de seguridad antes de mover la gramática del sitio y datos de prueba compartidos (§VIII: jscpd también cuenta `e2e/`).

- [X] T012 Escribir las pruebas de **caracterización** de la salida actual, que deben pasar contra el código de hoy: ampliar `packages/bloques/src/render/texto-en-linea.test.tsx` con un corpus de textos (marcas anidadas, sin cerrar, con espacios en los bordes, `_` dentro de palabras, URL con paréntesis, enlaces inseguros, caracteres propios `*`, `[`, `` ` ``) comparando `renderToStaticMarkup` con el HTML esperado; agregar `packages/bloques/src/utilidades.test.ts` (o ampliarlo) para `textoPlano` sobre el mismo corpus; y `packages/bloques/src/render/bloques.test.tsx` para párrafos con `\n`, `\n\n` y `\n\n\n`. `pnpm --filter @blog/bloques test` en verde.
- [X] T013 [P] Crear `packages/bloques/src/pruebas/corpus-contenido.ts`: contenidos válidos con los diez tipos, párrafos con saltos simples y con dos, tres y cuatro líneas en blanco, tramos vacíos o de solo espacios, textos con marcas propias y los textos de los artículos del seed copiados; lo usan `conversion.test.ts` y `en-linea.test.ts`. No se exporta desde `index.ts` (solo pruebas; knip lo ignora como archivo de prueba).

---

## Fase 2: Fundacional (bloqueante)

**Propósito**: La gramática en línea única, la partición de párrafos, la conversión documento ↔ bloques, la identidad de los elementos, el reductor, los anuncios, el menú con teclado y los cambios de `packages/ui`. Ninguna historia puede empezar antes.

### Tests (escribir primero, deben fallar)

- [X] T014 [P] Crear `packages/bloques/src/en-linea.test.ts` (research D3, [contracts/documento.md](contracts/documento.md)): propiedad `serializarEnLinea(analizarEnLinea(x)) === x` sobre el corpus y sobre textos al azar; propiedad `analizarEnLinea(serializarEnLinea(n))` igual a `normalizarMarcas(n)` sobre árboles al azar con las cuatro marcas, espacios en los bordes, cruces, anidado y nodos de texto adyacentes; casos de la revisión (negrita con espacio final, cursiva en `foo_bar_`, código que contiene una comilla invertida, etiqueta de enlace con `](`); U+200B solo para texto plano ambiguo.
- [X] T015 [P] Crear `packages/bloques/src/parrafos.test.ts`: `unirParrafos(partirParrafos(x)) === x` para `A\n\nB`, `A\n\n\nB`, `A\n\n`, `A\n\n  \n\nB` y textos al azar; el separador exacto de cada tramo; texto sin líneas en blanco da un solo tramo.
- [X] T016 [P] Crear `apps/admin/src/componentes/editor/documento/conversion.test.ts`: `documentoABloques(bloquesADocumento(c))` igual a `c` para todo el corpus de T013 (ids, orden y campos); campos opcionales vacíos omitidos (`autor`, `fuente`, `lenguaje`, `leyenda`); el documento vacío da `[]` y `bloquesADocumento([])` da un solo párrafo; un `paragraph` con `continuacion` vacío se conserva; un `bloqueId` vacío hace fallar a `documentoABloques` (no genera ids); un ítem de lista o una cita con `\n` se conserva.
- [X] T017 [P] Crear `apps/admin/src/componentes/editor/documento/ids.test.ts`: `asegurarIds(doc)` asigna un uuid **una sola vez** a los nodos con `bloqueId` vacío, conserva los existentes, deduplica repetidos (queda el primero), no asigna `continuacion` a un nodo nuevo y es idempotente; el `bloqueId` y `continuacion` no salen en el HTML del portapapeles.
- [X] T018 [P] Ampliar `packages/ui/src/clases.test.ts`: la terciaria con `aria-pressed` suma `aria-pressed:border-marca` y su contraste contra el fondo es ≥ 3:1 (WCAG 1.4.11); la salida de `clasesBoton()` sin opciones sigue idéntica (el sitio no cambia).
- [X] T019 [P] Actualizar `apps/admin/src/componentes/editor/anuncios.test.ts` para los mensajes de [contracts/atajos.md](contracts/atajos.md): insertar, mover, duplicar, quitar (con uno y con varios), convertir, modo elementos, pegado con sobrante, límites ("Quedan 500 caracteres (se cuentan las marcas de formato)" al cruzar el 90 %), deshacer y rehacer con el nombre de la acción, subida en curso; ninguna cadena contiene la palabra «bloque» (`resumenDeErrores` dice «elemento»).
- [X] T020 [P] Ampliar `apps/admin/src/componentes/editor/reductor.test.ts`: la acción `{ tipo: 'contenido', valor }` reemplaza `datos.contenido` y la deja sucia respecto de lo guardado; `guardado` y `adoptar_vigente` siguen igual; `CambiosDeBloque` se importa de `bloques/tipos.ts`.
- [X] T021 [P] Crear `apps/admin/src/lib/menu-teclado.test.ts` para las funciones puras de `useMenuTeclado`: índice siguiente y anterior con vuelta, `Inicio` y `Fin`, índice por letra tipeada (*typeahead*) sin tildes ni mayúsculas, que los ítems deshabilitados se salteen.

### Implementación

- [X] T022 `packages/bloques/src/en-linea.ts`: extraer el analizador de `render/TextoEnLinea.tsx` **sin cambiar su comportamiento** a `analizarEnLinea(texto): NodoEnLinea[]` y agregar `serializarEnLinea` y `normalizarMarcas` ([contracts/documento.md](contracts/documento.md)); tipo `NodoEnLinea` (`texto | negrita | cursiva | codigo | enlace`). T012 y T014 en verde.
- [X] T023 `packages/bloques/src/render/TextoEnLinea.tsx`: pintar el árbol de `analizarEnLinea` (`strong`, `em`, `code`, `a`, `span` si el enlace no es seguro) con la misma salida HTML; `packages/bloques/src/utilidades.ts`: `textoPlano` pasa a `analizarEnLinea` (revisar el efecto en extractos y en `ComparacionVersiones`; U+200B se ignora). T012 sigue en verde.
- [X] T024 [P] `packages/bloques/src/parrafos.ts`: `partirParrafos` y `unirParrafos` con el separador exacto; `render/Parrafo.tsx` las usa y sigue descartando al pintar los tramos en blanco. T012 y T015 en verde.
- [X] T025 [P] `packages/bloques/src/render/clases.ts`: constantes con las clases de tipografía hoy sueltas en `Parrafo.tsx`, `Titulo.tsx`, `Cita.tsx`, `Lista.tsx` y `Codigo.tsx`; esos componentes las usan; exportarlas desde `render/index.ts`. T012 sigue en verde.
- [X] T026 `packages/bloques/src/index.ts`: exportar `analizarEnLinea`, `serializarEnLinea`, `normalizarMarcas`, `NodoEnLinea`, `partirParrafos`, `unirParrafos` (los exports de lo que se elimina salen en T078).
- [X] T027 [P] `packages/ui/src/clases.ts` y `packages/ui/src/tokens.css`: `aria-pressed:border-marca` en la terciaria y los tokens `--container-panel-propiedades`, `--carril-asa` (= `--tactil-min`) y `--alto-hoja-propiedades` (45 dvh). T018 en verde; `pnpm --filter web build` sin cambios en el CSS del sitio más allá de las clases nuevas.
- [X] T028 `apps/admin/src/componentes/editor/documento/conversion.ts`: `bloquesADocumento` y `documentoABloques` según [contracts/documento.md](contracts/documento.md), usando `partirParrafos`, `unirParrafos`, `analizarEnLinea`, `serializarEnLinea` y `normalizarMarcas`; JSON puro sin importar React ni Tiptap. T016 en verde.
- [X] T029 [P] `apps/admin/src/componentes/editor/documento/ids.ts`: `asegurarIds(doc)` puro (y, más adelante, el plugin que lo aplica con `appendTransaction`). T017 en verde.
- [X] T030 `apps/admin/src/componentes/editor/reductor.ts`: agregar la acción `{ tipo: 'contenido', valor: Contenido }` y mover el tipo `CambiosDeBloque` a `apps/admin/src/componentes/editor/bloques/tipos.ts` (actualizar a quienes lo importan). Las acciones por bloque siguen hasta T078. T020 en verde.
- [X] T031 [P] `apps/admin/src/componentes/editor/ContextoEditor.tsx`: renombrar `useEditor` a `useContextoEditor` y actualizar todos los usos (choca por nombre con `useEditor` de `@tiptap/react`).
- [X] T032 [P] `apps/admin/src/componentes/editor/anuncios.ts`: agregar los mensajes nuevos de [contracts/atajos.md](contracts/atajos.md) y cambiar «bloque» por «elemento» en `resumenDeErrores` y en los nombres reutilizados; las funciones viejas (`etiquetaDeBloque`, `nombreDeBoton`, `anuncioDeMovimiento`, `anuncioDeQuitado`) siguen hasta T078. T019 en verde.
- [X] T033 [P] `apps/admin/src/lib/menu-teclado.ts`: hook `useMenuTeclado({ items, abierto, alCerrar, alElegir })` con `propsDeContenedor` y `propsDeItem` (flechas, `Inicio`, `Fin`, escritura por letra, `Tab`, `Esc`), apoyado en `useDesplegable` solo para el clic fuera y el cierre al navegar; funciones puras exportadas. T021 en verde.
- [X] T034 [P] `apps/admin/src/componentes/estructura/MasAcciones.tsx`: hacer la dirección de apertura (arriba o abajo) y el corte por *container query* props con los valores de hoy por defecto (`BarraEditor` no cambia); `apps/admin/src/componentes/estructura/estructura.test.tsx` cubre las dos direcciones.
- [X] T035 [P] `apps/admin/src/componentes/Icono.tsx`: agregar los íconos `negrita`, `cursiva`, `codigo`, `enlace`, `lista`, `lista_numerada`, `deshacer`, `rehacer`, `asa`, `insertar`, `acciones` y `propiedades`, con el mismo formato de trazado que los existentes (`currentColor`, `aria-hidden`).

**Checkpoint**: `pnpm --filter @blog/bloques test`, `pnpm --filter @blog/ui test`, `pnpm --filter admin test` y `pnpm typecheck` en verde; el sitio se ve igual (T012).

---

## Fase 3: Historia 1 - Escribir como en un documento de texto (Prioridad: P1) 🎯 MVP

**Objetivo**: El cuerpo del artículo es un lienzo de documento con la tipografía del sitio y una barra de herramientas; Enter, Retroceso, estilos de párrafo, marcas en línea y el menú «/» e «Insertar» para los elementos de texto.

**Prueba independiente**: crear un artículo nuevo y escribir un título, dos párrafos con una palabra en negrita, una lista y una cita con la barra y el teclado, y comprobar que al guardar el contenido tiene esos elementos en ese orden.

### Tests de la Historia 1 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T036 [P] [US1] Crear `apps/admin/src/componentes/editor/documento/atajos.test.ts`: `detectarAtajo(texto)` puro (`## `, `### `, `#### `, `- `, `* `, `1. `, `> `, `---`, tres comillas invertidas, solo al comienzo de una línea vacía) y `puedeAbrirMenu(contexto)` (solo en una línea vacía; no en medio de un texto ni de una URL).
- [X] T037 [P] [US1] Crear `apps/admin/src/componentes/editor/documento/menu-insercion.test.ts`: `filtrarItems` sin tildes ni mayúsculas, por nombre y descripción; `/tit` encuentra los títulos; `/zzz` da lista vacía; los nombres salen de `nombreDeTipo` (sin tabla paralela).
- [X] T038 [P] [US1] Crear `apps/admin/src/componentes/editor/documento/BarraHerramientas.test.tsx` (render estático): `role="toolbar"` con nombre "Formato del texto", un solo control con `tabindex=0`, `aria-pressed` en los de estado, «Insertar» presente y fuera de «Más» (se escribe después de T040: la barra importa tipos de `@tiptap/react`, y debe fallar por la aserción y no por un módulo faltante), botones `terciaria` y `compacto`.
- [X] T039 [US1] Crear `e2e/admin/editor-documento.spec.ts`, bloque "Escribir como documento" (H1 esc. 1 a 7): artículo nuevo con un párrafo vacío y la barra, sin «Agregar bloque»; Enter, Retroceso (nunca queda sin párrafo) y salir de una lista; negrita, cursiva, código y enlace con barra y atajo; estilo de párrafo desde la barra; menú `/` filtrable con flechas, Enter y Esc, y no se abre en medio de un texto; la tipografía de títulos y párrafos coincide con la del sitio. Agregar a `e2e/admin/ayudas/editor.ts` las ayudas del lienzo y la barra (`lienzo(page)`, `barraDeFormato(page)`, `escribirEnLienzo(page, texto)`, `abrirMenuInsertar(page)`).

### Implementación de la Historia 1

- [X] T040 [US1] Instalar las dependencias **definitivas** en `apps/admin/package.json` en versión exacta 3.31.4 (`@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extensions` y `@tiptap/suggestion`, ya aprobadas por `consistencia-codigo`; el asa es propia y no suma paquetes, T011) y correr `pnpm install`; confirmar que `pnpm calidad` no marca dependencias sin uso a medida que T041 a T046 las usan.
- [X] T041 [US1] `apps/admin/src/componentes/editor/documento/extensiones.ts`: esquema del documento y extensiones según research D2 y D3: nodos de [contracts/documento.md](contracts/documento.md) (`paragraph` con `bloqueId` y `continuacion` con `keepOnSplit: false`, `heading` 2 a 4 sin marcas, `blockquote` de un solo párrafo con `autor` y `fuente`, listas sin anidar con ítems de un párrafo, `codeBlock` con `lenguaje`, `horizontalRule`), marcas `bold`, `italic`, `code` y `link` (solo `https://` y rutas internas), **sin** strike, underline ni `hardBreak` en títulos, ítems y citas, `TrailingNode`, `Placeholder` con contraste, historial de `@tiptap/extensions`, el plugin `asignarIds` (T029) y la normalización de marcas en una transacción sin historial; `bloqueId` y `continuacion` fuera del portapapeles.
- [X] T042 [P] [US1] `apps/admin/src/componentes/editor/documento/atajos.ts`: `detectarAtajo` y `puedeAbrirMenu` (T036 en verde) y las reglas de entrada de ProseMirror que los usan, más los atajos de formato (`Mod+B`, `Mod+I`, `Mod+E`, `Mod+K`) y de deshacer y rehacer de [contracts/atajos.md](contracts/atajos.md); los comandos de formato aplican las reglas de D3 (recortar los espacios de la selección, extender la cursiva a la palabra completa, rechazar código con comilla invertida y etiqueta con `](`).
- [X] T043 [P] [US1] `apps/admin/src/componentes/editor/documento/menu-insercion.ts` (lista de elementos de texto y filtro puros; T037 en verde) y `MenuInsertar.tsx`: `role="listbox"` con opciones, «Sin resultados» como `role="status"`; desde `/` el foco queda en el lienzo con `aria-haspopup`, `aria-controls` y `aria-activedescendant`; desde «Insertar» el foco entra al listbox y vuelve al lienzo; posición con el `clientRect` de `@tiptap/suggestion` y `visualViewport` (sin `@floating-ui/dom`); usa `useMenuTeclado` (T033).
- [X] T044 [US1] `apps/admin/src/componentes/editor/documento/BarraHerramientas.tsx` (T038 en verde): `role="toolbar"` con un solo tope de tabulación y flechas, selector de estilo de párrafo (muestra el vigente como texto), negrita, cursiva, código, enlace (campo de URL con su propio modelo de foco: `Enter` aplica, `Esc` cierra y devuelve el foco al lienzo), listas, **Insertar** (siempre visible), deshacer y rehacer; `MasAcciones` (T034) para lo que no entra, con los ocultos `inert`; `sticky top-0`; `pointerdown` con `preventDefault` para no perder el teclado virtual; botones de la primitiva (`terciaria`, `compacto`).
- [X] T045 [US1] `apps/admin/src/componentes/editor/documento/EditorDocumento.tsx`: `useEditor({ immediatelyRender: false })` con las extensiones de T041, el `contenteditable` nativo con nombre "Contenido del artículo" y `aria-multiline` (el rol según la decisión de T011), `Placeholder` ("Escribe o pulsa / para insertar"; "Usa Insertar" en táctil), importación dinámica con esqueleto y error de carga con «Reintentar», `bloqueado` con `setEditable(false)` y `aria-readonly`, `alCambiar` con `documentoABloques` en cada transacción (conversión diferida solo si T008 lo pidió), `reinicio` que recrea el documento y su historial, y el botón de «Insertar» en cada línea vacía.
- [X] T046 [US1] `apps/admin/src/componentes/editor/EditorArticulo.tsx`: la sección «Contenido» pasa a `EditorDocumento` (despacha `{ tipo: 'contenido', valor }`); mantener la región de estado persistente de `ContextoEditor` y las validaciones de `guardar()`; el diseño de una sola columna por debajo de 1280 px (la segunda columna llega en T053). La lista de bloques vieja queda sin uso hasta T078. T039 en verde.

**Checkpoint**: T036 a T039 en verde; se escribe, se da formato y se insertan elementos de texto desde el teclado y desde «Insertar».

---

## Fase 4: Historia 2 - Elementos especiales y panel de propiedades (Prioridad: P1)

**Objetivo**: Imagen, galería, llamada a la acción, video, código y separador se insertan desde «Insertar» y «/», se ven en el lienzo como en el sitio y sus campos se editan en el panel de propiedades (pestaña desde 1280 px, hoja por debajo), con errores por elemento.

**Prueba independiente**: insertar uno de cada elemento, completar sus campos obligatorios en el panel y guardar; el contenido guardado y la vista previa coinciden con lo escrito.

### Tests de la Historia 2 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T047 [P] [US2] Crear `apps/admin/src/componentes/editor/documento/mapa-errores.test.ts`: `ErrorBloque.indice` → `bloqueId` con la lista convertida (el índice del bloque no es la posición del elemento: párrafos vacíos y continuaciones no cuentan); el primer error por orden del documento; errores de la imagen destacada (`indice: -1`) no se asignan a nodos.
- [X] T048 [P] [US2] Crear `apps/admin/src/componentes/editor/documento/PropiedadesDelElemento.test.tsx` (render estático): cada tipo muestra solo sus propiedades (título: nivel; cita: autor y fuente; lista: ordenada; código: lenguaje; imagen, galería, llamada a la acción y video: sus campos completos); párrafo y separador muestran "Este elemento no tiene propiedades. Escribe en el documento."; con varios elementos, "3 elementos seleccionados"; la variante hoja tiene botón «Cerrar» y es un `aside` con nombre "Propiedades del elemento 3, imagen".
- [X] T049 [US2] En `e2e/admin/editor-documento.spec.ts`, bloque "Elementos especiales y panel" (H2 esc. 1 a 7; CE-003 en su parte de insertar): «Insertar» y `/` ofrecen los diez tipos con nombre y descripción; insertar cada uno y completar sus campos en el panel; la imagen sube (JPEG, PNG, WebP, AVIF, hasta 5 MB) y exige texto alternativo o decorativa; el lienzo se actualiza al cambiar un campo; un elemento con error muestra texto de error y al guardar se selecciona y el panel enfoca el primer campo con error; a 1280 px el panel es la pestaña «Elemento» (con «Publicación» siempre visible) y por debajo es una hoja que se abre solo con «Propiedades» o `Enter` y no roba el foco; la pestaña cambia sola solo al seleccionar un elemento especial; el nombre "Imagen, 3 de 8" y el acceso al panel con teclado (árbol de accesibilidad); foco tras insertar según la tabla de [contracts/atajos.md](contracts/atajos.md).

### Implementación de la Historia 2

- [X] T050 [US2] `apps/admin/src/componentes/editor/documento/nodos/NodoBloque.tsx` y su registro en `extensiones.ts`: **una** vista con una fábrica por tipo (`imagenBloque`, `galeriaBloque`, `ctaBloque`, `videoBloque`), nodos `atom` con el atributo `bloque` y `draggable=false`; la vista llama a `Bloques` con una lista de un bloque y los `componentes` de la vista previa (`ImagenAdmin`); nombre en la isla ("Imagen, 3 de 8"); texto de error cuando hay un error de validación; contorno de 2 px al seleccionar; botones internos con `tabindex=-1`; con subida en curso, texto de progreso y mover y quitar con `aria-disabled` y la razón; «Subir imagen» abre el campo del panel.
- [X] T051 [P] [US2] `apps/admin/src/componentes/editor/bloques/Editor{Titulo,Cita,Lista,Codigo}.tsx`: prop `soloPropiedades` que oculta el campo de texto y deja nivel, autor y fuente, tipo de lista y lenguaje; eliminar `bloques/EditorParrafo.tsx` y sus usos en `EditorDeBloque.tsx`.
- [X] T052 [US2] `apps/admin/src/componentes/editor/documento/PropiedadesDelElemento.tsx`: **un solo** componente con `variante: 'lateral' | 'hoja'` que muestra `EditorDeBloque` con el bloque del nodo y `alCambiar` con la forma funcional de `CambiosDeBloque`; y en `apps/admin/src/componentes/editor/documento/comandos.ts` el comando `actualizarBloque(bloqueId, cambios)` que busca el nodo **por `bloqueId` al aplicar** (no por la selección). T048 en verde.
- [X] T053 [US2] `apps/admin/src/componentes/editor/EditorArticulo.tsx` y su CSS: desde 1280 px, dos columnas con el lienzo a la izquierda y a la derecha (`xl:sticky`, alto máximo de la ventana con desplazamiento propio) **Publicación** fija y debajo las pestañas «Artículo» (taxonomías y para buscadores) y «Elemento» (`role="tablist"`, `tab`, `tabpanel`, flechas); por debajo de 1280 px, una columna y `HojaPropiedades` como `aside` no modal (alto máximo `--alto-hoja-propiedades`, apilada **sobre** la barra fija de `BarraEditor`, `scroll-margin-bottom` del lienzo igual a su alto, `visualViewport` e `interactive-widget=resizes-content`, «Cerrar» y `Esc` al final del orden de `Esc`, anuncio al abrir); ancho de la columna con `--container-panel-propiedades`.
- [X] T054 [US2] `apps/admin/src/componentes/editor/documento/mapa-errores.ts` y el enfoque del primer error en `EditorArticulo.tsx`: traducir `ErrorBloque.indice` a `bloqueId` (T047 en verde), marcar los nodos con error por `bloqueId` y, al guardar con errores, seleccionar el nodo y enfocar el campo del panel (`seleccionarBloque` y `enfocarCampo` de `EditorDocumento`).
- [X] T055 [US2] `apps/admin/src/componentes/editor/documento/menu-insercion.ts` y `MenuInsertar.tsx`: sumar imagen, galería, llamada a la acción, video, código y separador con `crearBloque(tipo)` para los valores iniciales; foco al terminar según la tabla de [contracts/atajos.md](contracts/atajos.md); al llegar a 200 elementos, avisar "Se alcanzó el máximo de 200 elementos" y no insertar. T049 en verde.

**Checkpoint**: T047 a T049 en verde; los diez tipos se insertan, se ven como en el sitio y se editan en el panel.

---

## Fase 5: Historia 5 - Que nada de lo que ya funciona se pierda (Prioridad: P1)

**Objetivo**: Los artículos existentes se abren y se guardan idénticos; las validaciones, los avisos, el conflicto, las subidas y los flujos de las specs 003 y 004 siguen cumpliéndose con el editor nuevo.

**Prueba independiente**: abrir y guardar sin tocar cada artículo del seed y uno con los diez tipos; el contenido guardado es idéntico y la versión no cambia.

### Tests de la Historia 5 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T056 [US5] En `e2e/admin/editor-documento.spec.ts`, bloque "Nada se pierde" (H5 esc. 1 a 6, CE-002): abrir y guardar sin tocar los artículos reales del seed y uno con los diez tipos, y un artículo con asteriscos, guiones bajos, corchetes y comillas invertidas propios: contenido idéntico y versión sin cambios (consulta a la base con `e2e/admin/ayudas/articulos.ts`); publicar o archivar desde la barra **no** reinicia el documento (se conserva el cursor y el historial) y `adoptar_vigente` sí; con 360 px la barra se reacomoda con «Más» y «Insertar» sigue visible. RF-018: con la pestaña «Elemento» activa, «Publicación» sigue visible y la barra de acciones del artículo de la spec 004 y los permisos de editor y admin no cambian. Tras guardar, el contenido que devuelve el servidor es idéntico al enviado y el documento no se toca; si el servidor devolviera otro (por ejemplo, normalizado), el editor lo adopta, conserva la selección cuando puede y lo avisa.
- [ ] T057 [US5] Adaptar `e2e/admin/ayudas/editor.ts` (`agregarBloque` inserta desde «Insertar» o `/`; `grupoDeBloque` ubica el elemento en el lienzo; `completarBloque` completa los campos en el panel; `elegirImagen` sube desde el panel) y `e2e/admin/articulo-editor.spec.ts` (los 10 tipos, errores por elemento, mover en los extremos con el teclado y cambios sin guardar). Deben fallar contra el editor actual y pasar al final de esta fase.
- [ ] T058 [P] [US5] Adaptar `e2e/admin/casos-borde.spec.ts` (subida fallida, slug repetido y publicado sin bloques sobre el lienzo y el panel), `e2e/admin/articulo-conflicto.spec.ts` (la comparación y «Reemplazar con la vigente» reinician el documento y el historial), `e2e/admin/medios.spec.ts` y `e2e/admin/permisos.spec.ts` (imagen destacada y de elemento sobre el lienzo y el panel).
- [ ] T059 [P] [US5] Adaptar `e2e/admin/accesibilidad.spec.ts`: axe sobre el editor nuevo con el menú `/` abierto, con el panel y con la hoja abiertos, en los cuatro anchos; el editor sin violaciones.

### Implementación de la Historia 5

- [ ] T060 [US5] `apps/admin/src/componentes/editor/EditorArticulo.tsx` y `documento/EditorDocumento.tsx`: `guardado` **no** toca el documento (también se despacha al publicar o archivar desde `BarraEditor.alCambiarEstado`); solo la carga inicial y `adoptar_vigente` suben `reinicio`; el aviso de conflicto, `ComparacionVersiones` y «Reemplazar con la vigente» funcionan con el documento; las subidas en curso bloquean guardar como hoy; la limpieza de imágenes sin uso sigue (`rutasDeImagenes`); si el contenido que devuelve el servidor difiere del enviado, se adopta con `setContent` (conservando la selección cuando se pueda) y se avisa por la región de estado; si es idéntico, no se toca nada. T056 a T059 en verde.
- [ ] T061 [US5] `apps/admin/src/componentes/editor/ComparacionVersiones.tsx` y los textos de `AvisoConflicto.tsx`: usar «elemento» en lugar de «bloque» y comprobar que `textoPlano` (ahora sobre `analizarEnLinea`) sigue dando la comparación esperada.

**Checkpoint**: T056 a T059 en verde; el editor nuevo cumple todo lo que cumplía el anterior, salvo mover, duplicar y quitar (Historia 3).

---

## Fase 6: Historia 3 - Mover, duplicar, quitar y seleccionar varios elementos (Prioridad: P2)

**Objetivo**: Asa para ratón y toque con arrastre, botón «Acciones» en la barra para teclado y lectores, modo elementos con selección de varios, una sola ruta de borrado protegida y atajos documentados.

**Prueba independiente**: con un artículo de cinco elementos, mover el tercero al principio (arrastrando y con teclado), duplicar el segundo, convertir un párrafo en cita y quitar el último, y comprobar el orden y el tipo resultantes.

### Tests de la Historia 3 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T062 [P] [US3] Crear `apps/admin/src/componentes/editor/documento/comandos.test.ts`: `rangoDeElementos` solo en modo elementos (un rango de texto no cuenta); `moverRango`, `duplicarRango` y `quitarRango` con uno y con varios elementos, en una sola transacción, con los extremos devolviendo `false` y los ids de los duplicados vacíos; `convertirElemento` entre texto con el texto intacto y `{ pierde }` para lista de varios ítems a párrafo, cita con autor o fuente a párrafo y párrafo con marcas a título o código; no se ofrece con varios elementos.
- [X] T063 [P] [US3] Crear `apps/admin/src/componentes/editor/documento/proteger.test.ts`: `decidirBorrado(estado, contexto)` puro: bloquea quitar o mover un elemento con subida en curso, exige confirmación para una imagen ya guardada (por cualquier vía: menú, atajo, `Supr`, cortar, escribir sobre la selección, `Mod+A` y borrar) y deja pasar lo demás con el anuncio "Elemento quitado. Pulsa Ctrl+Z para deshacer".
- [X] T064 [US3] En `e2e/admin/editor-documento.spec.ts`, bloque "Mover, duplicar, quitar y seleccionar" (H3 esc. 1 a 11; CE-003): botón «Acciones» con menú de flechas, `Inicio`, `Fin` y letra; mover, duplicar, convertir y quitar con menú y con los atajos (`Alt+↑/↓`, `Mod+D`, `Supr`) en modo elementos; `Esc` entra y sale del modo; un rango de texto que cruza párrafos no habilita mover ni quitar; `Shift+↑/↓` amplía y se anuncia la cantidad solo al entrar, salir y terminar; marca no cromática y texto fijo; arrastrar el asa con el ratón y con emulación táctil, el desplazamiento táctil sobre el texto no arrastra, soltar fuera o `Esc` cancela; una imagen ya guardada pide confirmación por cualquier vía; con subida en curso no se puede mover ni quitar; un solo Deshacer revierte una acción de varios elementos; la hoja y el menú siguen el orden de `Esc`. CE-003: los diez tipos y el reordenamiento de cinco elementos solo con teclado.

### Implementación de la Historia 3

- [X] T065 [US3] `apps/admin/src/componentes/editor/documento/comandos.ts`: `rangoDeElementos`, `moverRango`, `duplicarRango`, `quitarRango` y `convertirElemento` como transacciones únicas, más la selección del modo elementos (`Esc`, ampliar con `Shift+↑/↓`) sobre los hijos de primer nivel. T062 en verde.
- [X] T066 [US3] `apps/admin/src/componentes/editor/documento/proteger.ts`: plugin con `filterTransaction`, `handleKeyDown` y `handleDrop` que unifica toda vía de borrado y movimiento (T063 en verde): bloquea con subida en curso, exige la confirmación de hoy para una imagen ya guardada (`ConfirmarAccion`) y anuncia con "Ctrl+Z para deshacer"; los nodos no son arrastrables por sí mismos.
- [X] T067 [US3] `apps/admin/src/componentes/editor/documento/AsaDeElemento.tsx`: asa flotante única que sigue al elemento activo, para ratón y toque (`tabindex=-1`, nombre "Acciones del elemento N, tipo"), con el carril `--carril-asa` desde 768 px y sobre el elemento activo por debajo, `touch-action: none` solo en el botón, indicador de destino con texto ("Soltar aquí: posición 3 de 8") y desplazamiento automático que respeta `prefers-reduced-motion`; es un asa **propia** (decidido en T011: la de la librería trae `yjs` al cliente), con el arrastre de ProseMirror y eventos de puntero para el dedo, y sin `@tiptap/extension-node-range`.
- [X] T068 [US3] `apps/admin/src/componentes/editor/documento/BarraHerramientas.tsx` y un `MenuAcciones`: botones «Acciones» (`aria-haspopup="menu"`, `aria-expanded`) y «Propiedades» (con un elemento especial o con propiedades seleccionado) en la barra, menú con `useMenuTeclado` (Subir, Bajar, Duplicar, Convertir en…, Quitar, Seleccionar, Propiedades y Atajos), atajos de [contracts/atajos.md](contracts/atajos.md), foco tras cada acción según su tabla y anuncios de `anuncios.ts`; «Subir» y «Bajar» no están disponibles en los extremos.
- [X] T069 [US3] Modo elementos en la interfaz: texto fijo "N elementos seleccionados" y botón «Salir de la selección» junto a la barra, marca no cromática en cada elemento seleccionado (borde de 2 px a la izquierda e ícono de verificación, contraste ≥ 3:1, visible en `forced-colors`) y el diálogo «Atajos de teclado» (`apps/admin/src/componentes/editor/documento/AyudaAtajos.tsx`, con foco gestionado) alcanzable desde el menú de acciones. T064 en verde.

**Checkpoint**: T062 a T064 en verde; mover, duplicar, convertir y quitar funcionan con teclado, menú, asa y selección múltiple.

---

## Fase 7: Historia 4 - Atajos de escritura, pegado y deshacer (Prioridad: P2)

**Objetivo**: Atajos tipo Markdown con deshacer inmediato, pegado limpio con sobrante a párrafos nuevos, avisos de límite de caracteres y un solo historial con mensajes que nombran la acción.

**Prueba independiente**: escribir «## Mi título» al comienzo de una línea y comprobar que se convierte en un título; pegar un texto de un documento con formato y comprobar que solo conserva las cuatro marcas permitidas.

### Tests de la Historia 4 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T070 [P] [US4] Crear `apps/admin/src/componentes/editor/documento/pegado.test.ts` y `apps/admin/src/componentes/editor/documento/limites.test.ts`: partir un párrafo pegado que supera 5000 caracteres en párrafos nuevos cortando en fin de oración o de palabra (nunca a mitad de palabra), cuántos se crearon, texto sin pérdida; en títulos, citas, ítems y código el sobrante no crea elementos de otro tipo; el conteo es del texto **serializado** (con marcadores y URL, sin U+200B); avisos al cruzar el 90 % y el 100 % sin repetirse; límite de 200 elementos.
- [ ] T071 [US4] En `e2e/admin/editor-documento.spec.ts`, bloque "Atajos, pegado y deshacer" (H4 esc. 1 a 5): `## `, `### `, `#### `, `- `, `1. `, `> `, `---` y las tres comillas invertidas convierten la línea; Deshacer inmediato deja el texto escrito; `Mod+Z` y `Mod+Shift+Z` sobre un solo historial (texto, formato y acciones sobre elementos, y un elemento quitado se recupera); pegar HTML con colores, tipografías y tamaños deja solo las cuatro marcas; pegar un párrafo de más de 5000 caracteres crea los párrafos nuevos y se anuncia; copiar y pegar elementos nunca duplica ids; CE-006: el menú `/` e «Insertar» abren en menos de 200 ms con 50 elementos y el máximo de 200 se comporta como [contracts/atajos.md](contracts/atajos.md).

### Implementación de la Historia 4

- [ ] T072 [US4] `apps/admin/src/componentes/editor/documento/atajos.ts` y `extensiones.ts`: completar las reglas de entrada de bloque (`## `, `### `, `#### `, `- `, `* `, `1. `, `> `, `---`, tres comillas invertidas) y de línea (`**x**`, `_x_`, `` `x` ``, `[x](u)`) con deshacer inmediato que deja el texto escrito; según el resultado de T006, con `beforeinput` si hace falta para teclados móviles y composición.
- [ ] T073 [P] [US4] `apps/admin/src/componentes/editor/documento/pegado.ts`: `transformPasted` que parte los párrafos que superan el límite (T070 en verde), reduce el formato a las cuatro marcas (el esquema descarta el resto), no copia `bloqueId` ni `continuacion` y anuncia cuántos párrafos se crearon.
- [ ] T074 [P] [US4] `apps/admin/src/componentes/editor/documento/limites.ts`: contador por bloque sobre el texto serializado con `CharacterCount` y avisos por la región de estado solo al cruzar el 90 % y el 100 %; rechazo con aviso al llegar a 200 elementos (Enter, «Insertar», `/` y pegado). T070 en verde.
- [ ] T075 [US4] `apps/admin/src/componentes/editor/documento/EditorDocumento.tsx`: anuncios de deshacer y rehacer con el nombre de la acción ("Se deshizo: mover elemento"), con *debounce* de 400 ms para insertar, mover y duplicar y solo si el foco no cambió; `adoptar_vigente` recrea el editor con historial vacío. T071 en verde.

**Checkpoint**: T070 y T071 en verde.

---

## Fase 8: Validación y cierre

- [ ] T076 [US5] Cobertura cruzada: comprobar con la tabla "Plan de pruebas" de [plan.md](plan.md) que cada RF y cada CE de la spec tiene al menos un test ejecutándose (RF-001 a RF-021, CE-001 a CE-007); completar lo que falte.
- [ ] T077 Actualizar `specs/004-jerarquia-visual-panel/contracts/matriz-acciones.md` y `e2e/admin/jerarquia.spec.ts`: las filas «Editor — barra de marcas» y «Editor — bloques (provisorio)» pasan a la barra de herramientas, «Acciones» y el asa; las demás filas no cambian.
- [x] T078 Retirar el editor anterior (research D18): eliminar `apps/admin/src/componentes/editor/ListaBloques.tsx`, `BarraMarcas.tsx`, `TextoConMarcas.tsx`; de `reductor.ts` las acciones `agregar_bloque`, `mover_bloque`, `duplicar_bloque`, `quitar_bloque` y `actualizar_bloque` con sus pruebas; de `anuncios.ts` `etiquetaDeBloque`, `nombreDeBoton`, `anuncioDeMovimiento` y `anuncioDeQuitado` con sus pruebas; de `packages/bloques`: `src/operaciones.ts`, `src/marcas.ts` y sus pruebas, y sus exports de `index.ts` (`agregarBloque`, `moverBloque`, `duplicarBloque`, `quitarBloque`, `actualizarBloque`, `aplicarMarca`, `MarcaEnLinea`, `Seleccion`). Confirmar con `pnpm calidad` que knip y jscpd (≤ 3 %) están en verde. **Hecha** (2026-10-22): `CampoBloque.tsx` se conserva porque lo usan los editores del panel de propiedades (`bloques/Editor*.tsx`); knip dejó de reportar `entrarAlModo` y las ayudas sin uso de `esquema-prueba.ts`. Los ayudantes de E2E (`agregarBloque` y otros de `e2e/admin/ayudas/editor.ts`) se adaptan en T057.
- [ ] T079 Ejecutar `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm calidad && pnpm build` (Vitest de `apps/admin` y `@blog/db` en serie).
- [ ] T080 Ejecutar todos los E2E (`pnpm exec playwright test --project=admin` y `--project=web`) con `pnpm db:reset` previo, contra el build del admin y con `--workers=1` (CE-005 y regresión del sitio, R1).
- [ ] T081 Medir: Lighthouse (solo Accesibilidad, ≥ 95) en el editor en 360, 768, 1024 y 1440 px con el procedimiento de la spec 003 (T103); peso real del editor frente al tope de 250 KB gzip y sin `yjs` en el cliente; latencia de escritura con 200 elementos; una pasada final con NVDA (y VoiceOver o TalkBack si hay dispositivo) con el guion de T005; anotarlo todo en `specs/005-editor-estilo-documento/validacion.md`.
- [ ] T082 Recorrer [quickstart.md](quickstart.md) (A a F) y la comprobación visual del sitio (F); corregir el quickstart si algo cambió. Hacer la prueba de CE-001 y CE-007 con 3 a 5 personas que escriben habitualmente en procesadores de texto y anotar tiempo y dudas: es **requisito de cierre**; si no es posible antes del PR, CE-001 y CE-007 se declaran **diferidos** en `validacion.md` con la fecha prevista.
- [ ] T083 Ejecutar `/validar` (`revisor-ux-ui` y `consistencia-codigo`; `arquitecto-db` no aplica porque no hay cambios de base) y resolver todos los BLOQUEANTES en `specs/005-editor-estilo-documento/validacion.md`. CE-004 se verifica con T081 y la revisión de `revisor-ux-ui`.
- [ ] T084 Actualizar `CLAUDE.md` ("Estado actual": spec 005 y lo que sigue) y abrir el PR a `main`.
- [ ] T085 **Después del merge**: enmendar `constitucion.md` §II (tabla del stack: fila "Editor de texto: Tiptap 3.31", versión de PARCHE o MENOR según la gobernanza) en un commit aparte.

---

## Dependencias y orden de ejecución

### Entre fases

- **Fase 0 (compuerta)** → **Preparación (F1)** → **Fundacional (F2)** → **H1** → **H2** → **H5** → **H3** → **H4** → **Cierre (F8)**.
- **F1 y F2** pueden adelantarse a la compuerta (T012 a T035 no dependen de Tiptap: gramática, conversión, ids, reductor, anuncios y `packages/ui`), **pero se descartan o ajustan si la compuerta cambia de librería**. Lo que depende de la compuerta es T040 en adelante (instalación definitiva y asa, T067). Dentro de H1, T040 va antes de T038.
- **H1** depende de F2 (T022 a T035). Es el MVP del editor, pero **no se mergea sola**: el editor anterior se retira en T078 y exige H2, H3 y H5.
- **H2** depende de H1 (la barra, el menú y `EditorDocumento`).
- **H5** depende de H1 y H2 (adapta los specs existentes al editor nuevo).
- **H3** depende de H1 y H2 (el modo elementos y el menú de acciones usan la barra y los nodos).
- **H4** depende de H1; puede ir en paralelo con H3 salvo T075, que toca `EditorDocumento.tsx`.
- **Un solo PR** al final de la Fase 8, con las cinco historias.

### Archivos compartidos (hacer en secuencia)

- `apps/admin/src/componentes/editor/documento/extensiones.ts`: T041 → T050 → T066 → T072.
- `apps/admin/src/componentes/editor/documento/EditorDocumento.tsx`: T045 → T054 → T060 → T075.
- `apps/admin/src/componentes/editor/documento/BarraHerramientas.tsx`: T044 → T068.
- `apps/admin/src/componentes/editor/documento/comandos.ts`: T052 (`actualizarBloque`) → T065.
- `apps/admin/src/componentes/editor/documento/menu-insercion.ts` y `MenuInsertar.tsx`: T043 → T055.
- `apps/admin/src/componentes/editor/documento/atajos.ts`: T042 → T072.
- `apps/admin/src/componentes/editor/EditorArticulo.tsx`: T046 → T053 → T054 → T060.
- `e2e/admin/editor-documento.spec.ts`: T039 → T049 → T056 → T064 → T071.
- `e2e/admin/ayudas/editor.ts`: T039 → T057.
- `packages/bloques/src/index.ts`: T026 → T078.

### Dentro de cada historia

Tests (rojo) → lógica pura → extensiones y plugins → componentes → pantalla.

## Ejemplos de ejecución en paralelo

- **Fase 0**: T003 a T009 en paralelo (distintas mediciones); T010 aparte; T011 al final.
- **Fundacional, tests**: T014 a T021 en paralelo.
- **Fundacional, implementación**: T022 → T023; T024, T025, T027, T029, T031, T032, T033, T034 y T035 en paralelo entre sí; T028 depende de T022 y T024; T030 de T020.
- **H1**: T036, T037 y T038 en paralelo; T039 aparte; T042 y T043 en paralelo después de T041; T044 → T045 → T046.
- **H2**: T047 y T048 en paralelo; T051 en paralelo con T050; T052 → T053 → T054; T055 al final.
- **H5**: T058 y T059 en paralelo; T057 antes.
- **H3**: T062 y T063 en paralelo; T065 y T066 en paralelo; T067 a T069 en secuencia sobre la barra.
- **H4**: T073 y T074 en paralelo.

## Estrategia

- **Compuerta primero**: la Fase 0 decide la librería, el asa y los atajos con datos antes de escribir código definitivo; si falla, se compara con Lexical y se decide con el usuario.
- **Red de seguridad antes de mover la gramática del sitio**: T012 caracteriza la salida de hoy; el refactor (T022 a T025) debe dejarla idéntica.
- **MVP del editor**: F1 + F2 + H1 + H2 dan un editor de texto con todos los elementos; H5 lo hace equivalente al anterior; H3 y H4 lo completan. Se puede validar y mostrar a personas después de H2 y H5 (T082), antes de seguir.
- **Un solo PR** al final de la Fase 8, sin interruptor entre editores.

## Notas

- Commit por tarea o grupo lógico (Conventional Commits en español, por ejemplo `feat(admin): conversión entre el documento y los bloques`).
- Verificar que los tests fallen antes de implementar.
- Entre T046 y T078 quedan sin uso `ListaBloques` y las acciones viejas del reductor: `pnpm calidad` (knip) falla en los commits intermedios. Es esperado (un solo PR) y T078 lo deja en verde.
- La palabra «bloque» no aparece en nada que vea la persona; en el código y la base sigue siendo el término del esquema.
- El esquema de bloques no se toca: si una tarea parece pedirlo, detenerse y consultar.
