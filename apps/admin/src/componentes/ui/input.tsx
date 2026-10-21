import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export const CLASES_CONTROL =
  'min-h-(--tactil-min) w-full rounded-md border border-borde bg-fondo px-3 py-2 text-texto aria-invalid:border-error-borde disabled:bg-superficie disabled:text-texto-suave';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CLASES_CONTROL, className)} {...props} />;
}
