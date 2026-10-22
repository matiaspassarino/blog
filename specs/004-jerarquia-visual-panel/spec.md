# Especificación: Jerarquía visual del panel

**Rama**: `004-jerarquia-visual-panel`

**Creada**: 2026-10-21

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Hay que mejorar la UX/UI del backoffice. Hay errores en los botones y falta jerarquía visual." Errores señalados: "todo pesa igual" (no queda clara la acción principal de cada pantalla) y "tamaños desparejos" (alturas, anchos y alineación de los botones inconsistentes). El editor de notas se trata aparte, en la spec 005.

## Contexto

El panel funciona y cumple accesibilidad, pero cuesta leerlo de un vistazo:

- Casi todos los botones tienen el mismo peso visual. Hay pantallas con dos o más acciones destacadas a la vez; por ejemplo, en el editor compiten "Guardar" y "Publicar".
- Hay un solo tamaño de botón para todo: la acción principal de una pantalla, los botones de una fila de tabla y los de una barra de herramientas se ven iguales. Dentro de una misma barra, los botones quedan con alturas, anchos o alineaciones distintas.
- Los títulos, las secciones y los grupos de acciones no siguen un mismo orden en todas las pantallas, así que la vista no sabe dónde ir primero.

## Aclaraciones

### Sesión 2026-10-21

- P: En el editor, ¿qué botón debería ser el principal: "Guardar" o la acción de estado del artículo? → R: Las dos acciones van a la barra fija del editor. Con cambios sin guardar, el principal es "Guardar"; sin cambios, es la siguiente acción de estado. El recuadro "Publicación" queda solo para la información (estado, fecha y "Ver en el sitio").
- P: Con "Programar" en la barra fija del editor, ¿dónde se elige la fecha y hora de publicación? → R: "Programar" abre un diálogo con el campo de fecha y hora y un botón "Programar" que confirma. Como hoy solo se programa desde un borrador, no se agrega la opción de reprogramar.
- P: Cuando no hay cambios sin guardar, ¿qué acción es la principal en un artículo programado, publicado o archivado? → R: Solo un borrador tiene una acción de estado principal ("Publicar"). En programado, publicado y archivado el principal es siempre "Guardar" (deshabilitado si no hay cambios) y las acciones de estado son secundarias.
- P: En el teléfono (360 px), ¿cómo debería verse la barra fija del editor cuando tiene varias acciones? → R: En pantallas angostas la barra muestra la acción principal y una secundaria, y el resto pasa a un botón "Más acciones" que abre un menú; desde 768 px se ven todas.
- P: ¿Se hace una prueba con personas para medir si encuentran la acción principal, o se reemplaza por una revisión? → R: Sin prueba con personas: alcanza con la revisión de cada pantalla por `revisor-ux-ui` y el inventario de CE-001.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Reconocer la acción principal de cada pantalla (Prioridad: P1)

Un editor o un admin entra a cualquier pantalla del panel y distingue sin pensar cuál es la acción principal (por ejemplo "Nuevo artículo" en la lista, "Ingresar" en el ingreso o "Guardar" en el perfil). El resto de las acciones se ve con menos peso, y las destructivas se reconocen como tales.

**Por qué esta prioridad**: es el problema que más señaló el usuario ("todo pesa igual") y el que más afecta el uso diario. Resolverlo ya cambia la percepción del panel aunque no se haga nada más.

**Prueba independiente**: recorrer cada pantalla y cada diálogo del panel y comprobar que hay como máximo una acción con el máximo peso visual por contexto, que las demás tienen un peso menor según su importancia y que las destructivas usan su propio estilo.

**Escenarios de aceptación**:

1. **Dado** la lista de artículos, **cuando** se carga, **entonces** "Nuevo artículo" es la única acción con el máximo peso visual; "Filtrar" y la paginación se ven con menos peso.
2. **Dado** el editor de un artículo, **cuando** se carga, **entonces** "Guardar" y las acciones de estado están juntas en la barra fija, solo una de ellas tiene el máximo peso visual (ver RF-005) y las demás (archivar, volver a borrador, cancelar programación) se ven como secundarias.
3. **Dado** un borrador sin cambios pendientes en el editor, **cuando** se modifica cualquier campo, **entonces** "Guardar" pasa a ser la acción principal y "Publicar" pasa a secundaria; **cuando** se guarda, "Publicar" vuelve a ser la principal.
4. **Dado** un diálogo de confirmación de una acción destructiva (eliminar un artículo, una categoría o una etiqueta, desactivar a un miembro), **cuando** se abre, **entonces** la acción que confirma usa el estilo destructivo y "Cancelar" se ve con menos peso.
5. **Dado** cualquier pantalla con una acción destructiva disponible (por ejemplo "Eliminar" en el editor para un admin), **cuando** se muestra, **entonces** queda separada de las acciones comunes y no se confunde con la principal.
6. **Dado** la pantalla de equipo, **cuando** hay varios miembros, **entonces** las acciones de cada fila (cambiar rol, desactivar, reenviar invitación) tienen menos peso que la acción principal de la pantalla ("Invitar").

---

### Historia 2 - Botones parejos y alineados (Prioridad: P1)

Un editor recorre el panel en el teléfono, en la tablet y en la computadora, y los botones de un mismo grupo tienen la misma altura, están alineados entre sí y con los campos que acompañan, y respetan el mismo orden en todas las pantallas.

**Por qué esta prioridad**: es el segundo problema que señaló el usuario ("tamaños desparejos") y depende de las mismas definiciones que la historia 1; juntas forman la base del cambio.

**Prueba independiente**: en 360, 768, 1024 y 1440 px, revisar cada barra o grupo de acciones del panel y verificar alturas iguales, alineación, orden y área táctil mínima.

**Escenarios de aceptación**:

1. **Dado** cualquier grupo de botones del panel, **cuando** se muestra en cualquiera de los cuatro anchos, **entonces** todos los botones del grupo tienen la misma altura y quedan alineados entre sí.
2. **Dado** un botón junto a un campo de formulario (por ejemplo "Filtrar" junto a los filtros o "Agregar" junto al nombre de una categoría nueva), **cuando** se muestra, **entonces** queda alineado con el campo y no con su etiqueta.
3. **Dado** las acciones de una fila de tabla o de una barra de herramientas, **cuando** se muestran, **entonces** usan un tamaño compacto que mantiene un área táctil de al menos 44 × 44 px.
4. **Dado** el editor de un borrador en 360 px, **cuando** se carga, **entonces** la barra fija ocupa una sola línea con "Publicar", "Guardar" y "Más acciones", y "Programar" (y "Eliminar" para el admin) están dentro de ese menú.
5. **Dado** una barra de acciones en 360 px fuera del editor, **cuando** los botones no entran en una línea, **entonces** se acomodan de forma ordenada (sin botones cortados ni texto partido de manera ilegible) y la acción principal sigue siendo la primera que se encuentra al recorrer con el teclado o al leer.
6. **Dado** un botón que está procesando una acción, **cuando** muestra su estado "ocupado", **entonces** conserva su tamaño y la barra no se mueve.

---

### Historia 3 - Pantallas que guían la vista (Prioridad: P2)

Un editor entra a cualquier pantalla y la lee siempre en el mismo orden: título de la pantalla, una descripción breve cuando hace falta, la acción principal en un lugar previsible, y después las secciones con sus propios títulos. Los mensajes de estado (vacío, cargando, error, éxito) se presentan igual en todas.

**Por qué esta prioridad**: completa la jerarquía visual más allá de los botones. Aporta valor, pero el panel ya es usable con las historias 1 y 2.

**Prueba independiente**: comparar las pantallas del panel entre sí y verificar que todas siguen la misma estructura de encabezado, la misma escala de títulos y el mismo espaciado entre secciones.

**Escenarios de aceptación**:

1. **Dado** cualquier pantalla del panel, **cuando** se carga, **entonces** muestra un encabezado con el título de la pantalla y, si la pantalla tiene una acción principal, esa acción aparece siempre en la misma posición del encabezado.
2. **Dado** una pantalla con varias secciones (por ejemplo el editor: contenido, imagen destacada, taxonomías y publicación; o el perfil), **cuando** se recorre, **entonces** cada sección tiene un título del mismo nivel y estilo, y la separación entre secciones es mayor que la separación dentro de ellas.
3. **Dado** una lista sin resultados, una carga en curso, un error o una acción exitosa, **cuando** se muestra el estado, **entonces** usa la misma presentación en todas las pantallas.
4. **Dado** el texto de apoyo (fechas, ayudas, conteos), **cuando** se muestra, **entonces** se distingue del texto principal con el mismo tratamiento en todas las pantallas, sin bajar del contraste mínimo.

### Casos borde

- **Pantallas sin acción principal** (por ejemplo "No tienes permiso" o "Este enlace ya se usó o venció"): no se fuerza una acción destacada; el enlace de salida se ve como secundario o como enlace.
- **Acción principal deshabilitada** (por ejemplo "Guardar" sin cambios o mientras sube una imagen): sigue reconociéndose como la principal, se ve claramente inactiva sin parecer rota y explica por qué no está disponible cuando no es evidente.
- **Varias acciones del mismo nivel** (por ejemplo los botones de negrita, cursiva y enlace de la barra de marcas del editor): se ven como un grupo de herramientas de bajo peso, no como acciones principales.
- **Rol editor**: si una acción solo existe para el admin (por ejemplo "Eliminar"), su ausencia no deja huecos ni desacomoda la barra.
- **Textos largos en botones** (por ejemplo "Reemplazar con la vigente" o "Cancelar programación") en 360 px: no se cortan ni rompen la alineación del grupo.
- **Zoom del navegador al 200 %**: los grupos de acciones se reacomodan sin superponerse ni salirse de la pantalla.
- **Diálogos**: dentro de un diálogo la jerarquía se evalúa sola; la acción principal de la pantalla de fondo no cuenta.
- **Programar con cambios sin guardar**: se mantiene la regla de hoy (hay que guardar antes de cambiar el estado); el aviso aparece antes de abrir el diálogo de fecha.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **RF-001**: El panel DEBE ofrecer cuatro niveles de acción con pesos visuales distintos y reconocibles: **principal** (el máximo peso), **secundaria**, **terciaria** (el menor peso, para acciones de apoyo, de herramientas o de navegación con aspecto de botón) y **destructiva**.
- **RF-002**: Cada contexto (una pantalla, o un diálogo abierto) DEBE tener como máximo una acción de nivel principal visible a la vez.
- **RF-003**: Las acciones destructivas (eliminar, desactivar, reemplazar contenido ajeno) DEBEN usar el nivel destructivo, NO DEBEN mostrarse con el nivel principal y DEBEN quedar separadas visualmente de las acciones comunes del mismo grupo. Se mantiene la confirmación previa que ya existe.
- **RF-004**: Cada acción de cada pantalla y diálogo del panel DEBE tener asignado un nivel explícito según su importancia en ese contexto; ninguna acción puede quedar con el nivel principal solo por omisión.
- **RF-005**: En el editor, "Guardar" y las acciones de estado del artículo (publicar, programar, cancelar programación, volver a borrador, archivar y, para el admin, eliminar) DEBEN estar juntas en la barra fija del editor. La acción principal DEBE ser **"Publicar"** cuando el artículo es un borrador sin cambios pendientes, y **"Guardar"** en cualquier otro caso: con cambios sin guardar en cualquier estado, y siempre en un artículo programado, publicado o archivado (donde "Guardar" queda deshabilitado mientras no haya cambios). Las demás acciones se muestran como secundarias, y "Eliminar" como destructiva. El recuadro "Publicación" queda solo para la información del estado: estado actual, fecha de publicación o de programación y el enlace "Ver en el sitio".
- **RF-018**: "Programar" DEBE abrir un diálogo con el campo de fecha y hora de publicación (con el foco en ese campo) y un botón "Programar" como acción principal del diálogo. Una fecha pasada se sigue rechazando con el mismo mensaje de hoy, sin cerrar el diálogo; "Cancelar" cierra el diálogo sin cambios.
- **RF-006**: El panel DEBE ofrecer dos tamaños de botón: **estándar**, para las acciones de una pantalla, de un formulario o de un diálogo, y **compacto**, para las acciones repetidas en filas, tarjetas y barras de herramientas. Ambos DEBEN tener un área táctil de al menos 44 × 44 px.
- **RF-007**: Los botones que solo muestran un ícono DEBEN tener un tamaño cuadrado uniforme y un nombre accesible.
- **RF-008**: Los botones de un mismo grupo DEBEN tener la misma altura y quedar alineados entre sí. Un botón que acompaña a un campo de formulario DEBE alinearse con el campo.
- **RF-009**: Las barras de acciones DEBEN seguir un orden consistente en todo el panel: la acción principal primero en el orden de lectura y de teclado, después las secundarias, después las terciarias, y las destructivas al final y separadas. En anchos angostos los botones DEBEN reacomodarse sin cortarse ni superponerse.
- **RF-019**: Por debajo de 768 px, la barra fija del editor DEBE mostrar en una sola línea la acción principal, la secundaria más relacionada ("Guardar" o "Publicar", la que no sea principal; si no existe "Publicar", la primera acción de estado) y un botón "Más acciones" con el resto. El menú DEBE poder abrirse, recorrerse y cerrarse con el teclado y anunciarse a los lectores de pantalla, y las acciones destructivas van al final del menú, separadas. Desde 768 px todas las acciones se ven en la barra.
- **RF-010**: Los botones DEBEN mostrar estados distinguibles: reposo, sobre el puntero, foco de teclado, presionado, deshabilitado y ocupado. El estado deshabilitado DEBE verse inactivo sin parecer un error, y el estado ocupado DEBE conservar el tamaño del botón.
- **RF-011**: Cada pantalla del panel DEBE tener un encabezado con la misma estructura: título de la pantalla, descripción breve opcional y, si existe, la acción principal de la pantalla en una posición fija del encabezado.
- **RF-012**: El panel DEBE usar una sola escala de títulos (título de pantalla, título de sección y título de subsección) y un mismo tratamiento para el texto de apoyo, aplicados igual en todas las pantallas.
- **RF-013**: El espaciado DEBE marcar la estructura: la separación entre secciones es mayor que la separación entre los elementos de una sección, con los mismos valores en todas las pantallas.
- **RF-014**: Los estados de vacío, carga, error y éxito DEBEN presentarse con el mismo formato en todas las pantallas del panel.
- **RF-015**: Los cambios DEBEN aplicarse a todas las pantallas del panel: ingreso, recuperación y definición de contraseña, lista de artículos, editor (encabezado, barra fija y sección de publicación), vista previa, categorías, etiquetas, equipo, perfil y las pantallas de error ("No encontrado" y "No tienes permiso").
- **RF-016**: El aspecto de los botones del sitio público y del bloque CTA de los artículos NO DEBE cambiar, aunque compartan la definición del botón con el panel.
- **RF-017**: Los flujos, los permisos y los textos de las acciones NO DEBEN cambiar, salvo que un texto haga falta para que un botón entre en 360 px sin cortarse.

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

Sin cambios: la feature solo cambia la presentación. Las acciones que hoy ve cada rol siguen siendo las mismas.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: En el 100 % de las pantallas y diálogos del panel hay como máximo una acción de nivel principal visible por contexto, y ninguna acción destructiva se muestra con ese nivel.
- **CE-002**: En una revisión pantalla por pantalla (incluidos los diálogos y los cuatro estados del artículo en el editor), la acción principal de cada contexto coincide con la definida en esta spec en el 100 % de los casos, sin hallazgos bloqueantes de jerarquía.
- **CE-003**: En 360, 768, 1024 y 1440 px, el 100 % de los grupos de acciones tiene botones de igual altura y alineados, sin botones cortados ni superpuestos, y el 100 % de los controles tiene un área táctil de al menos 44 × 44 px.
- **CE-004**: Todas las combinaciones de nivel y estado de los botones cumplen el contraste WCAG 2.1 AA, y las pantallas del panel mantienen Lighthouse Accesibilidad ≥ 95 en los cuatro anchos.
- **CE-005**: Los botones del sitio público y del bloque CTA se ven idénticos antes y después del cambio (comparación visual sin diferencias en la landing y en un artículo con CTA).
- **CE-006**: Ningún flujo del panel cambia de comportamiento: todas las pruebas de punta a punta del panel siguen pasando.

## Supuestos

- Es un sitio de demo: se privilegia un sistema simple y consistente por sobre la cantidad de variantes.
- Se reutilizan los tokens de diseño existentes; si hace falta un valor nuevo (por ejemplo un tamaño compacto o un color para el nivel terciario), se agrega primero como token.
- La identidad visual (colores, tipografías) no cambia; cambia cómo se usan para marcar la jerarquía.
- El texto de los botones se mantiene en español con tuteo, como el resto del panel.
- No hay cambios de datos ni de base de datos.

## Fuera de alcance

- El modelo de interacción del editor de bloques (cómo se agregan, mueven, duplican y quitan los bloques, y sus botones internos): se rediseña en la spec 005, con un editor estilo documento.
- El sitio público: su aspecto no cambia y no hay impacto en SEO; el panel sigue sin indexarse.
- Nuevas funciones, pantallas o permisos.
- Un modo oscuro o cambios de identidad visual.
