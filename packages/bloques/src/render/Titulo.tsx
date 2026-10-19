import type { BloqueDe } from '../esquema';

const ESTILOS = {
  2: 'mt-12 text-titulo-2',
  3: 'mt-10 text-titulo-3',
  4: 'mt-8 text-xl',
} as const;

/** Los títulos del cuerpo empiezan en h2: el h1 es el del artículo (RSEO-008). `ancla` la calcula Bloques. */
export function Titulo({ bloque, ancla }: { bloque: BloqueDe<'titulo'>; ancla: string | undefined }) {
  const Etiqueta = `h${bloque.nivel}` as const;
  return (
    <Etiqueta id={ancla} className={`scroll-mt-8 font-titulos font-bold text-balance ${ESTILOS[bloque.nivel]}`}>
      {bloque.texto}
    </Etiqueta>
  );
}
