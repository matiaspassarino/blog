import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

/** Casilla nativa; el área táctil de 44 px la da la etiqueta que la envuelve. */
export function Checkbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return <input type="checkbox" className={cn('size-5 accent-marca', className)} {...props} />;
}
