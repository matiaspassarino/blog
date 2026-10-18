// Tipos de dominio que devuelven las consultas públicas (contracts/db.md).
import type { Contenido, Imagen } from '@blog/bloques';

export type AutorPublico = { nombre: string; biografia: string | null; avatar: Imagen | null };
export type ReferenciaTaxonomia = { nombre: string; slug: string };

export type ArticuloPublico = {
  id: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  imagen_destacada: Imagen | null;
  contenido: Contenido;
  publicado_en: string;
  actualizado_en: string;
  categoria: ReferenciaTaxonomia | null;
  etiquetas: ReferenciaTaxonomia[];
  autor: AutorPublico | null;
  seo: { titulo: string; descripcion: string | null };
};
