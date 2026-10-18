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
export type { TipoEntidad, EstadoArticulo, RolMiembro } from './tipos-dominio';
