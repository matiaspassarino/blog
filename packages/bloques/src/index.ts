// Esquema único de bloques (constitucion.md §VI): lo comparten admin, web y db.
export { TIPOS_BLOQUE, type TipoBloque } from './tipos-bloque';
export { esquemaImagen, type Imagen } from './imagen';
export { esquemaBloque, esquemaContenido, type Bloque, type BloqueDe, type Contenido } from './esquema';
export { validarContenido, type ErrorBloque } from './validar';
export { textoPlano, crearBloque } from './utilidades';
