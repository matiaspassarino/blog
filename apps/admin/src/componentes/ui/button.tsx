'use client';

import { Slot } from '@radix-ui/react-slot';
import { clasesBoton, type TamanioBoton, type VarianteBoton } from '@blog/ui/clases';
import type { ComponentProps, MouseEvent } from 'react';
import { cn } from '../../lib/cn';

type PropsButton = ComponentProps<'button'> & {
  variante: VarianteBoton;
  tamanio?: TamanioBoton;
  asChild?: boolean;
} & ({ soloIcono: true; tamanio: 'compacto'; 'aria-label': string; asChild?: false } | { soloIcono?: false }) &
  ({ ocupado: true; textoOcupado: string; asChild?: false } | { ocupado?: false; textoOcupado?: never });

/** Props de `ocupado` según un booleano, para no repetir la unión discriminada en cada formulario. */
export const estadoOcupado = (ocupado: boolean, textoOcupado: string) =>
  ocupado ? ({ ocupado: true, textoOcupado } as const) : ({ ocupado: false } as const);

/** Botón del panel: las clases salen de `clasesBoton` (una sola definición, constitución §VII.3). */
export function Button({
  variante,
  tamanio = 'estandar',
  soloIcono = false,
  ocupado = false,
  textoOcupado,
  asChild = false,
  className,
  type = 'button',
  onClick,
  children,
  ...props
}: PropsButton) {
  const Componente = asChild ? Slot : 'button';
  const inactivo = ocupado || props['aria-disabled'] === true || props['aria-disabled'] === 'true';

  // `aria-disabled` no impide el clic como `disabled`: se frena aquí para no enviar el formulario ni navegar.
  const alHacerClic = (evento: MouseEvent<HTMLButtonElement>) => {
    if (inactivo) {
      evento.preventDefault();
      return;
    }
    onClick?.(evento);
  };

  return (
    <Componente
      {...(asChild ? {} : { type })}
      data-nivel={variante}
      data-tamanio={tamanio}
      className={cn(
        clasesBoton(variante, soloIcono ? { tamanio: 'compacto', soloIcono: true } : { tamanio }),
        ocupado && 'relative',
        className,
      )}
      {...props}
      {...(ocupado ? { 'aria-disabled': true } : {})}
      onClick={alHacerClic}
    >
      {ocupado ? (
        <>
          <span className="opacity-0">{children}</span>
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="size-5 motion-safe:animate-spin"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path d="M12 3a9 9 0 019 9" strokeLinecap="round" />
            </svg>
          </span>
          <span role="status" className="sr-only">
            {textoOcupado}
          </span>
        </>
      ) : (
        children
      )}
    </Componente>
  );
}
