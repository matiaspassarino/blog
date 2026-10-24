// El documento (constitución §VI, spec 005): lista permitida, normalización, validación y elementos. Lo comparten
// admin, web y db.
export { esquemaImagen, type Imagen } from './imagen';
export {
  esquemaDocumento,
  type DatosDe,
  type Documento,
  type Elemento,
  type ElementoDe,
  type Inline,
  type Marca,
  type TipoConDatos,
  type TipoElemento,
  type Texto,
} from './esquema';
export { normalizarDocumento } from './normalizar';
export { validarDocumento, type ErrorElemento } from './validar';
export {
  crearElemento,
  datosDeElemento,
  elementoDesdeDatos,
  recorrer,
  textoDeElemento,
  TIPOS_ELEMENTO,
  visibleDeDocumento,
} from './elementos';
export { detectarImagen, type ImagenDetectada, type TipoImagenArchivo } from './imagen-archivo';
export { rutasDeImagenes, rutasQuitadas, type ImagenesDeArticulo } from './imagenes-en-uso';
export {
  cuadricula,
  esRectangulo,
  LIMITES_TABLA,
  type CeldaEstructural,
  type CeldaUbicada,
  type FilaEstructural,
  type ResultadoCuadricula,
  type TablaEstructural,
} from './tablas';
