# Especificación: Sitio público (landing y blog)

**Rama**: `002-sitio-publico`

**Creada**: 2026-10-19

**Estado**: Borrador

**Entrada**: Descripción del usuario: "002-sitio-publico: sitio público en apps/web (Astro) con landing de la demo genérica y blog. Landing con hero, propuesta de valor, servicios/beneficios, últimos artículos y CTA de contacto. Blog: listado paginado de artículos publicados, detalle de artículo con render de los 10 tipos de bloque de @blog/bloques, páginas de categoría, etiqueta y autor, redirecciones de slugs viejos (301), sitemap, RSS, metadatos SEO completos (title, description, canonical, OG, JSON-LD), 404, y endpoint de revalidación ISR firmado con HMAC que recibe las notificaciones de la base. Consume solo datos públicos vía @blog/db. Diseño con tokens de @blog/ui, WCAG AA, responsive, JS cero por defecto. Fuera de alcance: búsqueda (H5 de 001), formulario de contacto funcional."

## Contexto

Esta feature es **la cara visible de la demo**. Es lo que se le muestra al cliente y lo que indexan los buscadores.
Se apoya en el modelo de contenido de la spec 001, que ya define qué es público, cómo se compone un artículo y cuándo se avisa que algo cambió. Esta spec define **qué ve el visitante, cómo lo encuentra y cómo se mantiene actualizado**.

**Actores**
- **Visitante**: persona anónima que llega desde un buscador, una red social o un enlace directo.
- **Buscador o lector de feeds**: un agente automático que indexa el sitio o lee el feed.
- **Base de datos**: emite el aviso firmado de "cambió contenido público" (contrato de la spec 001).
- **Responsable de la demo**: la persona que adapta la identidad y los textos de la landing para cada cliente.

## Aclaraciones

### Sesión 2026-10-19

- P: ¿Adónde lleva la llamada a contactar? → R: A WhatsApp, con un mensaje prearmado, y a un correo como alternativa. Ambos se configuran por cliente.
- P: ¿Dónde se configuran los textos de la landing? → R: En un archivo de contenido del proyecto, que se valida al generar el sitio. No se editan desde el panel.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Leer un artículo (Prioridad: P1)

Un visitante abre la URL de un artículo publicado. Ve:
- el título, la imagen destacada, el autor, la fecha de publicación, la categoría y las etiquetas;
- el cuerpo completo, con cada tipo de bloque (párrafo, título, imagen, cita, lista, galería, llamada a la acción, separador, código y video) presentado de forma legible y accesible;
- al final, una ficha del autor y enlaces para seguir navegando (categoría, etiquetas, otros artículos).

**Por qué esta prioridad**: El artículo es la unidad que posiciona en buscadores y la que se comparte. Sin esta página el blog no existe.

**Prueba independiente**: Abrir un artículo de demo que use los 10 tipos de bloque y comprobar estas tres cosas:
- cada bloque se muestra con su contenido y en su orden;
- la página tiene un único título principal;
- las imágenes tienen texto alternativo.

**Escenarios de aceptación**:

1. **Dado** un artículo publicado, **cuando** un visitante abre `/blog/{slug}`, **entonces** ve el título como único encabezado principal, el autor con su nombre y foto, la fecha de publicación, la categoría enlazada, las etiquetas enlazadas y todos los bloques en orden.
2. **Dado** un bloque de código que contiene etiquetas HTML o scripts, **cuando** se muestra el artículo, **entonces** el texto aparece literal y nunca se ejecuta.
3. **Dado** un bloque de imagen marcado como decorativo, **cuando** se muestra, **entonces** las tecnologías de asistencia lo ignoran. Una imagen no decorativa expone su texto alternativo.
4. **Dado** un bloque de video, **cuando** se carga la página, **entonces** el reproductor externo no se descarga hasta que el visitante decide reproducirlo, y el bloque muestra un título accesible.
5. **Dado** un artículo en borrador, programado o archivado, o un slug inexistente, **cuando** un visitante abre su URL, **entonces** recibe la página "no encontrado" con estado 404.
6. **Dado** un bloque de llamada a la acción, **cuando** el visitante lo activa, **entonces** navega al destino indicado. Si el destino es externo, se abre de forma segura, sin dar acceso a la página de origen.

---

### Historia 2 - Recorrer el blog por listados (Prioridad: P1)

Un visitante entra a `/blog` y ve los artículos publicados, del más reciente al más antiguo, en tarjetas con imagen, título, extracto, categoría y fecha. Puede:
- pasar de página;
- entrar a la página de una categoría, de una etiqueta o de un autor, cada una con su presentación (nombre, descripción o biografía) y sus artículos.

**Por qué esta prioridad**: Los listados son la navegación principal del blog, y las páginas de taxonomía son páginas indexables que atraen tráfico por temas.

**Prueba independiente**: Con el contenido de demo, recorrer `/blog`, una categoría, una etiqueta y un autor, y comprobar que en cada caso el orden, la paginación y el contenido coinciden con lo publicado.

**Escenarios de aceptación**:

1. **Dado** más de 12 artículos publicados, **cuando** un visitante abre `/blog`, **entonces** ve los 12 más recientes y una navegación accesible hacia la página siguiente (`/blog/pagina/2`).
2. **Dado** una categoría con artículos publicados, **cuando** se abre `/blog/categoria/{slug}`, **entonces** se muestran su nombre como título principal, su descripción y solo sus artículos publicados, ordenados por fecha descendente.
3. **Dado** una etiqueta, **cuando** se abre `/blog/etiqueta/{slug}`, **entonces** se comporta igual que una categoría.
4. **Dado** un autor con artículos publicados, **cuando** se abre `/blog/autor/{slug}`, **entonces** se muestran su nombre, su foto, su biografía y sus artículos publicados. Nunca se muestran su correo, su rol ni su estado.
5. **Dado** una página de listado fuera de rango (por ejemplo `/blog/pagina/99`), **cuando** se abre, **entonces** responde 404.
6. **Dado** la URL `/blog/pagina/1`, **cuando** se abre, **entonces** redirige de forma permanente a `/blog`.
7. **Dado** una categoría o etiqueta existente sin artículos publicados, **cuando** se abre, **entonces** muestra un estado vacío con un enlace al blog, y los buscadores no la indexan.

---

### Historia 3 - Conocer la propuesta en la landing (Prioridad: P2)

Un visitante entra a la portada (`/`) y recorre, en este orden:
1. un **hero** con la propuesta principal y una llamada a la acción;
2. la **propuesta de valor**;
3. los **servicios o beneficios**;
4. **testimonios**;
5. los **últimos 3 artículos** del blog;
6. una **llamada final a contactar**.

La identidad visual (colores, tipografía, logo) y los textos se pueden adaptar a cada cliente sin tocar la estructura.

**Por qué esta prioridad**: Es lo primero que ve el cliente en la demo. Depende de que el blog exista para mostrar los últimos artículos.

**Prueba independiente**: Abrir `/` y comprobar estas cuatro cosas:
- aparecen las seis secciones en orden;
- los artículos mostrados son los 3 últimos publicados;
- la llamada a contactar lleva a un canal de contacto válido;
- al cambiar la paleta y los textos de demo, la página refleja el cambio sin modificar sus componentes.

**Escenarios de aceptación**:

1. **Dado** el contenido de demo, **cuando** se abre `/`, **entonces** se ven en orden el hero, la propuesta de valor, los servicios o beneficios, los testimonios, los últimos artículos y la llamada a contactar, con un único encabezado principal (el del hero).
2. **Dado** que se publica un artículo nuevo, **cuando** se vuelve a abrir `/`, **entonces** aparece primero entre los últimos artículos.
3. **Dado** que no hay artículos publicados, **cuando** se abre `/`, **entonces** la sección de últimos artículos no aparece y el resto de la página sigue completa.
4. **Dado** un visitante que activa la llamada a contactar, **cuando** lo hace, **entonces** abre una conversación de WhatsApp con un mensaje inicial prearmado. Como alternativa visible, tiene un enlace de correo con el asunto prearmado. Ambos datos se configuran por cliente.
5. **Dado** que el responsable de la demo cambia los textos de la landing, **cuando** se publica esa versión del sitio, **entonces** la landing muestra los nuevos textos. Los textos viven en un archivo de contenido del proyecto, con estructura validada, y no en el panel.

---

### Historia 4 - Ver siempre la versión vigente (Prioridad: P2)

Cuando el equipo publica, edita, archiva o cambia el slug de algo público, el sitio muestra el cambio en menos de un minuto, sin que nadie tenga que redesplegar. Así se mantienen la velocidad del contenido pre-generado y la frescura del contenido dinámico. Los enlaces viejos siguen funcionando: redirigen de forma permanente a la URL nueva.

**Por qué esta prioridad**: Sin actualización automática el panel no sirve, y sin redirecciones se pierde el posicionamiento ganado cada vez que se cambia un slug.

**Prueba independiente**: Publicar un artículo y verlo en el sitio. Después cambiarle el slug y comprobar que la URL vieja responde con una redirección permanente a la nueva. Por último, archivarlo y comprobar que responde 404 y desaparece de los listados.

**Escenarios de aceptación**:

1. **Dado** un aviso de cambio con una firma válida y vigente, **cuando** llega al sitio, **entonces** se actualizan todas las páginas afectadas por ese cambio (el artículo, los listados, su categoría, sus etiquetas, la portada, el sitemap y el feed), y el sitio responde que lo aceptó.
2. **Dado** un aviso con la firma incorrecta, sin firma o con una marca de tiempo de más de 5 minutos, **cuando** llega, **entonces** se rechaza como no autorizado y no se actualiza nada.
3. **Dado** el mismo aviso recibido dos veces, **cuando** se procesa, **entonces** el resultado es idéntico al de recibirlo una vez.
4. **Dado** un artículo cuyo slug cambió de "a" a "b", **cuando** un visitante abre `/blog/a`, **entonces** recibe una redirección permanente a `/blog/b`. Lo mismo vale para categorías y etiquetas.
5. **Dado** un slug que cambió dos veces (de "a" a "b" y de "b" a "c"), **cuando** se abre `/blog/a`, **entonces** redirige directamente a `/blog/c`, en un solo salto.
6. **Dado** que se renombra o elimina una categoría o etiqueta, **cuando** llega el aviso, **entonces** también se actualizan las páginas de los artículos que la mostraban.
7. **Dado** que cambian el nombre, la foto o la biografía de un autor, **cuando** llega el aviso, **entonces** se actualizan su página de autor y sus artículos.

---

### Historia 5 - Ser encontrado por buscadores y lectores de feeds (Prioridad: P3)

Un buscador encuentra todas las páginas públicas en el mapa del sitio, entiende cada una gracias a sus metadatos y datos estructurados, y respeta las indicaciones de rastreo. Un lector de feeds se suscribe y recibe los artículos nuevos. Al compartir un enlace en una red social, se ve una vista previa con título, descripción e imagen.

**Por qué esta prioridad**: El SEO es el motor del sitio (constitución §I), pero las historias 1 y 2 ya entregan las páginas. Esta historia completa su descubrimiento.

**Prueba independiente**: Validar el mapa del sitio, el feed y los datos estructurados con validadores estándar. Comprobar que cada página pública tiene todos sus metadatos.

**Escenarios de aceptación**:

1. **Dado** el contenido de demo, **cuando** se pide `/sitemap.xml`, **entonces** contiene la portada, `/blog`, cada artículo, categoría, etiqueta y autor con contenido publicado, cada uno con su fecha de última modificación, y ninguna página vacía, privada ni de redirección.
2. **Dado** el contenido de demo, **cuando** se pide `/rss.xml`, **entonces** es un feed válido con los 20 artículos más recientes, con título, enlace absoluto, extracto, fecha y categoría.
3. **Dado** cualquier página pública, **cuando** se inspecciona, **entonces** tiene título, descripción, URL canónica absoluta, vista previa para redes (Open Graph y Twitter Card) e idioma español declarado.
4. **Dado** un artículo, **cuando** se inspecciona, **entonces** declara datos estructurados de artículo de blog (con título, imagen, autor, fecha de publicación y de modificación) y de migas de pan. La portada declara los datos de la organización y del sitio web.
5. **Dado** `/robots.txt`, **cuando** se pide, **entonces** permite el rastreo de lo público, bloquea las rutas técnicas e indica la ubicación del sitemap.
6. **Dado** un despliegue de previsualización (no productivo), **cuando** un buscador lo visita, **entonces** se le indica que no lo indexe.

### Casos borde

- **Artículo sin imagen destacada**: la tarjeta y la vista previa en redes usan una imagen genérica del sitio; el diseño no se rompe.
- **Título o extracto muy largos** (120 y 300 caracteres): las tarjetas los recortan visualmente sin desbordar y sin perder el texto completo para tecnologías de asistencia.
- **Galería con una sola imagen o con muchas**: se presenta bien en los cuatro anchos de referencia.
- **Contenido con texto que parece código** (`<script>`, `{{`, etc.) en cualquier bloque: siempre se muestra como texto.
- **Enlace de llamada a la acción con un esquema peligroso** (por ejemplo `javascript:`): no se renderiza como enlace activo.
- **Video de un proveedor caído**: el resto del artículo se ve igual; el bloque muestra su título y un enlace al video original.
- **Autor desactivado con artículos publicados**: su página y su ficha siguen visibles, porque la autoría se conserva.
- **Slug con mayúsculas o barra final** (`/blog/Mi-Articulo/`): redirige de forma permanente a la forma canónica.
- **La base no responde** mientras se regenera una página: el visitante sigue viendo la última versión generada. Si la página nunca se generó, ve una página de error amable con estado 5xx (no un 404 falso).
- **Aviso de cambio con cuerpo malformado o tipo desconocido**: se rechaza como petición inválida, sin efectos.
- **Programado que llega a su hora**: aparece en el sitio cuando la base emite el aviso; antes no es accesible por ninguna URL.
- **Ruta inexistente fuera del blog** (`/cualquier-cosa`): página "no encontrado" con estado 404, navegación del sitio y enlace al blog.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Artículo**
- **RF-001**: El sistema DEBE mostrar cada artículo publicado en `/blog/{slug}` con título, imagen destacada (si tiene), autor (nombre y foto), fecha de publicación, fecha de actualización (si difiere), categoría, etiquetas y cuerpo.
- **RF-002**: El sistema DEBE presentar los 10 tipos de bloque de la spec 001 respetando su orden y sus variantes: niveles de título 2 a 4, listas ordenadas y no ordenadas, imágenes con epígrafe, galerías, citas con autor, código con su lenguaje, video y llamada a la acción.
- **RF-003**: Ningún texto de un bloque DEBE interpretarse como marcado ejecutable. Los enlaces solo DEBEN aceptar destinos `http`, `https`, `mailto` y rutas internas.
- **RF-004**: Los videos DEBEN cargar el reproductor externo solo cuando el visitante lo pide. Hasta entonces se muestra una vista previa liviana.
- **RF-005**: Al final del artículo DEBEN mostrarse la ficha del autor y hasta 3 artículos relacionados: primero los de la misma categoría, completando con los más recientes.
- **RF-006**: Los artículos no publicados y los slugs inexistentes DEBEN responder 404.

**Listados**
- **RF-007**: `/blog` DEBE listar los artículos publicados por fecha de publicación descendente, de a 12 por página, con páginas siguientes en `/blog/pagina/{n}`.
- **RF-008**: Las páginas de categoría (`/blog/categoria/{slug}`), etiqueta (`/blog/etiqueta/{slug}`) y autor (`/blog/autor/{slug}`) DEBEN mostrar su presentación y sus artículos publicados con la misma paginación (`…/pagina/{n}`).
- **RF-009**: Cada tarjeta de artículo DEBE mostrar imagen, título enlazado, extracto, categoría y fecha. La misma tarjeta DEBE usarse en todos los listados, en los relacionados y en la portada.
- **RF-010**: La paginación DEBE indicar la página actual y ofrecer anterior y siguiente. Las páginas fuera de rango responden 404 y `/pagina/1` redirige a la URL sin paginar.
- **RF-011**: Cada autor con artículos publicados DEBE tener un identificador legible y estable para su URL, derivado de su nombre con las mismas reglas de normalización de slugs de la spec 001.

**Landing**
- **RF-012**: La portada DEBE mostrar, en orden, estas secciones: hero con llamada a la acción, propuesta de valor, servicios o beneficios, testimonios, últimos 3 artículos publicados y llamada final a contactar.
- **RF-013**: Los textos, la imagen del hero, los servicios y los testimonios de la landing DEBEN poder adaptarse a cada cliente sin modificar los componentes, y la identidad visual DEBE cambiar solo editando tokens (constitución §VII.6).
- **RF-013b**: La llamada a contactar (hero, cabecera y llamada final) DEBE abrir WhatsApp con un número y un mensaje inicial configurables. También DEBE ofrecer un enlace de correo con un asunto configurable. El número y el correo DEBEN mostrarse también como texto en el pie.
- **RF-013c**: El contenido de la landing DEBE validarse al generar el sitio. Si falta un campo obligatorio, la generación DEBE fallar con un mensaje que indique el campo.
- **RF-014**: Si no hay artículos publicados, la sección de últimos artículos NO DEBE mostrarse.

**Navegación general**
- **RF-015**: Todas las páginas DEBEN compartir una cabecera con logo y navegación (Inicio, Blog y Contacto) y un pie con enlaces al blog, al feed y a los datos de contacto.
- **RF-016**: La página "no encontrado" DEBE responder 404, mantener cabecera y pie y ofrecer enlaces a la portada y al blog.
- **RF-017**: Cada página DEBE ofrecer un enlace para saltar al contenido principal.

**Actualización y redirecciones**
- **RF-018**: El sistema DEBE exponer un punto de recepción para los avisos de cambio definidos en el contrato de la spec 001. Este punto:
  - verifica la firma sobre el cuerpo exacto;
  - rechaza las firmas inválidas y las marcas de tiempo de más de 5 minutos con "no autorizado";
  - rechaza los cuerpos malformados con "petición inválida".
- **RF-019**: Al aceptar un aviso, el sistema DEBE actualizar todas las páginas afectadas: las rutas que define el contrato, más la portada, las páginas de autor y, ante un cambio de taxonomía, las páginas de los artículos que la muestran. Procesar dos veces el mismo aviso DEBE tener el mismo efecto que procesarlo una vez.
- **RF-020**: Un cambio visible para el público DEBE reflejarse en el sitio en menos de 60 segundos desde que ocurre.
- **RF-021**: Las URLs con slugs anteriores de artículos, categorías y etiquetas DEBEN redirigir de forma permanente (301), en un solo salto, a la URL vigente.
- **RF-022**: Las URLs con mayúsculas o barra final DEBEN redirigir de forma permanente a su forma canónica (minúsculas, sin barra final).

**Datos y rendimiento**
- **RF-023**: El sitio público DEBE leer solamente datos publicados, con credenciales públicas. NO DEBE poder leer ni modificar borradores, datos del equipo ni configuración.
- **RF-024**: Las páginas DEBEN entregarse pre-generadas. Solo se regeneran ante un aviso de cambio.
- **RF-025**: Las páginas NO DEBEN descargar código interactivo salvo para una funcionalidad que lo requiera y esté justificada. El reproductor de video, cuando el visitante lo activa, es la única excepción prevista.
- **RF-026**: Las imágenes DEBEN servirse optimizadas, en tamaños adecuados al ancho de pantalla, con dimensiones explícitas, carga diferida debajo del pliegue y carga prioritaria para la imagen principal.

### Requisitos de SEO *(obligatorio si afecta páginas públicas)*

- **RSEO-001**: Toda página pública DEBE tener título único (máx. 60 caracteres, con el nombre del sitio), descripción (máx. 160), URL canónica absoluta, Open Graph (tipo, título, descripción, imagen con dimensiones, URL), Twitter Card `summary_large_image` e idioma `es`.
- **RSEO-002**: Los artículos DEBEN usar su título y su descripción SEO, con el título y el extracto como respaldo (spec 001, RF-006). Además DEBEN declarar:
  - `og:type` `article`, con las fechas de publicación y modificación, la sección (categoría) y las etiquetas;
  - JSON-LD `BlogPosting`, con titular, imagen, autor, editor, fechas y URL;
  - JSON-LD `BreadcrumbList` (Inicio › Blog › Categoría › Artículo).
- **RSEO-003**: La portada DEBE declarar JSON-LD `Organization` y `WebSite`. Las páginas de autor DEBEN declarar `Person`. Los listados DEBEN declarar `CollectionPage` con sus migas de pan.
- **RSEO-004**: Las páginas paginadas DEBEN tener canónica propia (no apuntar a la página 1) y un título que indique el número de página.
- **RSEO-005**: `/sitemap.xml` DEBE incluir solo URLs públicas indexables, con su fecha de última modificación. Se actualiza con cada aviso de cambio.
- **RSEO-006**: `/rss.xml` DEBE publicar los 20 artículos más recientes con enlaces absolutos. Toda página DEBE anunciar el feed.
- **RSEO-007**: `/robots.txt` DEBE permitir lo público, excluir las rutas técnicas (el punto de recepción de avisos) y declarar el sitemap. Los despliegues de previsualización DEBEN indicar que no se indexen.
- **RSEO-008**: Cada página DEBE tener exactamente un encabezado principal y una jerarquía de encabezados sin saltos. Los títulos de bloque del artículo empiezan en el nivel 2.
- **RSEO-009**: Las páginas de taxonomía sin artículos publicados DEBEN marcarse como no indexables y quedar fuera del sitemap.

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

| Acción | visitante | base de datos (aviso firmado) | cualquier otro emisor |
|---|---|---|---|
| Ver artículos, listados, taxonomías y autores publicados | ✓ | — | — |
| Ver borradores, programados, archivados o datos privados del equipo | ✗ | — | — |
| Pedir la actualización de páginas | ✗ | ✓ | ✗ |

### Entidades clave *(si la feature involucra datos)*

- **Artículo público**: la vista de un artículo publicado según la spec 001. Incluye título, slug, extracto, SEO, imagen destacada, bloques, fechas, categoría, etiquetas y autor.
- **Autor público**: nombre, biografía, foto y **un identificador legible para su URL (nuevo en esta spec)**. Solo existe para miembros con artículos publicados.
- **Contenido de la landing**: textos del hero, propuesta de valor, servicios o beneficios (título, descripción, ícono), testimonios (cita, nombre, cargo, foto) y datos de contacto. Se adapta por cliente.
- **Aviso de cambio**: el mensaje firmado del contrato de la spec 001 (tipo, id, slugs, categorías, etiquetas, fecha).
- **Redirección**: un slug anterior que apunta a la entidad vigente (spec 001).

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: En el análisis de calidad en móvil sobre la previsualización, la portada, `/blog`, un artículo y una categoría obtienen estos puntajes: SEO ≥ 95, rendimiento ≥ 90 y accesibilidad ≥ 95.
- **CE-002**: En esas mismas páginas, la carga del contenido principal ocurre en menos de 2,5 s, el desplazamiento visual acumulado es menor a 0,1 y la respuesta a la interacción es menor a 200 ms.
- **CE-003**: El 100 % de las páginas públicas pasa la verificación automática de metadatos (título, descripción, canónica, Open Graph, Twitter Card), y el 100 % de los artículos pasa la validación de datos estructurados sin errores.
- **CE-004**: Un cambio publicado desde el panel se ve en el sitio en menos de 60 segundos en el 95 % de los casos, sin redesplegar.
- **CE-005**: El 100 % de los slugs anteriores del contenido de demo redirige en un solo salto, con redirección permanente, a la URL vigente.
- **CE-006**: Ninguna página pública presenta violaciones de accesibilidad WCAG 2.1 AA en la verificación automática, y todas se recorren completas con teclado, con foco visible.
- **CE-007**: Las páginas se ven sin desbordes horizontales ni solapamientos en 360, 768, 1024 y 1440 px.
- **CE-008**: Ninguna página descarga código interactivo hasta que el visitante activa un video.
- **CE-009**: El 100 % de los avisos con firma inválida, sin firma o vencidos se rechaza, y ninguno de ellos provoca una actualización.
- **CE-010**: El mapa del sitio y el feed pasan los validadores estándar sin errores.

## Supuestos

- El modelo de contenido, las reglas de visibilidad, el contrato del aviso de cambio y los datos de demo son los de la spec 001. Esta spec no cambia reglas de negocio de los artículos.
- La única novedad en los datos es el identificador legible de los autores (RF-011). Hereda las reglas de slugs y de redirección de la spec 001.
- El sitio es solo en español y tiene un único dominio por despliegue.
- Las páginas de demo usan las imágenes del contenido de demo. Si falta una imagen, se usa una genérica del sitio.
- El tamaño de página de 12 y el feed de 20 artículos son valores por defecto que se pueden cambiar.
- El contenido de la landing (textos, servicios, testimonios y datos de contacto) se adapta por cliente editando un archivo del proyecto y redesplegando. No se edita desde el panel (aclaración del 2026-10-19).
- Las fechas se muestran en formato largo en español y en la zona horaria de Argentina (por ejemplo, "18 de octubre de 2026").
- Los artículos relacionados se eligen por categoría y por recencia. No hay recomendación personalizada.
- El aviso de cambio sigue el contrato de la spec 001 y llega por HTTPS a la URL configurada en la base.

## Fuera de alcance

- Búsqueda de artículos (historia 5 de la spec 001 y su página pública): spec propia.
- Un formulario de contacto que envíe mensajes. Solo hay una llamada a la acción hacia el canal de contacto.
- Comentarios, newsletter, analítica y gestión de cookies.
- Panel de administración y edición de contenido.
- Multiidioma, modo oscuro elegido por el visitante y páginas institucionales adicionales (nosotros, servicios en detalle, legales).
- Dominio propio del cliente: la demo usa el dominio de la plataforma de despliegue.
