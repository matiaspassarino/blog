import type { BloqueDe } from '../esquema';
import type { ComponentesBloques } from './tipos';

// Clases literales para que Tailwind las detecte. md = 768 px (contrato).
const COLUMNAS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' } as const;
const SIZES = {
  2: '(min-width: 768px) 34ch, 50vw',
  3: '(min-width: 768px) 23ch, 50vw',
  4: '(min-width: 768px) 17ch, 50vw',
};

export function Galeria({ bloque, componentes }: { bloque: BloqueDe<'galeria'>; componentes: ComponentesBloques }) {
  const { Imagen } = componentes;
  return (
    <ul role="list" className={`mt-10 grid grid-cols-2 gap-3 ${COLUMNAS[bloque.columnas]}`}>
      {bloque.imagenes.map((imagen, i) => (
        <li key={`${imagen.ruta}-${i}`} className="overflow-hidden rounded-md">
          <Imagen imagen={imagen} sizes={SIZES[bloque.columnas]} />
        </li>
      ))}
    </ul>
  );
}
