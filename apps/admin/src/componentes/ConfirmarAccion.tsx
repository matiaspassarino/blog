'use client';

// Confirmación de una acción (RF-024): el diálogo dice qué se pierde o qué cambia, el foco inicial está en
// "Cancelar" (o en `focoInicial`) y Esc cierra devolviendo el foco a quien lo abrió. Con `cuerpo` aloja un campo
// (el diálogo de programar) y con `abierto` se controla desde afuera.
import { useState, type ReactNode, type RefObject } from 'react';
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
  /** Nivel de la confirmación (RF-004): `peligro` para las destructivas, `primaria` para el resto. */
  variante: 'primaria' | 'peligro';
  /** `false` (o una promesa que resuelve `false`) deja el diálogo abierto. */
  onConfirmar: () => boolean | void | Promise<boolean | void>;
  /** Contenido extra entre la descripción y los botones. */
  cuerpo?: ReactNode;
  /** Elemento que recibe el foco al abrir; por defecto, "Cancelar". */
  focoInicial?: RefObject<HTMLElement | null>;
  /** Modo controlado: quien lo usa decide cuándo se abre. */
  abierto?: boolean;
  alCambiarAbierto?: (abierto: boolean) => void;
  /** Con esto, quien lo usa decide a dónde va el foco al cerrar (research D11). */
  alCerrar?: (motivo: 'confirmado' | 'cancelado') => void;
  /** El botón que abre el diálogo; en modo controlado no hace falta. */
  children?: ReactNode;
};

export function ConfirmarAccion({
  titulo,
  descripcion,
  etiquetaConfirmar,
  variante,
  onConfirmar,
  cuerpo,
  focoInicial,
  abierto: abiertoControlado,
  alCambiarAbierto,
  alCerrar,
  children,
}: Props) {
  const [abiertoPropio, setAbiertoPropio] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const abierto = abiertoControlado ?? abiertoPropio;

  // Radix solo avisa por acá la apertura, Esc, el clic afuera y "Cancelar": confirmar se resuelve en `confirmar`.
  function cambiarAbierto(nuevo: boolean) {
    setAbiertoPropio(nuevo);
    alCambiarAbierto?.(nuevo);
    if (!nuevo) alCerrar?.('cancelado');
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    // Radix cierra solo al hacer clic; acá se decide según el resultado.
    evento.preventDefault();
    if (confirmando) return;
    setConfirmando(true);
    try {
      const resultado = await onConfirmar();
      if (resultado === false) return;
      setAbiertoPropio(false);
      alCambiarAbierto?.(false);
      alCerrar?.('confirmado');
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent
        onOpenAutoFocus={(evento) => {
          if (!focoInicial?.current) return;
          evento.preventDefault();
          focoInicial.current.focus();
        }}
        onCloseAutoFocus={alCerrar ? (evento) => evento.preventDefault() : undefined}
      >
        <AlertDialogTitle>{titulo}</AlertDialogTitle>
        <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        {cuerpo}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variante={variante} onClick={confirmar}>
            {etiquetaConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
