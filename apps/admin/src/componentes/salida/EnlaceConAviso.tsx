'use client';

// Enlace del panel que respeta el aviso de cambios sin guardar. Con cambios, en lugar de navegar abre el
// diálogo de confirmación; con un clic modificado (nueva pestaña) o sin cambios, se comporta como un enlace.
import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { useSalida } from './ProveedorSalida';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

export function EnlaceConAviso({ href, onClick, ...props }: Props) {
  const { sucio, salirHacia } = useSalida();

  function alHacerClic(evento: MouseEvent<HTMLAnchorElement>) {
    onClick?.(evento);
    const modificado = evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button !== 0;
    if (evento.defaultPrevented || !sucio || modificado) return;
    evento.preventDefault();
    salirHacia(href);
  }

  return <Link href={href} onClick={alHacerClic} {...props} />;
}
