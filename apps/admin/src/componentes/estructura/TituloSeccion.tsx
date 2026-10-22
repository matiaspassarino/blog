import type { ReactNode } from 'react';

type Props = { como?: 'h2' | 'legend'; id?: string; children: ReactNode };

/** Título de sección (y de diálogo): una sola escala para todo el panel (RF-012). */
const CLASES_TITULO_SECCION = 'font-titulos text-titulo-3 font-semibold';

export function TituloSeccion({ como: Etiqueta = 'h2', id, children }: Props) {
  return (
    <Etiqueta id={id} className={CLASES_TITULO_SECCION}>
      {children}
    </Etiqueta>
  );
}
