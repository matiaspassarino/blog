# Modelo de datos: Editor de notas estilo documento

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Decisiones**: [research.md](research.md)

## Base de datos

**Sin cambios.** La feature no agrega migraciones, tablas, columnas, índices, políticas RLS, funciones, triggers ni cambios en `seed.sql`. `articulos.contenido` sigue guardando la lista de bloques validada por `esquemaContenido` de `packages/bloques` (hasta 200 bloques). No hace falta regenerar `packages/db/src/tipos.ts` ni consultar a `arquitecto-db` (§X).

## Modelo de presentación

Conceptos de interfaz. No se guardan; se definen acá para que el plan, los contratos y las pruebas usen los mismos nombres.

### Documento y elemento

| Concepto | Definición |
|---|---|
| Documento | Lo que ve y escribe la persona en el lienzo. En memoria es un documento de ProseMirror; cada cambio se convierte a la lista de bloques y llega al reductor. |
| Elemento | Cada hijo de primer nivel del documento. Un elemento corresponde a **un** bloque, salvo los párrafos con continuación (D4 del research), que comparten el bloque del párrafo anterior. |
| Elemento especial | Imagen, galería, llamada a la acción o video: nodo atómico con el bloque entero como atributo. |
| Selección | Un cursor o un rango de **texto** (aunque cruce párrafos: sirve para dar formato), o el **modo elementos** (uno o varios elementos seleccionados con `Esc`, Shift + clic sobre el asa o «Seleccionar»). Mover, duplicar, quitar y convertir actúan solo en modo elementos. |
| Panel de propiedades | Muestra los campos del elemento seleccionado. Con varios elementos seleccionados no muestra campos (muestra la cantidad). |

### Atributos de los nodos

| Nodo | Atributos | Notas |
|---|---|---|
| Todos los de primer nivel | `bloqueId` (uuid o vacío) | Vacío solo un instante en un elemento recién creado: el plugin `asignarIds` le asigna un uuid **una sola vez** y deduplica los repetidos. No se copia al dividir con Enter ni al portapapeles. |
| `paragraph` | `continuacion` (texto o vacío) | El separador exacto (`"\n\n"`, `"\n\n\n"`…) en el segundo tramo en adelante de un párrafo guardado con líneas en blanco; vacío en los demás. No se copia al dividir ni al portapapeles. |
| `heading` | `level` (2, 3 o 4) | Sin marcas. |
| `blockquote` | `autor`, `fuente` | Un solo párrafo dentro; `fuente` es una URL `https`. |
| `orderedList` / `bulletList` | — | La ordenada ↔ `ordenada: true`. Ítems de un solo párrafo, sin anidar. |
| `codeBlock` | `lenguaje` | Sin marcas. |
| `horizontalRule` | — | Separador. |
| `imagenBloque`, `galeriaBloque`, `ctaBloque`, `videoBloque` | `bloque` (objeto del esquema) | El tipo del nodo coincide con `bloque.tipo`. |

### Estado del editor

`EstadoEditor` (reductor de la spec 003) **no cambia de forma**: `datos.contenido` sigue siendo la lista de bloques. Cambian las acciones:

| Acción | Antes | Ahora |
|---|---|---|
| Cambiar el contenido | `agregar_bloque`, `mover_bloque`, `duplicar_bloque`, `quitar_bloque`, `actualizar_bloque` | `{ tipo: 'contenido', valor: Contenido }` (el editor convierte el documento y despacha) |
| `campo`, `sugerir_slug`, `guardado`, `adoptar_vigente` | igual | igual. **`guardado` no toca el documento** (también se despacha al publicar o archivar); solo la carga inicial y `adoptar_vigente` suben `reinicio` y recrean el documento con su historial (D6 y D11) |

Estado solo de la interfaz (no va al reductor ni se guarda): selección actual, pestaña del panel («Artículo» o «Elemento»), hoja abierta o cerrada en pantallas angostas, menú abierto y consulta del menú «/», elemento que se arrastra.

### Reglas de integridad

| Regla | Dónde se comprueba |
|---|---|
| `documentoABloques(bloquesADocumento(c))` es igual a `c` para todo contenido válido (ids, orden y campos), incluidos los párrafos con varias líneas en blanco, los tramos vacíos y los textos con marcas propias | `conversion.test.ts` (CE-002) |
| `unirParrafos(partirParrafos(x))` es igual a `x` para todo texto | `parrafos.test.ts` |
| `analizarEnLinea(serializarEnLinea(n))` es igual a `normalizarMarcas(n)` para todo árbol de marcas | `en-linea.test.ts` |
| Los errores y los cambios de propiedades apuntan al elemento por `bloqueId`, no por posición | `conversion.test.ts`, `ids.test.ts` y E2E |
| `serializarEnLinea(analizarEnLinea(x))` es igual a `x` para todo texto | `en-linea.test.ts` |
| El documento nunca queda sin un párrafo | extensión del documento (`content: 'block+'` y `TrailingNode`) |
| Un título tiene nivel 2, 3 o 4 y no lleva marcas | esquema de la librería |
| Cada bloque convertido cumple `esquemaBloque` (límites incluidos) | `validarEditor` al guardar, como hoy |

Estas reglas son la correspondencia completa del documento con el esquema; el detalle campo por campo está en [contracts/documento.md](contracts/documento.md).
