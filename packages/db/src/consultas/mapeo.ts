// Mapeo de filas de la base a tipos de dominio (validación C3-M4): un único lugar
// para los casts y el respaldo SEO, que reutilizan las consultas públicas.
// Los casts se justifican por research D8: el contenido se valida con Zod al
// escribir y la base tiene un check liviano; no se revalida en cada lectura.
import type { Contenido, Imagen } from '@blog/bloques';

export type AutorPublico = { nombre: string; biografia: string | null; avatar: Imagen | null };
export type ReferenciaTaxonomia = { nombre: string; slug: string };

type FilaSeo = { titulo: string; extracto: string | null; titulo_seo: string | null; descripcion_seo: string | null };

/** Respaldo de RF-006: sin campos SEO propios se usan el título y el extracto. */
export function aSeo(fila: FilaSeo) {
  return { titulo: fila.titulo_seo ?? fila.titulo, descripcion: fila.descripcion_seo ?? fila.extracto };
}

export const aImagen = (valor: unknown) => valor as Imagen | null;
export const aContenido = (valor: unknown) => valor as Contenido;
export const aAutor = (valor: unknown) => valor as AutorPublico | null;
