// Imagen de la vista previa para los renderers de @blog/bloques (contrato de la spec 002): cada app decide
// cómo muestra sus imágenes. El panel usa la imagen pública de Storage tal cual, sin optimizar.
import type { PropsImagen } from '@blog/bloques/render';
import { urlImagen } from '@blog/db';

export function ImagenAdmin({ imagen, sizes, prioridad = false }: PropsImagen) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagen remota de Storage, sin optimizar
    <img
      src={urlImagen(imagen.ruta, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')}
      width={imagen.ancho}
      height={imagen.alto}
      alt={imagen.decorativa ? '' : (imagen.alt ?? '')}
      sizes={sizes}
      loading={prioridad ? 'eager' : 'lazy'}
      decoding="async"
      className="h-auto w-full rounded-md bg-superficie"
    />
  );
}
