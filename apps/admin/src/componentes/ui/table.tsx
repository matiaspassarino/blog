// Tabla responsive: desde 768 px es una tabla; debajo, cada fila es una tarjeta y cada celda lleva su
// rótulo (`etiqueta`), sin scroll horizontal. Conserva la semántica de tabla (spec 003, T077).
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full text-left max-md:block', className)} {...props} />;
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('max-md:sr-only', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('max-md:block', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-separador max-md:mb-3 max-md:block max-md:rounded-md max-md:border max-md:border-separador max-md:p-3',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th className={cn('px-3 py-2 font-semibold text-texto-suave', className)} {...props} />;
}

/** `etiqueta` es el rótulo que se ve en la tarjeta (< 768 px). */
export function TableCell({ className, etiqueta, ...props }: ComponentProps<'td'> & { etiqueta?: string }) {
  return (
    <td
      data-etiqueta={etiqueta}
      className={cn(
        'px-3 py-2 max-md:flex max-md:items-baseline max-md:gap-2 max-md:px-0 max-md:before:min-w-24 max-md:before:font-semibold max-md:before:text-texto-suave max-md:before:content-[attr(data-etiqueta)]',
        className,
      )}
      {...props}
    />
  );
}
