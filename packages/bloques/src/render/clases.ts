// Clases de tipografía de los bloques de texto. Las comparten el sitio (los renderers de esta carpeta) y el
// lienzo del editor (spec 005, RF-002): un cambio acá se ve igual en los dos.
export const CLASES_PARRAFO = 'mt-bloque text-lg leading-relaxed';

/** Alineación de párrafos y títulos (la izquierda es la ausencia del atributo). */
const CLASES_ALINEACION: Record<string, string | undefined> = {
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify hyphens-auto',
};

/** Las clases de un párrafo o un título con su alineación (un valor fuera de la lista no agrega nada). */
export const conAlineacion = (clases: string, textAlign: string | undefined) => {
  const alineacion =
    textAlign && Object.hasOwn(CLASES_ALINEACION, textAlign) ? CLASES_ALINEACION[textAlign] : undefined;
  return alineacion ? `${clases} ${alineacion}` : clases;
};

// Marcas en línea con clases propias. El subrayado es fino y del color del texto, sin efecto al pasar el puntero:
// no se parece al enlace (D31 U9). `s`, `sup` y `sub` usan los estilos de base.
export const CLASES_SUBRAYADO = 'underline decoration-1 underline-offset-2 decoration-current';
export const CLASES_RESALTADO = 'bg-resaltado text-resaltado-texto';

export const CLASES_TITULO = 'scroll-mt-8 font-titulos font-bold text-balance';
export const CLASES_TITULO_POR_NIVEL = {
  2: 'mt-12 text-titulo-2',
  3: 'mt-10 text-titulo-3',
  4: 'mt-8 text-xl',
} as const;

export const CLASES_CITA = 'mt-10 border-l-4 border-marca pl-6';
export const CLASES_CITA_TEXTO = 'font-titulos text-titulo-3 leading-snug text-balance';

export const CLASES_LISTA = 'mt-bloque space-y-2 pl-6 text-lg leading-relaxed';
export const CLASES_LISTA_NUMERADA = 'list-decimal';
export const CLASES_LISTA_VINETAS = 'list-disc';

export const CLASES_SEPARADOR = 'mx-auto my-12 w-24 border-t-2 border-separador';

export const CLASES_CODIGO = 'overflow-x-auto rounded-md bg-superficie p-4 font-codigo text-sm leading-relaxed';
