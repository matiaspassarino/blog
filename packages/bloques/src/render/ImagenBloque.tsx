import type { ElementoDe } from '../esquema';
import type { ComponentesDocumento } from './tipos';

/** Una imagen decorativa no lleva leyenda accesible (H1-E3). */
export function ImagenBloque({
  elemento,
  componentes,
}: {
  elemento: ElementoDe<'imagen'>;
  componentes: ComponentesDocumento;
}) {
  const { Imagen } = componentes;
  const { imagen } = elemento.attrs;
  const leyenda = imagen.decorativa ? undefined : elemento.attrs.leyenda;
  return (
    <figure className="mt-10">
      <Imagen imagen={imagen} sizes="(min-width: 768px) 68ch, 100vw" />
      {leyenda && <figcaption className="mt-2 text-sm text-texto-suave">{leyenda}</figcaption>}
    </figure>
  );
}
