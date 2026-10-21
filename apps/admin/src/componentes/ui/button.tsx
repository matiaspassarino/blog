import { Slot } from '@radix-ui/react-slot';
import { clasesBoton, type VarianteBoton } from '@blog/ui/clases';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

type PropsButton = ComponentProps<'button'> & { variante?: VarianteBoton; asChild?: boolean };

/** Botón del panel: las clases salen de `clasesBoton` (una sola definición, constitución §VII.3). */
export function Button({ variante = 'primaria', asChild = false, className, type = 'button', ...props }: PropsButton) {
  const Componente = asChild ? Slot : 'button';
  return (
    <Componente
      {...(asChild ? {} : { type })}
      className={cn(
        clasesBoton(variante),
        'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
