// Imágenes del contenido (specs/002-sitio-publico/research.md D7): URL pública y variantes
// optimizadas. Las variantes se calculan antes del render porque los renderers React de
// @blog/bloques son síncronos.
import type { Imagen } from '@blog/bloques';
import { getImage } from 'astro:assets';

/** Ruta absoluta tal cual; relativa, al bucket público `medios` de Supabase Storage. */
export function urlImagen(ruta: string, supabaseUrl: string): string {
  if (/^https?:\/\//.test(ruta)) return ruta;
  return `${supabaseUrl}/storage/v1/object/public/medios/${ruta.replace(/^\/+/, '')}`;
}

type Variante = { src: string; srcset: string; width: number; height: number };
export type MapaVariantes = Map<string, Variante>;

/** Calidad de las imágenes optimizadas: Vercel usa 100 por defecto y pesa el doble sin diferencia visible (T099). */
export const CALIDAD_IMAGEN = 75;

const ANCHOS = [480, 800, 1200, 1600];

/** ruta → variante optimizada, para las imágenes que muestra una página. */
export async function precalcularVariantes(imagenes: Imagen[], supabaseUrl: string): Promise<MapaVariantes> {
  const mapa: MapaVariantes = new Map();
  await Promise.all(
    imagenes
      .filter((imagen, i, todas) => todas.findIndex((otra) => otra.ruta === imagen.ruta) === i)
      .map(async (imagen) => {
        const anchos = ANCHOS.filter((ancho) => ancho < imagen.ancho).concat(imagen.ancho);
        const resultado = await getImage({
          src: urlImagen(imagen.ruta, supabaseUrl),
          width: imagen.ancho,
          height: imagen.alto,
          widths: anchos,
          quality: CALIDAD_IMAGEN,
        });
        mapa.set(imagen.ruta, {
          src: resultado.src,
          srcset: resultado.srcSet.attribute,
          width: imagen.ancho,
          height: imagen.alto,
        });
      }),
  );
  return mapa;
}
