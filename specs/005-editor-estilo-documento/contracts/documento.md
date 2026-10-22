# Contrato: el documento guardado (lista permitida)

**Spec**: [../spec.md](../spec.md) (RF-009, RF-022, RF-024, RF-025, RF-028) | **Decisiones**: [../research.md](../research.md) D22 a D27 | **Constitución**: §VI (2.0.0)

`articulos.contenido` guarda un documento JSON con la forma del de Tiptap/ProseMirror. Este contrato es la **lista permitida**: lo que no figura acá se rechaza. La define una sola vez `esquemaDocumento` (Zod) en `packages/bloques/src/esquema.ts`; las extensiones del editor, el renderer del sitio, la extracción de texto para la búsqueda y la de imágenes en uso se derivan de ella (§VI.3 y §VI.5).

## Forma general

```text
Documento  = { type: "doc", content: Elemento[] }            0 a 200 elementos
Elemento   = { type, attrs: { id: uuid, ...propios }, content? }
Texto      = { type: "text", text: string (≥ 1 carácter), marks?: Marca[] }
Marca      = { type, attrs? }
```

- **Nombres**: los nodos y marcas que trae la librería conservan su nombre (`paragraph`, `heading`, `bold`…), que §XII admite como términos del framework; los nodos propios tienen nombre en español (`imagen`, `galeria`, `cta`, `video`). Los atributos propios van en español (`autor`, `fuente`, `lenguaje`, `descripcion`); los de la librería, con su nombre (`level`, `textAlign`, `colspan`, `rowspan`, `href`).
- **Forma canónica** (D24): sin atributos `null` ni con su valor por defecto, sin `marks: []`, sin `content: []` salvo en el documento vacío, sin nodos de texto vacíos, sin dos textos contiguos con las mismas marcas y con las marcas en el orden de la tabla de marcas. `normalizarDocumento` la produce y es idempotente; el servidor guarda lo que el editor envía ya normalizado y lo valida estricto (objetos `strict`: una clave de más es un error).
- **Sin párrafos vacíos en el primer nivel**: un `paragraph` sin texto de primer nivel no se guarda (como hoy, un párrafo vacío no era un bloque). Dentro de una celda sí puede haber un párrafo vacío (una celda vacía es un `paragraph` sin `content`).

## Elementos (primer nivel)

| `type` | `attrs` propios | `content` | Límites y reglas |
|---|---|---|---|
| `paragraph` | `textAlign?` | Inline | 1 a 5000 caracteres de texto (sin contar marcas); `hardBreak` permitido |
| `heading` | `level` (2, 3 o 4), `textAlign?` | Inline sin `hardBreak` | 1 a 150 caracteres |
| `bulletList`, `orderedList` | — | 1 a 50 `listItem`, cada uno con **un** `paragraph` (sin `textAlign`) | 1 a 500 caracteres por ítem; sin anidar |
| `blockquote` | `autor?` (1 a 120), `fuente?` (URL https) | **un** `paragraph` (sin `textAlign`) | 1 a 1000 caracteres |
| `codeBlock` | `lenguaje?` (`^[a-z0-9+#-]{1,20}$`) | 0 o 1 `text` **sin marcas** | 0 a 20 000 caracteres |
| `horizontalRule` | — | — | — |
| `table` | `descripcion?` (1 a 150) | 1 a 50 `tableRow` | Ver "Tablas" |
| `imagen` | `imagen` (`esquemaImagen`), `leyenda?` (0 a 300) | — | Como el bloque `imagen` de hoy |
| `galeria` | `imagenes` (2 a 24 de `esquemaImagen`), `columnas` (2, 3 o 4) | — | Como el bloque `galeria` de hoy |
| `cta` | `titulo`, `texto?`, `etiquetaBoton`, `url`, `variante?` | — | Como el bloque `cta` de hoy |
| `video` | `proveedor`, `idVideo`, `titulo` | — | Como el bloque `video` de hoy |

Todos los elementos llevan `attrs.id` (uuid), único en el documento. Los esquemas de los campos de `imagen`, `galeria`, `cta`, `video`, de la cita (`autor`, `fuente`), del nivel de título y del lenguaje de código **son los mismos de hoy** (se reutilizan, no se copian): sus mensajes de error no cambian.

`textAlign` admite `"center"`, `"right"` o `"justify"`; la izquierda es la ausencia del atributo (nunca se guarda `"left"`).

## Inline

`Inline` = secuencia de `Texto` y `{ type: "hardBreak" }` (solo en `paragraph` y en los párrafos de las celdas).

| Marca | `attrs` | Reglas |
|---|---|---|
| `link` | `href` | `hrefSeguro` de hoy (ruta interna, `http(s)://` o `mailto:`); `target`, `rel` y `class` se quitan del esquema del editor y se ponen al dibujar |
| `bold`, `italic`, `underline`, `strike` | — | Se combinan entre sí y con `link` y `highlight` |
| `highlight` | — | Un solo color, el del sitio (sin `color`) |
| `code` | — | **Excluye** cualquier otra marca en el mismo texto |
| `superscript`, `subscript` | — | Se excluyen entre sí |

Orden canónico de las marcas en `marks`: `link`, `bold`, `italic`, `underline`, `strike`, `highlight`, `code`, `superscript`, `subscript`.

## Tablas

```text
table      = { type: "table", attrs: { id, descripcion? }, content: tableRow[] }
tableRow   = { type: "tableRow", content: (tableHeader | tableCell)[] }
celda      = { type: "tableHeader" | "tableCell", attrs?: { colspan?, rowspan? }, content: paragraph[] }
```

- **Cuadrícula regular**: sumando `colspan` y `rowspan`, todas las filas cubren el mismo número de columnas (1 a 10) y ninguna celda se superpone ni queda un hueco. `colspan` y `rowspan` ≥ 2 cuando están (1 es la ausencia).
- **Fila de encabezado**: es la primera fila cuando **todas** sus celdas son `tableHeader`. `tableHeader` solo puede estar en la primera fila (no hay columna de encabezado). Una celda combinada no puede abarcar la fila de encabezado y el cuerpo (`rowspan` de un `tableHeader` = 1).
- **Celdas**: 1 o más `paragraph` sin `textAlign`; hasta 1000 caracteres en total por celda (todos sus párrafos); una celda puede estar vacía (`paragraph` sin `content`). Sin listas, imágenes ni otros elementos.
- **Publicar**: una tabla sin texto en ninguna celda es un error al publicar ("La tabla no tiene contenido"); un borrador la admite.
- No se guardan anchos de columna: `colwidth` se quita del esquema del editor y el sitio reparte el ancho. En el `codeBlock`, el `language` de la librería también se quita: queda solo `lenguaje`.

## Errores

`validarDocumento(doc)` devuelve `ErrorElemento[]` = `{ indice, id, campo, mensaje }`: `indice` es la posición del elemento en `content` (desde 0; −1 para la imagen destacada, como hoy), `id` su `attrs.id` y `campo` un nombre estable (`texto`, `imagen.alt`, `celda.2.3`, `descripcion`…) que `nombreDeCampo` traduce a palabras de la persona ("Celda de la fila 2, columna 3"). El editor marca el elemento por `id`.

## Base de datos (forma mínima, §VI.4)

`privado.contenido_valido(contenido)` comprueba solo la forma: objeto con `type = 'doc'`, `content` arreglo de hasta 200 objetos con `type` dentro de `privado.tipos_elemento()` y `attrs.id` de tipo texto. El detalle lo valida el servidor con `esquemaDocumento` antes de guardar. Ver [../data-model.md](../data-model.md).

## Correspondencia con el formato anterior (solo para la conversión)

La conversión (D25) usa `bloquesADocumento` y `documentoABloques`, que ya existen en `apps/admin/src/componentes/editor/documento/conversion.ts` con sus pruebas de ida y vuelta, adaptados a esta forma:

| Bloque anterior | Elemento |
|---|---|
| `parrafo` (un tramo por cada línea en blanco; salto simple = `hardBreak`) | uno o más `paragraph`; el primero conserva el `id` del bloque y los siguientes reciben uno derivado (`uuid v5` del id y el número de tramo, así la conversión es repetible) |
| `titulo` | `heading` con `level` |
| `cita` | `blockquote` con `autor` y `fuente` |
| `lista` | `bulletList` u `orderedList` |
| `codigo` | `codeBlock` con `lenguaje` |
| `separador` | `horizontalRule` |
| `imagen`, `galeria`, `cta`, `video` | el nodo del mismo nombre con los campos del bloque como `attrs` |
| `**x**`, `_x_`, `` `x` ``, `[x](u)` | marcas `bold`, `italic`, `code`, `link` (con `analizarEnLinea`, el analizador del sitio de hoy) |

**Verificación de ida y vuelta**: para cada artículo, `documentoABloques(bloquesADocumento(c))` es igual a `c` (salvo que los tramos de un párrafo vuelven a unirse con su separador exacto) y el texto visible, las anclas de los títulos, las imágenes y los enlaces que muestra el renderer nuevo son los que mostraba el anterior (prueba de caracterización, D26).
