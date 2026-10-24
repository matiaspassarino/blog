// Reglas de entrada del editor (contracts/atajos.md): qué escrito al comienzo de una línea vacía convierte el
// párrafo y cuándo la «/» abre el menú. Son funciones puras; ProseMirror aplica la conversión y esto la nombra.

export type AtajoDeEscritura =
  | { tipo: 'titulo'; nivel: 2 | 3 | 4 }
  | { tipo: 'lista'; ordenada: boolean }
  | { tipo: 'cita' }
  | { tipo: 'separador' }
  | { tipo: 'codigo' };

const DISPARADORES: Record<string, AtajoDeEscritura> = {
  '## ': { tipo: 'titulo', nivel: 2 },
  '### ': { tipo: 'titulo', nivel: 3 },
  '#### ': { tipo: 'titulo', nivel: 4 },
  '- ': { tipo: 'lista', ordenada: false },
  '* ': { tipo: 'lista', ordenada: false },
  '1. ': { tipo: 'lista', ordenada: true },
  '> ': { tipo: 'cita' },
  '---': { tipo: 'separador' },
  '```': { tipo: 'codigo' },
};

/** `textoDeLaLinea` es todo el texto del párrafo: solo hay atajo si es exactamente el disparador. */
export function detectarAtajo(textoDeLaLinea: string): AtajoDeEscritura | null {
  return Object.hasOwn(DISPARADORES, textoDeLaLinea) ? (DISPARADORES[textoDeLaLinea] ?? null) : null;
}

/** El menú «/» solo se abre en una línea vacía: ni en medio de un texto ni dentro de una URL. */
export const puedeAbrirMenu = ({ antes, despues }: { antes: string; despues: string }) =>
  antes === '' && despues === '';

export const esMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Teclas del superíndice y del subíndice: `Ctrl+.` y `Ctrl+,` fuera de macOS. En Mac no hay (`Cmd+,` abre la
 * configuración y `Cmd+.` detiene la carga en Safari). El tachado, el resaltado y la alineación no tienen atajo.
 */
export const atajosDeIndices = () => (esMac() ? null : { superindice: 'Ctrl-.', subindice: 'Ctrl-,' });

/** Nombre del resultado, para anunciarlo ("Se convirtió en título 2"). */
export function nombreDeAtajo(atajo: AtajoDeEscritura): string {
  switch (atajo.tipo) {
    case 'titulo':
      return `título ${atajo.nivel}`;
    case 'lista':
      return atajo.ordenada ? 'lista numerada' : 'lista con viñetas';
    case 'codigo':
      return 'bloque de código';
    default:
      return atajo.tipo;
  }
}
