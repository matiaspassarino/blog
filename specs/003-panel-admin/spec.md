# Especificación: Panel de administración

**Rama**: `003-panel-admin`

**Creada**: 2026-10-20

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Panel de administración (apps/admin): login, listado y editor de artículos con bloques, publicar y programar, categorías y etiquetas, y gestión del equipo (roles y activación). Usa lo que ya tiene @blog/db."

## Contexto

Esta feature es **la parte autoadministrable de la demo**: lo que le permite al equipo del cliente escribir y publicar sin ayuda técnica. Es el punto 6 del alcance del MVP (constitución §I).
Las reglas de negocio ya están definidas y verificadas en la spec 001: qué es un artículo y sus bloques, los estados y sus transiciones, la programación, las categorías y etiquetas, los roles y el último admin. La spec 002 ya muestra en el sitio público todo lo que se publica, y el sitio se actualiza solo con cada cambio. Esta spec define **qué hace cada miembro del equipo en el panel y cómo lo ve**, sin redefinir esas reglas.

**Actores**
- **Editor**: miembro del equipo que redacta, edita, publica, programa y archiva artículos y gestiona categorías y etiquetas.
- **Admin**: además de todo lo del editor, elimina artículos definitivamente y gestiona el equipo (altas, roles, activación).
- **Miembro desactivado**: alguien que fue parte del equipo y ya no tiene acceso.
- **Visitante**: cualquier persona sin sesión. No ve nada del panel salvo la pantalla de ingreso.

## Aclaraciones

### Sesión 2026-10-20

- P: ¿Cómo obtiene su acceso un miembro nuevo? → R: Por invitación por correo: el admin lo da de alta, el miembro recibe un enlace y define su contraseña. Existe "olvidé mi contraseña", también por correo. El admin nunca conoce la contraseña de otro miembro (RF-026, RF-027).
- P: ¿Qué tipos de archivo de imagen puede subir el equipo? → R: JPEG, PNG, WebP y AVIF; no se aceptan SVG ni GIF (RF-007).
- P: ¿Cuánto tiempo sin actividad antes de cerrar la sesión? → R: 8 horas; la sesión se renueva mientras haya actividad (RF-002).
- P: ¿Qué formato en línea admiten los bloques de texto? → R: Solo las cuatro marcas ya definidas en la spec 001 (D9): negrita, cursiva, enlaces y código en línea; sin subrayado (RF-005).
- P: ¿Qué pasa con lo no guardado si la sesión vence o el miembro es desactivado? → R: En ambos casos se cierra la sesión y se descarta lo no guardado, con un aviso del motivo (casos borde, RF-002).
- P: ¿Qué pasa con las imágenes subidas al quitarlas de un artículo o eliminar el artículo? → R: Se borran del almacenamiento, salvo que otro contenido (artículo, galería o perfil) las siga usando (RF-007).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Ingresar al panel (Prioridad: P1)

Un miembro del equipo abre el panel, ingresa con su correo y contraseña y llega a la lista de artículos. Desde cualquier pantalla puede cerrar la sesión. Si alguien sin sesión intenta abrir una pantalla interna, el panel lo lleva al ingreso y, después de ingresar, lo devuelve a donde quería ir.

**Por qué esta prioridad**: Sin ingreso no hay panel; todo lo demás depende de saber quién es el usuario y qué rol tiene.

**Prueba independiente**: Con los usuarios de demo, ingresar como editor, como admin y como un miembro desactivado, y comprobar a qué llega cada uno.

**Escenarios de aceptación**:

1. **Dado** un miembro activo, **cuando** ingresa con su correo y contraseña correctos, **entonces** llega a la lista de artículos y ve su nombre y su rol.
2. **Dado** un correo o una contraseña incorrectos, **cuando** intenta ingresar, **entonces** ve un mensaje que no revela cuál de los dos falló, y el formulario conserva el correo.
3. **Dado** un miembro desactivado, **cuando** intenta ingresar, **entonces** no accede a ninguna pantalla interna y ve un mensaje que le indica que su cuenta está desactivada.
4. **Dado** un visitante sin sesión, **cuando** abre la dirección de una pantalla interna, **entonces** el panel lo lleva al ingreso y, al ingresar, vuelve a esa pantalla.
5. **Dado** un miembro con la sesión abierta, **cuando** la cierra, **entonces** vuelve al ingreso y ninguna pantalla interna es accesible sin ingresar de nuevo.
6. **Dado** un miembro que el admin desactiva mientras tiene la sesión abierta, **cuando** intenta su siguiente acción, **entonces** la acción se rechaza el panel lo saca de la sesión y descarta lo no guardado, explicándole el motivo.
7. **Dado** un miembro que olvidó su contraseña, **cuando** la pide desde la pantalla de ingreso, **entonces** recibe un correo con un enlace de un solo uso para definir una nueva y, al hacerlo, ingresa al panel. El panel muestra el mismo mensaje exista o no el correo, para no revelar quién es parte del equipo.

---

### Historia 2 - Redactar y editar un artículo con bloques (Prioridad: P1)

Un editor crea un artículo nuevo: escribe el título, ve el slug que se generará y puede cambiarlo, completa el extracto, elige la imagen destacada (subiéndola) con su texto alternativo, elige la categoría y las etiquetas, y arma el cuerpo agregando bloques de los 10 tipos (párrafo, título, imagen, cita, lista, galería, llamada a la acción, separador, código y video). Puede reordenar, duplicar y quitar bloques. También completa, si quiere, el título y la descripción para buscadores. Guarda como borrador y puede volver a editarlo después. Antes de publicar, ve una vista previa del artículo tal como se verá en el sitio.

**Por qué esta prioridad**: Escribir contenido es la razón de ser del panel y lo que el cliente evalúa en la demo.

**Prueba independiente**: Crear un borrador que use los 10 tipos de bloque, con imagen destacada subida desde el equipo, guardarlo, cerrarlo, volver a abrirlo y comprobar que todo se conservó en orden; y abrir su vista previa.

**Escenarios de aceptación**:

1. **Dado** un editor en un artículo nuevo, **cuando** escribe el título, **entonces** ve el slug sugerido con la misma normalización que usará el sistema, y puede reemplazarlo.
2. **Dado** un artículo con bloques, **cuando** el editor agrega, reordena, duplica o quita bloques y guarda, **entonces** al reabrirlo los bloques aparecen con el mismo contenido y en el mismo orden.
3. **Dado** un bloque con un campo obligatorio vacío o inválido (por ejemplo, una imagen sin texto alternativo que no está marcada como decorativa), **cuando** el editor guarda, **entonces** el guardado se rechaza completo, el panel señala ese bloque y ese campo con un mensaje comprensible y el resto de lo escrito se conserva.
4. **Dado** un bloque de imagen o de galería, o la imagen destacada, **cuando** el editor sube una imagen desde su equipo, **entonces** el panel la guarda, registra su ancho y alto, y le pide el texto alternativo o que la marque como decorativa.
5. **Dado** dos miembros que editan el mismo artículo, **cuando** el segundo guarda sobre una versión que el primero ya cambió, **entonces** el guardado se rechaza, el panel le explica que hay cambios más nuevos y le permite recargar el artículo sin perder de vista lo que había escrito.
6. **Dado** un editor con cambios sin guardar, **cuando** intenta salir de la pantalla, **entonces** el panel le avisa antes de descartarlos.
7. **Dado** un borrador, **cuando** el editor abre la vista previa, **entonces** ve el artículo con la misma presentación de los bloques que tendrá en el sitio, y la vista previa no es accesible para nadie fuera del equipo.
8. **Dado** un artículo de otro autor, **cuando** un editor lo edita y guarda, **entonces** los cambios se guardan y el autor no cambia.

---

### Historia 3 - Publicar, programar y retirar artículos (Prioridad: P1)

Desde el editor o desde la lista, un editor publica un borrador, lo programa para una fecha y hora futuras, cancela una programación, lo vuelve a borrador o lo archiva. El panel muestra en todo momento el estado del artículo, la fecha de publicación o la programada, y ofrece solo las acciones permitidas para ese estado. Un admin, además, puede eliminar un artículo definitivamente.

**Por qué esta prioridad**: Publicar es lo que convierte el trabajo en el panel en contenido visible; sin esto el blog no se autoadministra.

**Prueba independiente**: Con un borrador completo, publicarlo y verlo en el sitio; programar otro para dentro de 2 minutos y verlo aparecer solo; archivar el primero y comprobar que deja de estar en el sitio.

**Escenarios de aceptación**:

1. **Dado** un borrador con título, categoría y al menos un bloque, **cuando** el editor lo publica, **entonces** el panel muestra el estado "publicado" con su fecha y un enlace para verlo en el sitio, y el artículo aparece en el sitio en menos de 1 minuto.
2. **Dado** un borrador sin categoría o sin bloques, **cuando** el editor intenta publicarlo o programarlo, **entonces** la acción se rechaza y el panel indica qué falta.
3. **Dado** un borrador completo, **cuando** el editor elige programarlo para una fecha y hora futuras, **entonces** queda "programado" con esa fecha visible, y se publica solo a esa hora.
4. **Dado** una fecha y hora que no son futuras, **cuando** el editor intenta programar, **entonces** la acción se rechaza con un mensaje claro.
5. **Dado** un artículo programado, **cuando** el editor cancela la programación, **entonces** vuelve a ser borrador y no se publica.
6. **Dado** un artículo publicado, **cuando** el editor lo archiva o lo vuelve a borrador, **entonces** deja de aparecer en el sitio en menos de 1 minuto.
7. **Dado** un artículo en un estado cualquiera, **cuando** el editor ve sus acciones, **entonces** solo aparecen las transiciones permitidas para ese estado.
8. **Dado** un admin, **cuando** elimina un artículo y confirma la acción, **entonces** el artículo desaparece del panel y del sitio. Un editor no tiene esa acción.

---

### Historia 4 - Encontrar artículos en el panel (Prioridad: P2)

Un miembro del equipo ve la lista de todos los artículos (de cualquier autor y en cualquier estado) con su título, estado, autor, categoría y fecha relevante. Puede filtrar por estado, categoría y autor, buscar por título y paginar. Desde la lista abre un artículo para editarlo o crea uno nuevo.

**Por qué esta prioridad**: Con pocos artículos se puede trabajar sin filtros; con el volumen de un cliente real, encontrar un artículo rápido pasa a ser necesario.

**Prueba independiente**: Con los datos de demo, filtrar por "programado" y obtener exactamente los programados; buscar por una palabra del título y obtener el artículo.

**Escenarios de aceptación**:

1. **Dado** artículos en todos los estados, **cuando** el miembro abre la lista, **entonces** ve todos, ordenados por última modificación (el más reciente primero), con su estado claramente distinguible.
2. **Dado** un filtro por estado, categoría o autor, **cuando** se aplica, **entonces** la lista muestra solo los artículos que cumplen todos los filtros, y el filtro queda reflejado en la dirección de la página para poder compartirla o volver a ella.
3. **Dado** un texto en la búsqueda, **cuando** se aplica, **entonces** la lista muestra los artículos cuyo título lo contiene, sin distinguir mayúsculas ni tildes.
4. **Dado** que no hay artículos que cumplan los filtros, **cuando** se aplica la búsqueda, **entonces** el panel muestra un estado vacío con una forma de quitar los filtros.

---

### Historia 5 - Gestionar categorías y etiquetas (Prioridad: P2)

Un editor crea, renombra, cambia el slug, describe y elimina categorías y etiquetas. Ve cuántos artículos tiene cada una.

**Por qué esta prioridad**: Las categorías son obligatorias para publicar; la demo trae las suyas, pero cada cliente necesita adaptarlas.

**Prueba independiente**: Crear una categoría, asignarla a un artículo publicado, renombrarla y ver el nombre nuevo en el sitio; intentar eliminarla y recibir el rechazo por estar en uso.

**Escenarios de aceptación**:

1. **Dado** un nombre nuevo, **cuando** el editor crea una categoría o etiqueta, **entonces** aparece en la lista con su slug sugerido, y queda disponible para asignar en el editor de artículos.
2. **Dado** un nombre ya usado por otra categoría (o etiqueta), **cuando** el editor intenta guardarlo, **entonces** el panel lo rechaza con un mensaje claro.
3. **Dado** una categoría con artículos asignados, **cuando** el editor intenta eliminarla, **entonces** la acción se rechaza indicando cuántos artículos la usan.
4. **Dado** una etiqueta con artículos, **cuando** el editor la elimina y confirma, **entonces** desaparece de esos artículos sin afectar nada más.
5. **Dado** una categoría o etiqueta con artículos publicados, **cuando** el editor cambia su slug, **entonces** el panel avisa que la dirección pública cambia y que la anterior seguirá redirigiendo.

---

### Historia 6 - Gestionar el equipo y el perfil propio (Prioridad: P2)

Un admin ve la lista del equipo con nombre, correo, rol y estado; invita a un miembro nuevo con su rol, que recibe un correo para definir su contraseña; cambia roles; desactiva y reactiva miembros. Cualquier miembro edita su propio perfil: nombre visible, biografía y foto.

**Por qué esta prioridad**: El alta de miembros es la única forma de sumar personas (no hay registro público); sin embargo, la demo ya trae su equipo y puede mostrarse sin esta historia.

**Prueba independiente**: Como admin, invitar a un editor, abrir el correo de invitación, definir la contraseña y verificar que puede ingresar; desactivarlo y verificar que ya no puede; intentar degradar al único admin y recibir el rechazo.

**Escenarios de aceptación**:

1. **Dado** un admin, **cuando** da de alta un miembro con nombre, correo y rol, **entonces** el miembro aparece en la lista como "invitado", recibe un correo de invitación y, cuando define su contraseña con el enlace, queda activo y puede ingresar al panel.
2. **Dado** una invitación pendiente o vencida, **cuando** el admin la reenvía, **entonces** el miembro recibe un correo nuevo y el enlace anterior deja de valer.
3. **Dado** un correo que ya pertenece a un miembro, **cuando** el admin intenta darlo de alta, **entonces** el panel lo rechaza con un mensaje claro.
4. **Dado** un admin, **cuando** cambia el rol de un miembro o lo desactiva, **entonces** el cambio se refleja en la lista y en lo que ese miembro puede hacer desde su siguiente acción.
5. **Dado** el único admin activo, **cuando** alguien intenta quitarle el rol o desactivarlo (incluido él mismo), **entonces** la acción se rechaza explicando que siempre debe quedar un admin activo.
6. **Dado** un editor, **cuando** abre el panel, **entonces** no ve la gestión del equipo, y si llega a su dirección, se le niega el acceso.
7. **Dado** cualquier miembro, **cuando** edita su nombre, su biografía o su foto (con texto alternativo) y guarda, **entonces** el cambio se ve en su ficha de autor del sitio en menos de 1 minuto si tiene artículos publicados.
8. **Dado** un miembro, **cuando** edita su perfil, **entonces** no puede cambiar su propio rol ni su estado.

---

### Casos borde

- ¿Qué pasa si la sesión vence, o el miembro es desactivado, mientras escribe? Al intentar guardar, el panel cierra la sesión, lo lleva al ingreso y descarta lo no guardado; antes de salir le explica el motivo. Para minimizar la pérdida, la sesión se renueva con el uso (ver RF-002) y el panel avisa antes de salir con cambios sin guardar (RF-010).
- ¿Qué pasa si la subida de una imagen falla o el archivo no es una imagen JPEG, PNG, WebP o AVIF (por ejemplo, un SVG o un GIF) o supera el tamaño permitido? El bloque queda sin imagen, el panel explica el motivo y el resto del artículo no se afecta.
- ¿Qué pasa si un artículo programado se publica mientras alguien lo tiene abierto? Al guardar, el editor recibe el aviso de cambios más nuevos (Historia 2, escenario 5).
- ¿Qué pasa si se intenta publicar un artículo con 0 bloques válidos después de quitar todos? Se rechaza por requisitos de publicación.
- ¿Qué pasa con un artículo cuyo autor fue desactivado? Sigue apareciendo con su autor y puede editarse y publicarse.
- ¿Qué pasa si se eliminan todas las etiquetas de un artículo publicado? Se guarda sin etiquetas y el sitio deja de mostrarlas.
- ¿Qué pasa con un slug manual que ya existe? Se acepta con el sufijo numérico que agrega el sistema, y el panel muestra el slug final.
- ¿Qué pasa si se abre en un celular? Todas las pantallas se pueden usar desde 360 px de ancho, incluido el editor de bloques.
- ¿Qué pasa si un enlace de invitación o de recuperación ya se usó o venció? La pantalla lo explica y ofrece pedir uno nuevo (la recuperación) o indica que hay que pedirle al admin que reenvíe la invitación.
- ¿Qué pasa si el admin desactiva a un miembro que todavía no aceptó la invitación? El enlace deja de servir para ingresar: definir la contraseña no le da acceso mientras esté desactivado.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Acceso**
- **RF-001**: El panel DEBE exigir ingreso con correo y contraseña para cualquier pantalla interna. No DEBE existir el registro público (spec 001, RF-022).
- **RF-002**: Solo los miembros activos DEBEN acceder al panel. Un miembro desactivado DEBE perder el acceso a partir de su siguiente acción. La sesión DEBE cerrarse tras 8 horas sin actividad y renovarse mientras haya uso.
- **RF-003**: El panel DEBE mostrar u ocultar acciones según el rol, y toda acción DEBE validarse además en el servidor: ocultar un botón no alcanza (spec 001, RF-027).

**Artículos**
- **RF-004**: El panel DEBE permitir crear y editar todos los campos de un artículo definidos en la spec 001 (RF-001 y RF-006): título, slug, extracto, imagen destacada, categoría, etiquetas, cuerpo en bloques, título y descripción para buscadores.
- **RF-005**: El editor de bloques DEBE permitir agregar cualquiera de los 10 tipos de bloque, editar cada uno con sus campos, reordenarlos, duplicarlos y quitarlos. En los textos de párrafo, cita y lista DEBE ofrecer solo las marcas en línea que el sitio ya interpreta (negrita, cursiva, enlaces y código en línea) y NO DEBE permitir HTML.
- **RF-006**: El panel DEBE validar el contenido antes de enviarlo y DEBE mostrar los errores en el bloque y el campo exactos, con el mismo criterio que aplica el sistema al guardar.
- **RF-007**: El panel DEBE permitir subir imágenes desde el equipo del usuario para la imagen destacada, los bloques de imagen y las galerías, registrando ancho y alto y exigiendo texto alternativo o la marca de decorativa (spec 001, RF-004). Solo se aceptan imágenes JPEG, PNG, WebP o AVIF de hasta 5 MB; el servidor valida el tipo real del archivo, no solo su extensión. Una imagen que se quita de un artículo, o que queda sin uso al eliminarlo, DEBE borrarse del almacenamiento salvo que otro contenido (artículo, galería o perfil) la siga usando.
- **RF-008**: El panel DEBE mostrar el slug sugerido mientras se escribe el título y DEBE mostrar el slug definitivo después de guardar.
- **RF-009**: El panel DEBE detectar ediciones concurrentes (spec 001, RF-008), informarlas sin descartar lo escrito por el usuario y permitirle recargar la versión vigente.
- **RF-010**: El panel DEBE avisar antes de salir de una pantalla con cambios sin guardar.
- **RF-011**: El panel DEBE ofrecer una vista previa del artículo con la misma presentación de bloques que el sitio público, accesible solo para miembros del equipo.

**Estados**
- **RF-012**: El panel DEBE mostrar el estado de cada artículo y sus fechas (publicación o programación) y ofrecer solo las transiciones permitidas (spec 001, RF-009).
- **RF-013**: Publicar o programar DEBE indicar qué requisito falta cuando se rechaza (spec 001, RF-010). Programar DEBE pedir una fecha y hora futuras, expresadas en la hora local del usuario.
- **RF-014**: Un artículo publicado DEBE mostrar un enlace a su página en el sitio.
- **RF-015**: Solo un admin DEBE poder eliminar un artículo, y DEBE confirmar la acción antes de ejecutarla.

**Listado**
- **RF-016**: La lista de artículos DEBE incluir todos los estados y autores, ordenada por última modificación, con filtros combinables por estado, categoría y autor, búsqueda por título (sin distinguir mayúsculas ni tildes) y paginación de 20 por página.
- **RF-017**: Los filtros, la búsqueda y la página actual DEBEN reflejarse en la dirección de la pantalla.

**Taxonomías**
- **RF-018**: El panel DEBE permitir crear, editar (nombre, slug, descripción) y eliminar categorías y etiquetas, mostrando cuántos artículos usa cada una, con las reglas de la spec 001 (RF-014 a RF-016).
- **RF-019**: Al cambiar el slug de una categoría o etiqueta con artículos publicados, el panel DEBE avisar que la dirección pública cambia y que la anterior redirige.

**Equipo**
- **RF-020**: Solo un admin DEBE ver y gestionar el equipo: listado con nombre, correo, rol y estado (incluido "invitado" mientras el miembro no definió su contraseña); alta de miembros; cambio de rol; desactivación y reactivación (spec 001, RF-021 a RF-025).
- **RF-021**: El panel DEBE informar con un mensaje claro cuando una acción dejaría al equipo sin ningún admin activo.
- **RF-022**: Cada miembro DEBE poder editar su nombre visible, biografía y foto (con texto alternativo), y NO DEBE poder cambiar su rol ni su estado.

**Mensajes y accesibilidad**
- **RF-023**: Todo rechazo del sistema (permisos, validación, conflicto, requisitos, último admin) DEBE mostrarse en español, en lenguaje no técnico, junto al lugar donde ocurrió.
- **RF-024**: Toda acción destructiva (eliminar un artículo, una categoría o una etiqueta; desactivar un miembro) DEBE pedir confirmación.
- **RF-025**: El panel DEBE poder usarse completo con teclado y lector de pantalla, incluido el editor de bloques (reordenar sin arrastrar), y en pantallas desde 360 px de ancho.

**Correo (invitación y recuperación)**
- **RF-026**: El panel DEBE ofrecer "olvidé mi contraseña": envía al correo un enlace de un solo uso y con vencimiento para definir una nueva, y responde lo mismo exista o no el correo.
- **RF-027**: El alta DEBE hacerse por invitación: el sistema envía al correo del miembro un enlace con vencimiento para definir su contraseña; el admin puede reenviarla, lo que invalida el enlace anterior. El sistema DEBE rechazar el alta de un correo que ya pertenece a un miembro.

### Requisitos de SEO *(obligatorio si afecta páginas públicas)*

- **RSEO-001**: Ninguna pantalla del panel DEBE ser indexable: todas se marcan para que los buscadores no las indexen ni sigan sus enlaces, y el panel indica a los rastreadores que no lo recorran.
- **RSEO-002**: La vista previa NO DEBE ser accesible sin sesión ni indexable, y NO DEBE confundirse con la página pública (no comparte su dirección ni su dirección canónica).
- **RSEO-003**: Los cambios hechos en el panel se reflejan en el sitio público por el mecanismo de actualización de la spec 002; el panel no publica páginas propias.

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

| Acción | anónimo | editor | admin |
|---|---|---|---|
| Ver la pantalla de ingreso y pedir "olvidé mi contraseña" | ✓ | ✓ | ✓ |
| Definir la contraseña con un enlace de invitación o recuperación válido | ✓ (solo con el enlace) | ✓ | ✓ |
| Ver cualquier pantalla interna | ✗ | ✓ | ✓ |
| Crear, editar y ver vista previa de artículos (de cualquier autor) | ✗ | ✓ | ✓ |
| Publicar, programar, cancelar programación, despublicar y archivar | ✗ | ✓ | ✓ |
| Eliminar un artículo definitivamente | ✗ | ✗ | ✓ |
| Subir imágenes | ✗ | ✓ | ✓ |
| Crear, editar y eliminar categorías y etiquetas | ✗ | ✓ | ✓ |
| Editar el perfil propio (nombre, biografía, foto) | ✗ | ✓ | ✓ |
| Ver el equipo, invitar miembros (y reenviar la invitación), cambiar roles, desactivar y reactivar | ✗ | ✗ | ✓ |

Un miembro desactivado se comporta como anónimo.

### Entidades clave *(si la feature involucra datos)*

- **Sesión**: la identidad del miembro que usa el panel, con su rol y su estado. Vence tras 8 horas sin actividad y se renueva con el uso; al cerrarla, deja de valer.
- **Artículo, categoría, etiqueta, perfil**: las entidades de la spec 001, sin cambios en su definición.
- **Imagen subida**: un archivo de imagen almacenado para el contenido, con ancho y alto; se usa en la imagen destacada, en bloques de imagen y galerías, y en la foto de perfil.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: Un editor que nunca usó el panel crea y publica un artículo con 5 bloques (incluida una imagen subida) en menos de 5 minutos, sin ayuda.
- **CE-002**: El 100 % de las combinaciones acción × rol de la tabla de permisos tiene una verificación automática sobre el panel que confirma el resultado esperado, incluido el intento directo por dirección o por fuera de la interfaz.
- **CE-003**: Un artículo publicado, archivado o editado desde el panel se ve actualizado en el sitio público en menos de 60 segundos.
- **CE-004**: En el 100 % de los casos de prueba de contenido inválido, el panel señala el bloque y el campo correctos y conserva todo lo escrito.
- **CE-005**: Ninguna edición se pierde en silencio: en el 100 % de las pruebas de edición concurrente, el segundo guardado se rechaza y el usuario ve su contenido sin guardar.
- **CE-006**: Todas las pantallas del panel obtienen Accesibilidad ≥ 95 en Lighthouse y se pueden recorrer completas solo con teclado, en 360, 768, 1024 y 1440 px.
- **CE-007**: Las pantallas del panel responden a la navegación en menos de 1 segundo con los datos de demo.

## Supuestos

- El ingreso es con correo y contraseña, con la sesión estándar del proveedor de autenticación que ya usa el proyecto. No se exige segundo factor en el MVP.
- Los correos de invitación y de recuperación se envían en español, con la identidad del sitio. En la nube hace falta configurar un servicio de envío de correos propio (el incluido por el proveedor tiene un límite bajo de envíos); en local se revisan en el buzón de pruebas del entorno.
- Los enlaces de invitación y de recuperación vencen según la configuración estándar del proveedor de autenticación (del orden de 24 horas).
- La vista previa se muestra dentro del panel, con la misma presentación de bloques que el sitio, y no a través del sitio público.
- No hay guardado automático: el usuario guarda de forma explícita, y el panel avisa antes de perder cambios.
- La búsqueda de la lista de artículos es por título; la búsqueda en español por contenido (spec 001, H5) es para el sitio público.
- Las imágenes se suben una por una desde cada campo; no hay una biblioteca de medios para reutilizar imágenes subidas antes.
- La hora para programar se ingresa en la hora local del navegador del usuario y se muestra igual.
- El panel usa la misma identidad visual (tokens de diseño) que el sitio, con componentes de interfaz propios de una herramienta de gestión.
- El panel se publica como una aplicación separada del sitio público (spec 002), con su propia dirección.

## Fuera de alcance

- Editar los textos de la landing (se configuran en un archivo del proyecto, spec 002).
- Biblioteca de medios, recorte o edición de imágenes.
- Historial de versiones de un artículo y comparación de cambios.
- Comentarios, flujos de aprobación o revisión entre miembros.
- Acciones masivas sobre varios artículos a la vez.
- Estadísticas de visitas.
- Segundo factor de autenticación e inicio de sesión con proveedores externos.
- Eliminación física de miembros (spec 001, RF-025).
