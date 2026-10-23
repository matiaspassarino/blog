'use client';

// Lista de elementos que se pueden insertar (contracts/componentes.md y atajos.md). Dos modelos de foco:
// desde «/» el foco queda en el lienzo y la opción activa se señala con `aria-activedescendant`; desde «Insertar»
// el foco entra a la lista. No usa `useDesplegable`: ese hook cierra al mover el foco.
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../../../lib/cn';
import { indiceAnterior, indicePrimero, indiceSiguiente, indiceUltimo } from '../../../lib/menu-teclado';
import { type ItemDeInsercion } from './menu-insercion';

type Props = {
  id: string;
  items: ItemDeInsercion[];
  /** Índice de la opción activa (en el modelo de «/» lo maneja el lienzo). */
  activo: number;
  alActivar?: (indice: number) => void;
  alElegir: (item: ItemDeInsercion) => void;
  /** Con foco propio (desde «Insertar») la lista toma el foco al abrirse y atiende el teclado. */
  focoPropio?: boolean;
  alCerrar?: () => void;
  estilo?: CSSProperties;
  className?: string;
};

const idDeOpcion = (idLista: string, item: ItemDeInsercion) => `${idLista}-${item.id}`;

export function MenuInsertar({
  id,
  items,
  activo,
  alActivar,
  alElegir,
  focoPropio = false,
  alCerrar,
  estilo,
  className,
}: Props) {
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focoPropio) lista.current?.focus();
  }, [focoPropio]);

  useEffect(() => {
    const opcion = items[activo];
    if (opcion) document.getElementById(idDeOpcion(id, opcion))?.scrollIntoView({ block: 'nearest' });
  }, [activo, id, items]);

  const alTeclear = (evento: KeyboardEvent) => {
    if (!focoPropio) return;
    const menu = items.map((item) => ({ etiqueta: item.nombre }));
    const ir = (indice: number) => {
      evento.preventDefault();
      if (indice >= 0) alActivar?.(indice);
    };
    switch (evento.key) {
      case 'ArrowDown':
        return ir(indiceSiguiente(menu, activo));
      case 'ArrowUp':
        return ir(indiceAnterior(menu, activo));
      case 'Home':
        return ir(indicePrimero(menu));
      case 'End':
        return ir(indiceUltimo(menu));
      case 'Enter':
      case ' ': {
        evento.preventDefault();
        const item = items[activo];
        if (item) alElegir(item);
        return;
      }
      case 'Escape':
      case 'Tab':
        evento.preventDefault();
        return alCerrar?.();
    }
  };

  const opcionActiva = items[activo];
  return (
    <div
      className={cn(
        'z-20 flex max-h-80 w-72 flex-col overflow-y-auto rounded-md border border-borde bg-fondo p-1 shadow-tarjeta',
        className,
      )}
      style={estilo}
      // La lista se desplaza: tiene que poder recorrerse con el teclado aunque el foco quede en el lienzo («/»).
      tabIndex={0}
    >
      <div
        ref={lista}
        id={id}
        role="listbox"
        aria-label="Insertar elemento"
        tabIndex={focoPropio ? -1 : undefined}
        aria-activedescendant={focoPropio && opcionActiva ? idDeOpcion(id, opcionActiva) : undefined}
        onKeyDown={alTeclear}
        // Con el puntero no se pierde el foco del lienzo (ni el teclado virtual).
        onPointerDown={(evento) => {
          if (!focoPropio) evento.preventDefault();
        }}
        className="flex flex-col outline-none"
      >
        {items.map((item, indice) => (
          <div
            key={item.id}
            id={idDeOpcion(id, item)}
            role="option"
            aria-selected={indice === activo}
            onClick={() => alElegir(item)}
            onMouseMove={() => alActivar?.(indice)}
            className={cn(
              'flex min-h-(--tactil-min) cursor-pointer flex-col justify-center rounded-sm px-3 py-1.5',
              indice === activo ? 'bg-marca-suave outline-2 -outline-offset-2 outline-marca' : 'hover:bg-superficie',
            )}
          >
            <span className="font-titulos font-semibold">{item.nombre}</span>
            <span className="text-sm text-texto-suave">{item.descripcion}</span>
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p role="status" className="px-3 py-2 text-texto-suave">
          Sin resultados
        </p>
      )}
    </div>
  );
}
