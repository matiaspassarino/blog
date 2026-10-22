// Corpus compartido de pruebas (spec 005, T013): contenidos válidos con los diez tipos, párrafos con saltos y
// líneas en blanco, tramos vacíos o de solo espacios, textos con marcas propias y textos del seed. Lo usan
// `en-linea.test.ts`, `parrafos.test.ts` y `documento/conversion.test.ts`. No se exporta desde `index.ts`.
import type { Bloque, Contenido } from '../esquema';

let contador = 0;
/** uuid v4 válido y determinista (el esquema exige `z.uuid`). */
const id = () => `00000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`;

const imagen = (semilla: string, alt: string) => ({
  ruta: `https://picsum.photos/seed/${semilla}/1600/900`,
  ancho: 1600,
  alto: 900,
  alt,
  decorativa: false,
});

const parrafo = (texto: string): Bloque => ({ id: id(), tipo: 'parrafo', texto });

/** Textos en línea y párrafos usados como entrada del analizador y de la partición. */
export const CORPUS_TEXTOS: string[] = [
  'Texto plano sin marcas.',
  'La tipografía es la **voz visual** de tu marca: transmite personalidad antes de que alguien lea una palabra.',
  'Un texto _importante_ acá.',
  'Usá `**no es negrita**` así.',
  'Mirá [el blog](/blog) primero.',
  'Leé [la guía](https://www.w3.org/WAI/) hoy.',
  'Enlace con paréntesis [wiki](https://es.wikipedia.org/wiki/Foo_(bar)) y más.',
  'Anidado **negrita con _cursiva_ adentro** y [enlace **fuerte**](/x).',
  'Sin cerrar **negrita y `código y [enlace',
  'Cursiva en palabra foo_bar_baz y snake_case_nombre.',
  'Espacios en el borde ** negrita ** y _ cursiva _.',
  'Caracteres propios: * asterisco, [corchete, ` comilla, _ guion bajo, ] y ).',
  'Enlace inseguro [clic](javascript:alert(1)) y [otro](//malo.com).',
  '****',
  '__',
  '``',
  '[]()',
  '**a**_b_`c`[d](e)',
  'Contraste mínimo de 4.5:1 para el texto.',
  'Definí tres adjetivos que describan tu marca y buscá familias tipográficas que los reflejen.',
  '',
  ' ',
  '\n',
  'Línea uno\nlínea dos\nlínea tres',
  'A\n\nB',
  'A\n\n\nB',
  'A\n\n\n\nB',
  'A\n\n',
  '\n\nA',
  'A\n\n  \n\nB',
  'A\n \nB',
  '  \n\n  ',
  'Tildes y ñ: canción, niño, ¿qué tal? ¡Bien!',
  'Emoji 😀 y **negrita 😀**',
];

export const CORPUS_CONTENIDOS: { nombre: string; contenido: Contenido }[] = [
  { nombre: 'vacío', contenido: [] },
  { nombre: 'un párrafo', contenido: [parrafo('Un párrafo simple.')] },
  {
    nombre: 'los diez tipos',
    contenido: [
      parrafo('La tipografía es la **voz visual** de tu marca.'),
      { id: id(), tipo: 'titulo', nivel: 2, texto: 'Empezá por los valores de la marca' },
      { id: id(), tipo: 'titulo', nivel: 3, texto: 'Un subtítulo' },
      { id: id(), tipo: 'titulo', nivel: 4, texto: 'Un subtítulo menor' },
      {
        id: id(),
        tipo: 'imagen',
        imagen: imagen('muestras', 'Comparación entre una serif y una sans'),
        leyenda: 'Serif y sans: dos personalidades distintas.',
      },
      {
        id: id(),
        tipo: 'cita',
        texto: 'La tipografía es lo que el lenguaje parece.',
        autor: 'Ellen Lupton',
        fuente: 'https://ellenlupton.com',
      },
      {
        id: id(),
        tipo: 'lista',
        ordenada: false,
        items: ['Elegí **dos** familias.', 'Probá la _legibilidad_.', 'Revisá la licencia.'],
      },
      { id: id(), tipo: 'lista', ordenada: true, items: ['Primero', 'Segundo'] },
      {
        id: id(),
        tipo: 'galeria',
        columnas: 3,
        imagenes: [imagen('uno', 'Primera imagen'), imagen('dos', 'Segunda imagen')],
      },
      {
        id: id(),
        tipo: 'cta',
        titulo: '¿Querés auditar tu sitio?',
        texto: 'Revisamos la accesibilidad de tu sitio.',
        etiquetaBoton: 'Pedir auditoría',
        url: '/#contacto',
        variante: 'primaria',
      },
      { id: id(), tipo: 'separador' },
      { id: id(), tipo: 'codigo', codigo: 'const a = **1**;\nconsole.log(`a`);', lenguaje: 'ts' },
      { id: id(), tipo: 'video', proveedor: 'youtube', idVideo: 'dQw4w9WgXcQ', titulo: 'Un video' },
      { id: id(), tipo: 'video', proveedor: 'vimeo', idVideo: '76979871', titulo: 'Otro video' },
    ],
  },
  {
    nombre: 'campos opcionales ausentes',
    contenido: [
      { id: id(), tipo: 'cita', texto: 'Una cita sin autor ni fuente.' },
      { id: id(), tipo: 'codigo', codigo: 'sin lenguaje' },
      {
        id: id(),
        tipo: 'imagen',
        imagen: { ruta: 'https://picsum.photos/seed/d/800/600', ancho: 800, alto: 600, decorativa: true },
      },
      { id: id(), tipo: 'cta', titulo: 'Sin texto', etiquetaBoton: 'Ir', url: '/blog' },
    ],
  },
  {
    nombre: 'párrafos con saltos simples',
    contenido: [parrafo('Línea uno\nlínea dos\nlínea tres'), parrafo('Con **negrita**\ny _cursiva_ en otra línea')],
  },
  {
    nombre: 'párrafos con dos, tres y cuatro líneas en blanco',
    contenido: [
      parrafo('Uno\n\nDos'),
      parrafo('Uno\n\n\nDos\n\n\n\nTres'),
      parrafo('Salto simple\ny doble\n\ny triple\n\n\nfin'),
    ],
  },
  {
    nombre: 'tramos vacíos o de solo espacios',
    contenido: [parrafo('A\n\n'), parrafo('\n\nB'), parrafo('A\n\n  \n\nB'), parrafo('A\n\n\n\n\n\nB')],
  },
  {
    nombre: 'textos con marcas propias',
    contenido: [
      parrafo('Sin cerrar **negrita y `código y [enlace'),
      parrafo('foo_bar_baz y snake_case'),
      parrafo('Enlace [wiki](https://es.wikipedia.org/wiki/Foo_(bar)) y **fuerte _anidado_**'),
      parrafo('Espacios ** raros ** y * suelto * y [corchetes] sueltos'),
      { id: id(), tipo: 'lista', ordenada: false, items: ['Con `código`', 'Con [enlace](/x)', 'Con un * asterisco'] },
      { id: id(), tipo: 'cita', texto: 'Cita con **negrita** y _cursiva_', autor: 'Alguien' },
    ],
  },
  {
    nombre: 'ítems de lista y citas con salto de línea guardado',
    contenido: [
      { id: id(), tipo: 'lista', ordenada: false, items: ['Primera línea\nsegunda línea', 'Otro'] },
      { id: id(), tipo: 'cita', texto: 'Verso uno\nverso dos' },
    ],
  },
  {
    nombre: 'artículo del seed: tipografía',
    contenido: [
      parrafo(
        'La tipografía es la **voz visual** de tu marca: transmite personalidad antes de que alguien lea una palabra.',
      ),
      { id: id(), tipo: 'titulo', nivel: 2, texto: 'Empezá por los valores de la marca' },
      parrafo('Definí tres adjetivos que describan tu marca y buscá familias tipográficas que los reflejen.'),
      {
        id: id(),
        tipo: 'cita',
        texto: 'La tipografía es lo que el lenguaje parece.',
        autor: 'Ellen Lupton',
        fuente: 'https://ellenlupton.com',
      },
      {
        id: id(),
        tipo: 'lista',
        ordenada: false,
        items: [
          'Elegí como máximo dos familias.',
          'Probá la legibilidad en pantallas chicas.',
          'Revisá la licencia de uso web.',
        ],
      },
    ],
  },
  {
    nombre: 'artículo del seed: accesibilidad',
    contenido: [
      parrafo(
        'Un sitio accesible es un sitio que **funciona mejor para todos**, no solo para personas con discapacidad.',
      ),
      { id: id(), tipo: 'titulo', nivel: 2, texto: 'Lo esencial' },
      {
        id: id(),
        tipo: 'lista',
        ordenada: true,
        items: [
          'Contraste mínimo de 4.5:1 para el texto.',
          'Todo se puede usar con el teclado.',
          'Cada imagen tiene un texto alternativo útil.',
          'Los formularios tienen etiquetas visibles.',
        ],
      },
      {
        id: id(),
        tipo: 'cta',
        titulo: '¿Querés auditar tu sitio?',
        texto: 'Revisamos la accesibilidad de tu sitio y te entregamos un plan de mejoras.',
        etiquetaBoton: 'Pedir auditoría',
        url: '/#contacto',
        variante: 'primaria',
      },
    ],
  },
];
