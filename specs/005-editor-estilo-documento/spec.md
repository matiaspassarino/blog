# Especificación: Editor de notas estilo documento

**Rama**: `005-editor-estilo-documento`

**Creada**: 2026-10-22 · **Ampliada**: 2026-10-22 (constitución 2.0.0)

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Editor de notas estilo documento para el panel, tipo Notion: en vez de la lista de bloques con botones (Subir, Bajar, Duplicar, Quitar, «Agregar bloque» con selector de tipo), el contenido del artículo se escribe como un documento continuo; con «/» se abre un menú para elegir el tipo de bloque." Reorientada el 2026-10-22: a los usuarios los bloques les resultan confusos y están acostumbrados a editores de texto como Word o Elementor, así que el editor pasa a ser un **editor de texto enriquecido** (con una captura de referencia: lienzo del documento, barra superior y panel de propiedades a la derecha). Ampliada el 2026-10-22: "integrar el editor nuevo con la mayor cantidad de funciones": el documento del editor pasa a ser lo que se guarda, y se suman más formatos en línea, alineación de texto y tablas.

## Contexto

Hoy el cuerpo de un artículo se arma como una lista de tarjetas: cada bloque tiene su propio recuadro con campos y una fila de botones para subirlo, bajarlo, duplicarlo o quitarlo, y al final un selector de tipo con «Agregar bloque». Funciona y es accesible, pero a quienes escriben les resulta confuso pensar en "bloques": escribir se siente como completar un formulario y no como escribir una nota en un procesador de texto.

- Para seguir escribiendo después de un párrafo hay que bajar hasta el selector, elegir el tipo y pulsar «Agregar bloque».
- Cada bloque ocupa mucho espacio con botones que repiten su nombre ("Subir bloque 3, párrafo") y la nota se ve fragmentada.
- No hay una forma rápida de pasar un párrafo a título o a cita, ni de ver cómo va a quedar.
- El formato se limita a negrita, cursiva, código y enlace: no se puede subrayar, tachar, resaltar, centrar un párrafo ni armar una tabla, cosas que cualquier procesador de texto ofrece.

Esta spec reemplaza el modelo de interacción del editor de bloques que la spec 004 dejó provisorio. El cuerpo del artículo se escribe en un **lienzo de documento** que se ve con la tipografía y el aspecto del sitio, con una **barra de herramientas** arriba (estilo de párrafo, formato, alineación, listas, enlace, deshacer…) y un **panel de propiedades** a la derecha para el elemento seleccionado (el nivel de un título, la leyenda de una imagen, los campos de una llamada a la acción…). Los elementos que un procesador de texto no tiene (imagen, galería, llamada a la acción, video, código) y las tablas se insertan desde un botón «Insertar» y desde «/», y se ven en el lienzo como se verán en el sitio.

**Lo guardado cambia** (enmienda 2.0.0 de la constitución, §VI): el contenido deja de ser una lista de bloques y pasa a ser el **documento** que la persona escribe, validado contra una lista cerrada de elementos, formatos y atributos. Los artículos que ya existen se pasan al formato nuevo una sola vez, sin perder nada, y se siguen viendo igual en el sitio. El sitio público aprende a mostrar los formatos nuevos, la alineación y las tablas.

## Aclaraciones

### Sesión 2026-10-22

- P: ¿El formato en línea se ve aplicado mientras se escribe o el texto conserva los marcadores visibles? → R: Se ve aplicado (la negrita se ve en negrita), sin marcadores (RF-009).
- P: ¿Se reordena también arrastrando? → R: Sí: **menú y atajos de teclado, más arrastrar el asa del elemento con ratón y con el dedo**; el menú y el teclado se mantienen siempre como alternativa sin arrastre (RF-007).
- P: ¿Cómo se ven y se editan los elementos con varios campos (imagen, galería, llamada a la acción, video, cita con autor)? → R: Se ven en el lienzo **como quedarán en el sitio** y sus campos se editan en el **panel de propiedades** al seleccionarlos (reemplaza la idea inicial de una vista resumida que abre los campos en el lugar) (RF-004, RF-020).
- P: ¿El deshacer es un historial único del documento o uno por bloque? → R: **Un solo historial para todo el documento**, con el texto y las acciones sobre elementos, en el orden en que ocurrieron (RF-011).
- P: ¿Se pueden seleccionar varios elementos a la vez para moverlos, duplicarlos o quitarlos? → R: Sí, **selección múltiple** (con Shift y clic o flechas) para mover, duplicar y quitar; convertir de tipo sigue siendo de a un elemento (RF-019).
- P: ¿Qué pasa cuando un texto pegado o escrito supera el máximo de caracteres de un párrafo? → R: **Al pegar, el sobrante pasa a párrafos nuevos; al escribir, se avisa del máximo sin cortar nada** (RF-015).
- P: Revisión del plan (2026-10-22): ¿cómo se resuelven los puntos de interfaz y de accesibilidad señalados? → R: la segunda columna empieza en 1280 px (a 1024 px el lienzo quedaría de unos 340 px); un rango de texto no es una selección de elementos (modo elementos aparte); el asa flotante es para ratón y toque y el botón «Acciones» de la barra es el camino de teclado y de lectores; «Publicación» queda fuera de las pestañas; los atajos con `Alt+Shift` y `Mod+Shift` se reemplazan por un modo elementos con `Alt+↑/↓`, `Mod+D` y `Supr` (RF-006, RF-019, RF-020).
- P: ¿Se adopta un editor de texto enriquecido en lugar de "bloques"? → R: Sí. El usuario decidió usar **Tiptap** y aceptar el riesgo técnico de sumar la librería (RF-021; desde la constitución 2.0.0 forma parte del stack).
- P: Ampliación (2026-10-22): ¿se mantiene la lista de bloques como formato guardado o se guarda el documento del editor? → R: **Se guarda el documento del editor** (constitución 2.0.0, §VI), para aprovechar más funciones; los artículos existentes se convierten una vez sin pérdida (RF-022, RF-023).
- P: Ampliación (2026-10-22): ¿qué funciones nuevas se suman? → R: **más formatos en línea** (subrayado, tachado, resaltado, superíndice y subíndice), **alineación** de párrafos y títulos, y **tablas**. Colores, tipografías y tamaños siguen fuera: salen del diseño del sitio (RF-009, RF-024, RF-025).
- P: ¿Qué puede ir dentro de una celda de tabla? → R: **Texto con formato en uno o varios párrafos** (Enter dentro de la celda crea un párrafo nuevo en ella); sin listas, imágenes ni otros elementos (RF-025).
- P: ¿Se pueden combinar celdas? → R: **Sí, combinar y separar celdas contiguas en horizontal y en vertical**, como en un procesador de texto, siempre que formen un rectángulo (RF-025, RF-028).
- P: ¿Se guarda una copia del contenido anterior a la conversión para poder volver atrás? → R: **No**: la verificación de ida y vuelta de todos los artículos tiene que pasar antes de aplicar la conversión, y si falla en alguno no se aplica en ninguno (RF-023).
- P: ¿Cómo se cambia la estructura de una tabla en un teléfono? → R: **En pantallas de menos de 768 px solo se escribe en las celdas**: combinar y separar celdas y agregar o quitar filas y columnas se hace desde 768 px. Insertar una tabla, pegarla y quitarla entera sí se puede (RF-029).
- P: ¿Cómo se distingue un texto subrayado de un enlace (que el sitio ya subraya)? → R: **El subrayado usa el color del texto, una línea fina y ningún efecto al pasar el puntero**; el enlace conserva el color de marca, su separación y el engrosado al pasar el puntero (RF-026).
- P: ¿Cómo se coordina en producción la conversión con el despliegue del código nuevo? → R: **Corte coordinado dentro de esta spec** (revisada a pedido del usuario: se trabaja en varias PC y conviene que la nube quede al día): al cerrar la spec se aplica la conversión en la nube e inmediatamente se mergea el PR, que despliega el sitio y el panel; sin código de transición (RF-030).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Escribir como en un documento de texto (Prioridad: P1)

Un editor abre un artículo y ve un documento: un lienzo con la tipografía del sitio y, arriba, una barra con el estilo de párrafo (Párrafo, Título 2, 3 y 4, Cita), negrita, cursiva, subrayado, enlace, lista con viñetas, lista numerada, alineación, deshacer y rehacer (los formatos menos usados, en «Más formato»). Escribe de corrido, con Enter para un párrafo nuevo, y da formato como en cualquier procesador de texto.

**Por qué esta prioridad**: es el cambio que el usuario pidió y el que más modifica la forma de escribir. Con solo esta historia el editor deja de ser una lista de formularios.

**Prueba independiente**: crear un artículo nuevo y escribir un título, dos párrafos con una palabra en negrita, una lista y una cita usando la barra y el teclado, y comprobar que al guardar el contenido tiene esos elementos en ese orden.

**Escenarios de aceptación**:

1. **Dado** un artículo nuevo, **cuando** se abre el editor, **entonces** el lienzo muestra un párrafo vacío con el cursor listo para escribir y la barra de herramientas arriba; no hay botón de «Agregar bloque» ni filas de botones por bloque.
2. **Dado** un párrafo con texto, **cuando** la persona pulsa Enter, **entonces** aparece debajo un párrafo nuevo con el cursor y el texto anterior queda intacto; Enter sobre una línea vacía de una lista sale de la lista.
3. **Dado** un texto seleccionado, **cuando** la persona usa la barra o el atajo de teclado de un formato en línea, **entonces** el formato se ve aplicado en el lienzo (la negrita se ve en negrita) y se puede quitar con el mismo control; el control activo se muestra con texto accesible, no solo con color.
4. **Dado** el cursor en un párrafo, **cuando** la persona elige «Título 2», «Título 3», «Título 4», «Cita», «Lista con viñetas» o «Lista numerada» en la barra, **entonces** ese párrafo cambia de tipo conservando el texto, y elegir «Párrafo» lo devuelve.
5. **Dado** una línea vacía, **cuando** la persona escribe «/», **entonces** se abre un menú con los elementos que se pueden insertar y los estilos de párrafo, filtrable al escribir («/tit»), navegable con flechas, Enter y Esc, y también con ratón y toque; Esc o borrar el «/» lo cierra sin cambios.
6. **Dado** un párrafo vacío o con el cursor al comienzo, **cuando** la persona pulsa Retroceso, **entonces** se une con el anterior o, si es el primero, se mantiene un párrafo vacío (el documento nunca queda sin ningún párrafo).
7. **Dado** el documento, **cuando** se lo mira, **entonces** los títulos, párrafos, listas, citas y tablas se ven con la tipografía y los estilos del sitio, para que la persona sepa cómo quedará el artículo.

---

### Historia 2 - Insertar y editar imágenes, galerías, llamadas a la acción, videos y código (Prioridad: P1)

La persona inserta una imagen, una galería, una llamada a la acción, un video, un bloque de código o un separador desde el botón «Insertar» de la barra o desde «/». En el lienzo cada uno se ve como se verá en el sitio, y al seleccionarlo, sus campos aparecen en el **panel de propiedades** a la derecha (texto alternativo, leyenda, columnas, URL, etiqueta del botón, lenguaje…).

**Por qué esta prioridad**: sin esto solo se podría escribir texto; todos los tipos de contenido tienen que poder crearse y editarse para reemplazar al editor anterior.

**Prueba independiente**: insertar uno de cada elemento desde «Insertar», completar sus campos obligatorios en el panel y guardar; el contenido guardado y la vista previa coinciden con lo escrito.

**Escenarios de aceptación**:

1. **Dado** el botón «Insertar» o el menú «/», **cuando** se los abre, **entonces** ofrecen imagen, galería, llamada a la acción, video, código, separador y tabla, cada uno con su nombre y una descripción corta, y los estilos de párrafo (título, cita, listas).
2. **Dado** que se elige «Imagen», **cuando** se inserta, **entonces** aparece en el lienzo con el selector para subirla (JPEG, PNG, WebP o AVIF, hasta 5 MB) y, al seleccionarla, el panel muestra el texto alternativo (o la marca de decorativa) y la leyenda, con las mismas reglas y mensajes de hoy.
3. **Dado** una galería, una llamada a la acción, un video, un bloque de código o una cita con autor, **cuando** se los inserta, **entonces** se ven en el lienzo como en el sitio (miniaturas en columnas, botón con su etiqueta, vista del video, texto en tipografía de código) y el panel de propiedades muestra sus campos propios con los límites y mensajes de validación de hoy.
4. **Dado** un elemento seleccionado, **cuando** la persona cambia un campo en el panel, **entonces** el lienzo se actualiza al instante.
5. **Dado** un elemento con un error de validación, **cuando** no está seleccionado, **entonces** el lienzo lo marca con un texto de error (no solo color) y, al intentar guardar, el elemento se selecciona y el panel enfoca el campo del primer error.
6. **Dado** una pantalla de menos de 1280 px, **cuando** la persona elige «Propiedades» (o pulsa Enter sobre un elemento seleccionado), **entonces** el panel se abre como una hoja que se puede cerrar con «Cerrar» y Esc, sin tapar el elemento seleccionado ni los controles y sin quitarle el foco al lienzo; tocar un elemento para desplazar la pantalla no la abre.
7. **Dado** un lector de pantalla, **cuando** se recorre el documento, **entonces** cada elemento especial se anuncia con su tipo y posición ("Imagen, 3 de 8"), y se puede llegar a su panel de propiedades con el teclado.

---

### Historia 3 - Mover, duplicar, quitar y seleccionar varios elementos (Prioridad: P2)

Para el ratón y el toque, el elemento activo (párrafo, título, lista, cita, tabla o elemento especial) muestra un asa discreta que se arrastra para moverlo y abre un menú con subir, bajar, duplicar, convertir y quitar; para el teclado y los lectores de pantalla, el mismo menú se abre con el botón «Acciones» de la barra. Las mismas acciones tienen atajos de teclado en un modo elementos, y se pueden seleccionar varios elementos a la vez.

**Por qué esta prioridad**: mantiene todo lo que el editor de hoy permite (RF-005 de la spec 003: reordenar, duplicar y quitar) sin las filas de botones. Es necesaria, pero las historias 1 y 2 ya dan un editor usable.

**Prueba independiente**: con un artículo de cinco elementos, mover el tercero al principio (arrastrando y con teclado), duplicar el segundo, convertir un párrafo en cita y quitar el último, y comprobar el orden y el tipo resultantes.

**Escenarios de aceptación**:

1. **Dado** un elemento, **cuando** recibe el puntero o el toque, **entonces** muestra su asa para arrastrarlo y abrir el menú de acciones; para teclado y lectores de pantalla, el mismo menú se abre con el botón «Acciones» de la barra, que dice a qué elemento actúa ("Acciones del elemento 3, párrafo").
2. **Dado** el menú del asa, **cuando** se elige «Subir» o «Bajar», **entonces** el elemento cambia de lugar, el foco queda en él y una región anuncia la nueva posición; en los extremos la acción no está disponible.
3. **Dado** el asa de un elemento, **cuando** la persona la arrastra con el ratón o con el dedo y la suelta entre otros dos elementos, **entonces** queda en ese lugar, se muestra dónde caería mientras se arrastra, se anuncia la nueva posición y el foco queda en el elemento movido; soltar fuera del documento o pulsar Esc cancela el movimiento.
4. **Dado** un teléfono, **cuando** la persona desplaza la pantalla con el dedo sobre el texto, **entonces** no se inicia ningún arrastre: solo el asa arrastra.
5. **Dado** el menú del asa, **cuando** se elige «Duplicar», **entonces** aparece una copia justo debajo con un identificador nuevo y el foco pasa a la copia.
6. **Dado** un párrafo, título, cita o lista, **cuando** se elige «Convertir en…» y otro tipo de texto, **entonces** cambia de tipo conservando su texto, y si el nuevo tipo no admite algún dato (por ejemplo, el autor de una cita o la alineación) se avisa antes de convertir.
7. **Dado** el menú del asa, **cuando** se elige «Quitar», **entonces** el elemento desaparece y el foco pasa al contiguo; si tenía una imagen ya guardada, se mantiene la confirmación de hoy antes de quitarla.
8. **Dado** un teclado, **cuando** la persona usa los atajos de mover, duplicar y quitar, **entonces** obtiene el mismo resultado que con el menú, y los atajos figuran en el menú y en la ayuda del editor.
9. **Dado** un elemento con el cursor, **cuando** la persona pulsa Esc (o Shift y clic sobre el asa, o «Seleccionar» en el menú de acciones), **entonces** entra al modo elementos con ese elemento seleccionado y, con Shift y las flechas, amplía la selección a elementos contiguos; se anuncia la cantidad al entrar y al terminar, se muestra "3 elementos seleccionados" como texto fijo y cada elemento seleccionado lleva una marca que no depende del color. Un rango de **texto** que cruza varios párrafos no es una selección de elementos: sirve para dar formato y no habilita mover ni quitar.
10. **Dado** varios elementos seleccionados, **cuando** se elige «Subir», «Bajar», «Duplicar» o «Quitar» (o se arrastra el asa de la selección), **entonces** la acción se aplica al conjunto en un solo paso, que se deshace de una vez; «Convertir en…» no se ofrece; quitar varios pide confirmación solo si alguno tiene una imagen ya guardada.
11. **Dado** varios elementos seleccionados, **cuando** la persona pulsa Esc o hace clic en un texto, **entonces** la selección se cancela sin cambios.

---

### Historia 4 - Atajos de escritura, pegado y deshacer (Prioridad: P2)

Quien ya conoce los atajos tipo Markdown los puede usar para dar formato sin tocar la barra, pegar texto de otras fuentes sin ensuciar el artículo, y deshacer cualquier cosa.

**Por qué esta prioridad**: acelera a quienes los conocen y evita contenido sucio; no es necesaria para que el editor funcione.

**Prueba independiente**: escribir «## Mi título» al comienzo de una línea y comprobar que se convierte en un título; pegar texto de un documento con formato y comprobar que solo conserva los formatos permitidos.

**Escenarios de aceptación**:

1. **Dado** una línea vacía, **cuando** la persona escribe «## » o «### » o «#### » seguido de texto, **entonces** la línea pasa a ser un título de nivel 2, 3 o 4; con «- » pasa a ser lista con viñetas, con «1. » lista numerada, con «> » cita, con «---» separador y con tres comillas invertidas bloque de código.
2. **Dado** una conversión no deseada por un atajo, **cuando** la persona pulsa Deshacer inmediatamente, **entonces** vuelve el texto escrito tal cual («## » queda como texto).
3. **Dado** cualquier acción del editor (escribir, dar formato, alinear, insertar, convertir, mover, duplicar, quitar, editar una tabla), **cuando** la persona pulsa Deshacer, **entonces** vuelve al estado anterior en un único historial del documento, sin importar dónde esté el cursor; Rehacer lo repite. Un elemento quitado por error se recupera con Deshacer, y el texto escrito de corrido se deshace por tramos razonables (no letra por letra).
4. **Dado** un texto copiado de otra aplicación, **cuando** se lo pega, **entonces** se crea un párrafo por cada párrafo copiado, se conservan solo los formatos en línea y la alineación permitidos, y nunca se aceptan HTML ni estilos de color, fuente o tamaño.
5. **Dado** un texto pegado que supera el máximo de caracteres de un párrafo, **cuando** se lo pega, **entonces** el sobrante pasa a párrafos nuevos a continuación (cortando en un fin de oración o de palabra) y se anuncia cuántos se crearon.
6. **Dado** una tabla copiada de una hoja de cálculo o de otro documento, **cuando** se la pega en una línea vacía, **entonces** se crea una tabla con sus filas y columnas y el texto de cada celda (con los formatos permitidos); si supera los límites de tamaño de una tabla, se pega como párrafos de texto y se avisa.

---

### Historia 5 - Que nada de lo que ya funciona se pierda (Prioridad: P1)

Los artículos que ya existen pasan al formato nuevo una sola vez y sin pérdida: se abren en el nuevo editor, se guardan y se ven en la vista previa y en el sitio igual que antes. Las validaciones, los errores por elemento, los avisos de cambios sin guardar y de conflicto, las imágenes, la búsqueda y el uso con teclado, lector de pantalla y teléfono siguen cumpliéndose.

**Por qué esta prioridad**: es una restricción, no una función: el nuevo formato no puede romper contenido ni flujos existentes. Se prueba en paralelo con las demás historias.

**Prueba independiente**: convertir todos los artículos del seed (y uno con los diez tipos de contenido de hoy), comprobar que cada uno conserva su texto, su orden, sus formatos, sus imágenes y sus campos, y que en el sitio se ve igual que antes; después, abrirlos y guardarlos sin tocar y comprobar que el contenido guardado no cambia.

**Escenarios de aceptación**:

1. **Dado** un artículo existente con elementos de los diez tipos de hoy, **cuando** se lo convierte al formato nuevo, **entonces** conserva el orden, el texto, los formatos (negrita, cursiva, código y enlace), los niveles de título, los ítems de lista, el autor y la fuente de las citas, las imágenes con su texto alternativo y leyenda, las galerías, las llamadas a la acción, los videos y el código; y volver a convertirlo da exactamente el mismo resultado.
2. **Dado** un artículo convertido, **cuando** se lo mira en el sitio, **entonces** el texto visible, los encabezados y sus anclas, las imágenes y los enlaces son los mismos que antes de la conversión, y la búsqueda lo sigue encontrando por las mismas palabras.
3. **Dado** un texto que contiene por sí mismo asteriscos, guiones bajos, corchetes o comillas invertidas, **cuando** se lo convierte, se abre y se guarda, **entonces** esos caracteres se conservan exactamente como texto, sin volverse formato.
4. **Dado** un artículo ya en el formato nuevo, **cuando** se abre y se guarda sin editar, **entonces** el contenido guardado es idéntico al original y la versión no cambia.
5. **Dado** un elemento con error de validación (por ejemplo, una imagen sin texto alternativo), **cuando** se intenta guardar, **entonces** el editor muestra el error en el elemento y el campo exactos, enfoca el primero y anuncia el resumen, como hoy; y un contenido con elementos, formatos o atributos fuera de la lista permitida se rechaza en el servidor sin llegar a guardarse.
6. **Dado** cambios sin guardar, **cuando** la persona intenta salir, **entonces** se mantiene el aviso de hoy; y **cuando** otra persona guardó antes, se mantiene el aviso de conflicto con comparación de versiones.
7. **Dado** un teléfono de 360 px, **cuando** se edita, **entonces** la barra de herramientas se reacomoda sin cortes (los controles que no entran pasan a un menú «Más»), los controles miden al menos 44 × 44 px y el menú de «Insertar» es alcanzable sin escribir «/».
8. **Dado** un lector de pantalla, **cuando** se recorre la barra y el lienzo, **entonces** la barra se anuncia como barra de herramientas con el estado de cada control, el lienzo como área de edición de texto, y las acciones se confirman con mensajes como hoy.

---

### Historia 6 - Más formato: subrayado, tachado, resaltado, superíndice, subíndice y alineación (Prioridad: P1)

Quien escribe puede subrayar, tachar o resaltar una palabra, escribir un superíndice o un subíndice (m², H₂O, notas al pie), y alinear un párrafo o un título a la izquierda, al centro, a la derecha o justificado, como en un procesador de texto. El sitio lo muestra igual.

**Por qué esta prioridad**: es lo que el usuario pidió al ampliar la spec ("la mayor cantidad de funciones") y es lo primero que alguien que viene de Word echa en falta. Es barato una vez que el documento es lo que se guarda.

**Prueba independiente**: en un artículo nuevo, subrayar una palabra, tachar otra, resaltar una frase, escribir «m2» con el 2 en superíndice, centrar un título y justificar un párrafo; guardar, abrir la vista previa y el artículo publicado, y comprobar que todo se ve igual que en el lienzo.

**Escenarios de aceptación**:

1. **Dado** un texto seleccionado en un párrafo, título, cita, ítem de lista o celda de tabla, **cuando** la persona aplica subrayado, tachado, resaltado, superíndice o subíndice desde la barra (o desde «Más formato») o con su atajo cuando lo tiene, **entonces** el formato se ve aplicado y el control se muestra activo con texto accesible; repetirlo lo quita.
2. **Dado** un texto en superíndice, **cuando** se le aplica subíndice, **entonces** deja de ser superíndice (los dos no se combinan).
3. **Dado** un texto con código en línea, **cuando** la persona intenta aplicarle otro formato, **entonces** el control no está disponible y se explica por qué ("El código no admite otros formatos"); los demás formatos se combinan entre sí (por ejemplo, negrita subrayada con enlace).
4. **Dado** el cursor en un párrafo o en un título, **cuando** la persona elige una alineación (izquierda, centro, derecha o justificado) en la barra (con ratón, toque o teclado), **entonces** el elemento se alinea en el lienzo y el control indica la alineación activa; en citas, listas, tablas y elementos especiales la alineación no se ofrece.
5. **Dado** un artículo con estos formatos y alineaciones, **cuando** se lo ve en la vista previa y en el sitio, **entonces** se ven igual que en el lienzo, con los colores del resaltado y del subrayado tomados del diseño del sitio, con contraste AA, y los lectores de pantalla reciben el texto completo.
6. **Dado** un texto pegado con subrayado, tachado, superíndice, subíndice, resaltado o alineación, **cuando** se lo pega, **entonces** esos formatos se conservan, y cualquier color de resaltado o de texto se descarta (queda el resaltado único del sitio).

---

### Historia 7 - Tablas (Prioridad: P2)

Quien escribe puede insertar una tabla, escribir en sus celdas uno o varios párrafos con formato, agregar y quitar filas y columnas, combinar y separar celdas, marcar una fila de encabezado y darle una descripción breve, y el sitio la muestra accesible y legible también en el teléfono.

**Por qué esta prioridad**: es la función nueva más pedida en contenidos de blog (comparativas, precios, especificaciones) y la más costosa de las tres; el editor es usable sin ella.

**Prueba independiente**: insertar una tabla de 3 × 3 desde «Insertar», marcar la primera fila como encabezado, escribir en las celdas (con una negrita y una celda de dos párrafos), combinar las dos primeras celdas de una fila, agregar una fila y quitar una columna, guardar y comprobar en la vista previa y en el sitio que la tabla tiene esas filas, columnas y encabezados, y que en 360 px se puede leer sin que se desborde la página.

**Escenarios de aceptación**:

1. **Dado** «Insertar» o «/», **cuando** se elige «Tabla», **entonces** se inserta una tabla de 3 columnas y 3 filas con la primera fila como encabezado y el cursor en la primera celda.
2. **Dado** el cursor en una celda, **cuando** la persona pulsa Tab o Shift+Tab, **entonces** pasa a la celda siguiente o anterior; Tab en la última celda agrega una fila nueva (desde 768 px, RF-029).
3. **Dado** el cursor en una celda, **cuando** la persona usa la barra contextual de la tabla o el panel de propiedades («Insertar fila arriba/abajo», «Insertar columna a la izquierda/derecha», «Quitar fila», «Quitar columna», «Fila de encabezado», «Quitar tabla»), **entonces** la tabla cambia en consecuencia, el foco queda en una celda útil y una región anuncia lo ocurrido ("Fila agregada, 4 filas").
4. **Dado** el cursor en una celda con texto, **cuando** la persona pulsa Enter, **entonces** se crea un párrafo nuevo dentro de la misma celda; Retroceso al comienzo de ese párrafo lo une con el anterior de la celda, y nunca saca el texto de la celda.
5. **Dado** dos o más celdas contiguas seleccionadas que forman un rectángulo (con el ratón, con Shift y las flechas o con el dedo), **cuando** se elige «Combinar celdas», **entonces** quedan en una sola celda que ocupa ese espacio, con los párrafos de todas en orden de lectura; si la selección no forma un rectángulo, la acción no está disponible y se explica por qué.
6. **Dado** una celda combinada, **cuando** se elige «Separar celdas», **entonces** vuelve a ocupar celdas individuales: el contenido queda en la primera y las demás quedan vacías.
7. **Dado** una tabla seleccionada, **cuando** se abre el panel de propiedades, **entonces** muestra la descripción breve de la tabla (que el sitio usa como título accesible) y si la primera fila es encabezado.
8. **Dado** una tabla que llega al máximo de filas o de columnas, **cuando** se intenta agregar otra, **entonces** se avisa del máximo y no se agrega.
9. **Dado** una tabla en el sitio, **cuando** se la ve en una pantalla angosta, **entonces** la página no se desborda: la tabla se desplaza horizontalmente dentro de su propio recuadro, que se puede recorrer con el teclado y tiene nombre accesible.
10. **Dado** un lector de pantalla, **cuando** recorre una tabla en el editor o en el sitio, **entonces** se anuncia como tabla con su descripción, su cantidad de filas y columnas, y los encabezados de cada celda, también en las celdas combinadas; una celda combinada se anuncia con cuántas filas o columnas ocupa.
11. **Dado** el texto de las celdas, **cuando** se busca en el sitio, **entonces** la búsqueda encuentra el artículo por esas palabras.

### Casos borde

- **Documento vacío**: un artículo sin contenido muestra un párrafo vacío para empezar; si se guarda así y el artículo se está publicando, se mantiene la regla de hoy de que un publicado necesita al menos un elemento con contenido.
- **«/» dentro de un texto**: escribir «/» en medio de una frase o de una URL no abre el menú; solo al comienzo de una línea vacía.
- **Textos largos**: al escribir a mano un párrafo que llega al máximo de caracteres, el editor avisa (con un mensaje que se anuncia) sin cortar ni perder lo escrito, y el error de validación aparece al guardar como hoy. En títulos, citas, ítems de lista, celdas y código, el sobrante se mantiene y se marca el error en lugar de crear elementos de otro tipo.
- **Conversión con pérdida**: convertir una lista de varios ítems a párrafo, una cita con autor a párrafo o un párrafo alineado a lista avisa qué se perdería y permite cancelar.
- **Subida en curso**: mientras una imagen o una galería sube, el guardado queda bloqueado como hoy y no se puede quitar o mover ese elemento.
- **Arrastrar en una pantalla larga**: al arrastrar cerca del borde superior o inferior de la ventana el documento se desplaza solo.
- **Muchos elementos**: un artículo con el máximo de 200 elementos sigue siendo ágil al escribir y al abrir el menú; al llegar al máximo se avisa y no se crean más.
- **Formatos combinados**: negrita, cursiva, subrayado, tachado, resaltado y enlace se combinan sobre el mismo texto y se ven igual en el sitio; el código en línea no se combina con ningún otro; superíndice y subíndice se excluyen entre sí.
- **Texto subrayado que además es enlace**: se ve como enlace (color de marca y engrosado al pasar el puntero); el subrayado propio no agrega una segunda línea.
- **Formatos con espacios en los bordes**: un formato que empieza o termina con un espacio se guarda tal como se ve, sin perder texto.
- **Menú «/» sin resultados**: «/zzz» muestra «Sin resultados» y no cambia nada al pulsar Enter.
- **Formato que el sitio no admite**: colores de texto o de resaltado, tipografías, tamaños, interlineado y márgenes (que muestra la captura de referencia) no se ofrecen, porque el sitio los define de forma uniforme; al pegar se descartan.
- **Tabla vacía**: una tabla sin ningún texto en sus celdas es un error al publicar ("La tabla no tiene contenido"); al guardar un borrador se admite.
- **Quitar la última fila o columna** de una tabla quita la tabla, con el mismo aviso y Deshacer que al quitar un elemento.
- **Quitar una fila o columna que atraviesa una celda combinada**: la celda combinada se achica (ocupa una fila o columna menos) sin perder su texto; si la fila o columna quitada era la que tenía su contenido, el contenido pasa a la parte que queda.
- **Agregar una fila o columna en medio de una celda combinada**: la celda combinada se agranda para abarcarla, de modo que la cuadrícula sigue siendo regular.
- **Combinar celdas de la fila de encabezado con celdas del cuerpo**: no se permite, porque deja encabezados ambiguos; se explica por qué.
- **Tabla pegada con celdas combinadas**: se conservan las combinaciones si forman rectángulos y caben en los límites; si no, se separan y se avisa.
- **Estructura de la tabla en el teléfono**: por debajo de 768 px, los controles de combinar, separar y de filas y columnas no se muestran; en su lugar, la barra contextual de la tabla dice "Para cambiar filas, columnas o combinar celdas, usá una pantalla más ancha", y Tab en la última celda no agrega una fila.
- **Celda con varios párrafos en el teléfono**: el texto se ajusta dentro de la celda y la tabla se desplaza dentro de su recuadro, sin desbordar la página.
- **Una tabla al final del documento** o dos tablas seguidas: siempre queda un párrafo donde seguir escribiendo.
- **Conversión que no pasa la verificación**: si un artículo no se puede convertir sin pérdida, la conversión se detiene sin cambiar ningún artículo e indica cuál falló y por qué, para corregirlo antes de reintentar.
- **Conversión de un artículo con datos inválidos** (por ejemplo, un borrador viejo con un campo vacío): se convierte igual, conservando lo que tiene, y el error aparece en el editor al guardar, como hoy.
- **Alguien guarda en el panel de producción durante el corte**: el panel viejo envía bloques y la base ya convertida los rechaza con un error comprensible, sin guardar nada inválido; tras el despliegue, la persona recarga y reintenta. El corte se avisa antes a quienes usan el panel.
- **Un artículo abierto durante la conversión**: quien tenía el editor abierto con la versión anterior recibe el aviso de conflicto de hoy al guardar, y nada se pierde.
- **Dos elementos especiales seguidos** o un elemento especial al final del documento: siempre queda un párrafo donde seguir escribiendo.
- **Sin JavaScript**: el panel requiere JavaScript, como hoy; el sitio público muestra todo (formatos, alineación y tablas) sin JavaScript.
- **Rol editor y rol admin**: ambos usan el mismo editor; los permisos de eliminar artículos no cambian.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **RF-001**: El editor DEBE presentar el cuerpo del artículo como un documento de texto enriquecido en un lienzo continuo, con una barra de herramientas arriba, sin botón de «Agregar bloque», sin selector de tipo y sin una fila de botones por bloque, y DEBE mostrar el contenido con la tipografía y los estilos del sitio.
- **RF-002**: Un artículo nuevo DEBE abrir con un párrafo vacío y el cursor en él. Enter DEBE crear un párrafo nuevo (o un ítem en una lista, y salir de la lista sobre un ítem vacío), y el documento NUNCA DEBE quedar sin un párrafo donde escribir.
- **RF-003**: La barra de herramientas DEBE ofrecer estilo de párrafo (Párrafo, Título 2, Título 3, Título 4 y Cita), los formatos en línea de RF-009 (los menos usados pueden agruparse en «Más formato»), enlace, alineación (RF-024), lista con viñetas, lista numerada, «Insertar», deshacer y rehacer, con área táctil de al menos 44 × 44 px, estado activo comunicado con texto accesible y reacomodo sin cortes en pantallas angostas.
- **RF-004**: Imagen, galería, llamada a la acción, video, código, cita con autor, separador y tabla DEBEN poder insertarse desde «Insertar» y «/», verse en el lienzo como se verán en el sitio y editarse con sus campos, límites y mensajes de validación; los de los diez tipos de hoy NO DEBEN cambiar.
- **RF-005**: «/» al comienzo de una línea vacía DEBE abrir un menú filtrable con los elementos insertables y los estilos de párrafo, navegable con flechas, Enter y Esc, y con ratón y toque. Además, «Insertar» DEBE ofrecer lo mismo sin escribir «/», para teclado virtual y toque.
- **RF-006**: El editor DEBE ofrecer, para el elemento activo (párrafo, título, lista, cita, tabla o elemento especial), un asa para ratón y toque y un botón «Acciones» en la barra para teclado y lectores de pantalla, que abren el mismo menú de subir, bajar, duplicar, convertir (entre los tipos de texto) y quitar, cada acción con su nombre accesible y su posición.
- **RF-007**: Las acciones sobre elementos DEBEN tener atajos de teclado documentados dentro del editor, y el elemento DEBE poder arrastrarse por su asa con ratón y con el dedo para reordenarlo. El arrastre es una forma adicional: el menú y los atajos DEBEN dar el mismo resultado sin arrastrar (spec 003, RF-025).
- **RF-008**: Tras cada acción (insertar, convertir, mover, duplicar, quitar, cambiar una tabla) el foco DEBE quedar en un lugar útil y una región de estado DEBE anunciar lo ocurrido en español, con la posición desde 1.
- **RF-009**: Los formatos en línea DEBEN ser exactamente: negrita, cursiva, subrayado, tachado, resaltado, código en línea, enlace, superíndice y subíndice, aplicables con la barra y, los que no chocan con el navegador ni con el teclado español, también con atajos de teclado (lista en el plan), en párrafos, títulos, citas, ítems de lista y celdas de tabla. El código en línea NO DEBE combinarse con otro formato, y superíndice y subíndice NO DEBEN combinarse entre sí. El formato DEBE verse aplicado mientras se escribe, sin mostrar marcadores. NO DEBEN permitirse HTML, colores de texto o de resaltado, tipografías ni tamaños.
- **RF-010**: Los atajos de escritura tipo Markdown («## », «### », «#### », «- », «1. », «> », «---» y las tres comillas invertidas) DEBEN convertir la línea al tipo correspondiente, y Deshacer inmediato DEBE dejar el texto escrito tal cual.
- **RF-011**: El editor DEBE ofrecer Deshacer y Rehacer con los atajos habituales sobre **un solo historial del documento** que incluya el texto, el formato, la alineación, las tablas y las acciones sobre elementos, y que se reinicie al adoptar la versión vigente con «Reemplazar con la vigente».
- **RF-012**: Un artículo en el formato nuevo DEBE abrirse sin cambios y guardarse con un contenido idéntico al original cuando no se edita, y la versión NO DEBE cambiar si no hubo cambios.
- **RF-013**: La validación previa al guardado, los errores por elemento y campo, el enfoque del primer error, el aviso de cambios sin guardar, el aviso de conflicto con comparación de versiones, el bloqueo durante subidas de imagen y la limpieza de imágenes sin uso DEBEN comportarse como hoy, también con tablas y con los formatos nuevos.
- **RF-014**: El editor DEBE poder usarse completo con teclado y lector de pantalla y en pantallas desde 360 px, sin cortes ni superposiciones, con las áreas táctiles mínimas de la spec 004 y sin depender del color solo.
- **RF-015**: Pegar texto en el documento DEBE crear un párrafo por párrafo copiado y conservar solo los formatos de RF-009 y la alineación de RF-024, sin HTML ni estilos. Si un párrafo pegado supera el máximo de caracteres, el sobrante DEBE pasar a párrafos nuevos a continuación sin perder texto, y el aviso de cuántos se crearon DEBE anunciarse. Una tabla pegada DEBE crear una tabla si cabe en los límites de RF-025, y si no, pegarse como párrafos con un aviso.
- **RF-016**: Una conversión de tipo que pierda datos (por ejemplo, una lista de varios ítems a párrafo, o la alineación al pasar a lista) DEBE avisar qué se perdería y permitir cancelar antes de aplicarla.
- **RF-017**: El menú «/» y el de «Insertar» DEBEN abrirse sin demora perceptible y el editor DEBE seguir siendo ágil (menos de 100 ms de latencia al escribir) con el máximo de 200 elementos. Al llegar a 200 elementos, insertar y pegar nuevos elementos DEBE avisar "Se alcanzó el máximo de 200 elementos" y no crear más.
- **RF-018**: Los permisos, la barra fija de acciones del artículo, el recuadro «Publicación», las secciones (imagen destacada, taxonomías, para buscadores) y los textos de la spec 004 NO DEBEN cambiar, salvo los textos propios del editor.
- **RF-019**: El editor DEBE tener un **modo elementos** (con Esc, Shift y clic sobre el asa o «Seleccionar» del menú de acciones) que permita seleccionar varios elementos consecutivos con Shift y las flechas y aplicarles mover, duplicar y quitar como una sola acción que Deshacer revierte de una vez; convertir de tipo NO DEBE ofrecerse con varios elementos seleccionados. Un rango de texto que cruza párrafos NO DEBE habilitar esas acciones. Toda vía que quite o mueva elementos (menú, atajo, Supr, cortar, escribir sobre la selección, arrastrar) DEBE pasar por las mismas reglas: bloquear con una subida en curso y confirmar una imagen ya guardada.
- **RF-020**: El editor DEBE ofrecer un **panel de propiedades** del elemento seleccionado, con los campos que se guardan para ese tipo (nivel de título, alineación, lista ordenada, autor y fuente de la cita, texto alternativo y leyenda de la imagen, columnas de la galería, campos de la llamada a la acción, URL del video, lenguaje del código, descripción y fila de encabezado de la tabla). En pantallas de 1280 px o más DEBE ser una pestaña de la columna lateral junto al lienzo (con «Publicación» siempre visible); en pantallas menores, una hoja que se abre con «Propiedades» o con Enter y se cierra con «Cerrar» o Esc sin tapar el elemento seleccionado ni quitar el foco del lienzo. NO DEBE ofrecer propiedades que no se guardan.
- **RF-021**: La librería de edición DEBE ser Tiptap (decisión del usuario, constitución §II), limitada a `apps/admin` y con versiones fijas y compatibles con la protección de antigüedad de paquetes del proyecto.
- **RF-022**: Lo guardado como contenido de un artículo DEBE ser el documento del editor, validado contra una **lista cerrada** de elementos, formatos y atributos con sus límites (constitución §VI). El servidor DEBE rechazar, con un error comprensible, cualquier contenido con elementos, formatos o atributos fuera de esa lista, y NO DEBE guardarse HTML.
- **RF-023**: Todos los artículos existentes DEBEN convertirse al formato nuevo **una sola vez**, sin perder texto, orden, formatos, campos ni imágenes, de modo que en el sitio se vean igual (texto visible, encabezados con las mismas anclas, imágenes y enlaces) y la búsqueda los siga encontrando por las mismas palabras. La conversión DEBE verificarse de ida y vuelta sobre **todos** los artículos antes de aplicarse y, si falla en uno, NO DEBE aplicarse en ninguno (no se guarda una copia del contenido anterior); DEBE ser repetible con el mismo resultado, NO DEBE avisar al sitio de cambios inexistentes y NO DEBE cambiar la fecha de actualización ni la versión que ve el panel.
- **RF-024**: Los párrafos y los títulos DEBEN admitir alineación a la izquierda (la de siempre), al centro, a la derecha y justificada, que se elige con la barra (alcanzable con teclado; sin atajo propio, porque los habituales chocan con el navegador y con AltGr), se ve en el lienzo y se muestra igual en el sitio. Las citas, las listas, las tablas y los elementos especiales NO DEBEN ofrecerla.
- **RF-025**: El editor DEBE permitir insertar **tablas** de hasta 10 columnas y 50 filas, con una fila de encabezado opcional y una descripción breve opcional (de hasta 150 caracteres), y DEBE permitir agregar y quitar filas y columnas, moverse entre celdas con Tab y Shift+Tab y escribir en cada celda **uno o varios párrafos** con los formatos de RF-009 y sin alineación (hasta 1000 caracteres por celda en total, contando todos sus párrafos). Una celda NO DEBE contener listas, imágenes ni otros elementos.
- **RF-028**: El editor DEBE permitir **combinar** celdas contiguas que formen un rectángulo, en horizontal y en vertical, y **separar** una celda combinada, con la barra contextual de la tabla, el panel de propiedades y el teclado. La fila de encabezado NO DEBE combinarse con celdas del cuerpo. Agregar o quitar filas y columnas DEBE mantener la cuadrícula regular sin perder texto (una celda combinada se agranda o se achica). En el editor y en el sitio, cada celda, también las combinadas, DEBE quedar asociada a sus encabezados para los lectores de pantalla.
- **RF-029**: En pantallas de menos de 768 px, el editor DEBE permitir escribir y dar formato en las celdas, insertar, pegar y quitar una tabla entera, y NO DEBE ofrecer combinar ni separar celdas ni agregar o quitar filas y columnas; DEBE explicar con un texto visible que esos cambios se hacen desde una pantalla más ancha. Desde 768 px DEBEN estar disponibles con ratón, con teclado y con toque.
- **RF-030**: La conversión DEBE aplicarse también en la base de la nube como parte del cierre de esta spec, en un **corte coordinado**: primero la verificación de ida y vuelta sobre los artículos de la nube, después la conversión y enseguida el merge que despliega el sitio y el panel nuevos. Durante ese intervalo el sitio DEBE seguir sirviendo las páginas ya generadas (la conversión no avisa al sitio), y al terminar todos los artículos publicados DEBEN verse en producción como antes. NO DEBE quedar código que lea el formato anterior.
- **RF-026**: El sitio público DEBE mostrar los formatos de RF-009, la alineación de RF-024 y las tablas de RF-025 sin JavaScript, con los colores y estilos del diseño del sitio, contraste AA, un subrayado que no se confunde con un enlace (color del texto, línea fina y sin efecto al pasar el puntero, frente al color de marca, la separación y el engrosado del enlace; igual en el lienzo), tablas accesibles (encabezados asociados a sus celdas y descripción como título) y sin desbordar la página en 360 px (la tabla se desplaza dentro de su recuadro, alcanzable con el teclado). Las metas de SEO, rendimiento y accesibilidad del sitio (constitución §IV.8) NO DEBEN empeorar.
- **RF-027**: La búsqueda del sitio DEBE incluir el texto de todos los elementos del documento, también el de las celdas de las tablas y sus descripciones.

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

Sin cambios: la feature cambia la forma de editar y de guardar el cuerpo del artículo. Editores y administradores ven y usan el mismo editor, y las acciones de estado y de eliminación siguen siendo las de hoy. Lo que se publica sigue siendo lo único visible para el público.

### Entidades clave

- **Documento**: el contenido de un artículo tal como se escribe y se guarda; una secuencia ordenada de elementos. Reemplaza a la lista de bloques.
- **Elemento**: cada párrafo, título, lista, cita, tabla o pieza especial (imagen, galería, llamada a la acción, video, código, separador) del documento, con su identificador estable y sus campos.
- **Formato en línea**: cada uno de los nueve formatos de RF-009 aplicados a un tramo de texto.
- **Alineación**: atributo de un párrafo o de un título (izquierda, centro, derecha o justificado).
- **Tabla**: elemento con filas y celdas, fila de encabezado opcional y descripción breve opcional.
- **Celda**: cada casilla de una tabla, con uno o varios párrafos de texto con formato; puede ocupar varias filas o columnas (celda combinada).
- **Lista permitida**: la lista cerrada de elementos, formatos y atributos (con sus límites) que el editor ofrece, el servidor valida, la base acepta y el sitio sabe mostrar.
- **Panel de propiedades**: la zona que muestra los campos del elemento seleccionado.
- **Menú de inserción**: la lista que se abre con «/» o con «Insertar».

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: Una persona que no usó el editor nuevo crea y publica un artículo de 5 elementos (con una imagen) en igual o menos tiempo que con el editor de la spec 003 (unos 2 minutos), sin ayuda.
- **CE-002**: El 100 % de los artículos del seed y un artículo con los diez tipos de contenido de hoy se convierten sin pérdida: el texto visible, los encabezados con sus anclas, las imágenes, los enlaces y los resultados de búsqueda en el sitio son los mismos antes y después, incluidos los textos con asteriscos, guiones bajos, corchetes y comillas invertidas propios; y abrirlos y guardarlos sin editar no cambia su contenido.
- **CE-003**: Todos los tipos de contenido (incluida la tabla) pueden insertarse, completarse y quitarse usando solo el teclado, y un artículo de cinco elementos se reordena (mover, duplicar, convertir, quitar) también solo con teclado.
- **CE-004**: En 360, 768, 1024 y 1440 px, el editor no tiene elementos cortados ni superpuestos, todos los controles miden al menos 44 × 44 px y Lighthouse Accesibilidad es ≥ 95 en el editor.
- **CE-005**: Todos los flujos de punta a punta del panel que hoy funcionan (guardar, errores por elemento, subida de imágenes, conflicto, publicación, programación) siguen pasando, adaptados solo en la forma de agregar, mover y editar los elementos.
- **CE-006**: Los menús de «/» y «Insertar» aparecen en menos de 200 ms, incluso con un artículo de 50 elementos.
- **CE-007**: En una prueba con 3 a 5 personas que escriben habitualmente en procesadores de texto, al menos 4 de cada 5 completan sin ayuda una nota con un título, formato, una lista, una tabla y una imagen, y ninguna necesita que se le explique qué es un "bloque".
- **CE-008**: Un artículo con los nueve formatos en línea, las cuatro alineaciones y una tabla de 5 columnas (con una celda combinada en horizontal, otra en vertical y una celda de dos párrafos) se ve en el sitio igual que en el lienzo, y en 360 px la página no tiene desplazamiento horizontal.
- **CE-009**: Las páginas de artículo del sitio mantienen las metas de la constitución en móvil (SEO ≥ 95, Rendimiento ≥ 90, Accesibilidad ≥ 95; LCP < 2,5 s, CLS < 0,1) con un artículo que tiene tablas y los formatos nuevos.
- **CE-010**: Después del corte, el 100 % de los artículos publicados en producción se ven igual que antes (texto visible, encabezados, imágenes y enlaces) y el sitio no da errores en ninguna página de artículo.

## Supuestos

- El contenido guardado pasa a ser el documento del editor (constitución 2.0.0, §VI): hay una migración de datos para los artículos existentes y cambian la validación del contenido en la base, la extracción de texto para la búsqueda y la de imágenes en uso. Los demás datos del artículo no cambian.
- Los límites de hoy se mantienen: 5000 caracteres por párrafo, 150 por título, 200 elementos por artículo, y los de imagen, galería, llamada a la acción, video, código, cita y lista.
- Los límites de las tablas (10 columnas, 50 filas, 1000 caracteres por celda y 150 en la descripción) son valores razonables para un blog; una celda combinada cuenta como una sola celda para el límite de caracteres.
- El resaltado y el subrayado usan colores del diseño del sitio (tokens), iguales en todos los artículos; cambiar la identidad cambia también esos colores.
- El editor sigue en `apps/admin` y reutiliza los componentes de la spec 004 (barra fija, niveles de botón, encabezado, títulos de sección, avisos). El sitio público cambia solo en lo necesario para mostrar los formatos nuevos, la alineación y las tablas.
- El peso adicional del editor sobre la ruta actual del editor no debe superar los 250 KB gzip, incluidas las tablas.
- Las Historias 1 a 3 ya están implementadas sobre el formato de bloques; el plan define cómo pasan al documento sin rehacer lo que no cambia.
- La captura de referencia (lienzo, barra superior y panel de propiedades a la derecha) sirve de guía de disposición; las propiedades se limitan a lo que se guarda.
- La imagen destacada, el extracto, las etiquetas, la categoría y los campos para buscadores siguen en sus secciones de hoy. El panel de propiedades del elemento comparte la zona lateral con ellas, en pestañas «Artículo» y «Elemento».
- Como cada push a `main` despliega el sitio y el panel en Vercel, la conversión en la nube y el merge del PR se hacen en el mismo momento (RF-030). Hasta entonces la rama se valida en local, porque el preview de Vercel lee la base de la nube, que sigue en el formato anterior.
- Es un sitio de demo genérico: se privilegia un editor simple y consistente; las funciones nuevas se eligieron por ser las que un procesador de texto ofrece y un blog usa.
- El texto de la interfaz está en español con tuteo, como el resto del panel.

## Fuera de alcance

- Colores de texto o de resaltado elegidos por la persona, tipografías, tamaños, interlineado y márgenes: el sitio los define de forma uniforme.
- Cambiar los límites de los tipos de contenido que ya existen.
- Colaboración en tiempo real, comentarios, historial de versiones del documento o autoguardado.
- Columnas de diseño (texto en dos columnas), incrustaciones nuevas (además del video de hoy), notas al pie automáticas y plantillas de artículo.
- Ordenar o filtrar tablas en el sitio, fórmulas y tablas importadas desde archivos.
- Arrastrar y soltar archivos desde el escritorio como forma de insertar imágenes.
- Cambios en la imagen destacada, el extracto, las etiquetas, la categoría o los campos para buscadores, o en el SEO del sitio (más allá de que no empeore).
