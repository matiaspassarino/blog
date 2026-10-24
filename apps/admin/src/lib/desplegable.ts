'use client';

// Desplegable del panel (spec 004, research D10): lo usan el menú de navegación y "Más acciones". Esc cierra y
// devuelve el foco al botón, el clic afuera cierra, y al cambiar de ruta se cierra solo.
import { usePathname } from 'next/navigation';
import { useEffect, useState, type RefObject } from 'react';

type Opciones = {
  refBoton: RefObject<HTMLElement | null>;
  refPanel: RefObject<HTMLElement | null>;
};

export function useDesplegable({ refBoton, refPanel }: Opciones) {
  const ruta = usePathname();
  // Está abierto "en una ruta": al navegar se cierra solo, sin efectos que reasignen el estado.
  const [rutaAbierta, setRutaAbierta] = useState<string | null>(null);
  const abierto = rutaAbierta !== null && rutaAbierta === ruta;

  const abrir = () => setRutaAbierta(ruta);
  const alternar = () => setRutaAbierta(abierto ? null : ruta);
  const cerrar = (devolverFoco = false) => {
    setRutaAbierta(null);
    if (devolverFoco) refBoton.current?.focus();
  };

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      setRutaAbierta(null);
      refBoton.current?.focus();
    };
    const alHacerClic = (evento: MouseEvent) => {
      const destino = evento.target as Node | null;
      if (destino && (refBoton.current?.contains(destino) || refPanel.current?.contains(destino))) return;
      setRutaAbierta(null);
    };
    // Si el foco sale por Tab, el panel no queda flotando.
    const alMoverFoco = (evento: FocusEvent) => {
      const destino = evento.target as Node | null;
      if (destino && (refBoton.current?.contains(destino) || refPanel.current?.contains(destino))) return;
      setRutaAbierta(null);
    };
    document.addEventListener('keydown', alTeclear);
    document.addEventListener('click', alHacerClic);
    document.addEventListener('focusin', alMoverFoco);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.removeEventListener('click', alHacerClic);
      document.removeEventListener('focusin', alMoverFoco);
    };
  }, [abierto, refBoton, refPanel]);

  return { abierto, abrir, cerrar, alternar };
}
