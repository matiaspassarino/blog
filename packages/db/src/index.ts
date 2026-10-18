// Punto único de acceso a datos (constitucion.md §III.2).
export type { Database, Json } from './tipos';
export { crearClientePublico, type ClienteBlog } from './cliente';
export { ErrorDominio, traducirError, type CodigoError, type ErrorPostgrest } from './errores';
