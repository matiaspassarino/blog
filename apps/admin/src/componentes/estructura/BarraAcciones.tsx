import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Props = {
  children: ReactNode;
  /** Acciones destructivas: van al final y separadas de las comunes (RF-003, RF-009). */
  destructivas?: ReactNode;
  alineacion?: 'inicio' | 'fin';
  /** Con nombre, la barra es un grupo para los lectores de pantalla. */
  etiqueta?: string;
};

/** Grupo de acciones: misma altura (`items-stretch`), reacomodo en anchos angostos y destructivas al final. */
export function BarraAcciones({ children, destructivas, alineacion = 'inicio', etiqueta }: Props) {
  return (
    <div
      {...(etiqueta ? { role: 'group', 'aria-label': etiqueta } : {})}
      className={cn('flex flex-wrap items-stretch gap-3', alineacion === 'fin' && 'justify-end')}
    >
      {children}
      {destructivas ? <div className="flex flex-wrap items-stretch gap-3 md:ms-auto">{destructivas}</div> : null}
    </div>
  );
}
