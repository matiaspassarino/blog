'use client';

// "Más acciones" (spec 004, RF-019): por debajo de 42 rem de ancho de la barra recoge las acciones que no entran
// en una línea; desde ahí se ven todas en línea y el botón desaparece. La barra se renderiza una sola vez: el panel
// pasa de menú a `contents` según la container query (research D10).
import { Children, useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { useDesplegable } from '../../lib/desplegable';
import { cn } from '../../lib/cn';
import { Icono } from '../Icono';
import { Button } from '../ui/button';

type Props = {
  children: ReactNode;
  destructivas?: ReactNode;
  /** Hacia dónde se abre el menú: la barra del editor está abajo (`arriba`); la del documento, arriba (`abajo`). */
  direccion?: 'arriba' | 'abajo';
  /** Ancho de la barra desde el cual las acciones se ven en línea (28 rem, 42 rem o 48 rem). */
  corte?: 'md' | '2xl' | '3xl';
  /** Atributos del botón «Más acciones» (por ejemplo, para que entre al orden de tabulación de una barra). */
  propsBoton?: Omit<ComponentProps<'button'>, 'children'> & Record<`data-${string}`, string>;
};

// Las clases se escriben completas: Tailwind no ve las que se arman con texto.
const CLASES_DE_CORTE = {
  md: { boton: '@md:hidden', panel: '@md:contents', separador: '@md:hidden' },
  '2xl': { boton: '@2xl:hidden', panel: '@2xl:contents', separador: '@2xl:hidden' },
  '3xl': { boton: '@3xl:hidden', panel: '@3xl:contents', separador: '@3xl:hidden' },
} as const;
const CLASES_DE_DIRECCION = { arriba: 'right-0 bottom-full mb-2', abajo: 'right-0 top-full mt-2' } as const;

export function MasAcciones({ children, destructivas, direccion = 'arriba', corte = '2xl', propsBoton }: Props) {
  const clases = CLASES_DE_CORTE[corte];
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
        className={clases.boton}
        onClick={alternar}
        {...propsBoton}
      >
        <Icono nombre="mas" />
      </Button>
      <div
        id={idPanel}
        ref={refPanel}
        data-direccion={direccion}
        // Ejecutar una acción cierra el menú; el foco lo decide quien la ejecuta (research D11).
        onClick={(evento) => {
          if ((evento.target as HTMLElement).closest('button, a')) cerrar();
        }}
        className={cn(
          clases.panel,
          abierto
            ? `absolute ${CLASES_DE_DIRECCION[direccion]} z-10 flex max-h-72 min-w-56 flex-col items-stretch gap-2 overflow-y-auto rounded-md border border-borde bg-fondo p-3 shadow-tarjeta`
            : 'hidden',
        )}
      >
        {children}
        {destructivas && (
          <>
            <hr className={cn('border-separador', clases.separador)} />
            {destructivas}
          </>
        )}
      </div>
    </div>
  );
}
