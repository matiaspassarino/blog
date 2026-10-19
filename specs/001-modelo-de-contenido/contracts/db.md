# Contrato: `@blog/db`

Es el único punto de acceso a datos (constitución §III.2). Todas las funciones reciben un cliente Supabase ya creado: la app decide cuál (anon en `web`; con la sesión del usuario en `admin`). Así el paquete no depende de cookies ni del framework.

## Clientes

```ts
export type ClienteBlog = SupabaseClient<Database>;
export function crearClientePublico(url: string, claveAnon: string): ClienteBlog; // sin sesión (apps/web, build/ISR)
```

El cliente con sesión para `apps/admin` (`@supabase/ssr`) se agrega en la spec del panel y reutiliza `ClienteBlog`.

## Errores de dominio

```ts
export class ErrorDominio extends Error { codigo: CodigoError; detalle?: string; errores?: ErrorBloque[]; cause?: unknown }
// `errores` solo viene con `contenido_invalido` (validación Zod previa a la base).
export type CodigoError =
  | 'conflicto_version'      // RF-008
  | 'estado_invalido'        // RF-009 (transición no permitida)
  | 'requisitos_publicacion' // RF-010
  | 'fecha_no_futura'        // RF-011
  | 'categoria_en_uso'       // RF-016 (FK restrict)
  | 'ultimo_admin'           // RF-023
  | 'sin_permiso'            // RLS / trigger de perfil
  | 'contenido_invalido'     // check de contenido / validación Zod
  | 'slug_duplicado'         // 23505 tras reintento
  | 'no_encontrado'
  | 'desconocido';           // cualquier otro error (se conserva en `cause`)
export function traducirError(error: PostgrestError): ErrorDominio; // mapea códigos y mensajes de Postgres
```

## Consultas públicas (visitante)

```ts
obtenerArticuloPublicado(c, slug): Promise<ArticuloPublico | null>
listarArticulosPublicados(c, { pagina?: number; porPagina?: number }): Promise<Pagina<ResumenArticulo>>
listarPorCategoria(c, slugCategoria, { pagina?, porPagina? }): Promise<{ categoria: Categoria; articulos: Pagina<ResumenArticulo> } | null>
listarPorEtiqueta(c, slugEtiqueta, { pagina?, porPagina? }): Promise<{ etiqueta: Etiqueta; articulos: Pagina<ResumenArticulo> } | null>
buscarArticulos(c, consulta, { pagina?, porPagina? }): Promise<Pagina<ResumenArticulo>>
resolverRedireccion(c, tipo: 'articulo'|'categoria'|'etiqueta', slug): Promise<string | null> // slug actual
listarParaSitemap(c): Promise<{ tipo; slug; actualizadoEn }[]>                              // RSEO-004
```

- `ArticuloPublico` = `{ id, titulo, slug, extracto, imagen_destacada, contenido, publicado_en, actualizado_en, categoria, etiquetas, autor, seo }`. Es un subconjunto de columnas (sin `estado`, `autor_id` ni los campos SEO crudos), con el respaldo de RF-006 ya resuelto en `seo: { titulo; descripcion }`.
  - `categoria: ReferenciaTaxonomia | null` y `autor: AutorPublico | null`, por lo que tipan los embebidos de PostgREST. En un publicado siempre vienen (por el check de requisitos y la vista).
  - `ReferenciaTaxonomia = { nombre; slug }` y `AutorPublico = { nombre; biografia; avatar }`.
  - `obtenerArticuloPublicado` filtra publicado de forma **explícita**, además de la RLS: con una sesión del equipo tampoco devuelve borradores (validación A3-M3).
- **`service_role` no escribe contenido editorial**: puede (A-M7), pero el sistema no está diseñado para eso. Si publicara con `publicado_en` futuro, el artículo se haría visible sin notificación. Los únicos escritores del sistema son el seed y el cron.
- `Pagina<T>` = `{ items: T[]; total: number; pagina: number; porPagina: number; totalPaginas: number }`. `porPagina` vale 12 por defecto (RF-017).
- Cada consulta hace una cantidad **constante** de peticiones, con relaciones embebidas (sin N+1). `obtenerArticuloPublicado`, `buscarArticulos` y `resolverRedireccion` hacen **una**. Los listados por taxonomía hacen hasta **2**, porque necesitan distinguir un slug inexistente (`null`) de un listado vacío, y `listarParaSitemap` hace **una**: el RPC `entradas_sitemap()` devuelve un único `jsonb`, que no corta `max_rows = 1000` de PostgREST (validación A5-B1).
- `ResumenArticulo = { id; titulo; slug; extracto; imagen_destacada; publicado_en; categoria: ReferenciaTaxonomia | null }`, en `tipos-publicos.ts`.
- `Pagina<T>`: `pagina` empieza en 1, `totalPaginas = ceil(total / porPagina)` y las opciones son opcionales (`listarArticulosPublicados(c)` es válido). El orden es `publicado_en desc, id desc`.
- `Categoria` y `Etiqueta` son la **fila completa** (`id, nombre, slug, descripcion, creado_en, actualizado_en`), en `tipos-dominio.ts`, junto con `Taxonomia = Categoria | Etiqueta`, `TipoTaxonomia = Exclude<TipoEntidad, 'articulo'>` y `TABLA_TAXONOMIA`.
- Otros exports: `OpcionesPagina = { pagina?; porPagina? }`, `EntradaSitemap = { tipo: TipoEntidad; slug; actualizadoEn }`, `NuevaTaxonomia = { nombre; slug?; descripcion? }` y `CambiosTaxonomia = Partial<NuevaTaxonomia>`.
- En `ArticuloPublico`, `etiquetas` viene ordenado por nombre.
- `asignarEtiquetas` valida la entrada: un arreglo o un elemento nulo, o más de 100 etiquetas, dan `contenido_invalido`; una etiqueta inexistente da `no_encontrado`. Un 23503 (FK) se traduce a `no_encontrado`, con la tabla en `detalle`.
- Operaciones de taxonomías: `crearTaxonomia(c, tipo, { nombre, slug?, descripcion? })` y `actualizarTaxonomia(c, tipo, id, cambios)` devuelven la fila, sin versión. `eliminarTaxonomia` devuelve `void` y lanza `no_encontrado` si no borra nada.

## Operaciones del equipo (las usa el panel en su spec)

```ts
crearArticulo(c, datos: NuevoArticulo): Promise<Articulo>                     // valida contenido con @blog/bloques; autor = usuario actual (default auth.uid())
// NuevoArticulo = { titulo; slug?; extracto?; titulo_seo?; descripcion_seo?; imagen_destacada?; contenido?; categoria_id? }
actualizarArticulo(c, id, version, cambios: CambiosArticulo): Promise<Articulo>
cambiarEstado(c, id, version, destino: EstadoArticulo, opciones?: { programadoPara?: Date }): Promise<Articulo>
asignarEtiquetas(c, articuloId, version, etiquetaIds: string[]): Promise<{ version: number }> // RPC atómico asignar_etiquetas
eliminarArticulo(c, id): Promise<void>                                         // solo admin
crearTaxonomia / actualizarTaxonomia / eliminarTaxonomia(c, 'categoria'|'etiqueta', ...)
actualizarPerfilPropio(c, cambios: { nombre?; biografia?; avatar? }): Promise<Perfil>
cambiarRol(c, perfilId, rol) / cambiarActivo(c, perfilId, activo)            // solo admin
previsualizarSlug(c, texto, tipo: 'articulo'|'categoria'|'etiqueta'): Promise<string>
```

Todas propagan `ErrorDominio`. Las operaciones de update **siempre** envían `version` (hay un test que lo verifica). La validación del contenido ocurre **antes** de llamar a la base y devuelve `contenido_invalido` con `ErrorBloque[]`.

## Revalidación

```ts
export type CambioPublico = {
  tipo: 'articulo' | 'categoria' | 'etiqueta' | 'autor';
  id: string;
  slugs: string[];            // actuales y anteriores del objeto; para 'autor', el slug del autor (spec 002)
  categorias?: string[];      // slugs de categorías afectadas (artículos)
  etiquetas?: string[];       // slugs de etiquetas afectadas (artículos)
};
// Spec 002: rutasAfectadas se reemplaza por invalidacionesDe(cambio): { tags, rutas } y CambioPublico
// se deriva de esquemaCambioPublico (Zod). Ver specs/002-sitio-publico/contracts/cache.md.
```

Ver [revalidacion.md](revalidacion.md).

## Exports adicionales (implementados en H1)

```ts
export type { Database, Json } from './tipos';                      // generado
export type ErrorPostgrest = Pick<PostgrestError, 'code' | 'message' | 'details' | 'hint'>;
export type Articulo = Database['public']['Tables']['articulos']['Row'];
export type NuevoArticulo;  export type CambiosArticulo;           // ver equipo-articulos.ts
export type TipoEntidad; export type EstadoArticulo; export type RolMiembro; // tipos-dominio.ts
```

La validación previa también cubre `imagen_destacada` con `esquemaImagen`. Sus errores van en `ErrorDominio.errores` con `indice: -1` y `campo: 'imagen_destacada.…'`. Se persisten los valores **parseados**, con sus valores por defecto aplicados.
