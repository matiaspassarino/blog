# Especificación: Modelo de contenido del blog

**Rama**: `001-modelo-de-contenido`

**Creada**: 2026-10-18

**Estado**: Borrador

**Entrada**: Descripción del usuario: "001-modelo-de-contenido: modelo de contenido del blog — perfiles con roles admin/editor, artículos compuestos por bloques estructurados con estados (borrador, programado, publicado, archivado), categorías, etiquetas, búsqueda full-text en español y permisos por rol. Base de datos y reglas de dominio sobre la que se construyen el panel y el blog público."

## Contexto

Esta feature define **qué información maneja el blog y qué reglas la gobiernan**: quién puede hacer qué, cómo se compone un artículo, en qué estados puede estar y qué ve un visitante.
No incluye pantallas: el panel de administración y las páginas públicas tienen sus propias specs, que se apoyan en esta. Por eso las historias se verifican sobre el comportamiento del sistema (qué se guarda, qué se rechaza y qué es visible para cada actor) y no sobre una interfaz.

**Actores**
- **Visitante**: persona anónima que lee el sitio.
- **Editor**: miembro del equipo de contenido.
- **Admin**: responsable del sitio; gestiona el contenido y el equipo.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Redactar un artículo con bloques como borrador (Prioridad: P1)

Un editor crea un artículo con título, extracto, imagen destacada, una categoría, etiquetas y un cuerpo compuesto por una secuencia ordenada de bloques (párrafo, título, imagen, cita, lista, galería, llamada a la acción, separador, código, video). El artículo queda guardado como **borrador** y nadie fuera del equipo puede verlo.

**Por qué esta prioridad**: Sin la capacidad de crear y guardar contenido estructurado no existe el blog. Todo lo demás depende de esto.

**Prueba independiente**: Crear un artículo con varios bloques como editor, volver a leerlo y comprobar que se conservan el contenido, el orden de los bloques y el estado borrador, y que un visitante no lo puede obtener.

**Escenarios de aceptación**:

1. **Dado** un editor autenticado, **cuando** guarda un artículo con título y tres bloques válidos, **entonces** el artículo queda guardado en estado borrador, con un identificador legible (slug) derivado del título y con los bloques en el orden indicado.
2. **Dado** un editor autenticado, **cuando** intenta guardar un bloque incompleto (por ejemplo, una imagen sin texto alternativo o un tipo de bloque inexistente), **entonces** el guardado se rechaza con un mensaje que indica qué bloque y qué campo fallaron, y no se guarda nada.
3. **Dado** un artículo en borrador, **cuando** un visitante lo busca por su slug, **entonces** el sistema responde como si no existiera.
4. **Dado** un artículo existente con el slug "mi-articulo", **cuando** se crea otro con el mismo título, **entonces** el nuevo recibe un slug distinto y único (por ejemplo "mi-articulo-2").

---

### Historia 2 - Publicar y que el visitante vea solo lo publicado (Prioridad: P1)

El equipo publica un artículo en borrador. A partir de ese momento cualquier visitante puede leerlo, junto con su categoría, sus etiquetas y los datos públicos del autor (nombre, biografía y foto). Los visitantes no ven borradores, artículos programados ni archivados.

**Por qué esta prioridad**: Es el valor central del producto: el contenido llega al público y alimenta el SEO.

**Prueba independiente**: Publicar un artículo y verificar como visitante que es visible con sus relaciones, mientras otros artículos en otros estados siguen ocultos.

**Escenarios de aceptación**:

1. **Dado** un artículo en borrador con categoría asignada, **cuando** un editor lo publica, **entonces** pasa a estado publicado, se registra la fecha de publicación y un visitante puede leerlo completo.
2. **Dado** un artículo publicado, **cuando** un visitante lo consulta, **entonces** ve el nombre, la biografía y la foto del autor, pero nunca su correo electrónico ni su rol.
3. **Dado** un artículo publicado, **cuando** se archiva, **entonces** deja de ser visible para los visitantes y se conserva para el equipo.
4. **Dado** un artículo publicado, **cuando** se cambia su slug, **entonces** el slug anterior queda registrado para redirigir de forma permanente al nuevo.
5. **Dado** un artículo en borrador sin categoría, **cuando** se intenta publicar, **entonces** la publicación se rechaza indicando que falta la categoría.

---

### Historia 3 - Navegar por categorías y etiquetas (Prioridad: P1)

Un visitante consulta los artículos publicados de una categoría o de una etiqueta, ordenados del más reciente al más antiguo y paginados. El equipo gestiona las categorías y etiquetas (nombre, slug y descripción) que dan título y contexto a esas páginas.

**Por qué esta prioridad**: Las páginas de categoría y etiqueta son páginas indexables clave para el SEO y para que el visitante navegue.

**Prueba independiente**: Crear categorías y etiquetas, asignarlas a artículos en distintos estados y comprobar que el listado de cada una devuelve solo los publicados, en orden.

**Escenarios de aceptación**:

1. **Dada** una categoría con 3 artículos publicados y 1 borrador, **cuando** un visitante la consulta, **entonces** obtiene exactamente los 3 publicados, del más reciente al más antiguo.
2. **Dado** un artículo con las etiquetas "seo" y "diseño", **cuando** un visitante consulta la etiqueta "diseño", **entonces** el artículo aparece en el listado.
3. **Dada** una categoría que tiene artículos asignados, **cuando** alguien del equipo intenta eliminarla, **entonces** la operación se rechaza indicando cuántos artículos la usan.
4. **Dada** una etiqueta con artículos asignados, **cuando** se elimina, **entonces** se quita de esos artículos y los artículos se conservan.
5. **Dada** una categoría o etiqueta sin artículos publicados, **cuando** un visitante la consulta, **entonces** obtiene un listado vacío, sin error.

---

### Historia 4 - Programar una publicación (Prioridad: P2)

Un editor deja un artículo **programado** para una fecha y hora futuras. Hasta ese momento el visitante no lo ve. Al llegar la hora, el artículo pasa solo a publicado, sin intervención humana.

**Por qué esta prioridad**: Permite planificar un calendario editorial. Aporta valor, pero el blog funciona sin esto.

**Prueba independiente**: Programar un artículo a unos minutos en el futuro y comprobar que es invisible antes y visible después de la hora indicada.

**Escenarios de aceptación**:

1. **Dado** un borrador con categoría, **cuando** se programa para mañana a las 10:00, **entonces** queda en estado programado y un visitante no puede verlo.
2. **Dado** un artículo programado, **cuando** llega su fecha y hora, **entonces** pasa a publicado en un plazo máximo de 1 minuto y se vuelve visible.
3. **Dado** un borrador, **cuando** se intenta programar para una fecha pasada, **entonces** se rechaza indicando que la fecha debe ser futura.
4. **Dado** un artículo programado, **cuando** se cancela la programación, **entonces** vuelve a borrador.

---

### Historia 5 - Buscar artículos en español (Prioridad: P2)

Un visitante escribe uno o más términos y obtiene los artículos publicados relevantes, ordenados por relevancia. La búsqueda entiende el español: ignora tildes y mayúsculas y reconoce variantes de una misma palabra (singular y plural, distintas conjugaciones).

**Por qué esta prioridad**: Mejora la experiencia en un blog con mucho contenido, pero no es imprescindible para un primer lanzamiento con pocos artículos.

**Prueba independiente**: Cargar artículos con textos conocidos y comprobar que búsquedas con variantes y sin tildes devuelven los esperados, y nunca artículos no publicados.

**Escenarios de aceptación**:

1. **Dado** un artículo publicado cuyo título contiene "Diseño de logotipos", **cuando** un visitante busca "diseno logotipo", **entonces** el artículo aparece en los resultados.
2. **Dado** un término que aparece en el título de un artículo y solo en el cuerpo de otro, **cuando** se busca, **entonces** el artículo con el término en el título aparece primero.
3. **Dado** un borrador que contiene el término buscado, **cuando** un visitante busca, **entonces** el borrador no aparece.
4. **Dada** una búsqueda sin coincidencias o vacía, **cuando** se ejecuta, **entonces** devuelve una lista vacía, sin error.

---

### Historia 6 - Gestionar el equipo y sus roles (Prioridad: P2)

El admin da de alta miembros del equipo con rol editor o admin, cambia sus roles y los desactiva. Cada miembro tiene un perfil con nombre, biografía y foto. Un editor no puede gestionar el equipo.

**Por qué esta prioridad**: Se necesita para operar con más de una persona y para proteger el contenido. Mientras tanto, la demo puede arrancar con usuarios precargados.

**Prueba independiente**: Con un admin y un editor, verificar qué operaciones sobre el equipo y el contenido permite y deniega el sistema a cada uno.

**Escenarios de aceptación**:

1. **Dado** un admin, **cuando** da de alta a una persona como editor, **entonces** esa persona puede acceder con el rol editor.
2. **Dado** un editor, **cuando** intenta cambiar su propio rol o el de otra persona, **entonces** la operación se rechaza.
3. **Dado** un miembro desactivado, **cuando** intenta operar, **entonces** se le niega el acceso y sus artículos publicados siguen visibles con su autoría.
4. **Dado** que existe un único admin activo, **cuando** se intenta quitarle el rol o desactivarlo, **entonces** la operación se rechaza para que el sitio nunca quede sin admin.
5. **Dado** cualquier miembro, **cuando** edita su propio perfil (nombre, biografía, foto), **entonces** los cambios se guardan.
6. **Dado** un editor, **cuando** edita, publica o archiva un artículo de otro autor, **entonces** la operación se permite y el autor original se conserva.
7. **Dado** un editor, **cuando** intenta eliminar definitivamente un artículo, **entonces** la operación se rechaza (solo puede archivarlo); un admin sí puede eliminarlo.

---

### Casos borde

- ¿Qué pasa si se publica un artículo programado manualmente antes de su hora? Pasa a publicado con la fecha actual y se descarta la programación.
- ¿Qué pasa con un artículo sin bloques? Puede guardarse como borrador, pero no puede publicarse ni programarse.
- ¿Qué pasa si cambia el slug de una categoría o etiqueta? El slug anterior también se registra para la redirección permanente.
- ¿Qué pasa si se renombra el artículo publicado? El slug **no** cambia automáticamente: solo cambia si alguien lo edita de forma explícita (así no se rompen los enlaces).
- ¿Qué pasa si se elimina el autor de un artículo? Los miembros no se eliminan, se desactivan, así que la autoría se conserva siempre.
- ¿Qué pasa si dos personas editan el mismo artículo al mismo tiempo? Si alguien intenta guardar sobre una versión desactualizada, el guardado se rechaza y se avisa (no se pisan cambios en silencio).
- ¿Qué pasa con slugs que llevan tildes, ñ o símbolos? Se normalizan a minúsculas, sin tildes, con "ñ" → "n" y espacios → "-" (por ejemplo, "Año de Diseño!" → "ano-de-diseno").
- ¿Qué pasa si el contenido de un bloque intenta inyectar código (scripts)? El texto se guarda como contenido y nunca se ejecuta al mostrarse.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Artículos y bloques**
- **RF-001**: El sistema DEBE permitir crear artículos con título (obligatorio, máx. 120 caracteres), slug, extracto (máx. 300), imagen destacada con texto alternativo, una categoría, cero o más etiquetas, autor y cuerpo en bloques.
- **RF-002**: El cuerpo DEBE ser una secuencia ordenada de bloques. Los tipos válidos son párrafo, título (niveles 2 a 4), imagen, cita, lista (ordenada o no), galería, llamada a la acción, separador, código y video. Cada tipo tiene campos obligatorios definidos.
- **RF-003**: El sistema DEBE rechazar un guardado completo si cualquier bloque es inválido, indicando la posición del bloque y el campo con error.
- **RF-004**: Toda imagen (en un bloque, en una galería o destacada) DEBE tener texto alternativo, salvo que se marque explícitamente como decorativa.
- **RF-005**: El sistema DEBE generar el slug a partir del título, normalizado (minúsculas, sin tildes, "ñ" → "n", separado por guiones) y único entre los artículos. Si ya existe, agrega un sufijo numérico.
- **RF-006**: Los artículos DEBEN tener campos opcionales de SEO: título SEO (máx. 60) y descripción SEO (máx. 160). Si faltan, se usan el título y el extracto.
- **RF-007**: El sistema DEBE registrar las fechas de creación, de última modificación y de publicación.
- **RF-008**: El sistema DEBE detectar ediciones concurrentes y rechazar el guardado hecho sobre una versión desactualizada.

**Estados**
- **RF-009**: Un artículo DEBE estar en uno de estos estados: borrador, programado, publicado o archivado. Las transiciones permitidas son: borrador → programado | publicado; programado → borrador | publicado; publicado → archivado | borrador; archivado → borrador. Cualquier otra transición se rechaza.
- **RF-010**: Para publicar o programar, un artículo DEBE tener título, categoría y al menos un bloque.
- **RF-011**: Programar DEBE exigir una fecha y hora futuras. El sistema DEBE pasar el artículo a publicado automáticamente, a más tardar 1 minuto después de esa fecha.
- **RF-012**: Al cambiar el slug de un artículo, categoría o etiqueta publicados, el sistema DEBE registrar el slug anterior para redirigir de forma permanente al nuevo.
- **RF-013**: Cada vez que cambia el contenido visible para el público (se publica, manualmente o por programación; se edita algo publicado; se despublica o archiva; cambia una categoría o etiqueta, o los datos públicos de un autor). Los cambios en borradores y programados no cuentan, el sistema DEBE notificarlo para que el sitio público se actualice.

**Taxonomías**
- **RF-014**: El sistema DEBE permitir gestionar categorías y etiquetas con nombre (único), slug (único, normalizado como en RF-005) y descripción opcional (máx. 300).
- **RF-015**: Cada artículo DEBE tener como máximo una categoría (obligatoria para publicar) y cualquier cantidad de etiquetas.
- **RF-016**: El sistema DEBE impedir eliminar una categoría que tenga artículos asignados. Eliminar una etiqueta la quita de sus artículos sin afectarlos.
- **RF-017**: El sistema DEBE devolver los artículos publicados de una categoría o etiqueta ordenados por fecha de publicación descendente, con paginación de tamaño configurable (12 por defecto).

**Búsqueda**
- **RF-018**: El sistema DEBE ofrecer búsqueda de texto sobre los artículos publicados: título, extracto, texto de los bloques, categoría y etiquetas.
- **RF-019**: La búsqueda DEBE ignorar tildes y mayúsculas y reconocer variantes morfológicas del español.
- **RF-020**: Los resultados DEBEN ordenarse por relevancia, y una coincidencia en el título DEBE pesar más que una en el cuerpo.

**Equipo y perfiles**
- **RF-021**: Cada miembro del equipo DEBE tener un perfil con nombre visible (obligatorio), biografía (opcional, máx. 500), foto (opcional), rol (admin o editor) y estado (activo o desactivado).
- **RF-022**: No DEBE existir el registro público: solo un admin puede dar de alta miembros.
- **RF-023**: Solo un admin DEBE poder cambiar roles y desactivar o reactivar miembros. El sistema DEBE impedir quedarse sin ningún admin activo.
- **RF-024**: Cualquier editor DEBE poder editar, publicar, programar y archivar cualquier artículo, sin cambiar su autor. Solo un admin DEBE poder eliminar artículos definitivamente.
- **RF-025**: Los miembros NO DEBEN eliminarse físicamente (para conservar la autoría): se desactivan.
- **RF-026**: Los visitantes solo DEBEN acceder al nombre, la biografía y la foto de los autores de artículos publicados. El correo, el rol y el estado nunca son públicos.

**Seguridad y datos de demo**
- **RF-027**: Todas las reglas de permisos DEBEN cumplirse en el propio almacenamiento de datos, de modo que no puedan saltearse aunque se acceda a los datos por fuera de la interfaz prevista.
- **RF-028**: El sistema DEBE incluir un conjunto de datos de demostración: 1 admin, 2 editores, 4 categorías, 10 etiquetas y al menos 12 artículos en distintos estados que usen todos los tipos de bloque.

### Requisitos de SEO *(obligatorio si afecta páginas públicas)*

- **RSEO-001**: Cada artículo, categoría y etiqueta DEBE tener un slug estable y legible, apto para URLs en español.
- **RSEO-002**: Cada artículo DEBE exponer los datos necesarios para sus metadatos: título y descripción SEO (con su respaldo), imagen destacada con dimensiones y texto alternativo, autor, fechas de publicación y modificación, categoría y etiquetas.
- **RSEO-003**: Los slugs anteriores DEBEN quedar disponibles para resolver redirecciones permanentes (RF-012).
- **RSEO-004**: El sistema DEBE poder listar todos los artículos, categorías y etiquetas públicos con su fecha de última modificación, para generar el sitemap y el feed.

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

| Acción | Visitante | Editor | Admin |
|---|---|---|---|
| Leer artículos publicados, categorías y etiquetas | ✓ | ✓ | ✓ |
| Leer borradores, programados y archivados | ✗ | ✓ | ✓ |
| Crear artículos (como autor) | ✗ | ✓ | ✓ |
| Editar, publicar, programar o archivar artículos propios | ✗ | ✓ | ✓ |
| Editar, publicar, programar o archivar artículos de otros | ✗ | ✓ | ✓ |
| Eliminar artículos definitivamente | ✗ | ✗ (solo archivar) | ✓ |
| Crear, editar y eliminar categorías y etiquetas | ✗ | ✓ | ✓ |
| Leer datos públicos de autores (nombre, biografía, foto) | ✓ (solo de autores con artículos publicados) | ✓ | ✓ |
| Editar el perfil propio | ✗ | ✓ | ✓ |
| Dar de alta miembros, cambiar roles, desactivar | ✗ | ✗ | ✓ |
| Buscar | ✓ (solo publicados) | ✓ | ✓ |

### Entidades clave

- **Perfil**: Miembro del equipo. Nombre visible, biografía, foto, rol (admin | editor), estado (activo | desactivado). Vinculado a una cuenta de acceso.
- **Artículo**: Unidad de contenido. Título, slug, extracto, imagen destacada (con texto alternativo), campos SEO, contenido (lista ordenada de bloques), estado, fecha programada, fecha de publicación, autor (perfil), categoría, etiquetas y versión (para detectar ediciones concurrentes).
- **Bloque**: Elemento del contenido de un artículo, con un tipo y campos propios del tipo. Vive siempre dentro de un artículo y no tiene identidad fuera de él.
- **Categoría**: Agrupación principal. Nombre, slug, descripción. Una categoría tiene muchos artículos.
- **Etiqueta**: Tema transversal. Nombre, slug, descripción. Relación de muchos a muchos con artículos.
- **Redirección**: Slug anterior → entidad actual (artículo, categoría o etiqueta), con fecha.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: El 100 % de las combinaciones acción × rol de la tabla de permisos tienen una verificación automática que confirma el resultado esperado (permitido o denegado).
- **CE-002**: Ningún artículo en estado distinto de publicado es obtenible por un visitante en ninguna consulta (artículo, listados, búsqueda, autores): 0 fugas en las pruebas.
- **CE-003**: Un artículo programado se vuelve visible a más tardar 60 segundos después de la hora indicada, en el 100 % de las pruebas.
- **CE-004**: Las búsquedas de prueba con variantes (sin tildes, singular/plural, conjugaciones) encuentran el artículo esperado entre los 3 primeros resultados en al menos el 95 % de los casos del conjunto de prueba.
- **CE-005**: Las búsquedas sobre los datos de demo responden en menos de 1 segundo para el visitante.
- **CE-006**: El 100 % de los bloques inválidos del conjunto de prueba se rechazan con un mensaje que identifica bloque y campo.
- **CE-007**: Con los datos de demostración cargados, el equipo puede mostrar al cliente artículos de cada tipo de bloque, categorías y etiquetas sin cargar nada a mano.

## Supuestos

- El acceso del equipo es con correo y contraseña (o enlace mágico). No hay registro público ni acceso con redes sociales en el MVP.
- Cada artículo tiene un único autor (no hay coautoría en el MVP).
- No hay historial de versiones ni comentarios en el MVP. Solo se guarda el estado actual y se detecta la edición concurrente.
- El sitio está en un único idioma (español) y en una única zona horaria configurable (por defecto, America/Argentina/Buenos_Aires) para programar.
- Las imágenes se suben a un almacenamiento de archivos del propio sistema. La interfaz de subida y la biblioteca de medios se especifican junto con el panel. Esta spec solo exige que toda imagen tenga referencia, dimensiones y texto alternativo.
- Los videos se incrustan desde proveedores externos (YouTube, Vimeo) a partir de su URL.
- El volumen esperado es bajo-medio: hasta unos 2.000 artículos y 10 miembros del equipo.

## Fuera de alcance

- Pantallas del panel de administración (editor visual de bloques, listados, formularios): spec del panel.
- Páginas públicas del blog y de la landing (diseño, metadatos HTML, sitemap y RSS renderizados): spec del sitio público.
- Contenido editable de la landing (hero, servicios, testimonios).
- Comentarios, newsletter, formulario de contacto, analítica.
- Historial de revisiones y flujo de aprobación editorial.
- Multiidioma.
