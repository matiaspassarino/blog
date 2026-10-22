// Esquema único de bloques (constitucion.md §VI): lo comparten admin, web y db.
export { TIPOS_BLOQUE, type TipoBloque } from './tipos-bloque';
export { esquemaImagen, type Imagen } from './imagen';
export { esquemaBloque, esquemaContenido, type Bloque, type BloqueDe, type Contenido } from './esquema';
export { validarContenido, type ErrorBloque } from './validar';
export { textoPlano, crearBloque } from './utilidades';
export { detectarImagen, type ImagenDetectada, type TipoImagenArchivo } from './imagen-archivo';
export { agregarBloque, moverBloque, duplicarBloque, quitarBloque, actualizarBloque } from './operaciones';
export { aplicarMarca, type MarcaEnLinea, type Seleccion } from './marcas';
export { rutasDeImagenes, rutasQuitadas, type ImagenesDeArticulo } from './imagenes-en-uso';
