// Textos accesibles del editor como funciones puras (spec 003, T059 y T061): nombres de grupos y
// botones, anuncios de la región role="status" y resumen de errores. Todo en español y con la posición
// que ve la persona (desde 1).
import type { ErrorBloque, TipoBloque } from '@blog/bloques';

const NOMBRES_DE_TIPO: Record<TipoBloque, string> = {
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

const TIPOS_FEMENINOS: readonly TipoBloque[] = ['imagen', 'cita', 'lista', 'galeria', 'cta'];

export const nombreDeTipo = (tipo: TipoBloque) => NOMBRES_DE_TIPO[tipo];

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export const etiquetaDeBloque = (posicion: number, tipo: TipoBloque) => `Bloque ${posicion}: ${nombreDeTipo(tipo)}`;

const ACCIONES_DE_BOTON = { subir: 'Subir', bajar: 'Bajar', duplicar: 'Duplicar', quitar: 'Quitar' } as const;

export const nombreDeBoton = (accion: keyof typeof ACCIONES_DE_BOTON, posicion: number, tipo: TipoBloque) =>
  `${ACCIONES_DE_BOTON[accion]} bloque ${posicion}, ${nombreDeTipo(tipo)}`;

export function anuncioDeMovimiento(tipo: TipoBloque, posicion: number, total: number) {
  const participio = TIPOS_FEMENINOS.includes(tipo) ? 'movida' : 'movido';
  return `${conMayuscula(nombreDeTipo(tipo))} ${participio} a la posición ${posicion} de ${total}`;
}

export function anuncioDeQuitado(posicion: number, tipo: TipoBloque, quedan: number) {
  const resto = quedan === 0 ? 'No quedan bloques' : quedan === 1 ? 'Queda 1 bloque' : `Quedan ${quedan} bloques`;
  return `Bloque ${posicion}, ${nombreDeTipo(tipo)}, eliminado. ${resto}`;
}

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

/** "Hay 3 errores. Revisa el bloque 2, campo Texto alternativo": señala el primero por orden de pantalla. */
export function resumenDeErrores(errores: ErrorBloque[]) {
  const primero = [...errores].sort((a, b) => a.indice - b.indice)[0];
  if (!primero) return '';
  const cantidad = errores.length === 1 ? 'Hay 1 error' : `Hay ${errores.length} errores`;
  const lugar = primero.indice < 0 ? 'la imagen destacada' : `el bloque ${primero.indice + 1}`;
  return `${cantidad}. Revisa ${lugar}, campo ${nombreDeCampo(primero.campo)}`;
}
