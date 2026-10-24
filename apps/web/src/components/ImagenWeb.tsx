// Componente Imagen de apps/web para <Documento> (contracts/bloques-render.md, research D7).
// Las variantes se precalculan en la página: React no puede esperar a getImage().
import type { ComponentesDocumento, PropsImagen } from '@blog/bloques/render';
import type { MapaVariantes } from '../lib/imagenes';

export function crearImagenWeb(variantes: MapaVariantes): ComponentesDocumento['Imagen'] {
  return function ImagenWeb({ imagen, sizes, prioridad = false }: PropsImagen) {
    const variante = variantes.get(imagen.ruta);
    return (
      <img
        src={variante?.src ?? imagen.ruta}
        srcSet={variante?.srcset}
        sizes={variante ? sizes : undefined}
        width={imagen.ancho}
        height={imagen.alto}
        alt={imagen.decorativa ? '' : (imagen.alt ?? '')}
        loading={prioridad ? 'eager' : 'lazy'}
        fetchPriority={prioridad ? 'high' : undefined}
        decoding="async"
        className="h-auto w-full rounded-md bg-superficie"
      />
    );
  };
}
