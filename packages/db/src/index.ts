// Punto único de acceso a datos (constitucion.md §III.2).
export type { Database, Json } from './tipos';
export { crearClientePublico, type ClienteBlog } from './cliente';
export { ErrorDominio, traducirError, type CodigoError, type ErrorPostgrest } from './errores';
export {
  crearArticulo,
  actualizarArticulo,
  cambiarEstado,
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
export { invalidacionesDe, leerCambioPublico, esquemaCambioPublico, type CambioPublico } from './invalidaciones';
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
export { buscarArticulos } from './consultas/busqueda';
export {
  actualizarPerfilPropio,
  cambiarRol,
  cambiarActivo,
  type Perfil,
  type CambiosPerfilPropio,
} from './consultas/equipo-perfiles';
export {
  crearTaxonomia,
  actualizarTaxonomia,
  eliminarTaxonomia,
  asignarEtiquetas,
  type NuevaTaxonomia,
  type CambiosTaxonomia,
} from './consultas/equipo-taxonomias';
export { urlImagen, rutaDeMedio, crearSubidaFirmada, descargarMedio, borrarMedios } from './medios';
export { ACCIONES, puede, transicionesDe, type Accion } from './permisos';
export {
  listarArticulosPanel,
  listarEquipo,
  rutasEnUso,
  obtenerPerfilPropio,
  listarAutores,
  listarTaxonomiasConConteo,
  leerTaxonomiaConPublicados,
  listarCategoriasPanel,
  listarEtiquetasPanel,
  obtenerArticuloParaEditar,
  type FiltrosPanel,
  type FilaArticuloPanel,
  type FilaEquipo,
  type TaxonomiaConConteo,
  type ArticuloParaEditar,
} from './consultas/panel';
