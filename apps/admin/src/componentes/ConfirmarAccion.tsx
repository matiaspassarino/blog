'use client';

// Confirmación de una acción (RF-024): el diálogo dice qué se pierde o qué cambia, el foco inicial está en
// "Cancelar" (o en `focoInicial`) y Esc cierra devolviendo el foco a quien lo abrió. Con `cuerpo` aloja un campo
// (el diálogo de programar) y con `abierto` se controla desde afuera.
import { useRef, useState, type ReactNode, type RefObject } from 'react';
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
  /** Con `esperarResultado`, `false` (o una promesa que resuelve `false`) deja el diálogo abierto. */
  onConfirmar: () => boolean | void | Promise<boolean | void>;
  /**
   * El diálogo se cierra recién cuando `onConfirmar` termina y no devuelve `false` (por ejemplo, el diálogo de
   * programar, que muestra el error junto al campo). Por defecto se cierra al confirmar y sigue la acción.
   */
  esperarResultado?: boolean;
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
  esperarResultado = false,
  focoInicial,
  abierto: abiertoControlado,
  alCambiarAbierto,
  alCerrar,
  children,
}: Props) {
  const [abiertoPropio, setAbiertoPropio] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const confirmado = useRef(false);
  const abierto = abiertoControlado ?? abiertoPropio;

  // Radix avisa por acá la apertura, Esc, el clic afuera, "Cancelar" y, sin `esperarResultado`, la confirmación.
  function cambiarAbierto(nuevo: boolean) {
    setAbiertoPropio(nuevo);
    alCambiarAbierto?.(nuevo);
    if (nuevo) return;
    alCerrar?.(confirmado.current ? 'confirmado' : 'cancelado');
    confirmado.current = false;
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    if (!esperarResultado) {
      // Radix cierra el diálogo y la acción sigue por su cuenta.
      confirmado.current = true;
      void onConfirmar();
      return;
    }
    evento.preventDefault();
    if (confirmando) return;
    setConfirmando(true);
    try {
      const resultado = await onConfirmar();
      if (resultado === false) return;
      confirmado.current = true;
      cambiarAbierto(false);
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
