// Del artículo de la base a los datos que edita el formulario (y de vuelta). Puro: lo usan las páginas del
// servidor y el editor del cliente.
import type { Documento, ErrorElemento, Imagen } from '@blog/bloques';
import { esquemaImagen, validarDocumento } from '@blog/bloques';
import type { ArticuloParaEditar } from '@blog/db';
import type { DatosArticulo } from './reductor';

type ConEtiquetas = Pick<
  ArticuloParaEditar,
  | 'version'
  | 'titulo'
  | 'slug'
  | 'extracto'
  | 'titulo_seo'
  | 'descripcion_seo'
  | 'imagen_destacada'
  | 'categoria_id'
  | 'contenido'
>;

export const DATOS_NUEVO: DatosArticulo = {
  version: 0,
  titulo: '',
  slug: '',
  extracto: null,
  titulo_seo: null,
  descripcion_seo: null,
  imagen_destacada: null,
  categoria_id: null,
  contenido: { type: 'doc', content: [] },
  etiquetas: [],
};

export function aDatosArticulo(articulo: ConEtiquetas, etiquetas: string[]): DatosArticulo {
  return {
    version: articulo.version,
    titulo: articulo.titulo,
    slug: articulo.slug,
    extracto: articulo.extracto,
    titulo_seo: articulo.titulo_seo,
    descripcion_seo: articulo.descripcion_seo,
    imagen_destacada: articulo.imagen_destacada as Imagen | null,
    categoria_id: articulo.categoria_id,
    contenido: articulo.contenido as Documento,
    etiquetas,
  };
}

/**
 * Valida en el navegador con el mismo esquema que usa el servidor (RF-006): el documento y la imagen
 * destacada. Los errores de la destacada llevan `indice: -1`, como los de @blog/db.
 */
export function validarEditor(datos: Pick<DatosArticulo, 'contenido' | 'imagen_destacada'>): ErrorElemento[] {
  const errores: ErrorElemento[] = [];

  if (datos.imagen_destacada) {
    const imagen = esquemaImagen.safeParse(datos.imagen_destacada);
    if (!imagen.success) {
      for (const problema of imagen.error.issues) {
        errores.push({
          indice: -1,
          id: '',
          campo: ['imagen_destacada', ...problema.path.map(String)].join('.'),
          mensaje: problema.message,
        });
      }
    }
  }

  errores.push(...validarDocumento(datos.contenido));
  return errores;
}
