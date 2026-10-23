import type { ElementoDe } from '../esquema';
import { CLASES_TITULO, CLASES_TITULO_POR_NIVEL } from './clases';
import { EnLinea } from './EnLinea';

/** Los títulos del cuerpo empiezan en h2: el h1 es el del artículo (RSEO-008). `ancla` la calcula Documento. */
export function Titulo({ elemento, ancla }: { elemento: ElementoDe<'heading'>; ancla: string | undefined }) {
  const { level } = elemento.attrs;
  const Etiqueta = `h${level}` as const;
  return (
    <Etiqueta id={ancla} className={`${CLASES_TITULO} ${CLASES_TITULO_POR_NIVEL[level]}`}>
      <EnLinea contenido={elemento.content} />
    </Etiqueta>
  );
}
