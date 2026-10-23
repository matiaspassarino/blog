// Textos accesibles del editor como funciones puras (spec 003, T059 y T061): nombres de grupos y
// botones, anuncios de la región role="status" y resumen de errores. Todo en español y con la posición
// que ve la persona (desde 1).
import type { ErrorElemento, TipoElemento } from '@blog/bloques';

/**
 * Los tipos como los ve la persona: las dos listas son «lista» y cada uno tiene un nombre en español. Los usan los
 * anuncios, el menú «Insertar» y el panel.
 */
export const TIPOS_VISIBLES = [
  'parrafo',
  'titulo',
  'imagen',
  'cita',
  'lista',
  'galeria',
  'cta',
  'separador',
  'codigo',
  'video',
] as const;
export type TipoVisible = (typeof TIPOS_VISIBLES)[number];

const TIPO_VISIBLE: Record<TipoElemento, TipoVisible> = {
  paragraph: 'parrafo',
  heading: 'titulo',
  bulletList: 'lista',
  orderedList: 'lista',
  blockquote: 'cita',
  codeBlock: 'codigo',
  horizontalRule: 'separador',
  imagen: 'imagen',
  galeria: 'galeria',
  cta: 'cta',
  video: 'video',
};

/** El tipo visible de un elemento del documento. */
export const tipoVisibleDe = (tipo: TipoElemento) => TIPO_VISIBLE[tipo];

const NOMBRES_DE_TIPO: Record<TipoVisible, string> = {
  parrafo: 'párrafo',
  titulo: 'título',
  imagen: 'imagen',
  cita: 'cita',
  lista: 'lista',
  galeria: 'galería',
  cta: 'llamada a la acción',
  separador: 'separador',
  codigo: 'código',
  video: 'video',
};

const TIPOS_FEMENINOS: readonly TipoVisible[] = ['imagen', 'cita', 'lista', 'galeria', 'cta'];

export const nombreDeTipo = (tipo: TipoVisible) => NOMBRES_DE_TIPO[tipo];

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Anuncios del editor estilo documento (spec 005, contracts/atajos.md): se dice «elemento», nunca «bloque».
const articuloIndefinido = (tipo: TipoVisible) => (TIPOS_FEMENINOS.includes(tipo) ? 'una' : 'un');

export const anuncioInsertado = (tipo: TipoVisible, posicion: number, total: number) =>
  `Se insertó ${articuloIndefinido(tipo)} ${nombreDeTipo(tipo)} en la posición ${posicion} de ${total}`;

export const anuncioMovido = (posicion: number, total: number) =>
  `Elemento movido a la posición ${posicion} de ${total}`;

export const anuncioDuplicado = (posicion: number, total: number) =>
  `Elemento duplicado, posición ${posicion} de ${total}`;

export const anuncioQuitado = (cantidad: number) =>
  `${cantidad === 1 ? 'Elemento quitado' : `${cantidad} elementos quitados`}. Pulsa Ctrl+Z para deshacer`;

export const anuncioConvertido = (nombre: string) => `Se convirtió en ${nombre}`;

export const anuncioModoElementos = (cantidad: number) =>
  cantidad === 1 ? '1 elemento seleccionado' : `${cantidad} elementos seleccionados`;

export const anuncioPegadoConSobrante = (cantidad: number) =>
  `${cantidad === 1 ? 'Se creó 1 párrafo nuevo' : `Se crearon ${cantidad} párrafos nuevos`} por el límite de caracteres`;

export const anuncioDeAvisoDeLimite = (quedan: number) =>
  `Quedan ${quedan} caracteres (se cuentan las marcas de formato)`;

export const anuncioDeLimiteAlcanzado = () => 'Se alcanzó el máximo de caracteres del párrafo';

export const anuncioDeshacer = (accion: string) => `Se deshizo: ${accion}`;

export const anuncioRehacer = (accion: string) => `Se rehízo: ${accion}`;

export const anuncioSubidaEnCurso = () => 'Subiendo imagen… No se puede mover ni quitar hasta que termine';

const NOMBRES_DE_CAMPO: Record<string, string> = {
  alt: 'Texto alternativo',
  texto: 'Texto',
  ruta: 'Imagen',
  leyenda: 'Leyenda',
  url: 'Dirección',
  titulo: 'Título',
  etiquetaBoton: 'Texto del botón',
  codigo: 'Código',
  lenguaje: 'Lenguaje',
  idVideo: 'ID del video',
  proveedor: 'Proveedor',
  items: 'Elementos',
  imagenes: 'Imágenes',
  imagen: 'Imagen',
  autor: 'Autor',
  fuente: 'Fuente',
  nivel: 'Nivel',
  columnas: 'Columnas',
  ancho: 'Ancho',
  alto: 'Alto',
};

/** Nombre con palabras de la persona para un campo técnico: usa el último segmento que no sea un número. */
export function nombreDeCampo(campo: string) {
  const segmento = campo
    .split('.')
    .filter((parte) => !/^\d+$/.test(parte))
    .at(-1);
  return NOMBRES_DE_CAMPO[segmento ?? ''] ?? conMayuscula(segmento ?? campo);
}

/** "Hay 3 errores. Revisa el elemento 2, campo Texto alternativo": señala el primero por orden de pantalla. */
export function resumenDeErrores(errores: ErrorElemento[]) {
  const primero = [...errores].sort((a, b) => a.indice - b.indice)[0];
  if (!primero) return '';
  const cantidad = errores.length === 1 ? 'Hay 1 error' : `Hay ${errores.length} errores`;
  const lugar = primero.indice < 0 ? 'la imagen destacada' : `el elemento ${primero.indice + 1}`;
  return `${cantidad}. Revisa ${lugar}, campo ${nombreDeCampo(primero.campo)}`;
}
