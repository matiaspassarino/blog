# Contrato: componentes del editor de documento

**Spec**: RF-001 a RF-008, RF-017, RF-019, RF-020 | **Decisiones**: [research.md](../research.md) | **Modelo**: [data-model.md](../data-model.md) | **Atajos y roles**: [atajos.md](atajos.md)

> **Ampliación (2026-10-22)**: el documento es lo que se guarda. Donde este contrato dice `Contenido`, `Bloque` o `ErrorBloque`, léase `Documento`, `Elemento` y `ErrorElemento` ([documento.md](documento.md)); donde dice `bloqueId`, `id`. Los componentes nuevos de la ampliación están al final.

Interfaces que el plan crea o modifica: qué recibe cada pieza y qué garantiza. El código queda para la implementación. Todo vive en `apps/admin/src/componentes/editor/documento/`, salvo lo que se indica.

## Disposición de la pantalla del editor

| Ancho | Disposición |
|---|---|
| menos de 1280 px | Una sola columna: título, slug, extracto, imagen destacada y **Contenido** (barra de herramientas + lienzo, con ancho de lectura `--container-lectura`); debajo, **Publicación** y las pestañas del panel; las propiedades del elemento se abren en una **hoja inferior** |
| 1280 px o más | Dos columnas: el lienzo a la izquierda y, a la derecha (`xl:sticky`, alto máximo de la ventana con desplazamiento propio), **Publicación** (siempre visible) y debajo las pestañas **Artículo** (taxonomías y para buscadores) y **Elemento** (propiedades) |

- A 1024 px con la navegación lateral de 16 rem quedan unos 340 px para una columna al lado de otra: por eso la segunda columna empieza en 1280 px y no en 1024 (hallazgo B1 de la revisión). La barra de herramientas es `sticky top-0` con el desplazamiento de la cabecera del panel.
- **Publicación** no entra en las pestañas: su estado y su acción principal (spec 004) no se ocultan mientras se edita un elemento.
- La pestaña cambia sola a «Elemento» **solo** al seleccionar un elemento especial con clic o toque (no al mover el cursor en un texto); si la persona elige una pestaña a mano, se respeta hasta que seleccione otro elemento especial.

## `EditorDocumento` — nuevo (importación dinámica)

```ts
type Props = {
  contenido: Documento;                          // lo guardado o lo adoptado; reinicia el documento y el historial al cambiar `reinicio`
  reinicio: number;                              // sube con `guardado` inicial y `adoptar_vigente`
  errores: ErrorElemento[];                      // por id de elemento
  alCambiar: (contenido: Documento) => void;     // normalizarDocumento(editor.getJSON()) en cada transacción que cambia el documento
  alSeleccionar: (seleccion: SeleccionDelDocumento) => void;
  bloqueado: boolean;                            // mientras se carga la versión vigente: editor no editable y aria-readonly
};
```

- Crea el editor con `immediatelyRender: false`, las extensiones de `extensiones.ts` y los atributos accesibles de [atajos.md](atajos.md). `bloqueado` usa `setEditable(false)` y `aria-readonly` (un `fieldset disabled` no desactiva un `contenteditable`).
- Mientras llega la importación dinámica muestra un esqueleto; si falla (red caída), un `AvisoEstado` de error con «Reintentar».
- Expone por *ref* `seleccionarBloque(indice)` y `enfocarCampo(indice, campo)` para el enfoque del primer error al guardar.
- `SeleccionDelDocumento = { tipo: 'texto' } | { tipo: 'elementos'; desde: number; hasta: number; bloques: Bloque[] }`. El texto que cruza párrafos es `{ tipo: 'texto' }`; `elementos` solo existe en el modo elementos (atajos.md).
- Vacío: el párrafo vacío muestra un *placeholder* con contraste ≥ 4,5:1 ("Escribe o pulsa / para insertar") y un texto alternativo para teclados que esconden `/` ("Usa Insertar").

## `BarraHerramientas` — nuevo

```ts
type Props = { editor: Editor | null; deshabilitada: boolean; seleccion: SeleccionDelDocumento };
```

- `role="toolbar"`, un solo tope de tabulación y flechas entre controles. Controles: estilo de párrafo (menú que muestra el estilo vigente como texto), negrita, cursiva, código, enlace (campo de URL, ver atajos.md), lista con viñetas, lista numerada, **Insertar** (siempre visible), **Acciones** (menú sobre el elemento o los elementos seleccionados), **Propiedades** (con un elemento especial o de texto con propiedades seleccionado), deshacer y rehacer.
- Botones de la primitiva (`Button`, `terciaria` y `compacto`, `soloIcono` donde corresponda); el estado activo se ve con **texto, forma y color** (ver "Cambios en `packages/ui`"). Lo que no entra pasa a «Más» (`MasAcciones`, mismo corte por *container query* que la barra de la 004), **excepto Insertar**; los controles que pasan a «Más» salen del orden de tabulación.
- Sin cursor en el lienzo, los controles de formato se deshabilitan con `aria-disabled`. Tras ejecutar un comando con el teclado el foco vuelve al lienzo; con el puntero se evita perder el teclado virtual (`pointerdown` con `preventDefault`).
- En modo elementos muestra, junto a la barra, el texto fijo "3 elementos seleccionados" y el botón «Salir de la selección».

## `MenuInsertar` y `menu-insercion.ts` — nuevos

```ts
type ItemDeInsercion = { id: string; nombre: string; descripcion: string; grupo: 'texto' | 'especial'; insertar: (editor: Editor) => void };
ITEMS: ItemDeInsercion[]                // Párrafo, Título 2/3/4, Cita, Lista con viñetas, Lista numerada, Imagen, Galería, Llamada a la acción, Video, Código, Separador
filtrarItems(consulta: string): ItemDeInsercion[]   // sin tildes ni mayúsculas, por nombre y descripción
```

- Una sola lista para «/», para «Insertar» y para el botón de la línea vacía (RF-005). `role="listbox"`; "Sin resultados" si no hay coincidencias; Enter sin coincidencias no cambia nada.
- Dos modelos de foco, definidos en [atajos.md](atajos.md): desde `/` el foco queda en el lienzo (`aria-activedescendant`); desde «Insertar» el foco entra al listbox y vuelve al lienzo al cerrar. **No usa `useDesplegable`** (ese hook cierra al mover el foco).
- La ventana se posiciona con `@floating-ui/dom` usando `visualViewport` (con el teclado virtual abierto aparece por encima del cursor).

## `lib/menu-teclado.ts` — nuevo

```ts
useMenuTeclado({ items, abierto, alCerrar, alElegir }): { propsDeContenedor, propsDeItem }
```

- Navegación con flechas, `Inicio`, `Fin`, escritura por letra (*typeahead*), `Enter`, `Esc` y cierre con `Tab`. Lo usan el menú de acciones, el selector de estilo de párrafo y «Insertar». Se apoya en `useDesplegable` solo para el clic fuera y el cierre al navegar.

## `AsaDeElemento` — nuevo

```ts
type Props = { editor: Editor };
```

- **Asa propia** (la de la librería se descartó en la Fase 0, research D17): una sola asa flotante que sigue al elemento activo (el que tiene el cursor o está seleccionado). Es para ratón y toque: botón con `tabindex=-1` y nombre "Acciones del elemento N, tipo"; arrastra y, al pulsarla, abre el mismo menú de acciones. El camino de teclado y de lector de pantalla es el botón «Acciones» de la barra.
- Ubicación: desde 768 px en un carril a la izquierda del lienzo de ancho `--tactil-min`; por debajo de 768 px aparece solo sobre el elemento activo, en su esquina superior derecha y sin carril permanente, para no restar ancho a un lienzo de unos 280 px. `touch-action: none` solo en el propio botón.
- El nodo no es arrastrable por sí mismo (`draggable=false`).
- El indicador de destino al arrastrar lleva texto ("Soltar aquí: posición 3 de 8") además de la línea de la librería; el desplazamiento automático respeta `prefers-reduced-motion`.

## `comandos.ts` y `proteger.ts` — nuevos

```ts
rangoDeElementos(estado: EditorState): { desde: number; hasta: number } | null   // solo en modo elementos
moverRango(direccion: -1 | 1): Command
duplicarRango(): Command
quitarRango(): Command
convertirElemento(tipo: TipoDeTexto, opciones?: { nivel?: 2 | 3 | 4 }): Command   // solo con un elemento
```

- Cada comando es **una transacción**: un Deshacer la revierte. Los extremos devuelven `false` sin cambiar nada. Los ids de los duplicados salen vacíos (se completan al serializar).
- `convertirElemento` avisa antes si pierde datos, según research D20 (actualizada): alineación al pasar a cita o lista, marcas al pasar a código, autor y fuente de una cita, ítems de una lista de varios; devuelve `{ pierde: string[] }` para que la interfaz confirme (RF-016).
- `proteger.ts` es un *plugin* con `filterTransaction`/`handleKeyDown`/`handleDrop`: **toda** vía que quite o mueva elementos (menú, atajo, `Supr`, cortar, escribir sobre la selección, arrastrar, `Mod+A` y borrar) pasa por el mismo control: bloquea quitar o mover un elemento con subida en curso, exige la confirmación de una imagen ya guardada y anuncia "Elemento quitado. Pulsa Ctrl+Z para deshacer".

## `PanelPropiedades` y `HojaPropiedades` — nuevos

```ts
type Props = {
  seleccion: SeleccionDelDocumento;
  errores: ErrorBloque[];
  alCambiar: (cambios: Partial<Bloque>) => void;   // updateAttributes del nodo seleccionado
  alCerrar?: () => void;                            // solo en la hoja
};
```

- `PanelPropiedades`: pestaña «Elemento» de la columna lateral desde 1280 px, con `role="tablist"`, `tab` y `tabpanel`. Sin selección: «Selecciona un elemento para editar sus propiedades». Con varios elementos: «3 elementos seleccionados».
- Muestra `EditorDeBloque` con el bloque del nodo (para los de texto, con `soloPropiedades`). El texto y los errores usan el mismo `aria-describedby` de hoy.
- `HojaPropiedades`: mismo contenido como `aside` no modal inferior para menos de 1280 px.
  - Se abre **solo** con «Propiedades» (barra), con «Propiedades» del menú de acciones o con `Enter` en modo elementos; nunca por tocar un elemento para desplazar la pantalla. Al abrir se anuncia el panel y **no roba el foco** salvo en las dos últimas formas.
  - Alto máximo 45 dvh y apilada **sobre** la barra fija de la 004 (la barra pasa a ocupar solo su alto propio); el lienzo gana un `scroll-margin-bottom` igual al alto de la hoja para que el elemento seleccionado y el foco no queden tapados; con el teclado virtual se usa `visualViewport` (y `interactive-widget=resizes-content`) y la hoja queda sobre el teclado.
  - Botón «Cerrar» y `Esc` (último en el orden de `Esc`).

## Nodos del documento (`nodos/*.tsx`)

- `ImagenNodo`, `GaleriaNodo`, `CtaNodo`, `VideoNodo`: vista React que llama a `Bloques` con un solo bloque y los `componentes` de la vista previa; nombre "Imagen, 3 de 8" en la isla; marca de error con **texto** cuando hay un error de validación; selección por contorno de 2 px, ícono de verificación y el panel; sus botones internos no se tabulan (ver atajos.md). `ImagenNodo` y `GaleriaNodo` vacíos muestran "Subir imagen" que abre el campo del panel. Con subida en curso muestran el texto del progreso y deshabilitan mover y quitar con `aria-disabled` y la razón.

## Cambios en `packages/ui`

- `clasesBoton`: la terciaria con `aria-pressed` suma un borde de marca (`aria-pressed:border-marca`) además del fondo `marca-suave`, para que el estado activo no dependa solo del tinte (WCAG 1.4.1 y 1.4.11; contraste del borde ≥ 3:1). `clases.test.ts` mide el contraste del borde y el texto. También mejora el conmutador «Mostrar contraseña» de la spec 004.
- Tokens nuevos: `--container-panel-propiedades` (ancho de la columna lateral), `--carril-asa` (igual a `--tactil-min`) y `--alto-hoja-propiedades` (45 dvh), definidos en `tokens.css`, sin valores sueltos.

## `MenuAcciones` y `AyudaAtajos` — nuevos

- `MenuAcciones`: el menú del botón «Acciones» de la barra y del asa (Subir, Bajar, Duplicar, Convertir en…, Quitar, Seleccionar, Propiedades y Atajos), con `useMenuTeclado`; las acciones no disponibles (extremos, varios elementos, subida en curso) llevan `aria-disabled` y la razón.
- `AyudaAtajos`: diálogo «Atajos de teclado» con foco inicial en su título y devolución del foco a «Acciones»; la lista sale de [atajos.md](atajos.md).

## `limites.ts` y `mapa-errores.ts` — nuevos (puros)

- `limites.ts`: cuenta de caracteres del **texto** de un elemento o de una celda (sin marcas), avisos al cruzar el 90 % y el 100 %, el máximo de 200 elementos y los de la tabla (10 columnas, 50 filas, 1000 caracteres por celda).
- `mapa-errores.ts`: agrupa los `ErrorElemento` por `id` y los ordena por posición en el documento.

## `EditorArticulo` y `reductor` — modificados

- La sección «Contenido» pasa a `EditorDocumento` + panel; la columna lateral gana las pestañas descritas arriba (con **Publicación** fuera de ellas).
- `alCambiar` despacha `{ tipo: 'contenido', valor }`; `guardado` y `adoptar_vigente` suben `reinicio`.
- Se eliminan las acciones por bloque, `ListaBloques`, `BarraMarcas` y `TextoConMarcas`.
- Terminología: los mensajes y los `aria-label` reutilizados de `anuncios.ts` dicen «elemento» (o el tipo) en lugar de «bloque».

## `editores de campos` — modificados

- `EditorTitulo`, `EditorCita`, `EditorLista`, `EditorCodigo`, `EditorParrafo`: prop `soloPropiedades` que oculta el campo de texto (se edita en el lienzo) y deja nivel, autor, fuente, tipo de lista y lenguaje.
- Los demás no cambian.

## Ampliación: componentes nuevos y modificados (2026-10-22)

### `packages/bloques`

| Pieza | Qué es |
|---|---|
| `esquema.ts` | `esquemaDocumento` (estricto), `Documento`, `Elemento`, `ElementoDe<T>`, `DatosDe<T>`; reutiliza `esquemaImagen` y los esquemas de campos de hoy |
| `validar.ts` | `validarDocumento(doc, { publicar }): ErrorElemento[]` (con `publicar`, también "La tabla no tiene contenido" y el requisito de contenido) |
| `normalizar.ts` | `normalizarDocumento(json): Documento` (forma canónica, idempotente) |
| `elementos.ts` | `TIPOS_ELEMENTO`, `crearElemento(tipo)`, `textoDeElemento(elemento)`, `datosDeElemento` y `elementoDesdeDatos` (adaptador para los editores de campos), `recorrer(doc, visitante)` |
| `tablas.ts` | `cuadricula(tabla)` (posiciones reales con `colspan` y `rowspan`), `esRectangulo(celdas)`, `limitesDeTabla`; los usan el esquema, el editor y el renderer |
| `imagenes-en-uso.ts` | `rutasDeImagenes(doc)` y `rutasQuitadas` recorren el documento |
| `render/Documento.tsx` | Reemplaza a `Bloques`: `<Documento contenido componentes />` con la misma prop `componentes` (la imagen de la web y de la vista previa) |
| `render/EnLinea.tsx` | Reemplaza a `TextoEnLinea`: pinta `Inline` con las nueve marcas y `hardBreak` |
| `render/Tabla.tsx` | Región con `max-w-full`, desplazamiento y sombras solo con CSS, foco con tokens; `caption` visible; `th scope="col"` y `headers`/`id` con `cuadricula()`; `colspan` y `rowspan` (research D27 y D31 U15) |
| `render/tipos.ts` | `ComponentesBloques` pasa a `ComponentesDocumento` |
| `render/clases.ts` | Suma las clases de `u`, `mark`, `s`, `sup`, `sub`, de alineación y de tabla, que usan el sitio y el lienzo |
| `conversion-anterior/` y `scripts/convertir-contenido.ts` | Solo hasta el corte (D25): `bloquesADocumento`, `documentoABloques`, `analizarEnLinea`, `partirParrafos`, `visibleDeBloques` y el esquema de bloques armado con los esquemas de campos de `esquema.ts`. No se exportan |

### `apps/admin`

| Pieza | Cambio |
|---|---|
| `extensiones.ts` | Nodos `imagen`, `galeria`, `cta` y `video` con `attrs` planos; `id` en lugar de `bloqueId`; sin `continuacion`; `underline`, `strike`, `link`, `Highlight`, `Subscript`, `Superscript`, `TextAlign` y la tabla con la configuración de research D23; atajos por defecto desactivados según D28 |
| `extensiones.test.ts` (nuevo) | Contrato: el esquema de ProseMirror coincide **exactamente** con la lista permitida |
| `BarraHerramientas` | Subrayado; menú «Alineación» (`menuitemradio`, muestra la vigente, `aria-disabled` con razón fuera de párrafos y títulos); «Más formato» (`menuitemcheckbox`: tachado, resaltado, código, superíndice, subíndice) con estado activo no solo de color; reglas de `aria-disabled` de [atajos.md](atajos.md) (código, celdas); se quita `estado.sinMarcas` de los títulos |
| `BarraTabla.tsx` (nuevo) | Barra contextual de la tabla (D29 y D31): fila dentro de la barra fija, visible con el cursor en una celda **o con la tabla seleccionada en el modo elementos** (actúa sobre la última celda o selección guardada); texto visible "Esc: salir de la tabla"; acciones con nombre, anuncio y `aria-disabled` con razón fija; «Combinar con la celda de la derecha» y «… de abajo»; se reacomoda con «Más»; por debajo de 768 px (ancho de la ventana) solo «Quitar tabla» y el texto de RF-029 |
| `documento/tablas.ts` (nuevo) | Comandos con las reglas propias: insertar y quitar filas y columnas con límites, combinar (rectángulo, sin mezclar encabezado y cuerpo), separar, fila de encabezado y quitar tabla por `proteger` |
| `PropiedadesDelElemento` | Alineación de párrafo y título; tabla: descripción (con el aviso no bloqueante "Agrega una descripción para los lectores de pantalla" si falta), fila de encabezado y las mismas acciones de la barra «Tabla» sobre la misma referencia de celda |
| `nodos/NodoBloque.tsx` | Dibuja el elemento especial con `Documento` (o el componente del elemento) en lugar de `Bloques` |
| `documento/esquema-prueba.ts` | Solo constructores de nodos sobre `getSchema(extensiones)` (sin esquema a mano) |
| `menu-insercion.ts`, `MenuInsertar` | Ítem «Tabla» (3 × 3 con encabezado) |
| `pegado.ts` | Tablas pegadas dentro o fuera de los límites (D28) |
