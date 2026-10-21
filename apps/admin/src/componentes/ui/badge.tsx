// Insignia de estado. Siempre lleva la palabra visible; el ícono es decorativo y los dos estados
// neutros (borrador, archivado) se distinguen además por su forma, no solo por el tono (WCAG 1.4.1).
// Mapeo (revisión de revisor-ux-ui, spec 003): borrador = neutro, programado = marca,
// publicado = éxito, archivado = neutro con borde punteado, invitado = advertencia,
// desactivado = error, activo = éxito.
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import { Icono, type NombreIcono } from '../Icono';

const variantes = cva('inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-sm font-semibold', {
  variants: {
    estado: {
      borrador: 'border-borde bg-superficie text-texto-suave',
      programado: 'border-marca bg-marca-suave text-marca',
      publicado: 'border-exito-borde bg-exito-suave text-exito',
      archivado: 'border-dashed border-borde bg-superficie text-texto-suave',
      invitado: 'border-advertencia-borde bg-advertencia-suave text-advertencia',
      desactivado: 'border-error-borde bg-error-suave text-error',
      activo: 'border-exito-borde bg-exito-suave text-exito',
    },
  },
});

export type EstadoBadge = NonNullable<VariantProps<typeof variantes>['estado']>;

const ICONOS: Record<EstadoBadge, NombreIcono> = {
  borrador: 'lapiz',
  programado: 'reloj',
  publicado: 'check',
  archivado: 'archivo',
  invitado: 'sobre',
  desactivado: 'prohibido',
  activo: 'check',
};

type PropsBadge = Omit<ComponentProps<'span'>, 'children'> & { estado: EstadoBadge; children: string };

export function Badge({ estado, className, children, ...props }: PropsBadge) {
  return (
    <span className={cn(variantes({ estado }), className)} {...props}>
      <Icono nombre={ICONOS[estado]} />
      {children}
    </span>
  );
}
