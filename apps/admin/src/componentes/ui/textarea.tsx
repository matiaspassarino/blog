import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import { CLASES_CONTROL } from './input';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CLASES_CONTROL, 'min-h-32', className)} {...props} />;
}
