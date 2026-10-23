// Gramática en línea única (research D3 de la spec 005): **negrita**, _cursiva_, `código` y [texto](url).
// La usan el sitio (`TextoEnLinea`, `textoPlano`) y el editor (conversión documento ↔ bloques), así lo que el
// editor muestra es lo que el sitio mostrará. Una marca sin cerrar queda como texto.

export type NodoEnLinea =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrita' | 'cursiva'; hijos: NodoEnLinea[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'enlace'; href: string; hijos: NodoEnLinea[] };

/** U+200B: delante de una marca la deja como texto (solo para texto plano ambiguo, research D3). */
const ANCHO_CERO = '​';

const esPalabra = (caracter: string | undefined) => caracter !== undefined && /[\p{L}\p{N}]/u.test(caracter);

/** Cierre del enlace: `)` que balancea los paréntesis abiertos dentro de la URL. */
function finDeUrl(texto: string, desde: number): number {
  let abiertos = 0;
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === '(') abiertos++;
    else if (texto[i] === ')') {
      if (abiertos === 0) return i;
      abiertos--;
    }
  }
  return -1;
}

/** `inicios` (opcional) recibe, en paralelo a los nodos, dónde empieza cada marca (-1 en el texto). */
function analizar(texto: string, inicios?: number[]): NodoEnLinea[] {
  const nodos: NodoEnLinea[] = [];
  let literal = '';
  let i = 0;
  const vaciarLiteral = () => {
    if (!literal) return;
    nodos.push({ tipo: 'texto', texto: literal });
    inicios?.push(-1);
    literal = '';
  };
  const empujar = (nodo: NodoEnLinea, desde: number) => {
    vaciarLiteral();
    nodos.push(nodo);
    inicios?.push(desde);
  };

  while (i < texto.length) {
    const resto = texto.slice(i);

    if (resto.startsWith('`') && texto[i + 1] !== ANCHO_CERO) {
      const fin = texto.indexOf('`', i + 1);
      if (fin > i + 1) {
        empujar({ tipo: 'codigo', texto: texto.slice(i + 1, fin) }, i);
        i = fin + 1;
        continue;
      }
    }

    if (resto.startsWith('**') && texto[i + 2] !== ANCHO_CERO) {
      const fin = texto.indexOf('**', i + 2);
      const interior = texto.slice(i + 2, fin);
      if (fin > i + 2 && interior.trim() === interior) {
        empujar({ tipo: 'negrita', hijos: analizar(interior) }, i);
        i = fin + 2;
        continue;
      }
    }

    if (resto.startsWith('_') && texto[i + 1] !== ANCHO_CERO && !esPalabra(texto[i - 1])) {
      let fin = texto.indexOf('_', i + 1);
      while (fin !== -1 && esPalabra(texto[fin + 1])) fin = texto.indexOf('_', fin + 1);
      const interior = texto.slice(i + 1, fin);
      if (fin > i + 1 && interior.trim() === interior) {
        empujar({ tipo: 'cursiva', hijos: analizar(interior) }, i);
        i = fin + 1;
        continue;
      }
    }

    if (resto.startsWith('[') && texto[i + 1] !== ANCHO_CERO) {
      const cierre = texto.indexOf('](', i + 1);
      const fin = cierre === -1 ? -1 : finDeUrl(texto, cierre + 2);
      if (cierre > i + 1 && fin !== -1) {
        empujar(
          { tipo: 'enlace', href: texto.slice(cierre + 2, fin), hijos: analizar(texto.slice(i + 1, cierre)) },
          i,
        );
        i = fin + 1;
        continue;
      }
    }

    literal += texto[i];
    i++;
  }
  vaciarLiteral();
  return nodos;
}

/** Árbol de marcas de un texto guardado. Para todo `x`: `serializarEnLinea(analizarEnLinea(x)) === x`. */
export function analizarEnLinea(texto: string): NodoEnLinea[] {
  return analizar(texto);
}

/** Texto plano que, escrito tal cual, se leería como marca: se le pone U+200B tras el primer carácter de la marca. */
function escaparTexto(texto: string): string {
  if (!/[*_`[]/.test(texto)) return texto;
  let actual = texto;
  for (let vuelta = 0; vuelta <= texto.length; vuelta++) {
    const inicios: number[] = [];
    const posicion = analizar(actual, inicios).findIndex((nodo) => nodo.tipo !== 'texto');
    if (posicion === -1) return actual;
    const desde = (inicios[posicion] ?? 0) + 1;
    actual = actual.slice(0, desde) + ANCHO_CERO + actual.slice(desde);
  }
  return actual;
}

/** La URL de un enlace solo se lee de vuelta si sus paréntesis balancean. */
const urlBalanceada = (href: string) => finDeUrl(`${href})`, 0) === href.length;

const primerCaracter = (nodo: NodoEnLinea | undefined) => (nodo?.tipo === 'texto' ? nodo.texto[0] : undefined);

function serializarLista(nodos: NodoEnLinea[], anterior: string, siguiente: string | undefined, dentro: string[]): string {
  let salida = '';
  nodos.forEach((nodo, i) => {
    const previo = salida ? salida.slice(-1) : anterior;
    const proximo = i + 1 < nodos.length ? primerCaracter(nodos[i + 1]) : siguiente;
    salida += serializarNodo(nodo, previo, proximo, dentro);
  });
  return salida;
}

function serializarNodo(nodo: NodoEnLinea, previo: string, proximo: string | undefined, dentro: string[]): string {
  if (nodo.tipo === 'texto') return escaparTexto(nodo.texto);
  if (nodo.tipo === 'codigo') {
    // Sin contenido, o con una comilla invertida adentro, la gramática no lo puede expresar: queda como texto.
    return nodo.texto && !nodo.texto.includes('`') ? `\`${nodo.texto}\`` : escaparTexto(nodo.texto);
  }

  const anidado = [...dentro, nodo.tipo];
  if (nodo.tipo === 'enlace') {
    const etiqueta = serializarLista(nodo.hijos, '[', ']', anidado);
    if (dentro.includes('enlace') || !etiqueta || etiqueta.includes('](') || !urlBalanceada(nodo.href)) return etiqueta;
    return `[${etiqueta}](${nodo.href})`;
  }

  const interior = serializarLista(nodo.hijos, '*', '*', anidado);
  const nucleo = interior.trim();
  if (dentro.includes(nodo.tipo) || !nucleo) return interior;
  // Los espacios de los bordes salen del marcador: `**palabra **` → `**palabra** `.
  const inicio = interior.slice(0, interior.indexOf(nucleo));
  const fin = interior.slice(inicio.length + nucleo.length);
  if (nodo.tipo === 'cursiva' && (esPalabra((inicio || previo).slice(-1)) || esPalabra((fin || (proximo ?? '')).charAt(0)))) {
    return interior; // la cursiva no abre ni cierra pegada a una palabra
  }
  const marca = nodo.tipo === 'negrita' ? '**' : '_';
  return `${inicio}${marca}${nucleo}${marca}${fin}`;
}

/** Texto guardado de un árbol de marcas. Lo que la gramática no puede expresar se degrada a texto plano. */
export function serializarEnLinea(nodos: NodoEnLinea[]): string {
  return serializarLista(nodos, '', undefined, []);
}

/** Forma que el sitio sabe leer: para todo árbol `n`, `analizarEnLinea(serializarEnLinea(n))` es `normalizarMarcas(n)`. */
export function normalizarMarcas(nodos: NodoEnLinea[]): NodoEnLinea[] {
  return analizar(serializarEnLinea(nodos));
}
