# Investigación (Fase 0): Modelo de contenido

**Feature**: [spec.md](spec.md) · **Fecha**: 2026-10-18

Entorno verificado: Postgres 17.11 local (Supabase CLI 2.121), con estas extensiones disponibles: `pg_cron 1.6.4`, `pg_net 0.20.4`, `unaccent 1.1`, `pgtap 1.3.3`, `pg_jsonschema 0.3.3`, `supabase_vault 0.3.1`. Postgres 17 no trae `uuidv7()` nativo.

---

## D1. Claves primarias
- **Decisión**: `id uuid primary key default gen_random_uuid()`.
- **Razón**: Es lo que pide la constitución (§V.3). El volumen esperado (~2.000 artículos) vuelve irrelevante la fragmentación de índices de UUIDv4. Además, los IDs no son secuenciales ni adivinables, lo que importa porque se exponen al cliente.
- **Alternativas**: `bigint identity` (exige otra clave pública si se expone); UUIDv7 (no está disponible en PG17 sin extensión).

## D2. Roles y autorización
- **Decisión**: `perfiles.rol` (enum `rol_miembro`: `admin` | `editor`) y `perfiles.activo`. Hay funciones auxiliares `security definer stable`, con `search_path = ''`, en el esquema no expuesto `privado`: `privado.es_equipo()` (miembro activo) y `privado.es_admin()` (admin activo). Las políticas las invocan como `(select privado.es_admin())`, así se evalúan una sola vez por consulta.
- **Razón**: El rol se consulta por PK (índice), los cambios de rol o la desactivación aplican al instante y no dependen de que expire un JWT.
- **Alternativas**: un custom access token hook con el rol como claim (más rápido, pero un cambio de rol no aplica hasta que se refresca el token, y suma configuración); `app_metadata` directo (el mismo problema de demora).

## D3. Alta de miembros sin registro público
- **Decisión**: `auth.enable_signup = false`. El admin crea miembros desde el servidor del panel con la Admin API de Auth (clave secreta; spec del panel). Un trigger `after insert on auth.users` crea el perfil con `rol` tomado de `raw_app_meta_data->>'rol'` (solo lo puede escribir el servidor) y `editor` por defecto. **Defensa en profundidad**: si `raw_app_meta_data` no trae `rol` (la cuenta no la creó el servidor), el perfil nace con `activo = false`. Para desactivar se usa `perfiles.activo = false`, que las políticas bloquean de inmediato; el panel además suspende la cuenta en Auth (`ban_duration`).
- **Razón**: Cumple RF-022: nadie puede auto-registrarse ni auto-asignarse el rol admin.
- **Alternativas**: invitaciones por mail (`inviteUserByEmail`). Es compatible y puede sumarse en la spec del panel.

## D4. Protección de campos sensibles del perfil
- **Decisión**: La política de update permite que cada uno edite su propia fila y que el admin edite cualquiera. Un trigger `before update` (`privado.proteger_perfil`) rechaza los cambios de `rol` o `activo` si quien los hace no es admin. `proteger_perfil` también vuelve inmutables `id` y `creado_en`. El trigger `after update` `garantizar_admin` toma `pg_advisory_xact_lock` y verifica que quede al menos un admin activo (RF-023), lo que evita la carrera entre dos admins que se degradan en simultáneo. Los editores desactivados no pueden editar ni su propio perfil: las políticas exigen `es_equipo()`.
- **Razón**: RLS controla filas, no columnas. El trigger cierra el hueco de "un editor se hace admin" editando su propia fila.

## D5. Datos públicos de autores (RF-026)
- **Decisión**: Vista `public.autores_publicos` con `security_invoker = false` y `security_barrier = true`, propiedad de `postgres`. Expone solo `id`, `nombre`, `biografia` y `avatar` de los perfiles con al menos un artículo `publicado` y `publicado_en <= now()`. Se le hace `revoke all` a `public`, `anon` y `authenticated`, y después `grant select` a `anon` y `authenticated`. `anon` no tiene ningún privilegio sobre `perfiles`.
- **Razón**: Las columnas no públicas quedan ocultas por diseño, y la vista es el contrato público.
- **Riesgo corregido (revisión arquitecto-db, B1)**: la vista es auto-actualizable y `postgres` tiene BYPASSRLS. Con los privilegios por defecto de Supabase, `anon` podía hacer **UPDATE** de perfiles a través de ella (se reprodujo). Por eso el `revoke all` es obligatorio, y un test pgTAP verifica que insert, update y delete fallen como `anon` y como `authenticated`.
- **Alternativas**: GRANT por columnas sobre `perfiles` (es frágil ante columnas nuevas y ante `select=*`).

## D6. Estados y transiciones (RF-009, RF-010, RF-011)
- **Decisión**: Enum `estado_articulo` (`borrador`, `programado`, `publicado`, `archivado`).
  - Un trigger `before insert or update` (`privado.validar_estado_articulo`) aplica la matriz de transiciones, exige `programado_para > now()` al programar, completa `publicado_en = now()` al publicar por primera vez y limpia `programado_para` al salir de `programado`.
  - Además, un `check` declarativo exige que, si `estado in ('programado','publicado')`, haya `categoria_id` no nulo y `jsonb_array_length(contenido) > 0`.
- **Campos del sistema** (trigger `a20_campos_sistema`, solo para peticiones de cliente, `privado.es_cliente()` = el GUC `role` es `anon` o `authenticated`): en el insert se fuerzan `version = 1`, `publicado_en = null` y `estado = 'borrador'`. En el update se conservan `autor_id`, `creado_en` y `publicado_en`. `busqueda` se recalcula siempre, con lo que cualquier valor que mande el cliente se descarta. El seed (que corre como `postgres`) puede cargar fechas históricas.
- **Errores con detalle**: `validar_estado` lanza `requisitos_publicacion` con `detail` (`categoria` o `contenido`); un `check` adicional exige `estado <> 'publicado' or publicado_en is not null`.
- **Razón**: Las reglas viven en la base (RF-027) y ningún cliente puede saltearlas. Los checks que dependen de `now()` van en el trigger, no en un `check`.
- **Volver a publicar**: si un artículo archivado vuelve a borrador y se publica de nuevo, se conserva su `publicado_en` original (para el SEO, la fecha de publicación es estable; la modificación se refleja en `actualizado_en`).

## D7. Publicación programada (RF-011, CE-003)
- **Decisión**: Un job de `pg_cron` que corre cada minuto ejecuta `privado.publicar_programados()`: hace `update ... set estado = 'publicado' where estado = 'programado' and programado_para <= now()`, usando `for update skip locked`. Corre como `postgres`, asigna `publicado_en = programado_para` (la hora prevista, no la de ejecución) e incrementa `version`.
- **Razón**: Latencia ≤ 60 s sin infraestructura extra.
- **Alternativas**: Vercel Cron (depende del deploy y no corre en local); Edge Function programada (más piezas).

## D8. Bloques: validación en dos capas sin duplicar el esquema
- **Decisión**:
  1. **Fuente única**: el esquema Zod 4 de `packages/bloques` (unión discriminada por `tipo`). El servidor del panel valida con ese esquema antes de guardar y devuelve errores con la ruta del problema (`contenido[3].imagen.alt`).
  2. **Defensa en la base**: un `check` liviano sobre `articulos.contenido` (`privado.contenido_valido(jsonb)`) verifica que sea un arreglo de ≤ 200 objetos y que cada `tipo` pertenezca a `privado.tipos_bloque()`.
  3. **Anti-deriva**: un test de integración compara `privado.tipos_bloque()` con `TIPOS_BLOQUE` de `packages/bloques` y falla si difieren.
- **Razón**: Cumple la constitución §VI.3–4 (una sola definición y nada inválido llega a la base) sin mantener dos esquemas completos.
- **Alternativas**: un JSON Schema completo generado desde Zod (`z.toJSONSchema`) y validado con `pg_jsonschema` en un `check`. Es más estricto, pero exige regenerar e inyectar el esquema en cada migración. Queda para una spec futura si aparecen escrituras fuera del panel.

## D9. Formato del texto en bloques
- **Decisión**: Los campos de texto de `parrafo`, `cita` y los items de `lista` admiten un subconjunto **inline** de Markdown: `**negrita**`, `_cursiva_`, `[texto](url)` y `` `código` ``. No admiten HTML. Al renderizar, se escapa todo y solo se interpretan esas marcas; los enlaces externos llevan `rel="noopener"`.
- **Razón**: El contenido queda portable y legible en JSON, el riesgo de XSS es nulo (spec, casos borde) y el editor resulta simple.
- **Alternativas**: HTML sanitizado (más superficie de ataque); árbol de nodos estilo ProseMirror (más complejo de lo que el MVP necesita).

## D10. Slugs (RF-005, RF-012)
- **Decisión**: La lógica vive en la base y es la única fuente:
  - `privado.slugificar(text)` es `immutable`: aplica `unaccent`, pasa a minúsculas, reemplaza todo lo que no sea `[a-z0-9]` por `-`, colapsa los guiones y recorta.
  - Un trigger `before insert` genera el slug si viene vacío y le agrega un sufijo `-2`, `-3`… si ya existe. Si el slug viene informado, lo normaliza igual.
  - El panel muestra la previsualización con el RPC `previsualizar_slug(texto, tabla)`.
- **Razón**: Una única implementación, testeada con pgTAP. Reimplementarla en TypeScript la duplicaría (§VIII).

## D11. Redirecciones por cambio de slug
- **Decisión**: Tabla `redirecciones(tipo_entidad, slug_anterior, entidad_id)`, con `unique (tipo_entidad, slug_anterior)`. Un trigger `after update of slug` inserta el slug viejo cuando la entidad es pública (un artículo con `publicado_en` no nulo, o cualquier categoría o etiqueta). Si un slug nuevo coincide con un `slug_anterior` registrado, esa redirección se elimina.
- **Razón**: Al apuntar a `entidad_id` (y no al slug destino) no se forman cadenas de redirecciones: siempre se resuelve al slug actual.

## D12. Búsqueda en español (RF-018–020, CE-004/005)
- **Decisión**:
  - **Doble configuración** en el documento y en la consulta. El documento se arma como `to_tsvector('public.es_sin_tildes', x) || to_tsvector('pg_catalog.spanish', x)`, donde `es_sin_tildes` es una copia de `spanish` con el mapeo `unaccent, spanish_stem`. La consulta se arma igual: `websearch_to_tsquery(es_sin_tildes) || websearch_to_tsquery(spanish)`. Siempre se nombran calificadas (con `search_path = ''`).
  - La columna `articulos.busqueda tsvector` se mantiene por trigger, porque incluye datos de otras tablas. Pesos: **A** título; **B** extracto, categoría y etiquetas; **C** texto de los bloques. El texto de los bloques sale de `privado.bloques_a_texto(jsonb)`, que excluye los bloques `codigo`, quita las URL de los enlaces Markdown y trunca a 200.000 caracteres para no superar el límite de 1 MB del tsvector.
  - Índice GIN.
  - El RPC `buscar_articulos` es `stable` y `security invoker`. Filtra de forma **explícita** `estado = 'publicado' and publicado_en <= now()`, acota `limite` a 50, ordena por `ts_rank_cd` y luego por `publicado_en desc`, y devuelve `total` con `count(*) over ()`.
- **Resultado (H5)**: sobre los 26 pares de `busqueda.test.sql` acierta 22 (84,6 %), por debajo del 95 % de CE-004. Desviación aceptada y registrada en `validacion.md`.
- **Razón**: Medido por arquitecto-db sobre 16 pares de prueba: `es_sin_tildes` sola acierta 10/16, porque el stemmer Snowball depende de las tildes (`publicación` → `publicacion`, pero `publicaciones` → `public`). La combinación de las dos configuraciones acierta 13/16. Los 3 casos que siguen fallando son limitaciones de Snowball (`publicaciones`/`publicacion`, `correr`/`corrió`). CE-004 se mide sobre un conjunto de prueba explícito en `busqueda.test.sql`, que incluye esos casos. Si no se alcanza el 95 %, se evalúa sumar `pg_trgm` como respaldo en una spec posterior.
- **Alternativas**: Pagefind estático (no sirve con ISR on-demand); solo `pg_trgm` (no maneja morfología).

## D13. Edición concurrente (RF-008)
- **Decisión**: Columna `version integer not null default 1`. El trigger `a30_controlar_version` exige `new.version = old.version` y la incrementa; si no coincide, lanza `P0001 conflicto_version`. **No hay bypass por GUC**:
  - Los recálculos derivados (búsqueda lanzada desde otro trigger, con `pg_trigger_depth() > 1`) conservan la versión.
  - El cron sí la incrementa, así un editor con el formulario abierto recibe un conflicto en lugar de pisar la publicación.
  - `packages/db` envía siempre la `version` (lo verifica un test).
- **Razón**: Revisión arquitecto-db, B6: un GUC `app.*` lo puede setear cualquier sesión con `set_config`, así que no sirve como mecanismo de seguridad.

## D14. Notificación de cambios públicos (RF-013)
- **Decisión**:
  - Hay triggers `z90_notificar_*` (after) en `articulos`, `categorias`, `etiquetas` y `perfiles` (estos últimos solo si cambian `nombre`, `biografia` o `avatar` de un autor con artículos publicados).
  - Para el **delete** de artículos se notifica en `before delete`, para capturar las etiquetas antes del cascade (el enqueue de `pg_net` es transaccional).
  - Los triggers de `articulos_etiquetas` salen sin hacer nada si el artículo padre ya no existe. Los updates que solo cambian columnas derivadas (`busqueda`, `version`, `actualizado_en`) no notifican.
  - `privado.notificar_cambio_publico` es `security definer`, propiedad de `postgres`, con `search_path = ''`. Envía `net.http_post` (asincrónico) envuelto en `exception when others then raise warning`, de modo que **nunca** hace fallar la transacción.
  - La URL y el secreto se leen de Vault. Si faltan, no se envía nada.
  - **Firma HMAC (decisión del usuario, 2026-10-18)**: `net.http_request_queue` concede ALL a PUBLIC y `postgres` no puede revocarlo (lo verificaron escritor-tests y la validación). Por eso el secreto **nunca** se pone en la petición: se envían `X-Blog-Marca-Tiempo` y `X-Blog-Firma = sha256=HMAC-SHA256(secreto, marca.cuerpo)` (`pgcrypto`). El endpoint verifica la firma y una ventana de 5 minutos. Leer la cola no permite falsificar avisos ni reusar los viejos fuera de la ventana. Se descartaron `Bearer` + riesgo aceptado y una cola propia sondeada por Vercel Cron (más latencia y más piezas).
  - **Riesgo aceptado y mitigado (SSRF)**: el event trigger de Supabase concede `execute` sobre `net.http_*` y `usage` sobre `net` a `anon` y `authenticated`, y `postgres` **no puede revocarlos** (los otorga `supabase_admin`; verificado). Mitigaciones:
    1. `net` no está en los esquemas expuestos por la API (`[api] schemas = ["public","graphql_public"]`), así que no se puede invocar por PostgREST.
    2. Ninguna función ejecutable por clientes llama a `net.http_*` (test pgTAP).
    3. Ninguna función definer expuesta ejecuta SQL dinámico (test pgTAP).
    4. `notificar_cambio_publico` no es ejecutable por clientes.
  - Un cambio de perfil emite **un solo** mensaje `tipo: 'autor'` con los slugs de hasta 50 artículos.
- **Razón**: Un solo camino de notificación para el panel y el cron.
- **Alternativas**: que el panel llame a revalidar (no cubre al cron); una tabla de cola con worker (más piezas).

## D15. Imágenes y Storage
- **Decisión**:
  - Bucket público `medios`: los archivos se sirven por URL pública (no pasa por RLS). Listar, subir, modificar y borrar es solo para `privado.es_equipo()`, porque listar revelaría imágenes de borradores (validación A-M4). Solo imágenes (`jpeg`, `png`, `webp`, `avif`, `gif`) de hasta 5 MB (A-M3).
  - `service_role` tiene `usage` sobre `privado` y `execute` sobre las funciones que usan los checks y triggers, así que las tareas del servidor con la clave secreta pueden escribir contenido (A-M7).
  - Las imágenes, tanto la destacada como las de los bloques, comparten el sub-esquema Zod `esquemaImagen`: `{ ruta, ancho, alto, alt, decorativa }`, donde `alt` es obligatorio salvo que `decorativa = true`.
  - En la tabla, la imagen destacada es `imagen_destacada jsonb`, con un `check` liviano (que tenga `ruta` y que tenga `alt` o sea decorativa).
- **Razón**: Reutiliza el mismo esquema (§VIII). Las dimensiones son obligatorias para evitar CLS (§IV.6).

## D16. Paginación
- **Decisión**: `limit/offset` con el índice `(estado, publicado_en desc)`. Tamaño por defecto: 12.
- **Razón**: Las URLs `/blog/pagina/N` necesitan saltar a una página concreta, y con unos 2.000 artículos el offset no tiene costo relevante.
- **Alternativas**: keyset (mejor para listas infinitas, peor para la paginación indexable).

## D17. Dependencias nuevas
| Paquete | Workspace | Justificación | ¿En el stack (§II)? |
|---|---|---|---|
| `zod@4.6.x` | `packages/bloques` | Esquema único de bloques | Sí |
| `@supabase/supabase-js@2.118.x` | `packages/db` | Cliente de datos | Sí |
| `@blog/bloques` | `packages/db` | Tipos de `contenido` | Interno |

`@supabase/ssr` se incorpora en la spec del panel (auth con cookies), no en esta.

## D18. Datos de demo
- **Decisión**: `supabase/seed.sql` crea las cuentas de Auth con contraseñas conocidas (solo para el entorno local y de demo) y, a partir de ellas, los perfiles: `admin@demo.local`, `editora@demo.local` y `editor@demo.local`. Suma 4 categorías, 10 etiquetas y 14 artículos: 9 publicados, 2 programados, 2 borradores y 1 archivado, cubriendo los 10 tipos de bloque. Las imágenes son placeholders con dimensiones reales.
- **Razón**: Cumple RF-028 y CE-007, y además sirve de fixture para los tests E2E.

## D19. Sitemap dinámico (impacto en la spec del sitio público)
- **Decisión**: `/sitemap.xml` es un endpoint ISR propio que usa `listarParaSitemap()`, y **no** `@astrojs/sitemap`.
- **Razón**: `@astrojs/sitemap` genera el sitemap solo en el build, así que los artículos publicados por ISR on-demand no aparecerían hasta el siguiente deploy. La integración puede quitarse o limitarse a las páginas estáticas de la landing; esa decisión corresponde a la spec del sitio público. Hay que actualizar la skill `astro-seo` en esa spec.

## D20. Privilegios explícitos (revisión arquitecto-db, B2)
- **Decisión**: La primera migración ejecuta `alter default privileges` para revocar a `anon` y `authenticated` todo sobre las tablas y el `execute` sobre las funciones nuevas de `public`. También revoca el `execute` a `PUBLIC` en el esquema `privado`. Después se concede **por objeto** solo lo que figura en la tabla de privilegios del data-model. Los tests pgTAP lo verifican con `table_privs_are` y `function_privs_are`.
- **Razón**: Los privilegios por defecto de Supabase conceden ALL (incluido TRUNCATE, que RLS no frena) y `execute` sobre todo lo nuevo, y con `usage` sobre `privado` cualquier función definer quedaba invocable.

## D21. Orden de los triggers
- **Decisión**: Postgres ejecuta los triggers del mismo evento por **orden alfabético**, así que los nombres llevan prefijo: `a10_` a `a90_` para los `before` y `z10_` a `z90_` para los `after`. No se usan listas `update of`: cada función compara `old` con `new`.

## D22. Asignación de etiquetas atómica
- **Decisión**: RPC `asignar_etiquetas(articulo_id uuid, etiqueta_ids uuid[], version int)`, `security definer` con chequeo `es_equipo()`, y **única vía de escritura** de `articulos_etiquetas`: los clientes no tienen insert ni delete directos. En una sola transacción verifica la versión, reemplaza el conjunto de etiquetas y hace **un único** update de versión, que recalcula la búsqueda vía `a50`. Emite una única notificación.
- **Por qué no se llama a `recalcular_busqueda` dentro del RPC**: un segundo update a profundidad de trigger 1 incrementaría la versión dos veces (hallazgo I3 de `/speckit-analyze`).
- **Por qué no hay escrituras directas**: si existieran, la búsqueda quedaría desactualizada y no se notificaría (hallazgo I4).
- **Razón**: Hacer delete más insert por PostgREST no es atómico y no respeta el bloqueo optimista.

## D23. Mensajes de error accionables
- **Decisión**:
  - Un trigger `before delete` sobre `categorias` cuenta los artículos y lanza `categoria_en_uso` con el conteo en `detail` (spec H3-E3).
  - Las colisiones de slug por concurrencia (23505) se reintentan una vez en `packages/db`.
  - Las redirecciones se insertan con `on conflict do update`.
  - Los nombres de las taxonomías son únicos sin distinguir mayúsculas (`unique index on (lower(nombre))`).

## D24. Visibilidad de redirecciones (revisión arquitecto-db, B8)
- **Decisión**:
  - La política de select de `redirecciones` para artículos exige que el artículo sea visible para quien consulta (`exists` sobre `articulos`, que hereda la RLS).
  - `resolver_redireccion` hace un join contra la tabla de la entidad.
  - `previsualizar_slug` recibe `tipo_entidad` (enum), no un nombre de tabla en texto, y resuelve con un `case` estático, sin SQL dinámico.
