import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import { CLASES_CONTROL } from './input';

/** `<select>` nativo con el estilo de los controles: ya es accesible por teclado y lector de pantalla. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(CLASES_CONTROL, className)} {...props} />;
}
