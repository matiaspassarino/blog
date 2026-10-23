// Corpus de documentos de prueba (spec 005, ampliación; T090 a T095, research D24 y D26): documentos en forma
// canónica ([contracts/documento.md](../../../../specs/005-editor-estilo-documento/contracts/documento.md)) con
// los once tipos de la Fase 10, marcas, saltos de línea y campos opcionales ausentes, y los constructores de nodos
// que usan las pruebas. Queda después del corte (D31 C3): lo usan `normalizar.test.ts`, `elementos.test.ts` y
// `render/documento.test.tsx`. No se exporta desde `index.ts`.
//
// `DOCUMENTOS_EQUIVALENTES` tiene, para algunos contenidos de `corpus-contenido.ts`, el documento que muestra lo
// mismo en el sitio (lo que la conversión tiene que producir): `visibleDeDocumento` y `<Documento>` tienen que dar
// lo de `salida-anterior.json` (T089). Se elimina con `corpus-contenido.ts` en T160.
import type { Documento } from '../esquema';
import type { Imagen } from '../imagen';

export type NodoPrueba = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NodoPrueba[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

let contador = 0;
/** uuid v4 válido y determinista; distinto en cada llamada. */
export const idDePrueba = () => `00000000-0000-4000-9000-${String(++contador).padStart(12, '0')}`;

export const marca = {
  enlace: (href: string) => ({ type: 'link', attrs: { href } }),
  negrita: { type: 'bold' },
  cursiva: { type: 'italic' },
  codigo: { type: 'code' },
  // Fase 12 (H6, RF-009): los cinco formatos nuevos, sin atributos (el resaltado no lleva color).
  subrayado: { type: 'underline' },
  tachado: { type: 'strike' },
  resaltado: { type: 'highlight' },
  superindice: { type: 'superscript' },
  subindice: { type: 'subscript' },
};

/** Alineaciones que se guardan (la izquierda es la ausencia del atributo, contracts/documento.md). */
type Alineacion = 'center' | 'right' | 'justify';

/** Copia de un párrafo o título con la alineación en sus `attrs` (Fase 12, RF-024). */
export const alineado = (elemento: NodoPrueba, textAlign: Alineacion | string): NodoPrueba => ({
  ...elemento,
  attrs: { ...elemento.attrs, textAlign },
});

export const imagenDePrueba = (semilla: string, alt?: string): Imagen => ({
  ruta: `https://picsum.photos/seed/${semilla}/1600/900`,
  ancho: 1600,
  alto: 900,
  ...(alt === undefined ? { decorativa: true } : { alt, decorativa: false }),
});

const conContenido = (contenido: NodoPrueba[]) => (contenido.length > 0 ? { content: contenido } : {});

/** Constructores de nodos en forma canónica (sin atributos vacíos ni `content: []`). */
export const nodo = {
  doc: (...contenido: NodoPrueba[]): NodoPrueba => ({ type: 'doc', content: contenido }),
  texto: (texto: string, ...marcas: NonNullable<NodoPrueba['marks']>): NodoPrueba =>
    marcas.length > 0 ? { type: 'text', text: texto, marks: marcas } : { type: 'text', text: texto },
  salto: (): NodoPrueba => ({ type: 'hardBreak' }),
  parrafo: (...contenido: NodoPrueba[]): NodoPrueba => ({
    type: 'paragraph',
    attrs: { id: idDePrueba() },
    ...conContenido(contenido),
  }),
  titulo: (level: 2 | 3 | 4, ...contenido: NodoPrueba[]): NodoPrueba => ({
    type: 'heading',
    attrs: { id: idDePrueba(), level },
    ...conContenido(contenido),
  }),
  /** Ítem de lista: un `listItem` con un solo `paragraph` (sin `attrs`). */
  item: (...contenido: NodoPrueba[]): NodoPrueba => ({
    type: 'listItem',
    content: [{ type: 'paragraph', ...conContenido(contenido) }],
  }),
  vinetas: (...items: NodoPrueba[]): NodoPrueba => ({
    type: 'bulletList',
    attrs: { id: idDePrueba() },
    content: items,
  }),
  numerada: (...items: NodoPrueba[]): NodoPrueba => ({
    type: 'orderedList',
    attrs: { id: idDePrueba() },
    content: items,
  }),
  cita: (campos: { autor?: string; fuente?: string }, ...contenido: NodoPrueba[]): NodoPrueba => ({
    type: 'blockquote',
    attrs: { id: idDePrueba(), ...campos },
    content: [{ type: 'paragraph', ...conContenido(contenido) }],
  }),
  codigo: (codigo: string, lenguaje?: string): NodoPrueba => ({
    type: 'codeBlock',
    attrs: { id: idDePrueba(), ...(lenguaje ? { lenguaje } : {}) },
    ...(codigo ? { content: [{ type: 'text', text: codigo }] } : {}),
  }),
  separador: (): NodoPrueba => ({ type: 'horizontalRule', attrs: { id: idDePrueba() } }),
  imagen: (imagen: Imagen, leyenda?: string): NodoPrueba => ({
    type: 'imagen',
    attrs: { id: idDePrueba(), imagen, ...(leyenda === undefined ? {} : { leyenda }) },
  }),
  galeria: (columnas: 2 | 3 | 4, ...imagenes: Imagen[]): NodoPrueba => ({
    type: 'galeria',
    attrs: { id: idDePrueba(), imagenes, columnas },
  }),
  cta: (campos: {
    titulo: string;
    texto?: string;
    etiquetaBoton: string;
    url: string;
    variante?: 'primaria' | 'secundaria';
  }): NodoPrueba => ({ type: 'cta', attrs: { id: idDePrueba(), ...campos } }),
  video: (proveedor: 'youtube' | 'vimeo', idVideo: string, titulo: string): NodoPrueba => ({
    type: 'video',
    attrs: { id: idDePrueba(), proveedor, idVideo, titulo },
  }),
};

const { doc, texto, salto, parrafo, titulo, item, vinetas, numerada, cita, codigo, separador } = nodo;
const { negrita, cursiva, enlace } = marca;

const comoDocumento = (documento: NodoPrueba) => documento as unknown as Documento;

/** Documentos canónicos: `normalizarDocumento(d)` es `d` y pasan `esquemaDocumento`. */
export const CORPUS_DOCUMENTOS: { nombre: string; documento: Documento }[] = [
  { nombre: 'vacío', documento: comoDocumento(doc()) },
  { nombre: 'un párrafo', documento: comoDocumento(doc(parrafo(texto('Un párrafo simple.')))) },
  {
    nombre: 'los once tipos',
    documento: comoDocumento(
      doc(
        parrafo(texto('La tipografía es la '), texto('voz visual', negrita), texto(' de tu marca.')),
        titulo(2, texto('Empezá por los valores de la marca')),
        titulo(3, texto('Un subtítulo con '), texto('formato', cursiva)),
        titulo(4, texto('Un subtítulo menor')),
        nodo.imagen(imagenDePrueba('muestras', 'Comparación entre una serif y una sans'), 'Serif y sans.'),
        cita(
          { autor: 'Ellen Lupton', fuente: 'https://ellenlupton.com' },
          texto('La tipografía es lo que el lenguaje parece.'),
        ),
        vinetas(
          item(texto('Elegí '), texto('dos', negrita), texto(' familias.')),
          item(texto('Probá la legibilidad.')),
        ),
        numerada(item(texto('Primero')), item(texto('Segundo'))),
        nodo.galeria(3, imagenDePrueba('uno', 'Primera imagen'), imagenDePrueba('dos', 'Segunda imagen')),
        nodo.cta({
          titulo: '¿Querés auditar tu sitio?',
          texto: 'Revisamos la accesibilidad de tu sitio.',
          etiquetaBoton: 'Pedir auditoría',
          url: '/#contacto',
          variante: 'primaria',
        }),
        separador(),
        codigo('const a = **1**;\nconsole.log(`a`);', 'ts'),
        nodo.video('youtube', 'dQw4w9WgXcQ', 'Un video'),
        nodo.video('vimeo', '76979871', 'Otro video'),
      ),
    ),
  },
  {
    nombre: 'campos opcionales ausentes',
    documento: comoDocumento(
      doc(
        cita({}, texto('Una cita sin autor ni fuente.')),
        codigo('sin lenguaje'),
        codigo(''),
        nodo.imagen({ ruta: 'https://picsum.photos/seed/d/800/600', ancho: 800, alto: 600, decorativa: true }),
        nodo.cta({ titulo: 'Sin texto', etiquetaBoton: 'Ir', url: '/blog' }),
      ),
    ),
  },
  {
    nombre: 'marcas combinadas y enlaces',
    documento: comoDocumento(
      doc(
        parrafo(
          texto('Leé '),
          texto('la guía', enlace('https://www.w3.org/WAI/'), negrita),
          texto(' y '),
          texto('el blog', enlace('/blog')),
          texto(', o escribinos a '),
          texto('hola@ejemplo.com', enlace('mailto:hola@ejemplo.com')),
          texto('. Usá '),
          texto('npm install', marca.codigo),
          texto(' y '),
          texto('negrita con cursiva', negrita, cursiva),
          texto('.'),
        ),
      ),
    ),
  },
  {
    nombre: 'saltos de línea dentro de un párrafo',
    documento: comoDocumento(
      doc(
        parrafo(texto('Línea uno'), salto(), texto('línea dos'), salto(), texto('línea tres')),
        parrafo(texto('Con '), texto('negrita', negrita), salto(), texto('y '), texto('cursiva', cursiva)),
      ),
    ),
  },
  {
    nombre: 'títulos repetidos y sin letras',
    documento: comoDocumento(
      doc(
        titulo(2, texto('Primeros pasos')),
        titulo(3, texto('Primeros pasos')),
        titulo(2, texto('Contenido')),
        titulo(2, texto('¿¡…!?')),
      ),
    ),
  },
  {
    // Fase 12 (H6, RF-009 y RF-024): los nueve formatos en línea, combinados, y las tres alineaciones que se guardan.
    nombre: 'nueve formatos y alineación',
    documento: comoDocumento(
      doc(
        alineado(titulo(2, texto('Un título '), texto('centrado', marca.subrayado)), 'center'),
        parrafo(
          texto('Texto '),
          texto('subrayado', marca.subrayado),
          texto(', '),
          texto('tachado', marca.tachado),
          texto(', '),
          texto('resaltado', marca.resaltado),
          texto(', m'),
          texto('2', marca.superindice),
          texto(' y H'),
          texto('2', marca.subindice),
          texto('O.'),
        ),
        alineado(
          parrafo(
            texto('Negrita subrayada con enlace', enlace('/blog'), negrita, marca.subrayado),
            texto(' y '),
            texto('todo junto', negrita, cursiva, marca.subrayado, marca.tachado, marca.resaltado),
            texto(' y '),
            texto('código', marca.codigo),
            texto('.'),
          ),
          'justify',
        ),
        alineado(parrafo(texto('Un párrafo a la derecha.')), 'right'),
        cita({}, texto('Una cita '), texto('resaltada', marca.resaltado)),
        vinetas(
          item(texto('Un ítem '), texto('tachado', marca.tachado)),
          item(texto('x'), texto('2', marca.superindice)),
        ),
      ),
    ),
  },
  {
    nombre: 'textos con caracteres propios del formato anterior',
    documento: comoDocumento(
      doc(
        parrafo(texto('Sin cerrar **negrita y `código y [enlace')),
        parrafo(texto('Caracteres: * asterisco, [corchete, ` comilla, _ guion bajo, ] y ).')),
        parrafo(texto('<script>alert(1)</script> es texto, no HTML.')),
      ),
    ),
  },
];

/**
 * Documento equivalente a algunos contenidos de `corpus-contenido.ts` (mismo nombre): lo que el sitio mostraba con
 * `<Bloques>` y tiene que seguir mostrando con `<Documento>` (CE-002).
 */
export const DOCUMENTOS_EQUIVALENTES: Record<string, Documento> = {
  'un párrafo': comoDocumento(doc(parrafo(texto('Un párrafo simple.')))),
  'artículo del seed: tipografía': comoDocumento(
    doc(
      parrafo(
        texto('La tipografía es la '),
        texto('voz visual', negrita),
        texto(' de tu marca: transmite personalidad antes de que alguien lea una palabra.'),
      ),
      titulo(2, texto('Empezá por los valores de la marca')),
      parrafo(texto('Definí tres adjetivos que describan tu marca y buscá familias tipográficas que los reflejen.')),
      nodo.imagen(
        imagenDePrueba('muestras', 'Comparación entre una serif clásica y una sans geométrica'),
        'Serif y sans: dos personalidades distintas.',
      ),
      cita(
        { autor: 'Ellen Lupton', fuente: 'https://ellenlupton.com' },
        texto('La tipografía es lo que el lenguaje parece.'),
      ),
      vinetas(
        item(texto('Elegí como máximo dos familias.')),
        item(texto('Probá la legibilidad en pantallas chicas.')),
        item(texto('Revisá la licencia de uso web.')),
      ),
    ),
  ),
  'artículo del seed: escribir para la web': comoDocumento(
    doc(
      parrafo(
        texto('En la web la gente '),
        texto('escanea', negrita),
        texto(' antes de leer. Escribí para que un vistazo alcance.'),
      ),
      cita(
        { autor: 'William Strunk Jr.', fuente: 'https://es.wikipedia.org/wiki/The_Elements_of_Style' },
        texto('Omití las palabras innecesarias.'),
      ),
      parrafo(
        texto('Usá títulos que digan algo, listas para los pasos y enlaces con textos descriptivos como '),
        texto('esta guía', enlace('/blog')),
        texto('.'),
      ),
      nodo.cta({
        titulo: 'Te ayudamos con tus contenidos',
        texto: 'Armamos tu estrategia de contenidos y un calendario editorial.',
        etiquetaBoton: 'Conversemos',
        url: '/#contacto',
        variante: 'primaria',
      }),
    ),
  ),
  'artículo del seed: JavaScript moderno': comoDocumento(
    doc(
      parrafo(
        texto('JavaScript cambió mucho en los últimos años. Estas son las herramientas que conviene conocer primero.'),
      ),
      codigo("const respuesta = await fetch('/api/articulos');\nconst articulos = await respuesta.json();", 'js'),
      numerada(
        item(
          texto('Módulos con '),
          texto('import', marca.codigo),
          texto(' y '),
          texto('export', marca.codigo),
          texto('.'),
        ),
        item(texto('Promesas y '), texto('async', marca.codigo), texto('/'), texto('await', marca.codigo), texto('.')),
        item(texto('Desestructuración y operador spread.')),
      ),
    ),
  ),
  'artículo del seed: guía visual de todos los bloques': comoDocumento(
    doc(
      // Un párrafo con una línea en blanco son dos `paragraph`; el salto simple, un `hardBreak` (D25).
      parrafo(texto('Este artículo reúne todos los bloques del editor.')),
      parrafo(
        texto('Sirve para revisar que cada uno se vea bien.'),
        salto(),
        texto('Este renglón va en la misma línea lógica que el anterior.'),
      ),
      titulo(2, texto('Imágenes y citas')),
      nodo.imagen(
        imagenDePrueba('bloque-imagen', 'Boceto de una interfaz dibujado a mano'),
        'Un boceto antes de pasar a la pantalla.',
      ),
      nodo.imagen(imagenDePrueba('decorativa')),
      cita(
        { autor: 'Steve Jobs', fuente: 'https://www.nytimes.com' },
        texto('El diseño no es solo cómo se ve, sino cómo funciona.'),
      ),
      numerada(
        item(texto('Definir el objetivo.')),
        item(texto('Elegir el bloque adecuado.')),
        item(texto('Revisar en el celular.')),
      ),
      nodo.galeria(
        4,
        imagenDePrueba('galeria-1', 'Paleta de colores impresa'),
        imagenDePrueba('galeria-2', 'Tarjetas personales sobre papel kraft'),
        imagenDePrueba('galeria-3', 'Pantalla con una grilla de diseño'),
        imagenDePrueba('galeria-4', 'Cuaderno con tipografías dibujadas'),
      ),
      nodo.cta({
        titulo: 'Conocé la documentación de accesibilidad',
        texto: 'Las pautas WCAG explican cómo hacer sitios para todas las personas.',
        etiquetaBoton: 'Ver las pautas',
        url: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
        variante: 'primaria',
      }),
      separador(),
      titulo(3, texto('Código y video')),
      codigo('<script>alert(1)</script>\n<p>Este código se muestra como texto y nunca se ejecuta.</p>', 'html'),
      nodo.video('youtube', 'dQw4w9WgXcQ', 'Video de muestra del bloque de video'),
    ),
  ),
};
