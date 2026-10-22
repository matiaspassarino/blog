# Especificación: Editor de notas estilo documento

**Rama**: `005-editor-estilo-documento`

**Creada**: 2026-10-22

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Editor de notas estilo documento para el panel, tipo Notion: en vez de la lista de bloques con botones (Subir, Bajar, Duplicar, Quitar, «Agregar bloque» con selector de tipo), el contenido del artículo se escribe como un documento continuo; con «/» se abre un menú para elegir el tipo de bloque." Reorientada el 2026-10-22: a los usuarios los bloques les resultan confusos y están acostumbrados a editores de texto como Word o Elementor, así que el editor pasa a ser un **editor de texto enriquecido** (con una captura de referencia: lienzo del documento, barra superior y panel de propiedades a la derecha).

## Contexto

Hoy el cuerpo de un artículo se arma como una lista de tarjetas: cada bloque tiene su propio recuadro con campos y una fila de botones para subirlo, bajarlo, duplicarlo o quitarlo, y al final un selector de tipo con «Agregar bloque». Funciona y es accesible, pero a quienes escriben les resulta confuso pensar en "bloques": escribir se siente como completar un formulario y no como escribir una nota en un procesador de texto.

- Para seguir escribiendo después de un párrafo hay que bajar hasta el selector, elegir el tipo y pulsar «Agregar bloque».
- Cada bloque ocupa mucho espacio con botones que repiten su nombre ("Subir bloque 3, párrafo") y la nota se ve fragmentada.
- No hay una forma rápida de pasar un párrafo a título o a cita, ni de ver cómo va a quedar.

Esta spec reemplaza el modelo de interacción del editor de bloques que la spec 004 dejó provisorio. El cuerpo del artículo se escribe en un **lienzo de documento** que se ve con la tipografía y el aspecto del sitio, con una **barra de herramientas** arriba (estilo de párrafo, negrita, cursiva, listas, enlace, deshacer…) y un **panel de propiedades** a la derecha para el elemento seleccionado (el nivel de un título, la leyenda de una imagen, los campos de una llamada a la acción…). Los elementos que un procesador de texto no tiene (imagen, galería, llamada a la acción, video, código) se insertan desde un botón «Insertar» y desde «/», y se ven en el lienzo como se verán en el sitio.

El contenido guardado **no cambia**: sigue siendo la misma lista de bloques de los mismos diez tipos y con las mismas reglas de validación. La persona escribe un documento; el editor lo guarda como esa lista. Para eso el usuario eligió Tiptap como librería de edición (el plan lo justifica contra la constitución).

## Aclaraciones

### Sesión 2026-10-22

- P: ¿El formato en línea se ve aplicado mientras se escribe o el texto conserva los marcadores visibles? → R: Se ve aplicado (la negrita se ve en negrita) y lo guardado sigue siendo el texto con las cuatro marcas de hoy (RF-009).
- P: ¿Se reordena también arrastrando? → R: Sí: **menú y atajos de teclado, más arrastrar el asa del elemento con ratón y con el dedo**; el menú y el teclado se mantienen siempre como alternativa sin arrastre (RF-007).
- P: ¿Cómo se ven y se editan los elementos con varios campos (imagen, galería, llamada a la acción, video, cita con autor)? → R: Se ven en el lienzo **como quedarán en el sitio** y sus campos se editan en el **panel de propiedades** al seleccionarlos (reemplaza la idea inicial de una vista resumida que abre los campos en el lugar) (RF-004, RF-020).
- P: ¿El deshacer es un historial único del documento o uno por bloque? → R: **Un solo historial para todo el documento**, con el texto y las acciones sobre elementos, en el orden en que ocurrieron (RF-011).
- P: ¿Se pueden seleccionar varios elementos a la vez para moverlos, duplicarlos o quitarlos? → R: Sí, **selección múltiple** (con Shift y clic o flechas) para mover, duplicar y quitar; convertir de tipo sigue siendo de a un elemento (RF-019).
- P: ¿Qué pasa cuando un texto pegado o escrito supera el máximo de caracteres de un párrafo? → R: **Al pegar, el sobrante pasa a párrafos nuevos; al escribir, se avisa del máximo sin cortar nada** (RF-015).
- P: Revisión del plan (2026-10-22): ¿cómo se resuelven los puntos de interfaz y de accesibilidad señalados? → R: la segunda columna empieza en 1280 px (a 1024 px el lienzo quedaría de unos 340 px); un rango de texto no es una selección de elementos (modo elementos aparte); el asa flotante es para ratón y toque y el botón «Acciones» de la barra es el camino de teclado y de lectores; «Publicación» queda fuera de las pestañas; los atajos con `Alt+Shift` y `Mod+Shift` se reemplazan por un modo elementos con `Alt+↑/↓`, `Mod+D` y `Supr` (RF-006, RF-019, RF-020).
- P: ¿Se adopta un editor de texto enriquecido en lugar de "bloques"? → R: Sí. El usuario decidió usar **Tiptap** y aceptar el riesgo técnico de sumar la librería; el plan evalúa antes una prueba corta contra Lexical (RF-021).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Escribir como en un documento de texto (Prioridad: P1)

Un editor abre un artículo y ve un documento: un lienzo con la tipografía del sitio y, arriba, una barra con el estilo de párrafo (Párrafo, Título 2, 3 y 4, Cita), negrita, cursiva, código, enlace, lista con viñetas, lista numerada, deshacer y rehacer. Escribe de corrido, con Enter para un párrafo nuevo, y da formato como en cualquier procesador de texto.

**Por qué esta prioridad**: es el cambio que el usuario pidió y el que más modifica la forma de escribir. Con solo esta historia el editor deja de ser una lista de formularios.

**Prueba independiente**: crear un artículo nuevo y escribir un título, dos párrafos con una palabra en negrita, una lista y una cita usando la barra y el teclado, y comprobar que al guardar el contenido tiene esos elementos en ese orden.

**Escenarios de aceptación**:

1. **Dado** un artículo nuevo, **cuando** se abre el editor, **entonces** el lienzo muestra un párrafo vacío con el cursor listo para escribir y la barra de herramientas arriba; no hay botón de «Agregar bloque» ni filas de botones por bloque.
2. **Dado** un párrafo con texto, **cuando** la persona pulsa Enter, **entonces** aparece debajo un párrafo nuevo con el cursor y el texto anterior queda intacto; Enter sobre una línea vacía de una lista sale de la lista.
3. **Dado** un texto seleccionado, **cuando** la persona usa la barra o el atajo de teclado de negrita, cursiva, código o enlace, **entonces** el formato se ve aplicado en el lienzo (la negrita se ve en negrita) y se puede quitar con el mismo control; el control activo se muestra con texto accesible, no solo con color.
4. **Dado** el cursor en un párrafo, **cuando** la persona elige «Título 2», «Título 3», «Título 4», «Cita», «Lista con viñetas» o «Lista numerada» en la barra, **entonces** ese párrafo cambia de tipo conservando el texto, y elegir «Párrafo» lo devuelve.
5. **Dado** una línea vacía, **cuando** la persona escribe «/», **entonces** se abre un menú con los elementos que se pueden insertar y los estilos de párrafo, filtrable al escribir («/tit»), navegable con flechas, Enter y Esc, y también con ratón y toque; Esc o borrar el «/» lo cierra sin cambios.
6. **Dado** un párrafo vacío o con el cursor al comienzo, **cuando** la persona pulsa Retroceso, **entonces** se une con el anterior o, si es el primero, se mantiene un párrafo vacío (el documento nunca queda sin ningún párrafo).
7. **Dado** el documento, **cuando** se lo mira, **entonces** los títulos, párrafos, listas y citas se ven con la tipografía y los estilos del sitio, para que la persona sepa cómo quedará el artículo.

---

### Historia 2 - Insertar y editar imágenes, galerías, llamadas a la acción, videos y código (Prioridad: P1)

La persona inserta una imagen, una galería, una llamada a la acción, un video, un bloque de código o un separador desde el botón «Insertar» de la barra o desde «/». En el lienzo cada uno se ve como se verá en el sitio, y al seleccionarlo, sus campos aparecen en el **panel de propiedades** a la derecha (texto alternativo, leyenda, columnas, URL, etiqueta del botón, lenguaje…).

**Por qué esta prioridad**: sin esto solo se podría escribir texto; los diez tipos de contenido tienen que poder crearse y editarse para reemplazar al editor anterior.

**Prueba independiente**: insertar uno de cada elemento desde «Insertar», completar sus campos obligatorios en el panel y guardar; el contenido guardado y la vista previa coinciden con lo escrito.

**Escenarios de aceptación**:

1. **Dado** el botón «Insertar» o el menú «/», **cuando** se los abre, **entonces** ofrecen imagen, galería, llamada a la acción, video, código y separador, cada uno con su nombre y una descripción corta, y los estilos de párrafo (título, cita, listas).
2. **Dado** que se elige «Imagen», **cuando** se inserta, **entonces** aparece en el lienzo con el selector para subirla (JPEG, PNG, WebP o AVIF, hasta 5 MB) y, al seleccionarla, el panel muestra el texto alternativo (o la marca de decorativa) y la leyenda, con las mismas reglas y mensajes de hoy.
3. **Dado** una galería, una llamada a la acción, un video, un bloque de código o una cita con autor, **cuando** se los inserta, **entonces** se ven en el lienzo como en el sitio (miniaturas en columnas, botón con su etiqueta, vista del video, texto en tipografía de código) y el panel de propiedades muestra sus campos propios con los límites y mensajes de validación de hoy.
4. **Dado** un elemento seleccionado, **cuando** la persona cambia un campo en el panel, **entonces** el lienzo se actualiza al instante.
5. **Dado** un elemento con un error de validación, **cuando** no está seleccionado, **entonces** el lienzo lo marca con un texto de error (no solo color) y, al intentar guardar, el elemento se selecciona y el panel enfoca el campo del primer error.
6. **Dado** una pantalla de menos de 1280 px, **cuando** la persona elige «Propiedades» (o pulsa Enter sobre un elemento seleccionado), **entonces** el panel se abre como una hoja que se puede cerrar con «Cerrar» y Esc, sin tapar el elemento seleccionado ni los controles y sin quitarle el foco al lienzo; tocar un elemento para desplazar la pantalla no la abre.
7. **Dado** un lector de pantalla, **cuando** se recorre el documento, **entonces** cada elemento especial se anuncia con su tipo y posición ("Imagen, 3 de 8"), y se puede llegar a su panel de propiedades con el teclado.

---

### Historia 3 - Mover, duplicar, quitar y seleccionar varios elementos (Prioridad: P2)

Cada párrafo, título, lista, cita o elemento especial tiene a su lado un asa discreta (visible al pasar el puntero, al recibir el foco y siempre en pantallas táctiles) que se arrastra para moverlo y abre un menú con subir, bajar, duplicar, convertir y quitar. Las mismas acciones tienen atajos de teclado, y se pueden seleccionar varios elementos a la vez.

**Por qué esta prioridad**: mantiene todo lo que el editor de hoy permite (RF-005 de la spec 003: reordenar, duplicar y quitar) sin las filas de botones. Es necesaria, pero las historias 1 y 2 ya dan un editor usable.

**Prueba independiente**: con un artículo de cinco elementos, mover el tercero al principio (arrastrando y con teclado), duplicar el segundo, convertir un párrafo en cita y quitar el último, y comprobar el orden y el tipo resultantes.

**Escenarios de aceptación**:

1. **Dado** un elemento, **cuando** recibe el puntero o el toque, **entonces** muestra su asa para arrastrarlo y abrir el menú de acciones; para teclado y lectores de pantalla, el mismo menú se abre con el botón «Acciones» de la barra, que dice a qué elemento actúa ("Acciones del elemento 3, párrafo").
2. **Dado** el menú del asa, **cuando** se elige «Subir» o «Bajar», **entonces** el elemento cambia de lugar, el foco queda en él y una región anuncia la nueva posición; en los extremos la acción no está disponible.
3. **Dado** el asa de un elemento, **cuando** la persona la arrastra con el ratón o con el dedo y la suelta entre otros dos elementos, **entonces** queda en ese lugar, se muestra dónde caería mientras se arrastra, se anuncia la nueva posición y el foco queda en el elemento movido; soltar fuera del documento o pulsar Esc cancela el movimiento.
4. **Dado** un teléfono, **cuando** la persona desplaza la pantalla con el dedo sobre el texto, **entonces** no se inicia ningún arrastre: solo el asa arrastra.
5. **Dado** el menú del asa, **cuando** se elige «Duplicar», **entonces** aparece una copia justo debajo con un identificador nuevo y el foco pasa a la copia.
6. **Dado** un párrafo, título, cita o lista, **cuando** se elige «Convertir en…» y otro tipo de texto, **entonces** cambia de tipo conservando su texto, y si el nuevo tipo no admite algún dato (por ejemplo, el autor de una cita) se avisa antes de convertir.
7. **Dado** el menú del asa, **cuando** se elige «Quitar», **entonces** el elemento desaparece y el foco pasa al contiguo; si tenía una imagen ya guardada, se mantiene la confirmación de hoy antes de quitarla.
8. **Dado** un teclado, **cuando** la persona usa los atajos de mover, duplicar y quitar, **entonces** obtiene el mismo resultado que con el menú, y los atajos figuran en el menú y en la ayuda del editor.
9. **Dado** un elemento con el cursor, **cuando** la persona pulsa Esc (o Shift y clic sobre el asa, o «Seleccionar» en el menú de acciones), **entonces** entra al modo elementos con ese elemento seleccionado y, con Shift y las flechas, amplía la selección a elementos contiguos; se anuncia la cantidad al entrar y al terminar, se muestra "3 elementos seleccionados" como texto fijo y cada elemento seleccionado lleva una marca que no depende del color. Un rango de **texto** que cruza varios párrafos no es una selección de elementos: sirve para dar formato y no habilita mover ni quitar.
10. **Dado** varios elementos seleccionados, **cuando** se elige «Subir», «Bajar», «Duplicar» o «Quitar» (o se arrastra el asa de la selección), **entonces** la acción se aplica al conjunto en un solo paso, que se deshace de una vez; «Convertir en…» no se ofrece; quitar varios pide confirmación solo si alguno tiene una imagen ya guardada.
11. **Dado** varios elementos seleccionados, **cuando** la persona pulsa Esc o hace clic en un texto, **entonces** la selección se cancela sin cambios.

---

### Historia 4 - Atajos de escritura, pegado y deshacer (Prioridad: P2)

Quien ya conoce los atajos tipo Markdown los puede usar para dar formato sin tocar la barra, pegar texto de otras fuentes sin ensuciar el artículo, y deshacer cualquier cosa.

**Por qué esta prioridad**: acelera a quienes los conocen y evita contenido sucio; no es necesaria para que el editor funcione.

**Prueba independiente**: escribir «## Mi título» al comienzo de una línea y comprobar que se convierte en un título; pegar texto de un documento con formato y comprobar que solo conserva las cuatro marcas permitidas.

**Escenarios de aceptación**:

1. **Dado** una línea vacía, **cuando** la persona escribe «## » o «### » o «#### » seguido de texto, **entonces** la línea pasa a ser un título de nivel 2, 3 o 4; con «- » pasa a ser lista con viñetas, con «1. » lista numerada, con «> » cita, con «---» separador y con tres comillas invertidas bloque de código.
2. **Dado** una conversión no deseada por un atajo, **cuando** la persona pulsa Deshacer inmediatamente, **entonces** vuelve el texto escrito tal cual («## » queda como texto).
3. **Dado** cualquier acción del editor (escribir, dar formato, insertar, convertir, mover, duplicar, quitar), **cuando** la persona pulsa Deshacer, **entonces** vuelve al estado anterior en un único historial del documento, sin importar dónde esté el cursor; Rehacer lo repite. Un elemento quitado por error se recupera con Deshacer, y el texto escrito de corrido se deshace por tramos razonables (no letra por letra).
4. **Dado** un texto copiado de otra aplicación, **cuando** se lo pega, **entonces** se crea un párrafo por cada párrafo copiado, el formato se reduce al texto con las cuatro marcas permitidas (negrita, cursiva, código y enlace) y nunca se acepta HTML ni estilos de color, fuente o tamaño.
5. **Dado** un texto pegado que supera el máximo de caracteres de un párrafo, **cuando** se lo pega, **entonces** el sobrante pasa a párrafos nuevos a continuación (cortando en un fin de oración o de palabra) y se anuncia cuántos se crearon.

---

### Historia 5 - Que nada de lo que ya funciona se pierda (Prioridad: P1)

Los artículos que ya existen se abren en el nuevo editor sin cambios, se guardan igual que hoy y se ven igual en la vista previa y en el sitio. Las validaciones, los errores por elemento, los avisos de cambios sin guardar y de conflicto, las imágenes y el uso con teclado, lector de pantalla y teléfono siguen cumpliéndose.

**Por qué esta prioridad**: es una restricción, no una función: el nuevo editor no puede romper contenido ni flujos existentes. Se prueba en paralelo con las demás historias.

**Prueba independiente**: abrir y guardar sin tocar cada artículo del seed (y un artículo con los diez tipos de contenido) y comprobar que el contenido guardado es idéntico al original.

**Escenarios de aceptación**:

1. **Dado** un artículo existente con elementos de los diez tipos, **cuando** se abre y se guarda sin editar, **entonces** el contenido guardado es idéntico al original (mismo orden, mismos identificadores y mismos campos) y la versión no cambia si no hubo cambios.
2. **Dado** un texto que contiene por sí mismo asteriscos, guiones bajos, corchetes o comillas invertidas, **cuando** se abre y se guarda sin editar, **entonces** esos caracteres se conservan exactamente.
3. **Dado** un elemento con error de validación (por ejemplo, una imagen sin texto alternativo), **cuando** se intenta guardar, **entonces** el editor muestra el error en el elemento y el campo exactos, enfoca el primero y anuncia el resumen, como hoy.
4. **Dado** cambios sin guardar, **cuando** la persona intenta salir, **entonces** se mantiene el aviso de hoy; y **cuando** otra persona guardó antes, se mantiene el aviso de conflicto con comparación de versiones.
5. **Dado** un teléfono de 360 px, **cuando** se edita, **entonces** la barra de herramientas se reacomoda sin cortes (los controles que no entran pasan a un menú «Más»), los controles miden al menos 44 × 44 px y el menú de «Insertar» es alcanzable sin escribir «/».
6. **Dado** un lector de pantalla, **cuando** se recorre la barra y el lienzo, **entonces** la barra se anuncia como barra de herramientas con el estado de cada control, el lienzo como área de edición de texto, y las acciones se confirman con mensajes como hoy.

### Casos borde

- **Documento vacío**: un artículo sin contenido muestra un párrafo vacío para empezar; si se guarda así y el artículo se está publicando, se mantiene la regla de hoy de que un publicado necesita al menos un bloque con contenido.
- **«/» dentro de un texto**: escribir «/» en medio de una frase o de una URL no abre el menú; solo al comienzo de una línea vacía.
- **Textos largos**: al escribir a mano un párrafo que llega al máximo de caracteres, el editor avisa (con un mensaje que se anuncia) sin cortar ni perder lo escrito, y el error de validación aparece al guardar como hoy. En títulos, citas, ítems de lista y código, el sobrante se mantiene en el campo y se marca el error en lugar de crear elementos de otro tipo.
- **Conversión con pérdida**: convertir una lista de varios ítems a párrafo, o una cita con autor a párrafo, avisa qué se perdería y permite cancelar.
- **Subida en curso**: mientras una imagen o una galería sube, el guardado queda bloqueado como hoy y no se puede quitar o mover ese elemento.
- **Arrastrar en una pantalla larga**: al arrastrar cerca del borde superior o inferior de la ventana el documento se desplaza solo.
- **Muchos elementos**: un artículo con el máximo de 200 bloques que admite el esquema sigue siendo ágil al escribir y al abrir el menú; al llegar al máximo se avisa y no se crean más.
- **Marcas que el sitio no sabe leer**: una negrita con espacios en los bordes, una cursiva a mitad de palabra, un código que contiene una comilla invertida o marcas que se cruzan se ajustan sin que se pierda texto (por ejemplo, el espacio queda fuera de la negrita), para que lo que se ve en el lienzo sea lo que el sitio muestra.
- **Menú «/» sin resultados**: «/zzz» muestra «Sin resultados» y no cambia nada al pulsar Enter.
- **Formato que el sitio no admite**: subrayado, tachado, colores, tipografías, tamaños, alineación y márgenes (que muestra la captura de referencia) no se ofrecen, porque el sitio los define de forma uniforme.
- **Dos elementos especiales seguidos** o un elemento especial al final del documento: siempre queda un párrafo donde seguir escribiendo.
- **Sin JavaScript**: el panel requiere JavaScript, como hoy.
- **Rol editor y rol admin**: ambos usan el mismo editor; los permisos de eliminar artículos no cambian.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **RF-001**: El editor DEBE presentar el cuerpo del artículo como un documento de texto enriquecido en un lienzo continuo, con una barra de herramientas arriba, sin botón de «Agregar bloque», sin selector de tipo y sin una fila de botones por bloque, y DEBE mostrar el contenido con la tipografía y los estilos del sitio.
- **RF-002**: Un artículo nuevo DEBE abrir con un párrafo vacío y el cursor en él. Enter DEBE crear un párrafo nuevo (o un ítem en una lista, y salir de la lista sobre un ítem vacío), y el documento NUNCA DEBE quedar sin un párrafo donde escribir.
- **RF-003**: La barra de herramientas DEBE ofrecer estilo de párrafo (Párrafo, Título 2, Título 3, Título 4 y Cita), negrita, cursiva, código en línea, enlace, lista con viñetas, lista numerada, «Insertar», deshacer y rehacer, con área táctil de al menos 44 × 44 px, estado activo comunicado con texto accesible y reacomodo sin cortes en pantallas angostas.
- **RF-004**: Imagen, galería, llamada a la acción, video, código, cita con autor y separador DEBEN poder insertarse desde «Insertar» y «/», verse en el lienzo como se verán en el sitio y editarse con sus mismos campos, límites y mensajes de validación de hoy; el esquema de bloques del contenido NO DEBE cambiar.
- **RF-005**: «/» al comienzo de una línea vacía DEBE abrir un menú filtrable con los elementos insertables y los estilos de párrafo, navegable con flechas, Enter y Esc, y con ratón y toque. Además, «Insertar» DEBE ofrecer lo mismo sin escribir «/», para teclado virtual y toque.
- **RF-006**: El editor DEBE ofrecer, para el elemento activo (párrafo, título, lista, cita o elemento especial), un asa para ratón y toque y un botón «Acciones» en la barra para teclado y lectores de pantalla, que abren el mismo menú de subir, bajar, duplicar, convertir (entre los tipos de texto) y quitar, cada acción con su nombre accesible y su posición.
- **RF-007**: Las acciones sobre elementos DEBEN tener atajos de teclado documentados dentro del editor, y el elemento DEBE poder arrastrarse por su asa con ratón y con el dedo para reordenarlo. El arrastre es una forma adicional: el menú y los atajos DEBEN dar el mismo resultado sin arrastrar (spec 003, RF-025).
- **RF-008**: Tras cada acción (insertar, convertir, mover, duplicar, quitar) el foco DEBE quedar en un lugar útil y una región de estado DEBE anunciar lo ocurrido en español, con la posición desde 1.
- **RF-009**: Las marcas en línea DEBEN limitarse a negrita, cursiva, código en línea y enlace (spec 003, RF-005), aplicables con la barra y con atajos de teclado, solo donde el esquema las admite (párrafo, cita y lista). El formato DEBE verse aplicado mientras se escribe, sin mostrar marcadores, y lo guardado DEBE seguir siendo el texto con las mismas cuatro marcas. NO DEBE permitirse HTML, subrayado, tachado, colores, tipografías, tamaños ni alineación.
- **RF-010**: Los atajos de escritura tipo Markdown («## », «### », «#### », «- », «1. », «> », «---» y las tres comillas invertidas) DEBEN convertir la línea al tipo correspondiente, y Deshacer inmediato DEBE dejar el texto escrito tal cual.
- **RF-011**: El editor DEBE ofrecer Deshacer y Rehacer con los atajos habituales sobre **un solo historial del documento** que incluya el texto, el formato y las acciones sobre elementos, y que se reinicie al adoptar la versión vigente con «Reemplazar con la vigente».
- **RF-012**: Un artículo existente DEBE abrirse sin cambios y guardarse con un contenido idéntico al original cuando no se edita, incluidos los textos que contienen por sí mismos caracteres que se usan como marcas; el modelo de datos, las migraciones y el esquema de bloques NO DEBEN cambiar.
- **RF-013**: La validación previa al guardado, los errores por elemento y campo, el enfoque del primer error, el aviso de cambios sin guardar, el aviso de conflicto con comparación de versiones, el bloqueo durante subidas de imagen y la limpieza de imágenes sin uso DEBEN comportarse como hoy.
- **RF-014**: El editor DEBE poder usarse completo con teclado y lector de pantalla y en pantallas desde 360 px, sin cortes ni superposiciones, con las áreas táctiles mínimas de la spec 004 y sin depender del color solo.
- **RF-015**: Pegar texto en el documento DEBE crear un párrafo por párrafo copiado y reducir el formato al texto con las cuatro marcas permitidas, sin HTML. Si un párrafo pegado supera el máximo de caracteres, el sobrante DEBE pasar a párrafos nuevos a continuación sin perder texto, y el aviso de cuántos se crearon DEBE anunciarse.
- **RF-016**: Una conversión de tipo que pierda datos (por ejemplo, una lista de varios ítems a párrafo) DEBE avisar qué se perdería y permitir cancelar antes de aplicarla.
- **RF-017**: El menú «/» y el de «Insertar» DEBEN abrirse sin demora perceptible y el editor DEBE seguir siendo ágil (menos de 100 ms de latencia al escribir) con el máximo de 200 bloques que admite el esquema. Al llegar a 200 elementos, insertar y pegar nuevos elementos DEBE avisar "Se alcanzó el máximo de 200 elementos" y no crear más.
- **RF-018**: Los permisos, la barra fija de acciones del artículo, el recuadro «Publicación», las secciones (imagen destacada, taxonomías, para buscadores) y los textos de la spec 004 NO DEBEN cambiar, salvo los textos propios del editor.
- **RF-019**: El editor DEBE tener un **modo elementos** (con Esc, Shift y clic sobre el asa o «Seleccionar» del menú de acciones) que permita seleccionar varios elementos consecutivos con Shift y las flechas y aplicarles mover, duplicar y quitar como una sola acción que Deshacer revierte de una vez; convertir de tipo NO DEBE ofrecerse con varios elementos seleccionados. Un rango de texto que cruza párrafos NO DEBE habilitar esas acciones. Toda vía que quite o mueva elementos (menú, atajo, Supr, cortar, escribir sobre la selección, arrastrar) DEBE pasar por las mismas reglas: bloquear con una subida en curso y confirmar una imagen ya guardada.
- **RF-020**: El editor DEBE ofrecer un **panel de propiedades** del elemento seleccionado, con los campos que el esquema admite para ese tipo (nivel de título, lista ordenada, autor y fuente de la cita, texto alternativo y leyenda de la imagen, columnas de la galería, campos de la llamada a la acción, URL del video, lenguaje del código). En pantallas de 1280 px o más DEBE ser una pestaña de la columna lateral junto al lienzo (con «Publicación» siempre visible); en pantallas menores, una hoja que se abre con «Propiedades» o con Enter y se cierra con «Cerrar» o Esc sin tapar el elemento seleccionado ni quitar el foco del lienzo. NO DEBE ofrecer propiedades que el esquema no guarda.
- **RF-021**: La librería de edición DEBE ser Tiptap (decisión del usuario). Su uso DEBE quedar justificado en el plan (constitución §II), limitado a `apps/admin` y con versiones fijas y compatibles con la protección de antigüedad de paquetes del proyecto. El editor NO DEBE superar de 250 KB gzip adicionales sobre la ruta actual del editor (tope de la prueba de concepto).

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

Sin cambios: la feature solo cambia la forma de editar el cuerpo del artículo. Editores y administradores ven y usan el mismo editor, y las acciones de estado y de eliminación siguen siendo las de hoy.

### Entidades clave *(la feature no agrega datos)*

- **Bloque**: cada unidad del contenido guardado (diez tipos), con su identificador, su tipo y sus campos. No cambia.
- **Documento**: lo que la persona ve y escribe en el lienzo; se guarda como la secuencia ordenada de bloques del artículo.
- **Elemento**: cada párrafo, título, lista, cita o pieza especial del documento; corresponde a un bloque.
- **Panel de propiedades**: la zona que muestra los campos del elemento seleccionado.
- **Menú de inserción**: la lista que se abre con «/» o con «Insertar».

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: Una persona que no usó el editor nuevo crea y publica un artículo de 5 elementos (con una imagen) en igual o menos tiempo que con el editor de la spec 003 (unos 2 minutos), sin ayuda.
- **CE-002**: El 100 % de los artículos del seed y de un artículo con los diez tipos de contenido se abre y se guarda sin edición con contenido idéntico al original, incluidos los textos con asteriscos, guiones bajos, corchetes y comillas invertidas propios.
- **CE-003**: Los diez tipos de contenido pueden insertarse, completarse y quitarse usando solo el teclado, y un artículo de cinco elementos se reordena (mover, duplicar, convertir, quitar) también solo con teclado.
- **CE-004**: En 360, 768, 1024 y 1440 px, el editor no tiene elementos cortados ni superpuestos, todos los controles miden al menos 44 × 44 px y Lighthouse Accesibilidad es ≥ 95 en el editor.
- **CE-005**: Todos los flujos de punta a punta del panel que hoy funcionan (guardar, errores por elemento, subida de imágenes, conflicto, publicación, programación) siguen pasando, adaptados solo en la forma de agregar, mover y editar los elementos.
- **CE-006**: Los menús de «/» y «Insertar» aparecen en menos de 200 ms, incluso con un artículo de 50 elementos.
- **CE-007**: En una prueba con 3 a 5 personas que escriben habitualmente en procesadores de texto, al menos 4 de cada 5 completan sin ayuda una nota con un título, formato, una lista y una imagen, y ninguna necesita que se le explique qué es un "bloque".

## Supuestos

- El contenido y su validación no cambian: es la misma lista de bloques de la spec 001 con las reglas de `packages/bloques`; no hay migraciones ni cambios de base de datos.
- El editor sigue en `apps/admin` y reutiliza los componentes de la spec 004 (barra fija, niveles de botón, encabezado, títulos de sección, avisos); no cambia el sitio público ni su aspecto.
- El usuario decidió usar Tiptap y aceptar el riesgo técnico (2026-10-22). El plan hace una prueba corta antes de cerrar la elección (ida y vuelta sin pérdida, accesibilidad, peso y rendimiento) y justifica la dependencia contra la constitución (stack cerrado, §II).
- La captura de referencia (lienzo, barra superior y panel de propiedades a la derecha) sirve de guía de disposición; las propiedades se limitan a lo que el esquema guarda.
- La imagen destacada, el extracto, las etiquetas, la categoría y los campos para buscadores siguen en sus secciones de hoy. El panel de propiedades del elemento comparte la zona lateral con ellas (por ejemplo, en pestañas «Artículo» y «Elemento»); la disposición exacta la define el plan.
- Es un sitio de demo: se privilegia un editor simple y consistente por sobre la cantidad de atajos y opciones.
- El texto de la interfaz está en español con tuteo, como el resto del panel.

## Fuera de alcance

- Cambiar el esquema de bloques, los tipos de bloque o sus límites.
- Tipografías, colores, tamaños, alineación, márgenes, subrayado y tachado: el sitio los define de forma uniforme.
- Colaboración en tiempo real, comentarios, historial de versiones del documento o autoguardado.
- Tablas, columnas, incrustaciones nuevas y plantillas de artículo.
- Arrastrar y soltar archivos desde el escritorio como forma de insertar imágenes.
- Cambios en la imagen destacada, el extracto, las etiquetas, la categoría o los campos para buscadores, en la vista previa, en el sitio público o en SEO.
