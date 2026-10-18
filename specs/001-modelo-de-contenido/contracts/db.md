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

- `ArticuloPublico` = artículo + `categoria` + `etiquetas[]` + `autor: AutorPublico` + `seo: { titulo; descripcion }`, con el respaldo de RF-006 ya resuelto.
- `Pagina<T>` = `{ items: T[]; total: number; pagina: number; porPagina: number; totalPaginas: number }`. `porPagina` vale 12 por defecto (RF-017).
- Cada consulta hace **una sola ida** a la base, con relaciones embebidas (sin N+1).

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
  slugs: string[];            // actuales y anteriores del objeto; para 'autor', los slugs de sus artículos publicados (máx. 50)
  categorias?: string[];      // slugs de categorías afectadas (artículos)
  etiquetas?: string[];       // slugs de etiquetas afectadas (artículos)
};
export function rutasAfectadas(cambio: CambioPublico): string[]; // función pura
```

Ver [revalidacion.md](revalidacion.md).
