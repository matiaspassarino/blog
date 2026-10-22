// Ayudas de las pruebas de render estático (`renderToStaticMarkup`, entorno `node`; spec 004, research D13): sin DOM
// ni Testing Library, se lee el HTML como texto.

const VACIOS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Atributos de la primera etiqueta que cumple `predicado` sobre su HTML de apertura. */
type Etiqueta = { nombre: string; apertura: string; atributos: Record<string, string>; inicio: number };

function atributosDe(apertura: string): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const [, clave, valor] of apertura.matchAll(/\s([a-zA-Z_:][\w:.-]*)(?:="([^"]*)")?/g)) {
    if (clave) atributos[clave] = valor ?? '';
  }
  return atributos;
}

/** Todas las etiquetas de apertura del HTML, en orden de aparición. */
export function etiquetasDe(html: string): Etiqueta[] {
  return [...html.matchAll(/<([a-zA-Z][\w-]*)(\s[^>]*?)?\/?>/g)].map((m) => ({
    nombre: (m[1] ?? '').toLowerCase(),
    apertura: m[0],
    atributos: atributosDe(m[0]),
    inicio: m.index ?? 0,
  }));
}

/** Primera etiqueta con ese nombre (y, si se indica, que cumpla el filtro). */
export function etiquetaDe(html: string, nombre: string, filtro: (e: Etiqueta) => boolean = () => true) {
  return etiquetasDe(html).find((e) => e.nombre === nombre && filtro(e));
}

/** Clases (como lista) de una etiqueta. */
export const clasesDeEtiqueta = (etiqueta: Etiqueta | undefined) =>
  (etiqueta?.atributos.class ?? '').split(/\s+/).filter(Boolean);

/**
 * Etiquetas abiertas (ancestros, del más externo al más interno) en la posición `indice` del HTML. Sirve para
 * comprobar, por ejemplo, que el contenedor de unas acciones tiene una clase `md:`.
 */
export function ancestrosEn(html: string, indice: number): Etiqueta[] {
  const pila: Etiqueta[] = [];
  const patron = /<(\/)?([a-zA-Z][\w-]*)(\s[^>]*?)?(\/)?>/g;
  for (const m of html.matchAll(patron)) {
    if ((m.index ?? 0) >= indice) break;
    const nombre = (m[2] ?? '').toLowerCase();
    if (m[1]) {
      const posicion = pila.map((e) => e.nombre).lastIndexOf(nombre);
      if (posicion >= 0) pila.length = posicion;
    } else if (!m[4] && !VACIOS.has(nombre)) {
      pila.push({ nombre, apertura: m[0], atributos: atributosDe(m[0]), inicio: m.index ?? 0 });
    }
  }
  return pila;
}
