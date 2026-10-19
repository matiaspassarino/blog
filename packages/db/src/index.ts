// Punto único de acceso a datos (constitucion.md §III.2).
export type { Database, Json } from './tipos';
export { crearClientePublico, type ClienteBlog } from './cliente';
export { ErrorDominio, traducirError, type CodigoError, type ErrorPostgrest } from './errores';
export {
  crearArticulo,
  actualizarArticulo,
  eliminarArticulo,
  previsualizarSlug,
  type Articulo,
  type NuevoArticulo,
  type CambiosArticulo,
} from './consultas/equipo-articulos';
export type {
  TipoEntidad,
  EstadoArticulo,
  RolMiembro,
  Categoria,
  Etiqueta,
  Taxonomia,
  TipoTaxonomia,
} from './tipos-dominio';
export {
  obtenerArticuloPublicado,
  resolverRedireccion,
  type ArticuloPublico,
  type AutorPublico,
  type ReferenciaTaxonomia,
} from './consultas/articulos-publicos';
export { rutasAfectadas, type CambioPublico } from './rutas-afectadas';
export { TAG_ARTICULOS, tagArticulo, tagCategoria, tagEtiqueta, tagAutor } from './tags';
export type { ResumenArticulo } from './consultas/tipos-publicos';
export type { Pagina, OpcionesPagina } from './paginacion';
export {
  listarArticulosPublicados,
  listarPorCategoria,
  listarPorEtiqueta,
  listarPorAutor,
  listarParaSitemap,
  listarRelacionados,
  type EntradaSitemap,
} from './consultas/listados';
export {
  crearTaxonomia,
  actualizarTaxonomia,
  eliminarTaxonomia,
  asignarEtiquetas,
  type NuevaTaxonomia,
  type CambiosTaxonomia,
} from './consultas/equipo-taxonomias';
