# Especificación: Editor de notas estilo documento

**Rama**: `005-editor-estilo-documento`

**Creada**: 2026-10-22

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Editor de notas estilo documento para el panel, tipo Notion: en vez de la lista de bloques con botones (Subir, Bajar, Duplicar, Quitar, «Agregar bloque» con selector de tipo), el contenido del artículo se escribe como un documento continuo; con «/» se abre un menú para elegir el tipo de bloque. Reemplaza el modelo de interacción del editor de bloques que la spec 004 dejó provisorio, sin cambiar el esquema de bloques ni la base de datos."

## Contexto

Hoy el cuerpo de un artículo se arma como una lista de tarjetas: cada bloque tiene su propio recuadro con campos y una fila de botones para subirlo, bajarlo, duplicarlo o quitarlo, y al final un selector de tipo con «Agregar bloque». Funciona y es accesible, pero escribir se siente como completar un formulario y no como escribir una nota:

- Para seguir escribiendo después de un párrafo hay que bajar hasta el selector, elegir el tipo y pulsar «Agregar bloque».
- Cada bloque ocupa mucho espacio con botones que repiten su nombre ("Subir bloque 3, párrafo"), y la nota se ve fragmentada.
- No hay una forma rápida de pasar un párrafo a título o a cita, ni de cambiar de tipo sin quitar y volver a crear.

La spec 004 resolvió la jerarquía visual del panel y dejó fuera de alcance, a propósito, el modelo de interacción del editor de bloques. Esta spec lo reemplaza: el contenido se escribe como un documento continuo y los bloques se insertan y transforman con un menú que se abre al escribir «/».

El contenido guardado **no cambia**: sigue siendo la misma lista de bloques de los mismos diez tipos, con las mismas reglas de validación. Cambia solo cómo se escribe, se mueve y se ordena en pantalla.

## Aclaraciones

### Sesión 2026-10-22

- P: ¿El formato en línea se ve aplicado mientras se escribe o el texto conserva los marcadores visibles? → R: El usuario pidió un editor "estilo WordPress" y autorizó sumar una librería si hace falta: el formato se ve aplicado mientras se escribe (la negrita se ve en negrita), y lo guardado sigue siendo el texto con las cuatro marcas de hoy (RF-009).
- P: ¿Se reordena también arrastrando el control del bloque? → R: Sin respuesta explícita; se toma por defecto **solo menú y atajos de teclado**, sin arrastre. Queda para confirmar en `/speckit-clarify` (RF-007).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Escribir de corrido y dar forma con «/» (Prioridad: P1)

Un editor abre un artículo y escribe como en un documento: un párrafo tras otro con Enter. Cuando quiere otro tipo de contenido, escribe «/» al comienzo de una línea vacía, elige del menú (por ejemplo «Título», «Cita», «Lista», «Código» o «Separador») y sigue escribiendo en el mismo lugar, sin salir del teclado.

**Por qué esta prioridad**: es el cambio que el usuario pidió y el que más modifica la sensación de escribir. Con solo esta historia el editor ya deja de ser una lista de formularios.

**Prueba independiente**: crear un artículo nuevo y escribir un párrafo, un título, una cita y una lista usando solo el teclado, y comprobar que al guardar el contenido tiene esos cuatro bloques en ese orden.

**Escenarios de aceptación**:

1. **Dado** un artículo nuevo, **cuando** se abre el editor, **entonces** el cuerpo muestra un primer párrafo vacío con el cursor listo para escribir, sin ningún botón de «Agregar bloque».
2. **Dado** un párrafo con texto, **cuando** la persona pulsa Enter al final, **entonces** aparece debajo un párrafo nuevo con el cursor, y el texto anterior queda intacto.
3. **Dado** una línea vacía, **cuando** la persona escribe «/», **entonces** se abre un menú con los tipos de bloque disponibles y, al seguir escribiendo («/tit»), el menú se filtra por nombre.
4. **Dado** el menú abierto, **cuando** la persona elige un tipo con las flechas y Enter (o con el ratón o el toque), **entonces** la línea se convierte en ese bloque, el «/» desaparece y el cursor queda donde corresponde escribir.
5. **Dado** el menú abierto, **cuando** la persona pulsa Esc o borra el «/», **entonces** el menú se cierra y la línea queda como estaba (sin bloque nuevo).
6. **Dado** un bloque de texto (párrafo, título o cita) vacío con el cursor, **cuando** la persona pulsa Retroceso, **entonces** el bloque se quita y el cursor pasa al final del bloque anterior; sobre un párrafo con texto al comienzo de la línea, Retroceso lo une con el anterior si también es de texto.
7. **Dado** un bloque de lista, **cuando** la persona pulsa Enter, **entonces** se agrega un ítem nuevo, y Enter sobre un ítem vacío termina la lista y abre un párrafo debajo.

---

### Historia 2 - Insertar y editar bloques con más campos, en su lugar (Prioridad: P1)

La persona inserta una imagen, una galería, una llamada a la acción, un video o un bloque de código desde el mismo menú «/», y los edita ahí mismo, dentro del documento, con sus campos (texto alternativo, leyenda, columnas, URL, etiqueta del botón…).

**Por qué esta prioridad**: sin esto, solo se podría escribir texto; los diez tipos tienen que poder crearse y editarse desde el nuevo modelo para reemplazar al anterior.

**Prueba independiente**: insertar uno de cada uno de los diez tipos desde el menú, completar sus campos obligatorios y guardar; el contenido guardado y la vista previa coinciden con lo escrito.

**Escenarios de aceptación**:

1. **Dado** el menú «/», **cuando** se lo abre, **entonces** ofrece los diez tipos de bloque (párrafo, título, imagen, cita, lista, galería, llamada a la acción, separador, código y video), cada uno con su nombre y una descripción corta.
2. **Dado** que se elige «Imagen», **cuando** se inserta, **entonces** aparece el bloque con el selector de imagen, el texto alternativo (o la marca de decorativa) y la leyenda, con las mismas reglas y mensajes de hoy.
3. **Dado** que se elige «Galería» o «Lista» o «Llamada a la acción» o «Video» o «Código» o «Cita», **cuando** se inserta, **entonces** muestra sus campos propios en el lugar, y los errores de validación aparecen en el campo exacto del bloque, como hoy.
4. **Dado** un título, **cuando** se lo inserta, **entonces** permite elegir su nivel (2, 3 o 4) sin salir del bloque.
5. **Dado** un bloque con más campos, **cuando** la persona recorre el documento con Tab, **entonces** el foco pasa por los campos del bloque en el orden de lectura y vuelve al texto continuo sin quedar atrapado.

---

### Historia 3 - Mover, duplicar, convertir y quitar bloques (Prioridad: P2)

Cada bloque tiene a su lado un control discreto (aparece al pasar el puntero, al recibir el foco y siempre visible en pantallas táctiles) que abre un menú de acciones: subir, bajar, duplicar, convertir a otro tipo y quitar. Las mismas acciones tienen atajos de teclado, así el documento se reordena sin arrastrar.

**Por qué esta prioridad**: reemplaza las filas de botones por bloque y mantiene todo lo que el editor de hoy permite (RF-005 de la spec 003). Es necesaria, pero la historia 1 y 2 ya dan un editor usable.

**Prueba independiente**: con un artículo de cinco bloques, mover el tercero al principio, duplicar el segundo, convertir un párrafo en cita y quitar el último, todo con teclado, y comprobar el orden y el tipo resultantes.

**Escenarios de aceptación**:

1. **Dado** un bloque, **cuando** recibe el foco o el puntero, **entonces** muestra su control de acciones; el control tiene un nombre accesible que dice a qué bloque pertenece ("Acciones del bloque 3, párrafo").
2. **Dado** el menú de acciones, **cuando** se elige «Subir» o «Bajar», **entonces** el bloque cambia de lugar, el foco queda en el bloque movido y una región anuncia la nueva posición ("Bloque movido a la posición 2 de 5"); en los extremos la acción no está disponible.
3. **Dado** el menú de acciones, **cuando** se elige «Duplicar», **entonces** aparece una copia justo debajo con un identificador nuevo y el foco pasa a la copia.
4. **Dado** un bloque de texto (párrafo, título, cita o lista), **cuando** se elige «Convertir en…» y otro tipo de texto, **entonces** el bloque cambia de tipo conservando su texto, y si el nuevo tipo no admite algún dato, se avisa antes de convertir.
5. **Dado** el menú de acciones, **cuando** se elige «Quitar», **entonces** el bloque desaparece y el foco pasa al bloque contiguo; si el bloque tenía una imagen ya guardada, se mantiene la confirmación de hoy antes de quitarla.
6. **Dado** un teclado, **cuando** la persona usa los atajos de mover, duplicar y quitar sobre el bloque con foco, **entonces** obtiene el mismo resultado que con el menú, y los atajos figuran en el menú y en la ayuda del editor.
7. **Dado** el control de un bloque, **cuando** se lo usa, **entonces** el orden se cambia solo con el menú de acciones y los atajos de teclado, sin arrastrar (decisión por defecto, a confirmar en la clarificación; si se agregara arrastrar, el menú y el teclado seguirían como alternativa).

---

### Historia 4 - Formato en línea y atajos de escritura (Prioridad: P2)

Mientras escribe, la persona aplica negrita, cursiva, código en línea y enlaces a un fragmento del texto (con una barra que aparece sobre la selección y con los atajos habituales), y puede crear bloques con atajos de escritura tipo Markdown: «# » para un título, «- » para una lista, «1. » para una lista ordenada, «> » para una cita, «---» para un separador y tres comillas invertidas para código.

**Por qué esta prioridad**: acelera a quienes ya conocen esos atajos y mantiene las cuatro marcas que el sitio interpreta; no es necesaria para que el editor funcione.

**Prueba independiente**: escribir «# Mi título» al comienzo de una línea y comprobar que se convierte en un título; seleccionar una palabra y aplicarle negrita con el atajo y con la barra.

**Escenarios de aceptación**:

1. **Dado** una línea vacía, **cuando** la persona escribe «# » seguido de texto, **entonces** la línea pasa a ser un título de nivel 2 (con «## » y «### » para los niveles 3 y 4); con «- », «1. », «> », «---» y tres comillas invertidas, pasa a ser lista, lista ordenada, cita, separador y código.
2. **Dado** un texto seleccionado en un bloque de párrafo, cita o lista, **cuando** la persona usa la barra de formato o el atajo de teclado, **entonces** se aplica o se quita la marca (negrita, cursiva, código o enlace) sobre la selección.
3. **Dado** un bloque que no admite marcas (título, código, separador), **cuando** se lo selecciona, **entonces** la barra de formato no se ofrece.
4. **Dado** una conversión no deseada por un atajo, **cuando** la persona pulsa Deshacer inmediatamente, **entonces** vuelve el texto escrito tal cual («# » queda como texto).
5. **Dado** cualquier acción del editor (escribir, convertir, mover, duplicar, quitar), **cuando** la persona pulsa Deshacer, **entonces** vuelve al estado anterior; Rehacer lo repite.

---

### Historia 5 - Que nada de lo que ya funciona se pierda (Prioridad: P1)

Los artículos que ya existen se abren en el nuevo editor sin cambios, se guardan igual que hoy y se ven igual en la vista previa y en el sitio. Las validaciones, los errores por bloque, los avisos de cambios sin guardar y de conflicto, las imágenes y el uso con teclado, lector de pantalla y teléfono siguen cumpliéndose.

**Por qué esta prioridad**: es una restricción, no una función: el nuevo editor no puede romper contenido ni flujos existentes. Se prueba en paralelo con las demás historias.

**Prueba independiente**: abrir y guardar sin tocar cada artículo del seed (y los 10 tipos de bloque) y comprobar que el contenido guardado es idéntico al original.

**Escenarios de aceptación**:

1. **Dado** un artículo existente con bloques de los diez tipos, **cuando** se abre y se guarda sin editar, **entonces** el contenido guardado es idéntico al original (mismo orden, mismos identificadores y mismos campos) y la versión no cambia si no hubo cambios.
2. **Dado** un bloque con error de validación (por ejemplo, una imagen sin texto alternativo), **cuando** se intenta guardar, **entonces** el editor muestra el error en el bloque y el campo exactos, enfoca el primero y anuncia el resumen, como hoy.
3. **Dado** cambios sin guardar, **cuando** la persona intenta salir, **entonces** se mantiene el aviso de hoy; y **cuando** otra persona guardó antes, se mantiene el aviso de conflicto con comparación de versiones.
4. **Dado** un teléfono de 360 px, **cuando** se edita, **entonces** el menú de bloques se abre también desde un botón visible en cada línea vacía (no solo con «/»), los controles tienen al menos 44 × 44 px y nada se corta.
5. **Dado** un lector de pantalla, **cuando** se recorre el documento, **entonces** cada bloque se anuncia con su tipo y posición, el menú «/» se anuncia como lista de opciones con la opción activa, y las acciones sobre bloques se confirman con mensajes como hoy.

### Casos borde

- **Documento vacío**: un artículo sin bloques muestra un párrafo vacío para empezar; si se guarda así y el artículo se está publicando, se mantiene la regla de hoy de que un publicado necesita al menos un bloque con contenido.
- **«/» dentro de un texto**: escribir «/» en medio de una frase o de una URL no abre el menú; solo al comienzo de una línea vacía o tras un espacio al inicio de un bloque vacío.
- **Pegar texto**: pegar varios párrafos crea un bloque por párrafo; pegar texto con formato se reduce a texto plano con las cuatro marcas permitidas; nunca se acepta HTML.
- **Textos largos**: un párrafo que llega al máximo de caracteres del esquema avisa antes de truncar y no pierde lo escrito.
- **Conversión con pérdida**: convertir una lista de varios ítems a párrafo, o una cita con autor a párrafo, avisa qué se perdería y permite cancelar.
- **Bloques de imagen o galería con subida en curso**: el guardado queda bloqueado como hoy y no se puede quitar o mover el bloque en medio de la subida.
- **Muchos bloques**: un artículo con el máximo de bloques sigue siendo ágil al escribir y al abrir el menú.
- **Menú «/» sin resultados**: «/zzz» muestra «Sin resultados» y no cambia nada al pulsar Enter.
- **Sin JavaScript**: el panel requiere JavaScript, como hoy; no hay alternativa sin él.
- **Rol editor y rol admin**: ambos usan el mismo editor; los permisos de eliminar artículos no cambian.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **RF-001**: El editor DEBE presentar el cuerpo del artículo como un documento continuo de bloques consecutivos, sin botón de «Agregar bloque», sin selector de tipo y sin una fila de botones por bloque.
- **RF-002**: Un artículo nuevo DEBE abrir con un párrafo vacío y el cursor en él. Enter al final de un bloque de texto DEBE crear un párrafo nuevo debajo; Enter en una lista DEBE agregar un ítem, y sobre un ítem vacío DEBE salir de la lista.
- **RF-003**: Escribir «/» al comienzo de una línea vacía DEBE abrir un menú de bloques con los diez tipos, filtrable al escribir, navegable con flechas, Enter y Esc, y también con ratón y toque. Elegir un tipo DEBE convertir esa línea en ese bloque y dejar el cursor listo para escribir.
- **RF-004**: Los diez tipos de bloque DEBEN poder insertarse y editarse en su lugar con los mismos campos, límites y mensajes de validación de hoy; el esquema de bloques del contenido NO DEBE cambiar.
- **RF-005**: Cada línea vacía del documento DEBE ofrecer también un botón visible para abrir el menú de bloques (para teclado virtual y toque), con área táctil de al menos 44 × 44 px.
- **RF-006**: Cada bloque DEBE ofrecer un control de acciones, visible al pasar el puntero, al recibir el foco y siempre en pantallas táctiles, con las acciones subir, bajar, duplicar, convertir (entre los tipos de texto) y quitar, cada una con su nombre accesible y su posición.
- **RF-007**: Las acciones de bloque DEBEN tener atajos de teclado documentados dentro del editor, de modo que reordenar, duplicar y quitar se puedan hacer sin ratón y sin arrastrar (spec 003, RF-025). El reordenamiento NO DEBE exigir arrastrar.
- **RF-008**: Tras cada acción (insertar, convertir, mover, duplicar, quitar) el foco DEBE quedar en un lugar útil y una región de estado DEBE anunciar lo ocurrido en español, con la posición desde 1.
- **RF-009**: Las marcas en línea DEBEN limitarse a negrita, cursiva, código en línea y enlace (spec 003, RF-005), aplicables con una barra sobre la selección y con atajos de teclado, solo en los bloques que las admiten (párrafo, cita y lista). El formato DEBE verse aplicado mientras se escribe (la negrita se ve en negrita, el enlace como enlace), sin mostrar los marcadores, y lo guardado DEBE seguir siendo el texto con las mismas cuatro marcas de hoy. NO DEBE permitirse HTML.
- **RF-010**: Los atajos de escritura tipo Markdown («# », «## », «### », «- », «1. », «> », «---» y las tres comillas invertidas) DEBEN convertir la línea al tipo correspondiente, y Deshacer inmediato DEBE dejar el texto escrito tal cual.
- **RF-011**: El editor DEBE ofrecer Deshacer y Rehacer para las acciones de escritura y de estructura, con los atajos habituales.
- **RF-012**: Un artículo existente DEBE abrirse sin cambios y guardarse con un contenido idéntico al original cuando no se edita; el modelo de datos, las migraciones y el esquema de bloques NO DEBEN cambiar.
- **RF-013**: La validación previa al guardado, los errores por bloque y campo, el enfoque del primer error, el aviso de cambios sin guardar, el aviso de conflicto con comparación de versiones, el bloqueo durante subidas de imagen y la limpieza de imágenes sin uso DEBEN comportarse como hoy.
- **RF-014**: El editor DEBE poder usarse completo con teclado y lector de pantalla y en pantallas desde 360 px, sin cortes ni superposiciones, con las áreas táctiles mínimas de la spec 004 y sin depender del color solo.
- **RF-015**: Pegar texto en el documento DEBE crear un bloque por párrafo y reducir el formato a texto plano con las cuatro marcas permitidas, sin HTML.
- **RF-016**: Una conversión de bloque que pierda datos (por ejemplo, una lista de varios ítems a párrafo) DEBE avisar qué se perdería y permitir cancelar antes de aplicarla.
- **RF-017**: El menú de bloques DEBE abrirse sin demora perceptible y el editor DEBE seguir siendo ágil con el máximo de bloques que admite el esquema.
- **RF-018**: Los permisos, la barra fija del editor, el recuadro «Publicación», las secciones y los textos de la spec 004 NO DEBEN cambiar, salvo los textos propios de los bloques.

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

Sin cambios: la feature solo cambia la forma de editar el cuerpo del artículo. Editores y administradores ven y usan el mismo editor, y las acciones de estado y de eliminación siguen siendo las de hoy.

### Entidades clave *(la feature no agrega datos)*

- **Bloque**: cada unidad del cuerpo (diez tipos), con su identificador, su tipo y sus campos. No cambia.
- **Documento**: la secuencia ordenada de bloques de un artículo; es lo que el editor muestra como texto continuo.
- **Menú de bloques**: la lista de tipos que se abre con «/» o con el botón de la línea vacía.
- **Acciones de bloque**: subir, bajar, duplicar, convertir y quitar, con sus atajos.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: Una persona que no usó el editor nuevo crea y publica un artículo de 5 bloques (con una imagen) en igual o menos tiempo que con el editor de la spec 003 (unos 2 minutos), sin ayuda.
- **CE-002**: El 100 % de los artículos del seed y de los diez tipos de bloque se abre y se guarda sin edición con contenido idéntico al original.
- **CE-003**: Los diez tipos de bloque pueden insertarse, completarse y quitarse usando solo el teclado, y un artículo de cinco bloques se reordena (mover, duplicar, convertir, quitar) también solo con teclado.
- **CE-004**: En 360, 768, 1024 y 1440 px, el editor no tiene elementos cortados ni superpuestos, todos los controles miden al menos 44 × 44 px y Lighthouse Accesibilidad es ≥ 95 en el editor.
- **CE-005**: Todos los flujos de punta a punta del panel que hoy funcionan (guardar, errores por bloque, subida de imágenes, conflicto, publicación, programación) siguen pasando, adaptados solo en la forma de agregar y mover bloques.
- **CE-006**: El menú «/» aparece en menos de 200 ms desde que se escribe la barra, incluso con un artículo de 50 bloques.

## Supuestos

- El contenido y su validación no cambian: es la misma lista de bloques de la spec 001 con las reglas de `packages/bloques`; no hay migraciones ni cambios de base de datos.
- El editor sigue en `apps/admin` y reutiliza los componentes de la spec 004 (barra fija, niveles de botón, encabezado, títulos de sección, avisos); no cambia el sitio público ni su aspecto.
- Se mantiene la idea de que la imagen destacada, el extracto, las etiquetas, la categoría y los campos para buscadores quedan fuera del documento continuo, en sus secciones de hoy.
- El usuario autorizó (2026-10-22) sumar una librería de edición para lograr un editor "estilo WordPress" si hace falta. Sigue rigiendo la constitución (stack cerrado, §II): el plan debe justificarla, elegir una versión compatible con la protección `minimumReleaseAge` de pnpm y confirmar que no sale de `apps/admin`.
- Es un sitio de demo: se privilegia un editor simple y consistente por sobre la cantidad de atajos y opciones.
- El texto de la interfaz está en español con tuteo, como el resto del panel.

## Fuera de alcance

- Cambiar el esquema de bloques, los tipos de bloque o sus límites.
- Colaboración en tiempo real, comentarios, historial de versiones del documento o autoguardado.
- Nuevos tipos de bloque, tablas, columnas, incrustaciones y subrayado.
- Cambios en la imagen destacada, el extracto, las etiquetas, la categoría o los campos para buscadores.
- Cambios en la vista previa, en el sitio público o en SEO.
- Plantillas de artículo y arrastrar y soltar archivos desde el escritorio como forma de insertar imágenes.
