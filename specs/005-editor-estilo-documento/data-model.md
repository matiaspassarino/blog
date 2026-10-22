# Modelo de datos: Editor de notas estilo documento

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Decisiones**: [research.md](research.md) | **Contrato del documento**: [contracts/documento.md](contracts/documento.md)

Con la constitución 2.0.0 (§VI), `articulos.contenido` deja de ser la lista de bloques y pasa a ser el **documento**. Esta spec agrega **una migración** y una **conversión** de los artículos existentes (local y nube, RF-023 y RF-030). No se agregan tablas, columnas, índices ni políticas.

## Base de datos

### Migración `20261023120000_contenido_documento.sql`

Una sola migración (una por historia: la H5 es la que cambia el formato). Funciones con `set search_path = ''` y nombres calificados; privilegios explícitos (research D20 de la 001): cada función nueva lleva `revoke all … from public, anon, authenticated` y solo el `grant execute` que figura abajo.

| Objeto | Cambio | Privilegios |
|---|---|---|
| `privado.tipos_bloque()` | Se **elimina** (`drop function`) y la reemplaza `privado.tipos_elemento()` | — |
| `privado.tipos_elemento()` (nueva, `immutable`) | `text[]` con los tipos de primer nivel de [contracts/documento.md](contracts/documento.md): `paragraph`, `heading`, `bulletList`, `orderedList`, `blockquote`, `codeBlock`, `horizontalRule`, `table`, `imagen`, `galeria`, `cta`, `video` | sin `grant` (solo la usan funciones de `privado`) |
| `privado.contenido_valido(jsonb)` | `create or replace`: objeto con `type = 'doc'`, `content` arreglo de 0 a 200 objetos, cada uno con `type` en `privado.tipos_elemento()` y `attrs.id` de tipo texto. Lo usa el `check` de la columna (`articulos_contenido_check`), que no cambia de nombre | igual que hoy |
| `privado.documento_tiene_contenido(jsonb)` (nueva, `immutable`) | Cierto si hay al menos un elemento que no sea un `paragraph` sin texto (la regla de hoy: un publicado necesita contenido). Una `table` sin texto en ninguna celda no cuenta | sin `grant` |
| `articulos_requisitos_publicacion` (check) | Se recrea (`drop constraint` + `add constraint … not valid`) con `privado.documento_tiene_contenido(contenido)` en lugar de `jsonb_array_length(contenido) > 0`. Al final de la migración se valida (`validate constraint`) **solo si** no queda ningún artículo con `jsonb_typeof(contenido) = 'array'`; si quedan (la nube antes de la conversión), lo valida el SQL de la conversión | — |
| Trigger `a40_validar_estado` (función de `estados_y_publicacion.sql`) | `create or replace` de la función: el chequeo de `requisitos_publicacion` usa `privado.documento_tiene_contenido` | — |
| Columna `articulos.contenido` | `alter column … set default '{"type":"doc","content":[]}'` | — |
| `privado.bloques_a_texto(jsonb)` | Se **elimina** y la reemplaza `privado.documento_a_texto(jsonb)` | — |
| `privado.documento_a_texto(jsonb)` (nueva, `immutable`) | Texto indexable del documento en orden de lectura: el texto de todos los nodos `text` **salvo** los de `codeBlock` (como hoy, sin el código), más `attrs.autor` de las citas, `imagen.alt` y `leyenda` de las imágenes, el `alt` de las imágenes de la galería, `titulo` y `texto` de la llamada a la acción, `titulo` del video y `descripcion` de la tabla. Las URL de los enlaces no entran (son atributos). Se trunca a 200 000 caracteres como hoy. Con `jsonb_path_query` (`strict $.**.text`) sobre cada elemento que no es `codeBlock` | sin `grant` |
| `privado.calcular_busqueda()` (trigger `a50_calcular_busqueda`) | `create or replace`: usa `privado.documento_a_texto` | igual que hoy |
| `public.rutas_en_uso` | **Sin cambios**: busca la ruta como texto dentro de `contenido::text`, así que vale para los dos formatos | — |

**Orden de los triggers**: no se agregan triggers; los `a30_controlar_version`, `a50_calcular_busqueda`, `a90_actualizado_en` y `z90_notificar_*` siguen como están. Después de la migración, `pnpm db:reset && pnpm db:tipos` (los tipos no cambian de forma: `contenido` sigue siendo `Json`, pero se regenera y se commitea igual).

**Lo que la migración NO hace**: convertir los artículos existentes. La conversión necesita el analizador en línea del sitio (TypeScript) para no perder marcas; reescribirlo en PL/pgSQL sería una segunda gramática (§VI.3, §VIII.3). Ver "Conversión" abajo.

### Conversión de los artículos existentes (RF-023, RF-030)

Un script de un solo uso, `packages/bloques/scripts/convertir-contenido.ts` (se corre con Node 24 y un cargador propio para los imports sin extensión, research D25), que **no se conecta a ninguna base** (D25):

1. **Entrada**: un JSON con `[{ id, version, contenido }]` de todos los artículos, exportado con una consulta (`select json_agg(…) from public.articulos`) desde el SQL Editor, el MCP de Supabase o `psql` local.
2. **Conversión y verificación**: para cada artículo, `bloquesADocumento`, `validarDocumento` (estricto), la ida y vuelta (`documentoABloques`) y la comparación del texto visible, las anclas, las imágenes y los enlaces con lo que mostraba el renderer anterior (D26). Si **un** artículo falla, el script termina con error, indica cuál y por qué, y **no genera nada** (todo o nada, sin copia del contenido anterior: aclaración del 2026-10-22). Un artículo que ya es un documento se deja igual (repetible).
3. **Salida**: un SQL de una sola transacción que:
   - desactiva `a30_controlar_version`, `a90_actualizado_en` y los `z90_notificar_*` de `articulos` (la versión y la fecha no cambian y el sitio no recibe avisos; `a50_calcular_busqueda` queda activo y recalcula la búsqueda con `documento_a_texto`);
   - hace un `update … set contenido = … where id = … and version = …` por artículo (si alguien guardó en el medio, la fila no coincide);
   - comprueba que se actualizó exactamente la cantidad esperada y que no queda ningún `contenido` de tipo `array`; si no, `raise exception` y se revierte todo;
   - valida `articulos_requisitos_publicacion` y vuelve a activar los triggers.
4. **Dónde se aplica**: en local no hace falta (el `seed.sql` ya queda en el formato nuevo y `db:reset` corre la migración con la tabla vacía); en una base local con datos propios, con `psql`; en la nube, en el **corte coordinado** del cierre (RF-030), con el SQL Editor o el MCP, verificando antes que la URL tenga `kgavzwzlhbzjkvreqhbu`.
5. **Después del corte**: el script, `conversion-anterior/` y sus pruebas se eliminan en el último commit del PR (RF-030: no queda código que lea el formato anterior).

### `seed.sql`

Se reescriben las funciones `pg_temp.*` para que devuelvan elementos del documento (`pg_temp.parrafo`, `pg_temp.titulo`, `pg_temp.cita`…), se agregan `pg_temp.texto(texto, marcas)` para los seis tramos con formato que hoy usan marcadores y `pg_temp.tabla(…)`, y cada artículo arma su `contenido` como `jsonb_build_object('type', 'doc', 'content', jsonb_build_array(…))`. Se suma al seed **un artículo publicado** con los formatos nuevos, las cuatro alineaciones y una tabla con celdas combinadas (para CE-008 y la búsqueda de RF-027). Los ids de los elementos son fijos (uuid literales) para que las pruebas sean repetibles.

### Pruebas pgTAP (§V.2 y §IX.4)

| Archivo | Qué prueba |
|---|---|
| `supabase/tests/contenido_documento.test.sql` (nuevo) | `privado.contenido_valido`: acepta el documento vacío y uno con los doce tipos; rechaza un arreglo (formato anterior), un `type` distinto de `doc`, más de 200 elementos, un tipo desconocido y un elemento sin `attrs.id`. `privado.documento_tiene_contenido`: documento vacío, solo párrafos vacíos y tabla sin texto → falso; un párrafo, una imagen o una tabla con texto → cierto. `privado.tipos_elemento` y `privado.documento_a_texto` (incluye celdas y descripción de tablas y `autor`, excluye el código y las URL) |
| `supabase/tests/busqueda.test.sql` | Se adaptan los contenidos al documento; nuevo: encuentra un artículo por una palabra de una celda de tabla (RF-027) |
| `supabase/tests/articulos_publicacion.test.sql`, `validaciones.test.sql`, `seed.test.sql`, `programacion.test.sql`, `notificaciones.test.sql`, `panel_admin.test.sql` y los demás que arman `contenido` | Se adaptan los contenidos de prueba al documento; los casos de "publicado sin contenido" usan el documento vacío y uno con solo párrafos vacíos |
| `supabase/tests/privilegios.test.sql` | Las funciones nuevas sin `execute` para `anon` ni `authenticated`; `tipos_bloque` y `bloques_a_texto` ya no existen |
| `supabase/tests/conversion.test.sql` (nuevo) | Con un artículo en el formato anterior insertado tras quitar el check dentro de la transacción de la prueba, y una muestra del SQL que genera el script (copiada como *fixture*): la versión y `actualizado_en` no cambian, no se encola ningún aviso, la búsqueda se recalcula y, si la versión no coincide, la transacción se revierte entera |

## Modelo del documento

El detalle de la lista permitida está en [contracts/documento.md](contracts/documento.md). Tipos en `packages/bloques`:

| Tipo | Qué es |
|---|---|
| `Documento` | `z.infer<typeof esquemaDocumento>`: `{ type: 'doc', content: Elemento[] }` |
| `Elemento`, `ElementoDe<T>` | Unión discriminada por `type` de los doce elementos de primer nivel |
| `Inline`, `Texto`, `Marca` | Contenido en línea y sus marcas |
| `ErrorElemento` | `{ indice, id, campo, mensaje }` (reemplaza a `ErrorBloque`) |
| `DatosDe<T>` | Los `attrs` de un elemento especial (`imagen`, `galeria`, `cta`, `video`), que reciben los editores de campos de hoy |

## Estado del editor

`EstadoEditor` (reductor de la spec 003) cambia solo el tipo de `datos.contenido`: de `Contenido` (bloques) a `Documento`. Las acciones son las de hoy (`campo`, `sugerir_slug`, `contenido`, `guardado`, `adoptar_vigente`); `contenido` recibe el documento **normalizado** (D24). `guardado` no toca el documento vivo; solo la carga inicial y `adoptar_vigente` lo recrean (D6 y D11, sin cambios).

Estado solo de la interfaz (no va al reductor ni se guarda): selección actual (texto, celdas o modo elementos), pestaña del panel, hoja abierta o cerrada, menú abierto y consulta del menú «/», elemento que se arrastra.

## Reglas de integridad

| Regla | Dónde se comprueba |
|---|---|
| Todo documento que guarda el editor cumple `esquemaDocumento` (estricto) | `validarDocumento` en el navegador y en la Server Action, antes de escribir (RF-022) |
| `normalizarDocumento` es idempotente y `normalizarDocumento(editor(d)) = d` para todo documento canónico `d` (abrir y guardar sin tocar no cambia nada, RF-012) | `normalizar.test.ts` (propiedades) y E2E |
| La base rechaza un `contenido` que no tiene la forma mínima (también el formato anterior) | `privado.contenido_valido` + pgTAP |
| Un publicado tiene al menos un elemento con contenido | `articulos_requisitos_publicacion`, `a40_validar_estado` + pgTAP |
| Los ids de los elementos son únicos y estables | `esquemaDocumento` (unicidad), plugin `asignarIds` y `ids.test.ts` |
| Las tablas tienen cuadrícula regular, encabezado solo en la primera fila y límites de filas, columnas y caracteres | `esquemaDocumento` (refinamiento de tabla) y `tablas.test.ts` |
| La conversión no pierde nada y es repetible | `conversion-anterior/*.test.ts` sobre el corpus y el seed, y la verificación del script sobre los datos reales (D25 y D26) |
| El sitio muestra todo lo que la lista permite y nada más | `render/documento.test.tsx` (cada nodo y marca) y `seguridad.test.tsx` (nada de HTML) |
