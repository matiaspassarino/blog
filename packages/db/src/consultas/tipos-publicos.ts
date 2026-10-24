// Tipos de dominio que devuelven las consultas públicas (contracts/db.md).
import type { Documento, Imagen } from '@blog/bloques';

// id y slug: tags de caché y URL de autor (spec 002, data-model "Tipos de dominio").
export type AutorPublico = {
  id: string;
  slug: string;
  nombre: string;
  biografia: string | null;
  avatar: Imagen | null;
};
export type ReferenciaTaxonomia = { id: string; nombre: string; slug: string };

export type ArticuloPublico = {
  id: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  imagen_destacada: Imagen | null;
  contenido: Documento;
  publicado_en: string;
  actualizado_en: string;
  categoria: ReferenciaTaxonomia | null;
  etiquetas: ReferenciaTaxonomia[];
  autor: AutorPublico | null;
  seo: { titulo: string; descripcion: string | null };
};

/** Artículo en listados, búsqueda y portadas (contracts/db.md). */
export type ResumenArticulo = {
  id: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  imagen_destacada: Imagen | null;
  publicado_en: string;
  categoria: ReferenciaTaxonomia | null;
};
