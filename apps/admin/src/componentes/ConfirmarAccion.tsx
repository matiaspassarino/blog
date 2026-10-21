'use client';

// Confirmación de una acción destructiva (RF-024): el diálogo dice qué se pierde, el foco inicial
// está en "Cancelar" y Esc cierra devolviendo el foco a quien lo abrió.
import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

type Props = {
  titulo: string;
  /** Qué se pierde o qué cambia al confirmar. */
  descripcion: string;
  etiquetaConfirmar: string;
  variante?: 'primaria' | 'peligro';
  onConfirmar: () => void | Promise<void>;
  /** El botón que abre el diálogo. */
  children: ReactNode;
};

export function ConfirmarAccion({
  titulo,
  descripcion,
  etiquetaConfirmar,
  variante = 'peligro',
  onConfirmar,
  children,
}: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <AlertDialog open={abierto} onOpenChange={setAbierto}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{titulo}</AlertDialogTitle>
        <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variante={variante} onClick={() => onConfirmar()}>
            {etiquetaConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
