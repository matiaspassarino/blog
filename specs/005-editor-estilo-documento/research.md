# Investigación: Editor de notas estilo documento

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Decisiones de la Fase 0 del plan, ya corregidas con las revisiones de `consistencia-codigo` y `revisor-ux-ui` (2026-10-22). No hay marcadores sin resolver: lo que depende del navegador y de la librería queda como criterio de salida de la prueba de concepto (D17), con umbrales escritos antes de medir.

> **Ampliación del 2026-10-22 (constitución 2.0.0).** El documento del editor pasa a ser lo que se guarda. Las decisiones **D22 a D30** (al final) son las de la ampliación y **prevalecen** sobre las anteriores. Quedan **reemplazadas**: D2 (correspondencia uno a uno con bloques, ahora D22), D3 (gramática en línea y U+200B: el sitio deja de leer marcadores, D22 y D26), D4 (continuaciones: los tramos se vuelven párrafos al convertir, D25), D6 en la parte de convertir en cada transacción (ahora se normaliza, D24), D12 en la parte de las cuatro marcas (D28) y D13 en la parte de contar el texto serializado (ahora se cuenta el texto, D24). D18 se completó en T078 y se amplía en D30. El resto sigue vigente.

## D1. Librería de edición: Tiptap

- **Decisión**: Tiptap 3, versión exacta **3.31.4** (publicada el 2026-09-30, hace 22 días) para todos los paquetes `@tiptap/*`, fijada en `apps/admin/package.json` sin rango. La 3.32.0 (2026-10-13) tiene 9 días: se prefiere la 3.31.4 por prudencia y porque es la que se prueba; actualizar es tema de otra spec. (La protección `minimumReleaseAge` de pnpm no está escrita en el repo, solo en la guía del proyecto; no se agregan exclusiones.) El usuario la eligió el 2026-10-22 y aceptó el riesgo técnico.
- **Paquetes** (MIT, verificados con `npm view`; todos con peers exactos a la misma versión):

| Paquete | Para qué | Estado |
|---|---|---|
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/react` | motor, ProseMirror, enlace con React | aprobado |
| `@tiptap/starter-kit` | extensiones base | aprobado, **con medición**: arrastra strike, underline y link que se desactivan pero se empaquetan; si en la Fase 0 pesan, se reemplaza por los paquetes `@tiptap/extension-*` individuales que el esquema usa |
| `@tiptap/extensions` | `Placeholder`, `TrailingNode` (párrafo final obligatorio), `CharacterCount` y el historial (`UndoRedo`) | aprobado; reemplaza a `@tiptap/extension-placeholder`, que en la versión 3 solo reexporta lo de este paquete |
| `@tiptap/suggestion` | menú «/» | aprobado |
| `@tiptap/extension-drag-handle`, `@tiptap/extension-drag-handle-react`, `@tiptap/extension-node-range` | asa, arrastre y selección de rangos | **descartados por la Fase 0** (2026-10-22): traen `yjs` al cliente (+50 KB gzip); el asa es propia (D10). No hace falta otra aprobación: no se suma ninguna dependencia |

- **`@floating-ui/dom`** es *peer* de `@tiptap/suggestion` (y dependencia directa solo del asa): **no se importa** desde `apps/admin`. El menú se posiciona con el `clientRect` que entrega `Suggestion` y un cálculo propio con `visualViewport` (D7).
- **Pares del asa**: `@tiptap/extension-drag-handle` declara como peers obligatorios `@tiptap/y-tiptap` y `@tiptap/extension-collaboration` (y, por ellos, `yjs`, `y-protocols`, `lib0` y paquetes `prosemirror-*`): unos cinco paquetes más en el lockfile y código de colaboración que el editor no usa. **No se escriben en `package.json` hasta que la Fase 0 decida** (D10): la prueba se hace con `pnpm add` en una rama descartable y el `package.json` definitivo lleva solo lo que sobrevive.
- **Por qué Tiptap**: *headless* (dibuja nuestra interfaz con nuestros tokens), MIT para editor, asa y rangos (solo se paga colaboración, IA e historial en su nube, fuera de alcance), nodos con vista React para los elementos especiales y un motor (ProseMirror) con historial único, reglas de entrada, pegado y esquema restringido.
- **Alternativas descartadas**: **Lexical** (más a mano: arrastre, rangos y barra; queda como camino alternativo de la Fase 0); **Plate/Slate** (ata la interfaz a otra capa y Slate es más inestable entre versiones); **editor propio con `contenteditable`** (costo de accesibilidad, IME, selección y deshacer).
- **Constitución**: la enmienda 2.0.0 (2026-10-22) ya suma la fila "Editor de texto: Tiptap 3.31" a §II. Las extensiones nuevas de la ampliación están en D23.

## D2. Modelo del documento: un nodo por bloque

- **Decisión**: el documento de ProseMirror tiene como hijos directos **un nodo por elemento**, y cada uno corresponde a un bloque ([contracts/documento.md](contracts/documento.md)):

| Bloque | Nodo del documento | Datos propios |
|---|---|---|
| `parrafo` | `paragraph` (uno por cada tramo separado por líneas en blanco) | texto con marcas |
| `titulo` (nivel 2, 3 o 4) | `heading` sin marcas | `level` |
| `cita` | `blockquote` con **un solo** párrafo | `autor`, `fuente` (atributos) |
| `lista` | `bulletList` u `orderedList`, ítems de **un solo** párrafo, sin anidar | `ordenada` según el tipo del nodo |
| `codigo` | `codeBlock` sin marcas | `lenguaje` |
| `separador` | `horizontalRule` | — |
| `imagen`, `galeria`, `cta`, `video` | nodo atómico propio | el bloque entero en un atributo `bloque` |

- **Configuración explícita** (no se deja a los valores por defecto): listas sin anidar (la tecla Tab no anida) y con ítems `paragraph`; cita con un solo párrafo y Enter que sale; **sin `hardBreak`** en títulos, ítems ni citas (Shift+Enter no lo crea; un `\n` ya guardado se conserva); strike y underline desactivados; `TrailingNode` para el párrafo final.
- **Por qué**: la correspondencia uno a uno hace la conversión simple y permite mover, duplicar y quitar como operaciones de nodo. Los atómicos guardan el bloque tal cual.
- **Alternativa descartada**: guardar el documento de Tiptap y derivar los bloques (rompe CE-002 y §VI.4).

## D3. Gramática en línea única y garantía de ida y vuelta

- **Decisión**: `packages/bloques/src/en-linea.ts` exporta `analizarEnLinea(texto): NodoEnLinea[]`, `serializarEnLinea(nodos): string` y `normalizarMarcas(nodos): NodoEnLinea[]`. `NodoEnLinea` es `texto | negrita(hijos) | cursiva(hijos) | codigo(texto) | enlace(href, hijos)`. El analizador es el de hoy de `TextoEnLinea.tsx` (con sus reglas: `_` no abre dentro de una palabra, el interior de negrita y cursiva no empieza ni termina con espacio, la marca sin cerrar queda literal, la URL balancea paréntesis) movido sin cambiar de comportamiento. `TextoEnLinea` pinta ese árbol y su salida HTML no cambia (R1). `textoPlano` (que hoy quita marcas con su propia expresión regular, una tercera gramática) pasa a usar `analizarEnLinea`; se comprueba el efecto en extractos y en `ComparacionVersiones`.
- **Garantía** (corregida): `serializarEnLinea(analizarEnLinea(x)) === x` para todo `x` (la salida del analizador siempre es serializable de vuelta). Lo **editado** en el documento puede tener marcas que el sitio no sabe leer; para que lo que se ve sea lo que se guarda:
  1. `normalizarMarcas` mueve los espacios de los bordes **fuera** del marcador (`**palabra **` → `**palabra** `), parte las marcas que se cruzan en tramos bien anidados, y degrada a texto plano lo que la gramática no puede expresar (cursiva a mitad de palabra, código que contiene `` ` ``, etiqueta de enlace con `](`).
  2. Los comandos de formato aplican la misma regla al crear la marca: al poner negrita se recortan los espacios de la selección (el doble clic de Windows selecciona el espacio final); la cursiva sobre una palabra parcial se extiende a la palabra completa; el código con comillas invertidas y la etiqueta de enlace con `](` se rechazan con un aviso.
  3. Tras cada transacción, si `normalizarMarcas` cambia algo, el editor aplica la normalización al documento en una transacción sin historial, así **lo que se ve es lo que el sitio mostrará**.
  - **Pruebas** (`en-linea.test.ts`): propiedad `serializar(analizar(x)) = x` sobre un corpus y sobre textos generados al azar; propiedad `analizar(serializar(n)) = normalizar(n)` sobre árboles generados al azar con las cuatro marcas, espacios en los bordes, cruces, anidado y adyacencia; casos de los hallazgos (negrita con espacio final, cursiva en `foo_bar_`, código con comilla, etiqueta con `]`, nodos de texto adyacentes).
- **Texto plano ambiguo**: si un texto plano del documento (por ejemplo, el usuario deshizo una regla de entrada y dejó `**x**` literal) volvería a analizarse como marca, `serializarEnLinea` inserta un carácter de ancho cero (U+200B) justo después del primer carácter del marcador. Es un caso residual (las reglas de entrada convierten `**x**`, `_x_`, `` `x` `` y `[x](u)` en marca real al escribirlas). `textoPlano` y el recuento de caracteres ignoran U+200B.
- **Nodos de texto vacíos**: ProseMirror no admite nodos `text` vacíos; un tramo vacío es un `paragraph` sin hijos (D4).
- **Alternativas descartadas**: agregar un escape al sitio (cambia la salida del sitio y los textos ya guardados); guardar HTML o el JSON de la librería (rompe el esquema y la seguridad, RF-003 de la spec 001).

## D4. Párrafos con líneas en blanco: partir y unir con el separador exacto

- **Decisión**: `packages/bloques` exporta `partirParrafos(texto): { texto: string; separador: string }[]` y `unirParrafos(tramos): string`, y `Parrafo.tsx` los usa también (una sola regla de tramos, salto simple y descarte de tramos en blanco al pintar). La conversión **a** documento reparte un `parrafo` con líneas en blanco en **varios** `paragraph` con el mismo `bloqueId`; desde el segundo llevan el atributo `continuacion` con el **separador exacto** (`"\n\n"`, `"\n\n\n"`…) y el tramo que vino de texto. Un tramo vacío o de solo espacios se conserva como `paragraph` (vacío o con ese texto), así `A\n\n\nB`, `A\n\n` y `A\n\n  \n\nB` vuelven idénticos (CE-002). La conversión **a** bloques une los `paragraph` con `continuacion` al anterior con ese separador; el salto simple es un `hardBreak`.
- **Un párrafo nuevo creado con Enter** no hereda `bloqueId` ni `continuacion` (`keepOnSplit: false`), así que es un bloque nuevo con id propio (D21). Un `paragraph` vacío de primer nivel sin `continuacion` no genera bloque, salvo que sea el único (documento vacío → contenido `[]`).
- **Consecuencia**: el límite de 5000 caracteres es por bloque; la unión de continuaciones no puede superarlo (el pegado y la escritura avisan antes: D13).

## D5. Elementos especiales: un nodo de bloque con vista del sitio

- **Decisión**: `imagen`, `galeria`, `cta` y `video` son nodos `atom` con el atributo `bloque` (el objeto completo). Una **sola** vista (`NodoBloque`) con una fábrica por tipo llama a `Bloques` con una lista de un bloque y los `componentes` de la vista previa (`ImagenAdmin`), así se ve como en el sitio; el selector de imagen y el aviso de subida reutilizan `SelectorImagen` y `ContextoEditor`. `separador` usa `horizontalRule` y `codigo` usa `codeBlock`.
- **Los campos se editan en el panel** (D9), no dentro del nodo: evita *inputs* anidados en el área editable y problemas de foco. Los botones internos del nodo no están en el orden de tabulación; la subida y los campos se alcanzan con `Enter` en modo elementos.
- **Alternativa descartada**: campos editables dentro del lienzo.

## D6. Estado, cambios sin guardar, validación y errores

- **Decisión**: `EditorArticulo` crea el editor y, en cada transacción que cambia el documento, calcula `documentoABloques(editor.getJSON())` y despacha `{ tipo: 'contenido', valor }` al reductor. `estaSucio` compara con lo guardado como hoy. `guardar()` valida con `validarEditor` los bloques ya convertidos.
- **`guardado` no toca el documento** (corrección de la revisión): solo la carga inicial y `adoptar_vigente` suben `reinicio` y recrean el documento con su historial. `guardado` también se despacha al publicar o archivar desde la barra de la 004: reiniciar ahí haría perder cursor, desplazamiento e historial.
- **Errores por id, no por posición**: `ErrorBloque.indice` es el índice del **bloque** (que omite párrafos vacíos y fusiona continuaciones), no la posición del elemento en el documento. Al validar, el editor traduce `indice` → `bloque.id` con la lista convertida y marca los nodos **por `bloqueId`**; "Imagen, 3 de 8" se calcula con la lista de elementos del documento, no con el índice del error. El enfoque del primer error selecciona el nodo por `bloqueId`.
- **Cambios desde el panel**: `PanelPropiedades` recibe `alCambiar` con la forma funcional de hoy (`CambiosDeBloque`: objeto o función del bloque actual, para que dos subidas simultáneas se sumen) y el comando `actualizarBloque(bloqueId, cambios)` busca el nodo **por id al aplicar**, no por la selección vigente (una subida que termina cuando la selección ya cambió o el nodo se movió escribe en el nodo correcto). `CambiosDeBloque` se mueve de `reductor.ts` a `bloques/tipos.ts`.
- **Rendimiento**: convertir hasta 200 bloques y comparar en profundidad en cada tecla re-renderiza `EditorArticulo`. Se mide la latencia al escribir en la Fase 0 (D17); si pasa el umbral, la conversión se difiere con un tiempo de espera corto (por ejemplo 150 ms) y se fuerza antes de guardar.

## D7. Menú «/» y «Insertar»

- **Decisión**: `@tiptap/suggestion` con el carácter `/`, restringido por una regla propia a *comienzo de una línea vacía* (no se abre en medio de un texto ni de una URL). La lista y el filtro (por nombre y descripción, sin tildes ni mayúsculas) son una función pura (`menu-insercion.ts`); los nombres salen de `nombreDeTipo` de `anuncios.ts` (sin tabla paralela). La interfaz es una lista propia con `role="listbox"` y opciones `role="option"`. **No se importa `@floating-ui/dom`**: la posición sale del `clientRect` de `Suggestion` y de `visualViewport` (con el teclado virtual abierto el menú aparece por encima del cursor).
- **Dos modelos de foco**, definidos en [contracts/atajos.md](contracts/atajos.md): desde `/` el foco queda en el lienzo y el menú se maneja con `aria-activedescendant`, sin cambiar el rol ni usar `aria-expanded` en el lienzo; desde «Insertar» el foco entra al listbox y vuelve al lienzo al cerrar. «Insertar» es el camino principal en teléfonos (los teclados esconden `/`): siempre visible, nunca dentro de «Más».
- **No usa `useDesplegable`** (cierra al mover el foco y no maneja flechas). Un hook nuevo `useMenuTeclado` (flechas, `Inicio`, `Fin`, escritura por letra, `Tab`, `Esc`) lo usan el menú de acciones, el selector de estilo y «Insertar».
- **Plan B** si NVDA falla con `aria-activedescendant` en el lienzo: el foco entra al listbox al escribir `/`.

## D8. Barra de herramientas

- **Decisión**: `role="toolbar"` con nombre, un solo tope de tabulación y flechas entre controles; botones de la primitiva con `aria-pressed`. Controles: estilo de párrafo (menú que muestra el vigente como texto), negrita, cursiva, código, enlace (campo de URL con su propio modelo de foco), listas, **Insertar**, **Acciones**, **Propiedades**, deshacer y rehacer. Lo que no entra pasa a «Más», salvo Insertar, y sale del orden de tabulación. La barra queda `sticky top-0`. `MasAcciones` se **modifica**: la dirección de apertura (arriba o abajo) y el corte pasan a props, porque hoy abre hacia arriba y con un corte fijo.
- **Estado activo no solo con color**: `clasesBoton` suma un borde de marca a la terciaria con `aria-pressed` (WCAG 1.4.1 y 1.4.11), con prueba de contraste en `clases.test.ts`.
- **Íconos nuevos** en `Icono.tsx`: negrita, cursiva, código, enlace, lista con viñetas, lista numerada, deshacer, rehacer, asa, insertar, acciones y propiedades.

## D9. Disposición y panel de propiedades

- **Decisión**: la segunda columna empieza en **1280 px** (a 1024 px con la navegación lateral de 16 rem quedarían unos 340 px para el lienzo). Desde 1280 px, la columna derecha (`sticky`, con desplazamiento propio) muestra **Publicación** (siempre visible, fuera de las pestañas, por la spec 004) y debajo dos pestañas: **Artículo** (taxonomías y para buscadores) y **Elemento** (propiedades). Por debajo de 1280 px, una sola columna con la hoja inferior no modal para las propiedades.
- **Reglas de la hoja**: alto máximo 45 dvh y apilada sobre la barra fija de la 004; `scroll-margin-bottom` del lienzo igual al alto de la hoja; con el teclado virtual se usa `visualViewport` (y `interactive-widget=resizes-content`); se abre solo con «Propiedades» o `Enter` en modo elementos, no al tocar para desplazar, y **no roba el foco** salvo con esas dos; `Esc` la cierra al final del orden de `Esc`.
- **Pestañas**: `role="tablist"`/`tab`/`tabpanel` con flechas; cambian solas a «Elemento» **solo** al seleccionar un elemento especial con clic o toque; si la persona elige una pestaña a mano, se respeta.
- **Contenido**: un solo componente (`PropiedadesDelElemento` con variante lateral u hoja) que muestra `EditorDeBloque` con el bloque del nodo; los editores de texto reciben `soloPropiedades`. `EditorParrafo` se elimina (un párrafo y un separador no tienen propiedades: el panel dice "Este elemento no tiene propiedades. Escribe en el documento.").
- **Tokens nuevos**: `--container-panel-propiedades`, `--carril-asa` (= `--tactil-min`) y `--alto-hoja-propiedades` (45 dvh) en `packages/ui/src/tokens.css`.

## D10. Arrastrar, menú de acciones, asa y modo elementos

- **Dos modos de selección** ([contracts/atajos.md](contracts/atajos.md)): un rango de **texto** que cruza párrafos sirve para dar formato y no habilita mover ni quitar; el **modo elementos** se entra con `Esc`, con Shift + clic sobre el asa o con «Seleccionar» en el menú, y permite ampliar con `Shift+↑/↓`. Esto evita quitar dos párrafos enteros por tener resaltado solo el medio de cada uno.
- **Asa**: **una sola asa flotante** que sigue al elemento activo, para ratón y toque (`tabindex=-1`); el camino de teclado y de lector de pantalla es el botón «Acciones» de la barra. Desde 768 px vive en un carril a la izquierda (`--carril-asa`); por debajo de 768 px solo aparece sobre el elemento activo, sin carril. `touch-action: none` solo en el propio botón; los nodos no son arrastrables por sí mismos (`draggable=false`).
- **Comandos y una sola ruta**: `moverRango`, `duplicarRango`, `quitarRango` y `convertirElemento` son transacciones (un Deshacer las revierte). Un plugin `proteger` intercepta **toda** vía que quite o mueva elementos y aplica las mismas reglas (subida en curso, confirmación de imagen guardada, anuncio con "Ctrl+Z para deshacer").
- **Peso y decisión** (R3, resuelto el 2026-10-22): la medición mostró que el asa de la librería suma 50 KB gzip y trae `yjs` al cliente, así que se implementa un **asa propia** con el arrastre de ProseMirror y **sin** `@tiptap/extension-node-range` (los comandos de rango son propios); los comandos y los atajos no cambian.
- **Dedo** (R4): el arrastre nativo HTML5 no está garantizado con el dedo. Criterio de la Fase 0 en dispositivos reales; si falla, arrastre con eventos de puntero sobre el asa y, si tampoco se logra, se vuelve a consultar al usuario (el requisito se acordó el 2026-10-22).
- **Alternativa al arrastre (WCAG 2.5.7)**: el menú de acciones y los atajos dan el mismo resultado en un paso; en documentos largos se evalúa un «Mover a…» con lista (sugerencia, fuera de alcance si no hace falta).

## D11. Un solo historial de deshacer

- **Decisión**: el historial de `@tiptap/extensions` (un historial para todo el documento; agrupa el texto de corrido, `newGroupDelay` de 500 ms). Las operaciones sobre elementos y las ediciones desde el panel son transacciones propias y se deshacen como un paso. **`guardado` no limpia ni recrea nada** (D6); `adoptar_vigente` recrea el editor con el contenido vigente y un historial vacío (RF-011). El mensaje de deshacer nombra la acción ("Se deshizo: mover elemento").

## D12. Pegado

- **Decisión**: el esquema solo admite las cuatro marcas, así que al pegar HTML de otra aplicación ProseMirror descarta el resto (colores, tipografías, tamaños, subrayado). Una `transformPasted` parte los párrafos que superan el límite (D13) en párrafos nuevos, cortando en un fin de oración o de palabra, y anuncia cuántos se crearon. El texto plano pegado se interpreta con las mismas reglas de entrada (no se abre HTML). Los atributos `bloqueId` y `continuacion` **no se copian** al portapapeles (`renderHTML` y `parseHTML` los ignoran): pegar o arrastrar con copia nunca duplica ids (D21).

## D13. Límites de caracteres y de cantidad

- **Decisión**: el límite del esquema se mide sobre el **texto serializado** (con marcadores y URL de los enlaces; sin U+200B), porque es lo que valida el servidor, usando `CharacterCount` de `@tiptap/extensions` con un contador propio por bloque. Se avisa **al cruzar** el 90 % y el 100 % por la región de estado ("Quedan 500 caracteres (se cuentan las marcas de formato)"), sin cortar lo escrito; el error del esquema aparece al guardar, como hoy. En títulos, citas, ítems de lista y código, el sobrante se queda y se marca el error.
- **Máximo de 200 bloques** (`esquemaContenido`): al llegar al máximo, «Insertar», `/`, Enter y el pegado que crearía más elementos se rechazan con el aviso "Se alcanzó el máximo de 200 elementos".

## D14. Accesibilidad y roles

- **Decisión**: roles y nombres según [contracts/atajos.md](contracts/atajos.md). El lienzo usa el `contenteditable` nativo con nombre y `aria-multiline`, **sin forzar `role="textbox"`** (los hijos de un `textbox` son presentacionales y aplanarían títulos, listas, citas y las islas de los elementos especiales); la Fase 0 compara con y sin el rol. El **rol del lienzo no cambia** mientras el menú «/» está abierto. Cada isla de un elemento especial lleva su nombre ("Imagen, 3 de 8"). Anuncios por la región persistente, con *debounce* y la palabra **elemento** (no «bloque», por CE-007; se reemplazan los textos y `aria-label` de `anuncios.ts`).
- **Estados**: editor no editable con `setEditable(false)` y `aria-readonly` (`fieldset disabled` no desactiva un `contenteditable`); subida en curso con texto de progreso y mover y quitar `aria-disabled` con la razón; arrastre con texto de destino; marcas de error y de selección con texto y forma, no solo color (también en `forced-colors`); *placeholder* con contraste ≥ 4,5:1; `prefers-reduced-motion` también para el desplazamiento automático; error de carga del *chunk* con «Reintentar».
- **Verificación**: axe y Lighthouse en CI (CE-004) y los lectores de pantalla de la Fase 0 (D17).

## D15. Carga y servidor

- **Decisión**: `EditorDocumento` se importa de forma dinámica (`next/dynamic`, `ssr: false` válido porque `EditorArticulo` es un componente de cliente) con un esqueleto mientras llega; `useEditor({ immediatelyRender: false })` evita el desajuste de hidratación. Solo las rutas `/articulos/nuevo` y `/articulos/[id]` cargan la librería. Antes de escribir esa carga se lee la guía de Next en `apps/admin/node_modules/next/dist/docs/` (regla del proyecto). `useEditor` de `ContextoEditor.tsx` choca por nombre con el de `@tiptap/react` y se renombra a `useContextoEditor`.

## D16. Estrategia de pruebas

- **Decisión**: la lógica pura se prueba primero con Vitest en entorno `node` (análisis y normalización en línea, partir y unir párrafos, conversión de los diez tipos y de un corpus, filtro del menú, `detectarAtajo`, reglas de partir texto largo, asignación y deduplicación de ids, comandos sobre el rango). Las **reglas de entrada** de ProseMirror y toda la interacción (teclado, arrastre, foco, anuncios, panel, hoja) se prueban con Playwright contra el *build* con `--workers=1`; no se agregan jsdom ni Testing Library.
- **Corpus de CE-002**: el seed es SQL, así que Vitest usa un corpus propio (`packages/bloques/src/pruebas/corpus-contenido.ts`) con los diez tipos, los casos borde de los hallazgos y los textos del seed copiados; el E2E abre y guarda sin tocar los artículos reales del seed y comprueba que la versión no sube.

## D17. Fase 0: prueba de concepto, umbrales y regla de decisión

Rama descartable con una pantalla en `apps/admin` (editor, barra, asa, un nodo de imagen y la maqueta del panel y de la hoja). **Los umbrales se escriben antes de medir**; los resultados y la decisión se registran en este archivo.

| Criterio | Cómo se mide | Umbral | Si falla |
|---|---|---|---|
| Peso | KB gzip adicionales en las dos rutas del editor frente a la ruta actual; con y sin el asa; con `starter-kit` e individuales | ≤ 250 KB gzip adicionales y sin `yjs` en el cliente | Extensiones individuales; asa propia (D10) |
| Dedo | Dispositivos reales iOS Safari y Android Chrome, documento largo con desplazamiento automático | Reordena con el asa y el desplazamiento vertical sobre el texto no dispara nada | Eventos de puntero (D10); si no, volver a consultar |
| Lectores de pantalla | NVDA con Chrome y Firefox, VoiceOver iOS, TalkBack y, si hay Mac, VoiceOver macOS; guion con aprobado o reprobado: leer la barra, títulos y listas del lienzo, menú `/` con la opción activa, insertar una imagen y su foco, mover con teclado, llegar al panel y volver, modo elementos y que `Esc` no saque del modo foco | Todo aprobado | Ajustar roles (con y sin `role="textbox"`); un fallo crítico **por sí solo** dispara la comparación con Lexical |
| Teclados | Gboard, iOS, dictado (IME) y teclado español y latinoamericano: Enter, Retroceso, `## `, `- `, `1. `, `**x**`, `/`, `[`, `` ` `` y el acento muerto | Las reglas funcionan con autocorrección y composición | Reglas propias con `beforeinput` |
| Atajos | Tabla de colisiones por plataforma (Windows, Mac, Linux) y distribución (es-ES, es-LA, en-US) para los atajos de [atajos.md](contracts/atajos.md) | Ninguno interceptado por el navegador o el sistema | Cambiar el atajo; el camino visible siempre existe |
| Ida y vuelta | El corpus de D16 y artículos reales del seed | Idéntico (CE-002) | Ajustar D3 y D4 |
| Escritura | INP o latencia de tecla con 200 elementos, nodos con imágenes y en un equipo de gama baja | < 100 ms | Diferir la conversión (D6) |
| Menús | Tiempo hasta ver la lista con 50 elementos | < 200 ms | Virtualizar la lista |
| Otros | `forced-colors`, zoom de 200 % y 400 % sin pérdida de contenido (reflow) y la hoja a 360 × 640 con el teclado virtual | Sin cortes ni contenido tapado | Ajustar D9 |
| Descubribilidad | 2 o 3 personas con la maqueta: ¿encuentran «Insertar», el asa y el panel? | Las tres cosas en menos de un minuto sin ayuda | Rediseñar antes de seguir |

**Regla de decisión**: un fallo crítico de accesibilidad (lectores de pantalla) **por sí solo** dispara la comparación con **Lexical** con la misma pantalla; fallos de peso, dedo o teclados se resuelven primero con sus caminos alternativos. Si dos o más criterios no se resuelven dentro del plan, se compara con Lexical y se decide con el usuario antes de seguir.

### Resultados de la Fase 0 (2026-10-22)

Medidos por Claude sobre una pantalla descartable (rama `005-spike-tiptap`, no se mergea), con el *build* de producción y Chromium. **No se pudieron medir** T004, T005 (lectores de pantalla reales), T006 (teclados móviles) y T010 (personas): no hay dispositivos ni personas disponibles.

| Criterio | Resultado | Veredicto |
|---|---|---|
| Peso (T003) | Ruta actual del editor: 278 KB gzip. Editor de Tiptap con `starter-kit`: **+141 KB gzip** (se retiran 113 KB del editor anterior). Con el asa de la librería: **+50 KB** y **`yjs` en el cliente** (~44 KB gzip de código de colaboración) | Tope de 250 KB: cumplido. «Sin `yjs` en el cliente»: **incumplido por el asa** → asa propia |
| Reglas de entrada, escritorio (T006) | `## `, `### `, `#### `, `- `, `* `, `1. `, `> `, `---`, `**x**`, `_x_` y `` `x` `` convierten bien; Deshacer inmediato de `## ` deja el texto; `/` abre el menú solo al comienzo de una línea vacía (no en `a/`). Las tres comillas invertidas piden Espacio o Enter al final | Aprobado en escritorio; teclados móviles sin medir |
| Latencia (T008) | 200 elementos, solo el editor (sin la conversión a bloques): máxima 24 ms (CPU 1×), 40 ms (4×), 80 ms (6×); el menú `/` abre en 4 a 35 ms | Umbrales cumplidos (< 100 ms y < 200 ms); **falta medir con `documentoABloques` en cada transacción** (T081) |
| Árbol de accesibilidad (T005, aproximación) | Barra con nombre y botones nombrados, lienzo con nombre, listbox con opciones y `aria-activedescendant` mientras el menú está abierto, "Imagen, 4 de 5" | Sin fallos visibles; **no reemplaza** a NVDA, VoiceOver ni TalkBack |
| `forced-colors` (T009) | Los botones conservan el borde y el elemento seleccionado se ve; el estado `aria-pressed` (solo tinte) **no se distingue** | Falla leve: agregar estilos para `forced-colors` en el estado activo (borde con color del sistema) |
| Zoom de 400 % (320 px) (T009) | Sin desborde horizontal; la barra se reacomoda | Aprobado |
| Hoja a 360 × 340 con el teclado virtual (T009) | La hoja ocupa 45 % del alto, los campos quedan cortados y el elemento seleccionado queda tapado | Falla prevista: exige `scroll-margin-bottom` y `visualViewport` (ya en D9) |
| Colisiones de atajos (T007, solo documentación de navegadores) | `Mod+B/I/E/K/D` los puede interceptar la página (el navegador deja `preventDefault`); `Alt+↑/↓` no choca en Windows y en Mac solo mueve el cursor, que en modo elementos no existe; `Esc`, `Supr` y `Shift+↑/↓` sin conflicto | Sin cambios; **sin verificar en Mac ni Linux** |

**Decisión (compuerta T011)**:
- **Se mantiene Tiptap** (no se compara con Lexical: ningún criterio falló de forma crítica y los que no se pudieron medir se asumen como riesgo).
- **Asa propia**: sin `@tiptap/extension-drag-handle*` ni `@tiptap/extension-node-range`. El arrastre usa el arrastre de ProseMirror con eventos de puntero para el dedo; el modo elementos y el botón «Acciones» siguen siendo la alternativa. La lista de dependencias queda en seis paquetes, todos ya aprobados por `consistencia-codigo` (2026-10-22): `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extensions` y `@tiptap/suggestion`.
- **`starter-kit` completo** (no hace falta pasar a extensiones individuales: el peso entra en el tope).
- **Lienzo con el `contenteditable` nativo y sin forzar `role="textbox"`**, como está en [contracts/atajos.md](contracts/atajos.md); queda por confirmar con un lector real.
- **Prueba en un teléfono real (2026-10-22, primer informe del usuario sobre `/spike`)**: en general funciona; fallan dos cosas. (1) **El arrastre con el dedo no funciona** con el asa de la librería (en escritorio sí): R4 se materializó y confirma el asa propia con eventos de puntero; el menú «Acciones» y el modo «Seleccionar» pasan a ser el camino principal en táctil hasta que el arrastre se pruebe en un teléfono. (2) **En el móvil no se ve el botón de publicar**: «Publicación» quedaba fuera de la hoja y sin acceso por debajo de 1280 px; en el diseño real «Publicar» y «Guardar» están en la barra fija del editor (spec 004) y debe verse a 360 px (CE de móvil en T081).
- **Riesgos asumidos por falta de mediciones** (se vuelven a mirar en T081 y T082 si aparece un dispositivo o una persona): arrastre con el dedo (R4), anuncios con lectores de pantalla reales (R5), teclados móviles y composición (R11) y descubribilidad de «Insertar», el asa y el panel. Mitigaciones ya previstas: el menú de acciones y el modo «Seleccionar» cubren el movimiento sin arrastrar, `axe` y Lighthouse corren en CI y las reglas de entrada se prueban con teclado de escritorio.

## D18. Retiro del editor anterior

- **Decisión**: el editor de bloques se reemplaza por completo (sin interruptor). Se eliminan con sus pruebas en la misma spec (§VIII.4 y VI.5):
  - `ListaBloques.tsx`, `BarraMarcas.tsx`, `TextoConMarcas.tsx`, `EditorParrafo.tsx`;
  - de `reductor.ts`: las acciones por bloque y el tipo `CambiosDeBloque` (que se mueve a `bloques/tipos.ts`), con sus pruebas;
  - de `anuncios.ts`: `etiquetaDeBloque`, `nombreDeBoton`, `anuncioDeMovimiento` y `anuncioDeQuitado`, reemplazados por los mensajes nuevos de [contracts/atajos.md](contracts/atajos.md) en el mismo módulo puro, con sus pruebas;
  - de `packages/bloques`: `operaciones.ts` y `aplicarMarca` (con `MarcaEnLinea` y `Seleccion`) y sus exports de `index.ts`, que ganan los nuevos (`analizarEnLinea`, `serializarEnLinea`, `normalizarMarcas`, `partirParrafos`, `unirParrafos`); `render/index.ts` exporta `clases.ts`.
- Se conservan `crearBloque`, los editores de campos y lo que siga en uso. `pnpm calidad` (knip y jscpd) lo verifica.

## D19. Modo elementos y protección de las vías de borrado

Ver D10 y [contracts/atajos.md](contracts/atajos.md). En resumen: un único camino para quitar y mover, intercepción en el plugin y no solo en los comandos, `draggable=false` salvo desde el asa, y confirmación de imágenes guardadas en cualquier vía.

## D20. Aviso de conversión con pérdida

- **Decisión**: `convertirElemento` informa qué se perdería: lista con varios ítems a párrafo, cita con autor o fuente a párrafo y **párrafo con marcas a título o código** (las marcas se pierden). La interfaz confirma antes de aplicar (RF-016).

## D21. Identidad de los elementos

- **Decisión**: cada elemento de primer nivel lleva `bloqueId`. Un *plugin* `asignarIds` (`appendTransaction`) asigna un uuid **una sola vez** a los que lo tienen vacío y **deduplica** los repetidos (conserva el primero); `bloqueId` y `continuacion` no se copian al portapapeles (D12) ni al dividir con Enter (D4). Así los ids son estables entre transacciones y entre despachos al reductor, y los errores, las propiedades y las subidas apuntan siempre por `bloqueId` (D6). No se usa `@tiptap/extension-unique-id` (sumaría `uuid`).

---

# Ampliación (2026-10-22): el documento es el contenido

## D22. Se guarda el documento del editor

- **Decisión**: `articulos.contenido` guarda el documento JSON del editor en su **forma canónica** ([contracts/documento.md](contracts/documento.md)), validado por `esquemaDocumento` (Zod) en `packages/bloques/src/esquema.ts`, que **reemplaza** a `esquemaBloque` y `esquemaContenido`. El sitio lo dibuja con un renderer propio (`render/Documento.tsx`) que recorre nodos y marcas sin Tiptap (la librería no sale de `apps/admin`, RF-021) y sin HTML crudo.
- **Nombres**: los nodos y marcas de la librería conservan sus nombres en inglés (`paragraph`, `bold`…): renombrarlos obliga a extender cada extensión y rompe los comandos, atajos y reglas que los referencian por nombre; §XII admite los términos técnicos del framework. Los nodos propios pasan de `imagenBloque` a `imagen`, etc.; el atributo de identidad pasa de `bloqueId` a `id`.
- **Elementos especiales**: los campos van como `attrs` planos del nodo (`{ type: 'imagen', attrs: { id, imagen, leyenda } }`), no como un objeto `bloque` anidado. Un adaptador puro (`datosDeElemento` y `elementoDesdeDatos`) entrega a los editores de campos de hoy (`EditorImagen`, `EditorGaleria`, `EditorCta`, `EditorVideo`) la misma forma que reciben hoy, así no se reescriben.
- **Por qué**: decisión del usuario (aclaración del 2026-10-22) para usar más funciones de la librería; la correspondencia con bloques obligaba a una gramática con marcadores (D3) que no puede expresar subrayado, alineación ni tablas sin otra capa.
- **Alternativas descartadas**: ampliar los bloques (la recomendación inicial; el usuario eligió el documento); guardar HTML (prohibido por §VI.1); renombrar todos los nodos al español (costo y fragilidad, sin beneficio para quien escribe).

## D23. Extensiones nuevas

| Paquete (3.31.4, MIT; solo peers `@tiptap/core` y `@tiptap/pm`, sin dependencias de runtime) | Para qué |
|---|---|
| `@tiptap/extension-table` (`Table`, `TableRow`, `TableHeader`, `TableCell`; usa `prosemirror-tables` de `@tiptap/pm/tables`) | tablas, selección de celdas, combinar y separar |
| `@tiptap/extension-text-align` | `textAlign` en `paragraph` y `heading` |
| `@tiptap/extension-highlight` | resaltado (`multicolor: false`) |
| `@tiptap/extension-subscript`, `@tiptap/extension-superscript` | subíndice y superíndice (excluyentes entre sí) |

- `underline`, `strike` y `link` ya vienen en `starter-kit` (hoy desactivados): se **activan**. El editor pasa de seis a once paquetes `@tiptap/*`, todos en la versión exacta 3.31.4 (publicada hace más de tres semanas: cumple `minimumReleaseAge` sin exclusiones). Las nuevas necesitan la aprobación de `consistencia-codigo` (§II).
- **Configuración explícita**: `Table` con `resizable: false` (no se guardan anchos), `allowTableNodeSelection: true` y celdas con `content: 'paragraph+'`; `TableHeader` solo en la primera fila (comando propio «Fila de encabezado»); `TextAlign` con `types: ['paragraph', 'heading']` y la izquierda sin guardar (D24); `Highlight` sin color; `Link` con `openOnClick: false`, `autolink` y la validación de `hrefSeguro`.
- **Peso**: se mide al implementar contra el tope de 250 KB gzip (T081); las tablas son lo más pesado (estimado de 25 a 35 KB gzip). Si se pasa, la extensión de tablas se carga solo al abrir un artículo con tablas o al insertar la primera.
- **Prueba de contrato**: `extensiones.test.ts` arma el esquema de ProseMirror con `getSchema(extensiones)` y comprueba que sus nodos, marcas y atributos son **exactamente** los de la lista permitida (§VI.3: el editor no ofrece nada que el esquema rechace ni al revés).

## D24. Forma canónica y normalización

- **Decisión**: `normalizarDocumento(json)` (pura, en `packages/bloques`) quita los atributos `null` o con su valor por defecto (`textAlign: 'left'`, `colspan: 1`, `colwidth`), los `marks: []`, los textos vacíos y los párrafos vacíos de primer nivel (incluido el que agrega `TrailingNode`), une textos contiguos con las mismas marcas y ordena las marcas. El editor despacha `contenido` con `normalizarDocumento(editor.getJSON())` en cada transacción que cambia el documento; la Server Action normaliza y valida antes de escribir.
- **Abrir y guardar sin tocar** (RF-012): cargar un documento canónico en el editor y normalizar su `getJSON()` devuelve el mismo documento, así el estado no queda sucio y la versión no sube. Se prueba con propiedades sobre el corpus y documentos generados al azar.
- **Límites de caracteres**: se cuenta el **texto** (los caracteres de los nodos `text`, sin marcas): desaparece el problema de contar marcadores (D13). Los avisos al 90 % y al 100 % siguen.
- **Rendimiento**: `getJSON` y `normalizarDocumento` con 200 elementos son más baratos que la conversión a bloques de antes; se mide igual (T081) y, si hace falta, se difiere con un tiempo de espera corto y se fuerza antes de guardar.

## D25. Conversión de los artículos existentes

- **Decisión**: un script de un solo uso (`packages/bloques/scripts/convertir-contenido.ts`) que reutiliza `bloquesADocumento` y `documentoABloques` (hoy en `apps/admin/src/componentes/editor/documento/conversion.ts`, con su ida y vuelta probada) y `analizarEnLinea`, movidos a `packages/bloques/src/conversion-anterior/` junto con una copia congelada del esquema de bloques. Lee un JSON exportado y escribe un SQL de una transacción ([data-model.md](data-model.md#conversión-de-los-artículos-existentes-rf-023-rf-030)). No se conecta a ninguna base ni necesita claves. Se corre con `pnpm --filter @blog/bloques convertir-contenido -- --entrada … --salida …`: Node 24 ejecuta TypeScript, pero exige extensión en los `import` y el paquete no la usa, así que el script se arranca con un cargador propio de unas diez líneas (`scripts/cargador.mjs`, con `module.register`) que resuelve los imports sin extensión; no se suma `tsx` ni otra dependencia.
- **Párrafos con líneas en blanco**: se convierten en varios `paragraph` (es lo que el sitio mostraba: un `<p>` por tramo). El primero conserva el id del bloque y los demás reciben un uuid v5 derivado del id y del número de tramo (repetible). El salto simple es un `hardBreak`.
- **Todo o nada**: si un artículo no pasa la verificación (D26), no se genera nada y se informa cuál y por qué (aclaración del 2026-10-22: sin copia del contenido anterior). El `update` lleva `where version = …` y el SQL comprueba la cantidad de filas y que no quede ningún arreglo.
- **Sin avisos ni cambios de versión** (RF-023): el SQL desactiva `a30`, `a90` y los `z90_notificar_*` durante el `update` (la regla de las cargas masivas de `CLAUDE.md`) y deja activo `a50_calcular_busqueda`.
- **Por qué no en la migración**: la conversión necesita el analizador en línea del sitio; reescribirlo en PL/pgSQL sería una segunda gramática y un riesgo de pérdida. La migración solo cambia la forma que acepta la base; la conversión se aplica con el SQL generado.
- **Alternativas descartadas**: conversor en PL/pgSQL (duplica la gramática); script con conexión directa a la base (sumaría `pg` y manejaría la cadena de conexión de la nube); que el sitio y el panel lean los dos formatos (descartado por el usuario: corte coordinado, RF-030).

## D26. Prueba de caracterización del sitio

- **Decisión**: **antes** de cambiar el renderer, una prueba captura, para el corpus de `packages/bloques/src/pruebas/corpus-contenido.ts` y los artículos del seed, lo que el renderer de bloques produce: texto visible por elemento, ids de los títulos (anclas), `src`, `alt` y leyendas de las imágenes, `href` y texto de los enlaces y el texto de la búsqueda. Se guarda como *fixture* (`pruebas/salida-anterior.json`). El script de conversión y las pruebas del renderer nuevo comparan contra esa *fixture* (CE-002, RF-023).
- El HTML exacto puede cambiar (por ejemplo, un párrafo con tramos ahora son varios `paragraph` con ids propios); lo que no puede cambiar es lo que ve y busca quien lee.

## D27. Renderer del sitio y estilos

- **Decisión**: `packages/bloques/src/render/Documento.tsx` (reemplaza a `Bloques.tsx`) recorre el documento y reutiliza los componentes de hoy para los elementos especiales (`Galeria`, `Cta`, `Video`, `ImagenBloque`, `Codigo`) con los `attrs` adaptados (D22), y `Titulo`, `Cita` y `Lista` con su contenido en línea. Un componente `EnLinea` (reemplaza a `TextoEnLinea`) pinta las marcas: `strong`, `em`, `u`, `s`, `mark`, `code`, `sup`, `sub` y `a` (con `hrefSeguro` y `atributosEnlace` de hoy). Las anclas de los títulos se calculan como hoy, con el texto del título.
- **Tablas**: `<div role="region" aria-labelledby tabindex="0">` con desplazamiento horizontal propio (`overflow-x-auto`) y foco visible, `<table>` con `<caption>` (la descripción; si falta, `aria-label` "Tabla N"), `<th scope="col">` en la fila de encabezado (con `colspan` sigue asociando por columna) y `colspan`/`rowspan` en las celdas. Sin JavaScript.
- **Alineación**: utilidades `text-center`, `text-right` y `text-justify` (sin valores sueltos).
- **Subrayado frente a enlace** (aclaración del 2026-10-22): `<u>` con el color del texto, línea fina y separación corta, sin efecto al pasar el puntero; el enlace conserva `CLASE_ENLACE` (`decoration-marca`, `underline-offset-4`, `hover:decoration-2`). Un enlace subrayado se ve solo como enlace.
- **Tokens nuevos** (`packages/ui/src/tokens.css`, con contraste AA comprobado en `clases.test.ts`): `--color-resaltado` y `--color-resaltado-texto` (fondo y texto de `mark`), `--color-borde-tabla` y `--color-fondo-encabezado-tabla`. El lienzo usa las mismas clases (exportadas desde `render/clases.ts`, como hoy).
- **SEO**: la estructura de encabezados no cambia (los títulos siguen empezando en `h2`); las tablas son HTML semántico indexable; sin JS nuevo en el sitio (CE-009).

## D28. Formato en el editor: barra, atajos y pegado

- **Barra**: estilo de párrafo, negrita, cursiva, subrayado, enlace, alineación (un menú con las cuatro opciones que muestra la vigente como texto), listas, «Insertar», «Acciones», «Propiedades», deshacer y rehacer; en **«Más formato»**: tachado, resaltado, código en línea, superíndice y subíndice. Lo que no entra pasa a «Más», salvo «Insertar».
- **Atajos** (se agregan a [contracts/atajos.md](contracts/atajos.md)): `Mod+U` subrayado, `Mod+.` superíndice y `Mod+,` subíndice. **Sin atajo propio**: tachado (`Mod+Shift+S` choca con la captura de pantalla de Firefox), resaltado (`Mod+Shift+H` abre el historial de Firefox) y alineación (`Mod+Shift+R` recarga, `Mod+Shift+J` abre la consola y `Ctrl+Alt` es AltGr en el teclado español). Se desactivan los atajos que esas extensiones traen por defecto. Todo se alcanza con la barra, que se recorre con el teclado (`role="toolbar"` con flechas).
- **Código en línea**: con `code` activo, los demás formatos quedan `aria-disabled` con la razón ("El código no admite otros formatos"); `superscript` y `subscript` se excluyen (`excludes` en el esquema).
- **Pegado** (reemplaza a D12 en lo que dice de las cuatro marcas): el esquema descarta lo que no admite (colores, tipografías, tamaños; el color del resaltado) y conserva las marcas y la alineación permitidas. Una tabla pegada que cabe en los límites se pega como tabla (sus combinaciones se conservan si forman rectángulos y respetan el encabezado; si no, se separan y se avisa); si no cabe, se pega como párrafos con un aviso. Los ids no viajan por el portapapeles (D21).

## D29. Tablas en el editor

- **Inserción**: «Insertar» y `/` ofrecen «Tabla» (3 × 3 con encabezado). Cuenta como un elemento (máximo 200).
- **Barra contextual de la tabla**: aparece con el cursor en una celda, como una fila de la barra de herramientas (no flotante, para no tapar contenido ni depender del puntero): insertar fila arriba y abajo, insertar columna a la izquierda y a la derecha, quitar fila, quitar columna, combinar celdas, separar celdas, fila de encabezado y quitar tabla. Las mismas acciones están en el panel de propiedades de la tabla, con la descripción. Cada acción tiene nombre accesible y anuncio ("Fila agregada, 4 filas").
- **Por debajo de 768 px** (RF-029): la barra contextual muestra solo «Quitar tabla» y el texto "Para cambiar filas, columnas o combinar celdas, usá una pantalla más ancha"; Tab en la última celda no agrega fila. Se decide con una *container query* sobre el ancho del editor y con `matchMedia` para el teclado.
- **Teclado**: Tab y Shift+Tab entre celdas; Tab en la última celda agrega una fila (desde 768 px); **Esc** pasa al modo elementos con la tabla seleccionada, desde donde Tab sale del lienzo (sin trampa de teclado, WCAG 2.1.2); Shift+flechas amplía una selección de celdas (`CellSelection` de `prosemirror-tables`) para combinar con teclado.
- **Reglas propias** (plugin `reglasDeTabla`, con pruebas en `tablas.test.ts`): rechaza combinar el encabezado con el cuerpo, combinar más allá de los límites o agregar filas o columnas por encima del máximo (con aviso); al quitar la última fila o columna, quita la tabla con la misma ruta de `proteger` (confirmación y Deshacer).
- **Lectores de pantalla**: en el lienzo la tabla es una `table` real (ProseMirror la dibuja así), con nombre por la descripción; la región de estado anuncia la celda al entrar ("Fila 2, columna 3, Precio").

## D30. Qué pasa con lo ya implementado (Historias 1 a 3)

| Pieza | Destino |
|---|---|
| `documento/conversion.ts` y su prueba | Se mueven a `packages/bloques/src/conversion-anterior/` para el script (D25); se eliminan después del corte |
| `en-linea.ts`, `parrafos.ts`, `render/TextoEnLinea.tsx`, `render/Parrafo.tsx`, `render/Bloques.tsx`, `utilidades.ts` (`textoPlano`) | La gramática y los tramos pasan a `conversion-anterior/`; el renderer de bloques se reemplaza por `Documento.tsx` y `EnLinea`; `textoPlano` por `textoDeElemento` (texto visible de un elemento, para `ComparacionVersiones` y el resumen de errores) |
| `esquema.ts` (`esquemaBloque`, `esquemaContenido`, `Contenido`), `validar.ts`, `tipos-bloque.ts`, `crearBloque` | Se reescriben sobre el documento (`esquemaDocumento`, `validarDocumento`, `TIPOS_ELEMENTO`, `crearElemento`); los esquemas de campos se reutilizan |
| `imagenes-en-uso.ts` (`rutasDeImagenes`, `rutasQuitadas`) | Recorren el documento |
| `extensiones.ts` | Sin `continuacion` ni normalización de marcas; nodos renombrados; `id`; marcas nuevas, alineación y tabla (D23) |
| `comandos.ts`, `proteger.ts`, `ids.ts`, `acciones-elemento.ts`, `AsaDeElemento`, `MenuAcciones` | `bloqueId` → `id`; la tabla es un elemento más (mover, duplicar, quitar; convertir no la ofrece) |
| `mapa-errores.ts`, `limites.ts`, `anuncios.ts` | Errores por ruta del documento y por `id`; conteo del texto; mensajes de tablas y formatos |
| `BarraHerramientas`, `MenuInsertar`, `menu-insercion.ts`, `PropiedadesDelElemento` | Formatos nuevos, «Más formato», alineación, «Tabla» y la barra contextual |
| `reductor.ts`, `datos.ts` (`validarEditor`), `EditorArticulo`, `ComparacionVersiones`, `acciones/articulos.ts`, vista previa | `Contenido` → `Documento` |
| `packages/db` (`tipos-publicos.ts`, `mapeo.ts`, `pruebas/datos.ts`, `pruebas/imagenes.ts`) | `Contenido` → `Documento` |
| `apps/web/src/pages/blog/[slug].astro` | `Bloques` → `Documento` |
| E2E (`editor-documento.spec.ts` y los de las specs 003 y 004) | Las consultas a la base comparan el documento en lugar de los bloques |

Lo que **no** cambia: el modo elementos, el asa propia, el menú «/», el panel y la hoja, el historial único, la barra fija de la 004 y los editores de campos.
