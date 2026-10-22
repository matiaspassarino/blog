# Contrato: correspondencia entre el documento y los bloques

**Spec**: RF-004, RF-009, RF-012, RF-015 | **Pruebas**: `documento/conversion.test.ts`, `packages/bloques/src/en-linea.test.ts`, `packages/bloques/src/parrafos.test.ts`

Las dos funciones puras que conectan el editor con el contenido guardado. No importan React ni la librería: trabajan con JSON.

## `analizarEnLinea` y `serializarEnLinea` (`@blog/bloques`) — nuevo

```ts
type NodoEnLinea =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrita' | 'cursiva'; hijos: NodoEnLinea[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'enlace'; href: string; hijos: NodoEnLinea[] };

analizarEnLinea(texto: string): NodoEnLinea[]
serializarEnLinea(nodos: NodoEnLinea[]): string
```

- `analizarEnLinea` aplica las reglas de hoy de `TextoEnLinea`: `**negrita**`, `_cursiva_` (no abre dentro de una palabra), `` `código` `` y `[texto](url)` (la URL balancea paréntesis); el interior de negrita y cursiva no empieza ni termina con espacio; una marca sin cerrar queda como texto.
- `serializarEnLinea(analizarEnLinea(x)) === x` para todo `x` (la salida del analizador siempre se serializa de vuelta).
- `normalizarMarcas(nodos)` deja el árbol en una forma que el sitio sabe leer: mueve los espacios de los bordes fuera del marcador (`**palabra **` → `**palabra** `), parte las marcas que se cruzan en tramos bien anidados y degrada a texto plano lo que la gramática no puede expresar (cursiva a mitad de palabra, código que contiene una comilla invertida, etiqueta de enlace con `](`). Para todo árbol `n`: `analizarEnLinea(serializarEnLinea(n))` es igual a `normalizarMarcas(n)`.
- Texto plano que al serializarse se volvería a leer como marca: se inserta U+200B después del primer carácter de la marca (research D3). Solo afecta a texto que **no** viene del analizador.
- `TextoEnLinea` y `textoPlano` usan este árbol; la salida HTML del sitio no cambia.

## `partirParrafos` y `unirParrafos` (`@blog/bloques`) — nuevos

```ts
partirParrafos(texto: string): { texto: string; separador: string }[]   // el separador es la secuencia exacta de saltos de línea que sigue al tramo anterior ("" en el primero)
unirParrafos(tramos: { texto: string; separador: string }[]): string
```

- `unirParrafos(partirParrafos(x)) === x` para todo `x`, incluidos `A\n\n\nB`, `A\n\n` y tramos de solo espacios. `Parrafo.tsx` los usa (y descarta al pintar los tramos en blanco, como hoy).

## `bloquesADocumento(contenido): JSONContent`

Devuelve `{ type: 'doc', content: [...] }`. Siempre hay al menos un párrafo (un contenido vacío da un párrafo vacío).

| Bloque | Resultado |
|---|---|
| `parrafo` con `texto` | `paragraph` por cada tramo de `partirParrafos`; el primero con `bloqueId = id`, los siguientes con `bloqueId = id` y `continuacion = <separador exacto>`; los saltos simples pasan a `hardBreak`; el texto de cada tramo pasa por `analizarEnLinea` → `text` con marcas `bold`, `italic`, `code`, `link`; un tramo vacío es un `paragraph` sin hijos (ProseMirror no admite `text` vacío) y uno de solo espacios conserva ese texto |
| `titulo` | `heading` con `level` y el texto sin marcas |
| `cita` | `blockquote` con `autor`, `fuente` y un `paragraph` con el texto en línea |
| `lista` | `bulletList` u `orderedList`; cada ítem es un `listItem` con un `paragraph` en línea |
| `codigo` | `codeBlock` con `lenguaje` y el texto sin marcas |
| `separador` | `horizontalRule` |
| `imagen`, `galeria`, `cta`, `video` | nodo del mismo nombre (`imagenBloque`, …) con `bloque` completo |

Todos los de primer nivel llevan `bloqueId = bloque.id`.

## `documentoABloques(doc): Contenido`

Inversa de la anterior, nodo por nodo:

- `paragraph`: el texto en línea se normaliza (`normalizarMarcas`) y se serializa con `serializarEnLinea`; los `paragraph` con `continuacion` se unen al bloque anterior con `unirParrafos` y su separador exacto; `hardBreak` → `"\n"`. Un `paragraph` con `continuacion` **vacío** se conserva (aporta el separador). Un párrafo vacío de primer nivel **no genera bloque**, salvo que sea el único del documento (documento vacío → contenido `[]`).
- `heading`, `blockquote`, listas, `codeBlock`, `horizontalRule` y los nodos especiales: se arman con los campos del esquema (`nivel`, `autor`, `fuente`, `ordenada`, `items`, `codigo`, `lenguaje`, `bloque`).
- `bloqueId` vacío: no ocurre en el flujo normal, porque el plugin `asignarIds` asigna un uuid una sola vez y deduplica los repetidos; `documentoABloques` es **pura** y falla si encuentra un id vacío (no genera ids, para que sean estables entre transacciones). Los ids existentes se conservan.
- Campos opcionales vacíos (`autor`, `fuente`, `lenguaje`, `leyenda`) se omiten, como hoy (no se guarda `""`).
- No valida: la validación es la de `validarEditor`/`esquemaContenido` al guardar.

## Reglas de ida y vuelta

1. Para todo contenido válido `c`: `documentoABloques(bloquesADocumento(c))` es igual a `c` (mismo orden, ids y campos).
2. Abrir un artículo y no tocarlo no ensucia: el contenido convertido es igual al guardado.
3. Un párrafo nuevo (Enter) es un bloque nuevo con `id` nuevo (no hereda `bloqueId` ni `continuacion`); dos párrafos pegados son dos bloques; los ids no viajan por el portapapeles, así copiar y pegar nunca duplica ids.
4. Un ítem de lista o una cita con `\n` guardado se conserva (se muestra como salto de línea en el editor); el editor no ofrece crear saltos simples en ítems ni en citas.
5. Para todo árbol de marcas `n`, lo que el editor muestra es lo que el sitio mostrará: el editor aplica `normalizarMarcas` al documento (en una transacción sin historial) antes de que el texto llegue a guardarse.
