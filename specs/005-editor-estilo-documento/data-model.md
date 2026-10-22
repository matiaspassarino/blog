# Modelo de datos: Editor de notas estilo documento

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Decisiones**: [research.md](research.md) | **Contrato del documento**: [contracts/documento.md](contracts/documento.md)

Con la constitución 2.0.0 (§VI), `articulos.contenido` deja de ser la lista de bloques y pasa a ser el **documento**. Esta spec agrega **una migración** y una **conversión** de los artículos existentes (local y nube, RF-023 y RF-030). No se agregan tablas, columnas, índices ni políticas. Revisado por `arquitecto-db` el 2026-10-22 (CAMBIOS REQUERIDOS, incorporados: ver research D31).

## Base de datos

### Migración `20261023120000_contenido_documento.sql`

Una sola migración (una por historia: la H5 es la que cambia el formato). Funciones con `set search_path = ''` y nombres calificados. **Orden dentro del archivo**: primero los `create` y `create or replace`, después los `drop` (los cuerpos SQL y PL/pgSQL no registran dependencias: un `drop` temprano no falla y el error aparecería recién al guardar).

| # | Objeto | Cambio |
|---|---|---|
| 1 | `privado.tipos_elemento()` (nueva, `immutable`) | `text[]` con los tipos de primer nivel: `paragraph`, `heading`, `bulletList`, `orderedList`, `blockquote`, `codeBlock`, `horizontalRule`, `table`, `imagen`, `galeria`, `cta`, `video` |
| 2 | `privado.contenido_valido(jsonb)` | `create or replace`: objeto con `type = 'doc'`, `content` arreglo de 0 a 200 objetos, cada uno con `type` en `privado.tipos_elemento()` y `attrs.id` de tipo texto. Termina en `coalesce(…, false)` (un check que da NULL se considera cumplido); con un arreglo o algo que no es objeto devuelve `false` sin error |
| 3 | `privado.documento_tiene_contenido(jsonb)` (nueva, `immutable`) | Cierto si hay al menos un elemento que no sea un `paragraph` sin texto; una `table` sin texto en ninguna celda no cuenta. `coalesce(…, false)`; `false` sin error con un arreglo |
| 4 | `privado.documento_a_texto(jsonb)` (nueva, `immutable`) | Texto indexable en **orden de lectura**: `jsonb_array_elements(…) with ordinality` sobre `content` (con `case when jsonb_typeof(contenido -> 'content') = 'array'`, así un arreglo da `''`), y por elemento que no es `codeBlock`, `jsonb_path_query(elemento, 'strict $.**.text ? (@.type() == "string")')`, unido con `string_agg(… order by …)`. Los textos de un mismo párrafo se unen sin espacio y el `hardBreak` cuenta como espacio (no se parte una palabra con marca parcial). Suma `attrs.autor` de las citas, `imagen.alt` y `leyenda`, el `alt` de las imágenes de la galería, `titulo` y `texto` de la llamada a la acción, `titulo` del video y `descripcion` de la tabla. Sin las URL. Truncado a 200 000 caracteres |
| 5 | `privado.calcular_busqueda()` (trigger `a50_calcular_busqueda`) | `create or replace` con `privado.documento_a_texto` |
| 6 | Función de `a40_validar_estado` (`estados_y_publicacion.sql`, sin reemplazos posteriores) | `create or replace` copiando el cuerpo actual y cambiando solo el chequeo de `requisitos_publicacion` por `privado.documento_tiene_contenido` |
| 7 | `articulos_contenido_check` | `drop constraint` + `add constraint articulos_contenido_check check (privado.contenido_valido(contenido)) not valid` (mismo nombre: el mapeo de `errores.ts` para 23514 no cambia). Recrearlo evita que un check `immutable` quede marcado como válido con filas que no lo cumplen |
| 8 | `articulos_requisitos_publicacion` | `drop constraint` + `add constraint … check (estado <> 'publicado' or (categoria_id is not null and privado.documento_tiene_contenido(contenido))) not valid` (la misma regla de hoy con la función nueva) |
| 9 | Validación condicional | Un bloque `do`: si no queda ningún artículo con `jsonb_typeof(contenido) = 'array'`, `validate constraint` de los dos checks. En local (tabla vacía al migrar) quedan validados; en la nube los valida la conversión, que corre en la misma ejecución |
| 10 | `articulos.contenido` | `alter column … set default '{"type":"doc","content":[]}'` |
| 11 | `drop function privado.tipos_bloque()` y `privado.bloques_a_texto(jsonb)` | Al final, con todo lo anterior ya reemplazado |

**Privilegios** (research D20 de la 001; el `check` y la función de `a40` se evalúan **con el rol de quien guarda** y Postgres comprueba `execute` en cada llamada anidada):

| Función | Privilegios |
|---|---|
| `privado.tipos_elemento()`, `privado.documento_tiene_contenido(jsonb)` | `revoke all … from public, anon, authenticated;` `grant execute … to anon, authenticated, service_role` (los mismos que hoy tienen `tipos_bloque` y `contenido_valido`, `fundacion.sql`) |
| `privado.contenido_valido(jsonb)` | sin cambios (`create or replace` conserva los privilegios) |
| `privado.documento_a_texto(jsonb)` | `revoke all … from public, anon, authenticated`, sin `grant` (solo la llama `calcular_busqueda`, que es `security definer`) |

**Sin cambios**: `public.rutas_en_uso` (busca la ruta escapada dentro de `contenido::text`; `attrs.imagen.ruta` y `attrs.imagenes[*].ruta` siguen siendo strings) y el orden de los triggers (`a30_controlar_version`, `a50_calcular_busqueda`, `a90_actualizado_en`, `z90_notificar_cambio`). Después de la migración, `pnpm db:reset && pnpm db:tipos` (`contenido` sigue siendo `Json`, pero se regenera y se commitea igual, §V.7).

**Lo que la migración NO hace**: convertir los artículos. La conversión necesita el analizador en línea del sitio (TypeScript); reescribirlo en PL/pgSQL sería una segunda gramática (§VI.3, §VIII.3).

### Conversión de los artículos existentes (RF-023, RF-030)

Un script de un solo uso, `packages/bloques/scripts/convertir-contenido.ts` (Node 24 con un cargador propio, research D25 y D31), que **no se conecta a ninguna base**:

1. **Entrada**: un JSON con `[{ id, version, contenido }]` de todos los artículos (`select json_agg(…) from public.articulos`), exportado con el SQL Editor, el MCP de Supabase o `psql`.
2. **Conversión y verificación**: para cada artículo en formato anterior, `bloquesADocumento`, `validarDocumento` (estricto), la ida y vuelta (`documentoABloques`) y la comparación de `visibleDeBloques(anterior)` con `visibleDeDocumento(nuevo)`: texto visible, anclas de los títulos, imágenes y enlaces (D26). Si **un** artículo falla, termina con error, indica cuál y por qué, y **no genera nada** (todo o nada, sin copia del contenido anterior). Un artículo que ya es un documento se deja igual (repetible).
3. **Salida**: un SQL que es **un único bloque `do $$ … $$`**, sin `begin`/`commit` (así es atómico en el SQL Editor, en el MCP, en `psql` sin `-1` y dentro de `throws_ok` de pgTAP):
   1. `alter table public.articulos disable trigger a30_controlar_version, disable trigger a90_actualizado_en, disable trigger z90_notificar_cambio` (la versión y la fecha no cambian y el sitio no recibe avisos; `a50_calcular_busqueda` queda activo y recalcula la búsqueda; `n10_notificar_borrado` es `before delete` y no se toca);
   2. `update public.articulos a set contenido = v.contenido from (values …) as v(id, version, contenido) where a.id = v.id and a.version = v.version`;
   3. `get diagnostics n = row_count`; si `n` no es la cantidad de artículos del export que eran arreglos, `raise exception`;
   4. si queda algún `contenido` de tipo `array` (por ejemplo, un artículo creado después del export), `raise exception`;
   5. `validate constraint articulos_contenido_check` y `validate constraint articulos_requisitos_publicacion`;
   6. `enable trigger` de los tres.
4. **Dónde se aplica**:
   - **Local**: no hace falta (el seed ya queda en el formato nuevo y la migración corre con la tabla vacía). En una base local con datos propios, la migración y el SQL de la conversión en una sola ejecución de `psql -1`.
   - **Nube**: en el **corte coordinado** del cierre (RF-030), **la migración y el SQL de la conversión en una sola ejecución del SQL Editor** (una sola transacción: no hay ventana en la que un `update` de un artículo sin convertir falle por el check nuevo; el cron y el panel esperan el lock). El SQL Editor corre como `postgres`, dueño de la tabla (se verifica antes con `pg_tables.tableowner`); con el MCP, solo fuera del modo de solo lectura. No se usa `session_replication_role` (pide superusuario y apagaría `a50`).
5. **Después del corte**: el último commit antes del merge elimina el script, `conversion-anterior/`, la caracterización, `conversion.test.sql` y su *fixture* (D31); queda solo `corpus-documento.ts`.

### `seed.sql`

Se reescriben las funciones `pg_temp.*` para que devuelvan elementos del documento (`pg_temp.parrafo`, `pg_temp.titulo`, `pg_temp.cita`…), se agregan `pg_temp.texto(texto, marcas)` para los seis tramos con formato que hoy usan marcadores y `pg_temp.tabla(…)`, y cada artículo arma su `contenido` como `jsonb_build_object('type', 'doc', 'content', jsonb_build_array(…))`. Se suma **un artículo publicado** con los formatos nuevos, las cuatro alineaciones y una tabla con celdas combinadas (CE-008, RF-027). Los ids de los elementos son uuid literales para que las pruebas sean repetibles. Ese artículo **no** se carga en la nube (allí el seed tiene contraseñas y ids propios): CE-008 se mide en local.

### Pruebas pgTAP (§V.2 y §IX.4)

| Archivo | Qué prueba |
|---|---|
| `contenido_documento.test.sql` (nuevo) | `contenido_valido`: acepta el documento vacío (también el *default*: un insert sin `contenido` funciona) y uno con los doce tipos; rechaza un arreglo, un `type` distinto de `doc`, más de 200 elementos, un tipo desconocido y un elemento sin `attrs.id`; nunca devuelve NULL. `documento_tiene_contenido`: vacío, solo párrafos vacíos, tabla sin texto y arreglo → `false`; párrafo, imagen o tabla con texto → `true`. `documento_a_texto`: incluye celdas, descripción y `autor`; excluye el código y las URL; respeta el orden; no duplica (cuenta apariciones); con un arreglo da `''`. Los dos checks quedan `convalidated` después de la migración en local |
| `articulos_borrador.test.sql` o `validaciones.test.sql` | Un insert y un update **como `authenticated`** con un documento (detecta un `execute` faltante en las funciones del check) |
| `busqueda.test.sql` | Contenidos adaptados; encuentra un artículo por una palabra de una celda y de la descripción (RF-027); el recálculo al renombrar una categoría funciona con documentos |
| `programacion.test.sql` | `publicar_programados` publica un programado con documento |
| `panel_admin.test.sql` | `rutas_en_uso` encuentra rutas en `attrs.imagen.ruta` y en `attrs.imagenes[*].ruta` y no confunde `a.jpg` con `a.jpg.bak` |
| `seed.test.sql` | Los jsonpath de las imágenes pasan a `$.content[*] ? (@.type == "imagen").attrs.imagen` (y galería) |
| `articulos_publicacion.test.sql`, `notificaciones.test.sql` y los demás que arman `contenido` | Contenidos adaptados; "publicado sin contenido" con el documento vacío y con solo párrafos vacíos |
| `privilegios.test.sql` | `function_privs_are` de `tipos_elemento` y `documento_tiene_contenido` (como hoy `tipos_bloque`) y de `documento_a_texto` (sin `execute`); las listas permitidas de los barridos con los nombres nuevos; `hasnt_function` para `tipos_bloque` y `bloques_a_texto`; `plan(…)` recalculado |
| `conversion.test.sql` (nuevo, se elimina tras el corte) | *Setup* en la transacción de la prueba: `drop constraint` de los dos checks, `disable trigger a40_validar_estado`, insertar un borrador y un publicado en el formato anterior, `enable trigger a40_validar_estado` y volver a agregar los dos checks `not valid` (el estado real de la nube). Con el *fixture* del SQL generado: `version` y `actualizado_en` sin cambios, la cola de `net` igual, `busqueda` con una palabra del documento, los dos checks `convalidated` y los triggers de nuevo en `tgenabled = 'O'`. Con una versión que no coincide: `throws_ok` y todo queda igual (contenido, checks y triggers). El *fixture* lo genera el script desde el corpus y una prueba de Vitest comprueba que no se desvió |

## Modelo del documento

El detalle de la lista permitida está en [contracts/documento.md](contracts/documento.md). Tipos en `packages/bloques`:

| Tipo | Qué es |
|---|---|
| `Documento` | `z.infer<typeof esquemaDocumento>`: `{ type: 'doc', content: Elemento[] }` |
| `Elemento`, `ElementoDe<T>` | Unión discriminada por `type` de los doce elementos de primer nivel |
| `Inline`, `Texto`, `Marca` | Contenido en línea y sus marcas |
| `ErrorElemento` | `{ indice, id, campo, mensaje }` (reemplaza a `ErrorBloque` también en `packages/db` y en `apps/admin`) |
| `DatosDe<T>`, `CambiosDeElemento` | Los datos que reciben los **ocho** editores de campos (imagen, galería, llamada a la acción, video, título, cita, lista y código) y sus cambios; reemplazan a `Bloque`, `BloqueDe` y `CambiosDeBloque` fuera de `conversion-anterior/` |

## Estado del editor

`EstadoEditor` (reductor de la spec 003) cambia solo el tipo de `datos.contenido`: de `Contenido` (bloques) a `Documento`. Las acciones son las de hoy (`campo`, `sugerir_slug`, `contenido`, `guardado`, `adoptar_vigente`); `contenido` recibe el documento **normalizado** (D24). `guardado` no toca el documento vivo; solo la carga inicial y `adoptar_vigente` lo recrean (D6 y D11, sin cambios).

Estado solo de la interfaz (no va al reductor ni se guarda): selección actual (texto, celdas o modo elementos), **última celda o selección de celdas de la tabla seleccionada** (para operar la barra «Tabla» desde el modo elementos, D31), pestaña del panel, hoja abierta o cerrada, menú abierto y consulta del menú «/», elemento que se arrastra.

## Reglas de integridad

| Regla | Dónde se comprueba |
|---|---|
| Todo documento que guarda el editor cumple `esquemaDocumento` (estricto) | `validarDocumento` en el navegador y en la Server Action, antes de escribir (RF-022) |
| `normalizarDocumento` es idempotente y `normalizarDocumento(editor(d)) = d` para todo documento canónico `d` (RF-012) | `normalizar.test.ts` (propiedades) y E2E |
| El esquema del editor es exactamente la lista permitida | `extensiones.test.ts` con `getSchema(extensiones)` (D23 y D31) |
| La base rechaza un `contenido` sin la forma mínima (también el formato anterior) y los checks no dan NULL | `privado.contenido_valido` + pgTAP |
| Un publicado tiene al menos un elemento con contenido | `articulos_requisitos_publicacion`, `a40_validar_estado` + pgTAP |
| Los ids de los elementos son únicos y estables | `esquemaDocumento` (unicidad), plugin `asignarIds` y `ids.test.ts` |
| Las tablas tienen cuadrícula regular, encabezado solo en la primera fila y límites | `esquemaDocumento` con `cuadricula` de `tablas.ts`, y `tablas.test.ts` |
| La conversión no pierde nada y es repetible | `conversion-anterior/*.test.ts`, la verificación del script sobre los datos reales y `conversion.test.sql` |
| El sitio muestra todo lo que la lista permite y nada más | `render/documento.test.tsx` y `seguridad.test.tsx` |
| Tras el corte no queda código del formato anterior | grep de cierre en `validacion.md` (`tipos_bloque`, `esquemaBloque`, `analizarEnLinea`, `continuacion`, `​`: sin resultados) |
