// Diálogo de confirmación sobre Radix: foco inicial en "Cancelar", atrapa el foco, cierra con Esc y
// devuelve el foco a quien lo abrió (RF-024; revisión de revisor-ux-ui B5).
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import { BarraAcciones } from '../estructura/BarraAcciones';
import { Button } from './button';
import { CLASES_TITULO_SECCION } from '../estructura/TituloSeccion';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 bg-overlay" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed inset-x-4 top-1/2 mx-auto max-h-dvh max-w-md -translate-y-1/2 overflow-y-auto rounded-md border border-borde bg-fondo p-6 shadow-tarjeta',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn(CLASES_TITULO_SECCION, className)} {...props} />;
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description className={cn('mt-2 text-texto-suave', className)} {...props} />;
}

export function AlertDialogFooter({ className, children }: ComponentProps<'div'>) {
  return (
    <div className={cn('mt-6', className)}>
      <BarraAcciones alineacion="fin">{children}</BarraAcciones>
    </div>
  );
}

export function AlertDialogCancel({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button variante="secundaria" className={className} {...props} />
    </AlertDialogPrimitive.Cancel>
  );
}

export function AlertDialogAction({
  variante,
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> & { variante: 'primaria' | 'peligro' }) {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button variante={variante} className={className} {...props} />
    </AlertDialogPrimitive.Action>
  );
}
