'use client';

// Aviso de cambios sin guardar (RF-010, research D13). Un contexto comparte el indicador `sucio`:
// el editor lo enciende, `beforeunload` avisa al cerrar o recargar la pestaña, y `EnlaceConAviso` pide
// confirmar antes de salir por un enlace del panel.
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '../ui/alert-dialog';

type ContextoSalida = {
  sucio: boolean;
  setSucio: (valor: boolean) => void;
  /** Pide confirmar la salida hacia `destino`; si no hay cambios, navega directo. */
  salirHacia: (destino: string) => void;
};

const Contexto = createContext<ContextoSalida | null>(null);

export function useSalida(): ContextoSalida {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSalida debe usarse dentro de <ProveedorSalida>');
  return contexto;
}

export function ProveedorSalida({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sucio, setSucio] = useState(false);
  const [destino, setDestino] = useState<string | null>(null);
  // Quien tenía el foco al abrir el diálogo (el enlace pulsado): Radix no lo restaura sin un disparador.
  const previo = useRef<HTMLElement | null>(null);

  // El navegador no admite un texto propio: solo muestra su aviso estándar.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      // Chromium solo muestra el aviso si hay un valor; el texto lo ignora y usa el suyo.
      evento.returnValue = 'Tienes cambios sin guardar';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const valor = useMemo<ContextoSalida>(
    () => ({
      sucio,
      setSucio,
      salirHacia: (siguiente) => {
        if (!sucio) return router.push(siguiente);
        previo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setDestino(siguiente);
      },
    }),
    [sucio, router],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <AlertDialog open={destino !== null} onOpenChange={(abierto) => !abierto && setDestino(null)}>
        <AlertDialogContent
          onCloseAutoFocus={(evento) => {
            evento.preventDefault();
            previo.current?.focus();
          }}
        >
          <AlertDialogTitle>Tienes cambios sin guardar</AlertDialogTitle>
          <AlertDialogDescription>
            Si sales ahora, se descartarán los cambios que hiciste en esta pantalla.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              variante="peligro"
              onClick={() => {
                const siguiente = destino;
                setSucio(false);
                setDestino(null);
                if (siguiente) router.push(siguiente);
              }}
            >
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Contexto.Provider>
  );
}
