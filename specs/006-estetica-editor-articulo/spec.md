# Especificación: Estética del editor de artículos y lienzo limpio

**Rama**: `006-estetica-editor-articulo`

**Creada**: 2026-10-24

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Ahora nos vamos a centrar en corregir detalles estéticos del panel para crear publicaciones. Titulo slug y extracto tiene demaciadpo peso, eso podríá estar mayormente en la barra lateral. para dejar más espacio a los bloques de la edición."

## Contexto

El editor de artículos actual funciona correctamente tras la adopción del formato canónico de documento (Spec 005) y la jerarquía visual del panel (Spec 004). Sin embargo, el lienzo principal de escritura sufre de sobrecarga visual en su cabecera:

- Antes de llegar al editor de contenido, el usuario se encuentra con un campo de formulario tradicional para el "Título", un campo para el "Slug" con su texto de ayuda, un área de texto para el "Extracto" y un bloque completo con previsualización para la "Imagen destacada".
- Esto empuja el editor de contenido por debajo de la línea de visibilidad inmediata (*above the fold*), haciendo que el acto de escribir se sienta encorsetado y alejado de una experiencia fluida estilo documento (como Notion, Medium, Substack o Gutenberg).
- La barra lateral ya dispone de una pestaña «Artículo» diseñada para agrupar metadatos del artículo (actualmente alberga Taxonomías y SEO), pero los metadatos principales siguen duplicando peso en la columna principal.

## Aclaraciones

### Sesión 2026-10-24

- **P**: ¿Dónde debe ubicarse el título del artículo?
  - **R**: El título se mantiene en la columna principal, pero integrado de forma limpia directamente en el lienzo de escritura (estilo Notion/Medium: sin caja gris ni marco pesado de formulario, tipografía grande y destacada, con autoajuste de altura y placeholder sutil "Título del artículo...").
- **P**: ¿Dónde deben ubicarse el slug y el extracto?
  - **R**: Se trasladan a la barra lateral (pestaña «Artículo»), liberando el lienzo de escritura.
- **P**: ¿Qué se hace con la imagen destacada?
  - **R**: Se traslada también a la barra lateral (pestaña «Artículo») para despejar por completo la columna principal, dejándola 100% dedicada al título y al cuerpo del documento.
- **P**: ¿Cómo interactúan los errores de validación de los campos trasladados a la barra lateral?
  - **R**: Si al guardar faltan campos obligatorios o hay errores (por ejemplo, extracto demasiado largo o imagen destacada con alt inválido):
    1. El aviso superior de errores lista el problema como hasta ahora.
    2. En pantallas donde la barra lateral tiene pestañas ("Artículo" / "Elemento"), si el error proviene de un campo de la pestaña "Artículo", la vista activa automáticamente dicha pestaña y hace scroll/foco en el campo correspondiente.

---

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Escritura fluida en lienzo despejado (Prioridad: P1)

Como editor o redactor de contenidos, quiero abrir el editor y comenzar a escribir el título y el cuerpo del artículo de forma inmediata y sin distracciones, para concentrarme en la creación del contenido con el máximo espacio vertical.

**Por qué esta prioridad**: Resuelve directamente el problema planteado por el usuario ("dejar más espacio a los bloques de la edición"). Transforma la experiencia de redacción en un flujo moderno y limpio.

**Prueba independiente**: Abrir `/articulos/nuevo` y verificar que la columna principal contiene únicamente el título integrado y el lienzo de contenido; verificar que no hay campos de formulario intermedios (slug, extracto, imagen destacada) ocupando espacio vertical.

**Escenarios de aceptación**:

1. **Dado** un artículo nuevo o existente en el editor, **cuando** la pantalla carga en escritorio (≥ 1280 px), **entonces** la columna principal muestra el encabezado de página, el campo de título integrado con estilo de documento y a continuación el editor de contenido estructurado.
2. **Dado** el campo de título integrado, **cuando** el redactor escribe un título largo de varias líneas, **entonces** el campo expande su altura automáticamente sin barras de desplazamiento internas ni desbordes.
3. **Dado** el campo de título, **cuando** está vacío, **entonces** muestra un texto de sugerencia (*placeholder*) claro (ej. "Título del artículo...") y un indicador accesible de error si no se completa antes de guardar.
4. **Dado** el foco en el título, **cuando** el redactor presiona `Enter` al final del texto, **entonces** el foco se traslada al primer bloque del editor de contenido.

---

### Historia 2 - Gestión centralizada de metadatos en la barra lateral (Prioridad: P2)

Como redactor o administrador, quiero configurar el slug, el extracto y la imagen destacada dentro de la pestaña «Artículo» de la barra lateral, para consultar y editar todos los metadatos del artículo en un solo lugar estructurado.

**Por qué esta prioridad**: Mantiene la accesibilidad y operatividad total de los campos que antes ocupaban la columna principal, organizándolos armónicamente junto a las taxonomías y los ajustes SEO.

**Prueba independiente**: Modificar el slug, extracto e imagen destacada desde la barra lateral, guardar el artículo y comprobar que persisten y se visualizan correctamente.

**Escenarios de aceptación**:

1. **Dado** el panel lateral con la pestaña «Artículo» seleccionada, **cuando** el usuario la visualiza, **entonces** encuentra las secciones ordenadas de:
   - "Detalles" o "General" (Slug con su ayuda y extracto).
   - "Imagen destacada" (Selector de imagen, previsualización, texto alternativo).
   - "Taxonomías" (Categoría y etiquetas).
   - "Para buscadores" (Título SEO y descripción SEO).
2. **Dado** un artículo nuevo, **cuando** el usuario escribe el título en el lienzo, **entonces** el slug sugerido se calcula y se actualiza en el campo de la barra lateral tras la pausa habitual (300 ms).
3. **Dado** un error de validación en un campo de la barra lateral (ej. extracto excedido), **cuando** se intenta guardar, **entonces** el panel de la barra lateral asegura que la pestaña «Artículo» esté visible y señala el campo en falta.

---

### Historia 3 - Adaptabilidad en dispositivos móviles y tabletas (Prioridad: P3)

Como usuario que edita desde un dispositivo móvil o tableta (< 1280 px), quiero que el lienzo de escritura se mantenga limpio y que los metadatos del artículo estén accesibles sin entorpecer la vista del documento.

**Por qué esta prioridad**: Cumplir con los requisitos de diseño responsive (360, 768, 1024 y 1440 px) y las directrices de accesibilidad de la Constitución v2.0.0.

**Prueba independiente**: Ejecutar el editor en resoluciones de 360 px y 768 px, comprobando la fluidez del título, el espacio del editor y el acceso a los metadatos.

**Escenarios de aceptación**:

1. **Dado** un viewport de 360 px o 768 px, **cuando** se carga el editor, **entonces** el lienzo muestra el título y el editor de contenido, mientras que la sección de metadatos, imagen destacada, taxonomías y SEO se ubican ordenadamente al pie o en su contenedor móvil respetando las áreas táctiles mínimas (44 px).

---

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **RF-001**: El campo de título del artículo DEBE presentarse visualmente integrado en el lienzo del documento, con tamaño tipográfico destacado (`text-3xl font-titulos font-bold`), sin bordes gruesos de caja de formulario estándar, con anillo de foco accesible (`focus-visible:ring`).
- **RF-002**: El campo de título DEBE admitir varias líneas ajustando su altura dinámicamente según el contenido (mediante `textarea` autoajustable o contenedor equivalente accesible).
- **RF-003**: El campo de slug DEBE ubicarse en la barra lateral (pestaña «Artículo»), conservando la previsualización y sugerencia automática a partir del título en artículos nuevos.
- **RF-004**: El campo de extracto DEBE ubicarse en la barra lateral (pestaña «Artículo») en la sección de detalles generales.
- **RF-005**: El selector de imagen destacada (con su subida, botón de medios, previsualización y texto alternativo) DEBE ubicarse en la barra lateral (pestaña «Artículo»).
- **RF-006**: La columna principal de edición DEBE ubicar el editor de documento Tiptap inmediatamente a continuación del título del artículo, sin secciones intermedias de formulario.
- **RF-007**: El sistema DEBE garantizar que todos los identificadores de formulario (`id`, `aria-describedby`, `aria-invalid`, `aria-labelledby`) sigan conectados para lectores de pantalla.
- **RF-008**: Si ocurre un error de validación en un campo de la barra lateral y la pestaña activa es «Elemento», el sistema DEBE cambiar automáticamente a la pestaña «Artículo» para exponer el error al usuario.

### Requisitos de permisos

Sin cambios respecto a la Spec 003 y Spec 004:
| Acción | anónimo | editor | admin |
|---|---|---|---|
| Editar artículo y metadatos | ✗ | ✓ | ✓ |

### Requisitos de accesibilidad (Constitución §I.2 y §IX.4)

- **RACC-001**: Contraste mínimo 4.5:1 en el título, etiquetas y placeholders.
- **RACC-002**: Navegación secuencial lógica por teclado: Título → Barra de herramientas del editor → Lienzo de contenido.
- **RACC-003**: 0 violaciones de Axe en 360, 768, 1024 y 1440 px.

---

## Criterios de éxito *(obligatorio)*

- **CE-001**: El espacio vertical previo al primer elemento del editor de contenido en pantalla de escritorio (1440 px) se reduce en al menos un 50% (medido desde la base del encabezado de página hasta el lienzo de Tiptap).
- **CE-002**: El 100% de las pruebas unitarias y E2E existentes del editor continúan pasando (adaptando los selectores de ubicación de campos sin pérdida de cobertura funcional).
- **CE-003**: 0 violaciones de accesibilidad con axe-core en las cuatro resoluciones canónicas.
- **CE-004**: Idempotencia: abrir un artículo, cambiar metadatos en la barra lateral o título en el lienzo, y guardar persiste exactamente la estructura esperada sin efectos colaterales.
