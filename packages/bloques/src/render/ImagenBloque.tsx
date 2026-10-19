import type { BloqueDe } from '../esquema';
import type { ComponentesBloques } from './tipos';

/** Una imagen decorativa no lleva leyenda accesible (H1-E3). */
export function ImagenBloque({ bloque, componentes }: { bloque: BloqueDe<'imagen'>; componentes: ComponentesBloques }) {
  const { Imagen } = componentes;
  const leyenda = bloque.imagen.decorativa ? undefined : bloque.leyenda;
  return (
    <figure className="mt-10">
      <Imagen imagen={bloque.imagen} sizes="(min-width: 768px) 68ch, 100vw" />
      {leyenda && <figcaption className="mt-2 text-sm text-texto-suave">{leyenda}</figcaption>}
    </figure>
  );
}
