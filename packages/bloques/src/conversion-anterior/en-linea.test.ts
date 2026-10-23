// T014 (spec 005, RF-004, RF-009, CE-002; research D3; contracts/documento.md): la gramática en línea única.
// FASE ROJA: `./en-linea` no existe. API supuesta (contracts/documento.md):
//   analizarEnLinea(texto: string): NodoEnLinea[]
//   serializarEnLinea(nodos: NodoEnLinea[]): string
//   normalizarMarcas(nodos: NodoEnLinea[]): NodoEnLinea[]
//   NodoEnLinea = texto | negrita | cursiva | codigo | enlace (ver contrato)
import { describe, expect, it } from 'vitest';
import { analizarEnLinea, normalizarMarcas, serializarEnLinea, type NodoEnLinea } from './en-linea';
import { CORPUS_CONTENIDOS, CORPUS_TEXTOS } from '../pruebas/corpus-contenido';

const ANCHO_CERO = '​';

// Generador pseudoaleatorio con semilla (mulberry32): las pruebas de propiedades son reproducibles.
function crearAzar(semilla: number) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const elegir = <T>(azar: () => number, opciones: readonly T[]): T => opciones[Math.floor(azar() * opciones.length)] as T;

const PIEZAS_DE_TEXTO = ['a', 'b', 'foo', 'bar', ' ', '  ', '**', '*', '_', '`', '[', ']', '](', '(', ')', '\n', 'https://x.com', 'ñ'];

function textoAlAzar(azar: () => number): string {
  const largo = Math.floor(azar() * 14);
  return Array.from({ length: largo }, () => elegir(azar, PIEZAS_DE_TEXTO)).join('');
}

const FRAGMENTOS = ['a', 'b c', ' ', ' x', 'y ', 'foo', 'bar_', '_baz', '*', '`', '[', ']', '](', 'ñu', ' z '];
const HREFS = ['/x', '/blog/otro', 'https://a.com/b', 'https://es.wikipedia.org/wiki/Foo_(bar)'];

function arbolAlAzar(azar: () => number, profundidad: number): NodoEnLinea[] {
  const cantidad = 1 + Math.floor(azar() * 3);
  return Array.from({ length: cantidad }, (): NodoEnLinea => {
    const tipo = profundidad <= 0 ? 'texto' : elegir(azar, ['texto', 'texto', 'negrita', 'cursiva', 'codigo', 'enlace'] as const);
    if (tipo === 'texto') return { tipo: 'texto', texto: elegir(azar, FRAGMENTOS) };
    if (tipo === 'codigo') return { tipo: 'codigo', texto: elegir(azar, FRAGMENTOS) };
    if (tipo === 'enlace') return { tipo: 'enlace', href: elegir(azar, HREFS), hijos: arbolAlAzar(azar, profundidad - 1) };
    return { tipo, hijos: arbolAlAzar(azar, profundidad - 1) };
  });
}

const sinAnchoCero = (texto: string) => texto.replaceAll(ANCHO_CERO, '');
const todosLosNodos = (nodos: NodoEnLinea[]): NodoEnLinea[] =>
  nodos.flatMap((nodo) => ('hijos' in nodo ? [nodo, ...todosLosNodos(nodo.hijos)] : [nodo]));
const textoDe = (nodos: NodoEnLinea[]): string =>
  nodos.map((nodo) => ('hijos' in nodo ? textoDe(nodo.hijos) : nodo.texto)).join('');

const textos = (azar: () => number, cantidad: number) => Array.from({ length: cantidad }, () => textoAlAzar(azar));

describe('analizarEnLinea: reglas de hoy de TextoEnLinea (spec 005, RF-004)', () => {
  it('RF-004: **negrita** produce un nodo negrita con su interior', () => {
    expect(analizarEnLinea('a **voz** b')).toEqual([
      { tipo: 'texto', texto: 'a ' },
      { tipo: 'negrita', hijos: [{ tipo: 'texto', texto: 'voz' }] },
      { tipo: 'texto', texto: ' b' },
    ]);
  });

  it('RF-004: _cursiva_ produce un nodo cursiva, y no abre dentro de una palabra', () => {
    expect(analizarEnLinea('un _texto_ acá')).toEqual([
      { tipo: 'texto', texto: 'un ' },
      { tipo: 'cursiva', hijos: [{ tipo: 'texto', texto: 'texto' }] },
      { tipo: 'texto', texto: ' acá' },
    ]);
    expect(analizarEnLinea('foo_bar_baz')).toEqual([{ tipo: 'texto', texto: 'foo_bar_baz' }]);
  });

  it('RF-004: `código` no interpreta su contenido', () => {
    expect(analizarEnLinea('usá `**x**` así')).toEqual([
      { tipo: 'texto', texto: 'usá ' },
      { tipo: 'codigo', texto: '**x**' },
      { tipo: 'texto', texto: ' así' },
    ]);
  });

  it('RF-004: [texto](url) produce un enlace y la URL balancea paréntesis', () => {
    expect(analizarEnLinea('ver [wiki](https://es.wikipedia.org/wiki/Foo_(bar)) hoy')).toEqual([
      { tipo: 'texto', texto: 'ver ' },
      { tipo: 'enlace', href: 'https://es.wikipedia.org/wiki/Foo_(bar)', hijos: [{ tipo: 'texto', texto: 'wiki' }] },
      { tipo: 'texto', texto: ' hoy' },
    ]);
  });

  it('RF-004: el interior de negrita y cursiva no empieza ni termina con espacio', () => {
    expect(analizarEnLinea('** a **')).toEqual([{ tipo: 'texto', texto: '** a **' }]);
    expect(analizarEnLinea('_ a _')).toEqual([{ tipo: 'texto', texto: '_ a _' }]);
  });

  it('RF-004: una marca sin cerrar queda como texto', () => {
    expect(analizarEnLinea('sin **cerrar')).toEqual([{ tipo: 'texto', texto: 'sin **cerrar' }]);
    expect(analizarEnLinea('sin `cerrar')).toEqual([{ tipo: 'texto', texto: 'sin `cerrar' }]);
  });

  it('RF-004: las marcas se anidan', () => {
    expect(analizarEnLinea('**a _b_**')).toEqual([
      {
        tipo: 'negrita',
        hijos: [
          { tipo: 'texto', texto: 'a ' },
          { tipo: 'cursiva', hijos: [{ tipo: 'texto', texto: 'b' }] },
        ],
      },
    ]);
  });

  it('RF-004: un texto vacío da una lista vacía', () => {
    expect(analizarEnLinea('')).toEqual([]);
  });
});

describe('serializarEnLinea(analizarEnLinea(x)) === x (CE-002)', () => {
  it.each(CORPUS_TEXTOS.map((texto) => [JSON.stringify(texto), texto] as const))(
    'CE-002: ida y vuelta del texto %s del corpus',
    (_nombre, texto) => {
      expect(serializarEnLinea(analizarEnLinea(texto))).toBe(texto);
    },
  );

  it('CE-002: ida y vuelta de todos los textos de los bloques del corpus de contenidos', () => {
    const textosDeBloques = CORPUS_CONTENIDOS.flatMap(({ contenido }) =>
      contenido.flatMap((bloque) =>
        bloque.tipo === 'lista' ? bloque.items : 'texto' in bloque && bloque.texto !== undefined ? [bloque.texto] : [],
      ),
    );
    expect(textosDeBloques.length).toBeGreaterThan(10);

    for (const texto of textosDeBloques) expect(serializarEnLinea(analizarEnLinea(texto)), texto).toBe(texto);
  });

  it('CE-002: ida y vuelta de 500 textos al azar con las marcas mezcladas', () => {
    const azar = crearAzar(20261022);

    for (const texto of textos(azar, 500)) {
      expect(serializarEnLinea(analizarEnLinea(texto)), JSON.stringify(texto)).toBe(texto);
    }
  });

  it('D3: la salida del analizador nunca agrega U+200B (solo se inserta para texto plano ambiguo)', () => {
    for (const texto of CORPUS_TEXTOS) expect(serializarEnLinea(analizarEnLinea(texto))).not.toContain(ANCHO_CERO);
  });
});

describe('analizarEnLinea(serializarEnLinea(n)) === normalizarMarcas(n) (CE-002)', () => {
  it('CE-002: 500 árboles al azar con las cuatro marcas, espacios en los bordes, anidado y texto adyacente', () => {
    const azar = crearAzar(7);

    for (let i = 0; i < 500; i++) {
      const arbol = arbolAlAzar(azar, 3);
      const normalizado = normalizarMarcas(arbol);

      expect(analizarEnLinea(serializarEnLinea(arbol)), JSON.stringify(arbol)).toEqual(normalizado);
    }
  });

  it('CE-002: normalizarMarcas es idempotente', () => {
    const azar = crearAzar(99);

    for (let i = 0; i < 300; i++) {
      const normalizado = normalizarMarcas(arbolAlAzar(azar, 3));

      expect(normalizarMarcas(normalizado)).toEqual(normalizado);
    }
  });

  it('CE-002: un árbol que ya sale del analizador queda igual al normalizarlo', () => {
    for (const texto of CORPUS_TEXTOS) {
      const analizado = analizarEnLinea(texto);

      expect(normalizarMarcas(analizado), JSON.stringify(texto)).toEqual(analizado);
    }
  });

  it('CE-002: nodos de texto adyacentes se unen en uno solo', () => {
    expect(
      normalizarMarcas([
        { tipo: 'texto', texto: 'a' },
        { tipo: 'texto', texto: 'b' },
      ]),
    ).toEqual([{ tipo: 'texto', texto: 'ab' }]);
  });

  it('CE-002: una marca sin contenido desaparece', () => {
    expect(normalizarMarcas([{ tipo: 'negrita', hijos: [] }])).toEqual([]);
  });
});

describe('casos de la revisión (research D3)', () => {
  it('negrita con espacio final: el espacio sale del marcador (**palabra ** -> **palabra** )', () => {
    const arbol: NodoEnLinea[] = [{ tipo: 'negrita', hijos: [{ tipo: 'texto', texto: 'palabra ' }] }];

    expect(normalizarMarcas(arbol)).toEqual([
      { tipo: 'negrita', hijos: [{ tipo: 'texto', texto: 'palabra' }] },
      { tipo: 'texto', texto: ' ' },
    ]);
    expect(serializarEnLinea(arbol)).toBe('**palabra** ');
  });

  it('negrita con espacio inicial: el espacio sale del marcador', () => {
    const arbol: NodoEnLinea[] = [{ tipo: 'negrita', hijos: [{ tipo: 'texto', texto: ' palabra' }] }];

    expect(serializarEnLinea(arbol)).toBe(' **palabra**');
  });

  it('cursiva con espacios en los bordes: salen del marcador', () => {
    const arbol: NodoEnLinea[] = [{ tipo: 'cursiva', hijos: [{ tipo: 'texto', texto: ' hola ' }] }];

    expect(serializarEnLinea(arbol)).toBe(' _hola_ ');
  });

  it('cursiva a mitad de palabra (foo_bar_): se degrada a texto plano', () => {
    const arbol: NodoEnLinea[] = [
      { tipo: 'texto', texto: 'foo' },
      { tipo: 'cursiva', hijos: [{ tipo: 'texto', texto: 'bar' }] },
    ];

    expect(normalizarMarcas(arbol)).toEqual([{ tipo: 'texto', texto: 'foobar' }]);
    expect(todosLosNodos(analizarEnLinea(serializarEnLinea(arbol))).some((nodo) => nodo.tipo === 'cursiva')).toBe(false);
  });

  it('código que contiene una comilla invertida: se degrada a texto plano', () => {
    const arbol: NodoEnLinea[] = [{ tipo: 'codigo', texto: 'a`b' }];

    const normalizado = normalizarMarcas(arbol);

    expect(todosLosNodos(normalizado).some((nodo) => nodo.tipo === 'codigo')).toBe(false);
    expect(sinAnchoCero(textoDe(normalizado))).toBe('a`b');
    expect(analizarEnLinea(serializarEnLinea(arbol))).toEqual(normalizado);
  });

  it('etiqueta de enlace con "](": se degrada a texto plano', () => {
    const arbol: NodoEnLinea[] = [{ tipo: 'enlace', href: '/x', hijos: [{ tipo: 'texto', texto: 'a](b' }] }];

    const normalizado = normalizarMarcas(arbol);

    expect(todosLosNodos(normalizado).some((nodo) => nodo.tipo === 'enlace')).toBe(false);
    expect(sinAnchoCero(textoDe(normalizado))).toContain('a](b');
    expect(analizarEnLinea(serializarEnLinea(arbol))).toEqual(normalizado);
  });

  it('marcas del mismo tipo anidadas (negrita dentro de negrita) quedan bien formadas', () => {
    const arbol: NodoEnLinea[] = [
      { tipo: 'negrita', hijos: [{ tipo: 'texto', texto: 'a ' }, { tipo: 'negrita', hijos: [{ tipo: 'texto', texto: 'b' }] }] },
    ];

    expect(analizarEnLinea(serializarEnLinea(arbol))).toEqual(normalizarMarcas(arbol));
  });

  it('negrita y cursiva anidadas con bordes mezclados se parten en tramos bien anidados', () => {
    const arbol: NodoEnLinea[] = [
      {
        tipo: 'negrita',
        hijos: [
          { tipo: 'texto', texto: 'uno ' },
          { tipo: 'cursiva', hijos: [{ tipo: 'texto', texto: ' dos ' }] },
          { tipo: 'texto', texto: ' tres' },
        ],
      },
    ];

    const reanalizado = analizarEnLinea(serializarEnLinea(arbol));

    expect(reanalizado).toEqual(normalizarMarcas(arbol));
    expect(textoDe(reanalizado).replace(/\s+/g, ' ').trim()).toBe('uno dos tres');
  });
});

describe('U+200B solo para texto plano ambiguo (research D3)', () => {
  it('texto plano que se leería como negrita lleva U+200B y no se vuelve a leer como marca', () => {
    const arbol: NodoEnLinea[] = [{ tipo: 'texto', texto: 'esto **no** es negrita' }];

    const serializado = serializarEnLinea(arbol);
    const reanalizado = analizarEnLinea(serializado);

    expect(serializado).toContain(ANCHO_CERO);
    expect(todosLosNodos(reanalizado).some((nodo) => nodo.tipo === 'negrita')).toBe(false);
    expect(sinAnchoCero(textoDe(reanalizado))).toBe('esto **no** es negrita');
  });

  it.each([
    ['cursiva', 'una _palabra_ suelta'],
    ['codigo', 'un `fragmento` suelto'],
    ['enlace', 'un [enlace](/x) suelto'],
  ])('texto plano que se leería como %s no se vuelve marca', (tipo, texto) => {
    const reanalizado = analizarEnLinea(serializarEnLinea([{ tipo: 'texto', texto }]));

    expect(todosLosNodos(reanalizado).some((nodo) => nodo.tipo === tipo)).toBe(false);
    expect(sinAnchoCero(textoDe(reanalizado))).toBe(texto);
  });

  it('texto plano sin ambigüedad no lleva U+200B', () => {
    for (const texto of ['hola mundo', 'precio 5 * 3', 'a_b', 'sin cerrar **x', 'ñandú, ¿qué tal?']) {
      expect(serializarEnLinea([{ tipo: 'texto', texto }]), texto).not.toContain(ANCHO_CERO);
    }
  });
});
