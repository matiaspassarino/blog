import type { BloqueDe, Contenido } from './esquema';
import type { TipoBloque } from './tipos-bloque';

// Quita las marcas del Markdown inline (research D9) y las URLs de los enlaces.
const sinMarcas = (texto: string) =>
  texto
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]*)`/g, '$1');

/** Texto legible del contenido (extractos, tiempo de lectura). Omite los bloques de código. */
export function textoPlano(contenido: Contenido): string {
  const partes: string[] = [];
  for (const bloque of contenido) {
    if (bloque.tipo === 'parrafo' || bloque.tipo === 'titulo' || bloque.tipo === 'cita') {
      partes.push(sinMarcas(bloque.texto));
    } else if (bloque.tipo === 'lista') {
      partes.push(...bloque.items.map(sinMarcas));
    }
  }
  return partes.join('\n');
}

const VALORES_INICIALES = {
  parrafo: { texto: '' },
  titulo: { nivel: 2, texto: '' },
  imagen: { imagen: { ruta: '', ancho: 0, alto: 0, alt: '', decorativa: false } },
  cita: { texto: '' },
  lista: { ordenada: false, items: [] },
  galeria: { imagenes: [], columnas: 3 },
  cta: { titulo: '', etiquetaBoton: '', url: '' },
  separador: {},
  codigo: { codigo: '', lenguaje: '' },
  video: { proveedor: 'youtube', idVideo: '', titulo: '' },
} as const satisfies Record<TipoBloque, object>;

/** Bloque nuevo para el editor: tiene id, pero no es válido hasta completarse (salvo separador). */
export function crearBloque<T extends TipoBloque>(tipo: T): BloqueDe<T> {
  return { id: crypto.randomUUID(), tipo, ...structuredClone(VALORES_INICIALES[tipo]) } as unknown as BloqueDe<T>;
}

/**
 * `id` legible para el ancla de un título ("Cómo empezar: el diseño" → "como-empezar-el-diseno").
 * No es un slug de entidad: esos los genera solo la base (privado.slugificar, research D10 de
 * la 001). Este solo vive en el HTML del artículo.
 */
export function anclaDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
