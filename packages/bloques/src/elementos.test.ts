// T092 (spec 005, ampliación): los elementos del documento (research D22, D26 y D31 C2 y C6;
// contracts/documento.md).
//
// Firmas propuestas (T101), exportadas desde './elementos':
//   TIPOS_ELEMENTO: readonly TipoElemento[]   // los once de la Fase 10, en el orden del contrato
//   crearElemento<T extends TipoElemento>(tipo: T): ElementoDe<T>   // id uuid nuevo; valores iniciales del editor
//   textoDeElemento(elemento: Elemento): string   // texto visible, sin marcas ni URL; hardBreak e ítems con '\n'
//   visibleDeDocumento(documento: Documento): Visible   // el formato de pruebas/salida-anterior.json (T089):
//     { textos: string[]; anclas: string[]; imagenes: { src, alt, leyenda }[]; enlaces: { href, texto }[] }
//   datosDeElemento<T>(elemento: ElementoDe<T>): DatosDe<T>   // la forma que reciben hoy los editores de campos
//   elementoDesdeDatos<T>(elemento: ElementoDe<T>, datos: Partial<DatosDe<T>>): ElementoDe<T>
//   recorrer(documento: Documento, visitante: (nodo, indiceElemento: number) => void): void   // en orden de lectura
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  crearElemento,
  datosDeElemento,
  elementoDesdeDatos,
  recorrer,
  textoDeElemento,
  TIPOS_ELEMENTO,
  visibleDeDocumento,
} from './elementos';
import { esquemaDocumento } from './esquema';
import {
  CORPUS_DOCUMENTOS,
  DOCUMENTOS_EQUIVALENTES,
  imagenDePrueba,
  marca,
  nodo,
  type NodoPrueba,
} from './pruebas/corpus-documento';

const {
  doc,
  texto,
  salto,
  parrafo,
  titulo,
  item,
  vinetas,
  numerada,
  cita,
  codigo,
  separador,
  celda,
  encabezado,
  fila,
  tabla,
  parrafoSimple,
} = nodo;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SALIDA_ANTERIOR = JSON.parse(
  readFileSync(fileURLToPath(new URL('./pruebas/salida-anterior.json', import.meta.url)), 'utf8'),
) as Record<string, unknown>;

// Los editores de campos de hoy se escriben sin tipos estrictos: el adaptador se prueba por valores.
const comoElemento = (elemento: NodoPrueba) => elemento as never;
const comoDocumento = (documento: NodoPrueba) => documento as never;

describe('TIPOS_ELEMENTO', () => {
  it('son los doce tipos de primer nivel en el orden del contrato, con table (T133)', () => {
    expect([...TIPOS_ELEMENTO]).toEqual([
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'blockquote',
      'codeBlock',
      'horizontalRule',
      'table',
      'imagen',
      'galeria',
      'cta',
      'video',
    ]);
  });
});

describe('crearElemento', () => {
  it.each(TIPOS_ELEMENTO.map((tipo) => [tipo]))('crea un %s con su tipo y un id uuid', (tipo) => {
    const elemento = crearElemento(tipo) as unknown as NodoPrueba;

    expect(elemento.type).toBe(tipo);
    expect(elemento.attrs?.id).toMatch(UUID);
  });

  it('cada llamada da un id nuevo', () => {
    const ids = TIPOS_ELEMENTO.flatMap((tipo) => [crearElemento(tipo), crearElemento(tipo)]).map(
      (elemento) => (elemento as unknown as NodoPrueba).attrs?.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('un separador nuevo ya es válido; los demás tienen la forma del contrato y los valores iniciales de hoy', () => {
    expect(esquemaDocumento.safeParse(doc(crearElemento('horizontalRule') as never)).success).toBe(true);
    expect(crearElemento('heading')).toMatchObject({ attrs: { level: 2 } });
    expect(crearElemento('galeria')).toMatchObject({ attrs: { imagenes: [], columnas: 3 } });
    expect(crearElemento('video')).toMatchObject({ attrs: { proveedor: 'youtube', idVideo: '', titulo: '' } });
    expect(crearElemento('cta')).toMatchObject({ attrs: { titulo: '', etiquetaBoton: '', url: '' } });
  });

  it('una tabla nueva es de 3x3 con encabezados y tiene id uuid (T133)', () => {
    const t = crearElemento('table' as never) as unknown as NodoPrueba;
    expect(t.type).toBe('table');
    expect(t.attrs?.id).toMatch(UUID);
    expect(t.content).toHaveLength(3);
    const primeraFila = t.content?.[0] as NodoPrueba;
    expect(primeraFila.type).toBe('tableRow');
    expect(primeraFila.content).toHaveLength(3);
    expect(primeraFila.content?.[0]?.type).toBe('tableHeader');
  });

  it('una lista nueva tiene un ítem con un párrafo (la forma del contrato)', () => {
    const lista = crearElemento('bulletList') as unknown as NodoPrueba;

    expect(lista.content).toHaveLength(1);
    expect(lista.content?.[0]?.type).toBe('listItem');
    expect(lista.content?.[0]?.content?.[0]?.type).toBe('paragraph');
  });
});

describe('textoDeElemento', () => {
  it('devuelve el texto visible de un párrafo sin marcas ni URL', () => {
    const elemento = parrafo(
      texto('Leé '),
      texto('la guía', marca.enlace('https://www.w3.org/WAI/'), marca.negrita),
      texto(' y usá '),
      texto('npm', marca.codigo),
      texto('.'),
    );

    expect(textoDeElemento(comoElemento(elemento))).toBe('Leé la guía y usá npm.');
  });

  it('un hardBreak es un salto de línea', () => {
    expect(textoDeElemento(comoElemento(parrafo(texto('Uno'), salto(), texto('dos'))))).toBe('Uno\ndos');
  });

  it('una lista da sus ítems, uno por línea', () => {
    const lista = numerada(item(texto('Primero')), item(texto('Segundo '), texto('fuerte', marca.negrita)));

    expect(textoDeElemento(comoElemento(lista))).toBe('Primero\nSegundo fuerte');
  });

  it('un título y una cita dan su texto', () => {
    expect(textoDeElemento(comoElemento(titulo(2, texto('Un título'))))).toBe('Un título');
    expect(textoDeElemento(comoElemento(cita({ autor: 'Alguien' }, texto('Menos es más.'))))).toBe('Menos es más.');
  });

  it('un separador no tiene texto', () => {
    expect(textoDeElemento(comoElemento(separador()))).toBe('');
  });

  it('una tabla da el texto de todas sus celdas separadas por saltos de línea (T133)', () => {
    const t = tabla(
      undefined,
      fila(encabezado(undefined, parrafoSimple(texto('A'))), encabezado(undefined, parrafoSimple(texto('B')))),
      fila(celda(undefined, parrafoSimple(texto('C'))), celda(undefined, parrafoSimple(texto('D')))),
    );
    expect(textoDeElemento(comoElemento(t))).toBe('A\nB\nC\nD');
  });
});

describe('visibleDeDocumento (D26, D31 C2): lo que muestra el sitio, sin JSX', () => {
  it.each(Object.entries(DOCUMENTOS_EQUIVALENTES))(
    'CE-002: el documento equivalente a "%s" muestra lo mismo que la fixture del renderer anterior',
    (nombre, documento) => {
      expect(SALIDA_ANTERIOR[nombre], `falta "${nombre}" en salida-anterior.json`).toBeDefined();
      expect(visibleDeDocumento(documento)).toEqual(SALIDA_ANTERIOR[nombre]);
    },
  );

  it('el documento vacío no muestra nada', () => {
    expect(visibleDeDocumento(comoDocumento(doc()))).toEqual({ textos: [], anclas: [], imagenes: [], enlaces: [] });
  });

  it('una tabla en visibleDeDocumento extrae el texto de las celdas y enlaces en ellas (T133)', () => {
    const t = tabla(
      { descripcion: 'Una tabla' },
      fila(encabezado(undefined, parrafoSimple(texto('Encabezado')))),
      fila(celda(undefined, parrafoSimple(texto('Dato con '), texto('enlace', marca.enlace('/ruta'))))),
    );
    const visible = visibleDeDocumento(comoDocumento(doc(t)));
    expect(visible.textos).toContain('Encabezado Dato con enlace');
    expect(visible.enlaces).toContainEqual({ href: '/ruta', texto: 'enlace' });
  });

  it('las anclas son únicas como hoy: sufijo -2, no pisan "contenido" y un título sin letras no tiene ancla', () => {
    const documento = CORPUS_DOCUMENTOS.find(({ nombre }) => nombre === 'títulos repetidos y sin letras')?.documento;

    expect(visibleDeDocumento(documento as never).anclas).toEqual([
      'primeros-pasos',
      'primeros-pasos-2',
      'contenido-2',
    ]);
  });

  it('un enlace inseguro no es un enlace y su texto se sigue viendo', () => {
    const documento = doc(parrafo(texto('Clic', marca.enlace('javascript:alert(1)')), texto(' acá.')));

    const visible = visibleDeDocumento(comoDocumento(documento));
    expect(visible.enlaces).toEqual([]);
    expect(visible.textos).toEqual(['Clic acá.']);
  });

  it('la imagen decorativa tiene alt vacío y no muestra la leyenda', () => {
    const documento = doc(nodo.imagen(imagenDePrueba('decorativa'), 'Una leyenda que no se muestra'));

    expect(visibleDeDocumento(comoDocumento(documento)).imagenes).toEqual([
      { src: 'https://picsum.photos/seed/decorativa/1600/900', alt: '', leyenda: null },
    ]);
  });
});

describe('datosDeElemento y elementoDesdeDatos: el adaptador de los ocho editores de campos (D31 C6)', () => {
  const imagen = imagenDePrueba('una', 'Una foto');
  const casos: [string, NodoPrueba, Record<string, unknown>][] = [
    ['imagen', nodo.imagen(imagen, 'Leyenda'), { imagen, leyenda: 'Leyenda' }],
    [
      'galería',
      nodo.galeria(2, imagen, imagenDePrueba('dos', 'Otra foto')),
      { imagenes: [imagen, imagenDePrueba('dos', 'Otra foto')], columnas: 2 },
    ],
    [
      'llamada a la acción',
      nodo.cta({ titulo: 'Hola', etiquetaBoton: 'Ir', url: '/blog', variante: 'secundaria' }),
      { titulo: 'Hola', etiquetaBoton: 'Ir', url: '/blog', variante: 'secundaria' },
    ],
    [
      'video',
      nodo.video('vimeo', '76979871', 'Un video'),
      { proveedor: 'vimeo', idVideo: '76979871', titulo: 'Un video' },
    ],
    ['título (level ↔ nivel)', titulo(3, texto('Un título')), { nivel: 3 }],
    [
      'cita',
      cita({ autor: 'Alguien', fuente: 'https://ejemplo.com' }, texto('Menos es más.')),
      { autor: 'Alguien', fuente: 'https://ejemplo.com' },
    ],
    ['lista con viñetas (tipo ↔ ordenada)', vinetas(item(texto('Uno'))), { ordenada: false }],
    ['lista numerada (tipo ↔ ordenada)', numerada(item(texto('Uno'))), { ordenada: true }],
    ['código', codigo('const a = 1;', 'ts'), { lenguaje: 'ts' }],
  ];

  it.each(casos)('%s: entrega los campos con los nombres de hoy', (_caso, elemento, esperado) => {
    expect(datosDeElemento(comoElemento(elemento))).toMatchObject(esperado);
  });

  it.each(casos)('%s: ida y vuelta sin cambios', (_caso, elemento) => {
    const original = structuredClone(elemento);

    expect(elementoDesdeDatos(comoElemento(elemento), datosDeElemento(comoElemento(elemento)) as never)).toEqual(
      original,
    );
    expect(elemento).toEqual(original);
  });

  it('título: cambiar el nivel cambia level y conserva el id y el texto con sus marcas', () => {
    const elemento = titulo(2, texto('Un '), texto('título', marca.negrita));

    expect(elementoDesdeDatos(comoElemento(elemento), { nivel: 4 } as never)).toEqual({
      ...elemento,
      attrs: { ...elemento.attrs, level: 4 },
    });
  });

  it('lista: cambiar ordenada cambia el tipo de nodo y conserva el id y los ítems', () => {
    const elemento = vinetas(item(texto('Uno')), item(texto('Dos')));

    expect(elementoDesdeDatos(comoElemento(elemento), { ordenada: true } as never)).toEqual({
      ...elemento,
      type: 'orderedList',
    });
  });

  it('cita: quitar el autor quita el atributo (forma canónica)', () => {
    const elemento = cita({ autor: 'Alguien' }, texto('Menos es más.'));

    expect(elementoDesdeDatos(comoElemento(elemento), { autor: undefined } as never)).toEqual({
      ...elemento,
      attrs: { id: elemento.attrs?.id },
    });
  });

  it('código: cambiar el lenguaje conserva el código', () => {
    const elemento = codigo('const a = 1;', 'ts');

    expect(elementoDesdeDatos(comoElemento(elemento), { lenguaje: 'js' } as never)).toEqual({
      ...elemento,
      attrs: { ...elemento.attrs, lenguaje: 'js' },
    });
  });

  it('imagen: cambiar la leyenda conserva la imagen y el id', () => {
    const elemento = nodo.imagen(imagen, 'Antes');

    expect(elementoDesdeDatos(comoElemento(elemento), { leyenda: 'Después' } as never)).toEqual({
      ...elemento,
      attrs: { ...elemento.attrs, leyenda: 'Después' },
    });
  });
});

describe('recorrer', () => {
  it('visita cada nodo en orden de lectura con el índice de su elemento de primer nivel', () => {
    const documento = doc(
      parrafo(texto('Uno', marca.negrita), salto(), texto('dos')),
      vinetas(item(texto('Ítem'))),
      separador(),
    );
    const visitados: string[] = [];

    recorrer(comoDocumento(documento), (nodoActual: { type: string }, indice: number) => {
      visitados.push(`${indice}:${nodoActual.type}`);
    });

    expect(visitados).toEqual([
      '0:paragraph',
      '0:text',
      '0:hardBreak',
      '0:text',
      '1:bulletList',
      '1:listItem',
      '1:paragraph',
      '1:text',
      '2:horizontalRule',
    ]);
  });

  it('con el documento vacío no visita nada', () => {
    const visitados: unknown[] = [];

    recorrer(comoDocumento(doc()), (nodoActual: unknown) => visitados.push(nodoActual));

    expect(visitados).toEqual([]);
  });
});
