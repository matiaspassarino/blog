import type { ElementoDe } from '../esquema';
import type { ComponentesDocumento } from './tipos';

// Clases literales para que Tailwind las detecte. md = 768 px (contrato).
const COLUMNAS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' } as const;
const SIZES = {
  2: '(min-width: 768px) 34ch, 50vw',
  3: '(min-width: 768px) 23ch, 50vw',
  4: '(min-width: 768px) 17ch, 50vw',
};

export function Galeria({
  elemento,
  componentes,
}: {
  elemento: ElementoDe<'galeria'>;
  componentes: ComponentesDocumento;
}) {
  const { Imagen } = componentes;
  const { imagenes, columnas } = elemento.attrs;
  return (
    <ul role="list" className={`mt-10 grid grid-cols-2 gap-3 ${COLUMNAS[columnas]}`}>
      {imagenes.map((imagen, i) => (
        <li key={`${imagen.ruta}-${i}`} className="overflow-hidden rounded-md">
          <Imagen imagen={imagen} sizes={SIZES[columnas]} />
        </li>
      ))}
    </ul>
  );
}
