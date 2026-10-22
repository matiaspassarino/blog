import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Sin esto, `text-titulo-3` se toma por un color y `twMerge` lo descarta junto a `text-texto` (spec 004, D5).
const twMerge = extendTailwindMerge({ extend: { theme: { text: ['titulo-1', 'titulo-2', 'titulo-3'] } } });

/** Compone clases de Tailwind resolviendo conflictos (convención de shadcn/ui). */
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}
