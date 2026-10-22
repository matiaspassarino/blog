import type { BloqueDe } from '../esquema';
import { CLASES_TITULO, CLASES_TITULO_POR_NIVEL } from './clases';

/** Los títulos del cuerpo empiezan en h2: el h1 es el del artículo (RSEO-008). `ancla` la calcula Bloques. */
export function Titulo({ bloque, ancla }: { bloque: BloqueDe<'titulo'>; ancla: string | undefined }) {
  const Etiqueta = `h${bloque.nivel}` as const;
  return (
    <Etiqueta id={ancla} className={`${CLASES_TITULO} ${CLASES_TITULO_POR_NIVEL[bloque.nivel]}`}>
      {bloque.texto}
    </Etiqueta>
  );
}
