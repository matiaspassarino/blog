'use client';

// "Más acciones" (spec 004, RF-019): por debajo de 42 rem de ancho de la barra recoge las acciones que no entran
// en una línea; desde ahí se ven todas en línea y el botón desaparece. La barra se renderiza una sola vez: el panel
// pasa de menú a `contents` según la container query (research D10).
import { Children, useId, useRef, type ReactNode } from 'react';
import { useDesplegable } from '../../lib/desplegable';
import { cn } from '../../lib/cn';
import { Icono } from '../Icono';
import { Button } from '../ui/button';

type Props = { children: ReactNode; destructivas?: ReactNode };

export function MasAcciones({ children, destructivas }: Props) {
  const idPanel = useId();
  const refBoton = useRef<HTMLButtonElement>(null);
  const refPanel = useRef<HTMLDivElement>(null);
  const { abierto, cerrar, alternar } = useDesplegable({ refBoton, refPanel });

  if (Children.toArray(children).length === 0 && !destructivas) return null;

  return (
    <div className="relative contents">
      <Button
        ref={refBoton}
        data-accion="mas-acciones"
        variante="terciaria"
        tamanio="compacto"
        soloIcono
        aria-label="Más acciones"
        aria-expanded={abierto}
        aria-controls={idPanel}
        className="@2xl:hidden"
        onClick={alternar}
      >
        <Icono nombre="mas" />
      </Button>
      <div
        id={idPanel}
        ref={refPanel}
        // Ejecutar una acción cierra el menú; el foco lo decide quien la ejecuta (research D11).
        onClick={(evento) => {
          if ((evento.target as HTMLElement).closest('button, a')) cerrar();
        }}
        className={cn(
          '@2xl:contents',
          abierto
            ? 'absolute right-0 bottom-full z-10 mb-2 flex max-h-72 min-w-56 flex-col items-stretch gap-2 overflow-y-auto rounded-md border border-borde bg-fondo p-3 shadow-tarjeta'
            : 'hidden',
        )}
      >
        {children}
        {destructivas && (
          <>
            <hr className="border-separador @2xl:hidden" />
            {destructivas}
          </>
        )}
      </div>
    </div>
  );
}
