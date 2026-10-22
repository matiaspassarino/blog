// Clases de tipografía de los bloques de texto. Las comparten el sitio (los renderers de esta carpeta) y el
// lienzo del editor (spec 005, RF-002): un cambio acá se ve igual en los dos.
export const CLASES_PARRAFO = 'mt-bloque text-lg leading-relaxed';

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
