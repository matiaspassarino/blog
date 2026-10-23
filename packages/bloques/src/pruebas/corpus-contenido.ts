// Corpus compartido de pruebas (spec 005, T013): contenidos válidos con los diez tipos, párrafos con saltos y
// líneas en blanco, tramos vacíos o de solo espacios, textos con marcas propias y el contenido de cada artículo de
// `supabase/seed.sql` (al día en T089). Lo usan las pruebas de `conversion-anterior/`. No se exporta desde `index.ts`.
import type { Bloque, Contenido } from '../conversion-anterior/esquema-bloques';

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
        tipo: 'imagen',
        imagen: imagen('muestras', 'Comparación entre una serif clásica y una sans geométrica'),
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
  {
    nombre: 'artículo del seed: rendimiento',
    contenido: [
      parrafo('El mejor JavaScript es el que no se envía. Un sitio estático bien armado carga en menos de un segundo.'),
      {
        id: id(),
        tipo: 'codigo',
        codigo: 'npx lighthouse https://tusitio.com --only-categories=performance',
        lenguaje: 'bash',
      },
      { id: id(), tipo: 'separador' },
      parrafo('Medí antes y después de cada cambio: la intuición falla seguido con el rendimiento.'),
    ],
  },
  {
    nombre: 'artículo del seed: SEO técnico',
    contenido: [
      parrafo('Antes de pensar en palabras clave, asegurate de que los buscadores **puedan leer** tu sitio.'),
      { id: id(), tipo: 'titulo', nivel: 2, texto: 'Checklist técnico' },
      {
        id: id(),
        tipo: 'lista',
        ordenada: false,
        items: [
          'Un título y una descripción únicos por página.',
          'Un sitemap actualizado.',
          'Datos estructurados en los artículos.',
          'Redirecciones 301 cuando cambia una URL.',
        ],
      },
      { id: id(), tipo: 'video', proveedor: 'youtube', idVideo: 'M7lc1UVf-VE', titulo: 'Introducción al SEO técnico' },
    ],
  },
  {
    nombre: 'artículo del seed: identidades',
    contenido: [
      parrafo('Reunimos algunos sistemas de identidad que resuelven muy bien la consistencia entre soportes.'),
      {
        id: id(),
        tipo: 'galeria',
        columnas: 3,
        imagenes: [
          imagen('identidad-1', 'Papelería con un sistema de color en azul'),
          imagen('identidad-2', 'Señalética con tipografía geométrica'),
          imagen('identidad-3', 'Aplicación de marca en redes sociales'),
        ],
      },
    ],
  },
  {
    nombre: 'artículo del seed: escribir para la web',
    contenido: [
      parrafo('En la web la gente **escanea** antes de leer. Escribí para que un vistazo alcance.'),
      {
        id: id(),
        tipo: 'cita',
        texto: 'Omití las palabras innecesarias.',
        autor: 'William Strunk Jr.',
        fuente: 'https://es.wikipedia.org/wiki/The_Elements_of_Style',
      },
      parrafo(
        'Usá títulos que digan algo, listas para los pasos y enlaces con textos descriptivos como [esta guía](/blog).',
      ),
      {
        id: id(),
        tipo: 'cta',
        titulo: 'Te ayudamos con tus contenidos',
        texto: 'Armamos tu estrategia de contenidos y un calendario editorial.',
        etiquetaBoton: 'Conversemos',
        url: '/#contacto',
        variante: 'primaria',
      },
    ],
  },
  {
    nombre: 'artículo del seed: JavaScript moderno',
    contenido: [
      parrafo('JavaScript cambió mucho en los últimos años. Estas son las herramientas que conviene conocer primero.'),
      {
        id: id(),
        tipo: 'codigo',
        codigo: "const respuesta = await fetch('/api/articulos');\nconst articulos = await respuesta.json();",
        lenguaje: 'js',
      },
      {
        id: id(),
        tipo: 'lista',
        ordenada: true,
        items: [
          'Módulos con `import` y `export`.',
          'Promesas y `async`/`await`.',
          'Desestructuración y operador spread.',
        ],
      },
    ],
  },
  {
    nombre: 'artículo del seed: validar una idea',
    contenido: [
      parrafo('La pregunta no es si la idea es buena, sino si **alguien pagaría** por ella.'),
      { id: id(), tipo: 'titulo', nivel: 2, texto: 'El plan de siete días' },
      {
        id: id(),
        tipo: 'lista',
        ordenada: true,
        items: [
          'Definí el problema en una frase.',
          'Hablá con diez posibles clientes.',
          'Armá una página de prueba.',
          'Medí cuántos dejan su correo.',
        ],
      },
      {
        id: id(),
        tipo: 'cta',
        titulo: '¿Tenés una idea para validar?',
        texto: 'Diseñamos la página de prueba y medimos los resultados con vos.',
        etiquetaBoton: 'Empezar',
        url: '/#contacto',
        variante: 'primaria',
      },
    ],
  },
  {
    nombre: 'artículo del seed: redes sociales',
    contenido: [
      parrafo('No hace falta estar en todas las redes: alcanza con estar bien en una o dos.'),
      {
        id: id(),
        tipo: 'imagen',
        imagen: imagen('calendario', 'Calendario de publicaciones semanal'),
        leyenda: 'Un calendario simple ayuda a sostener la constancia.',
      },
      parrafo('Medí las consultas que llegan por cada red, no solo los "me gusta".'),
    ],
  },
  {
    nombre: 'artículo del seed: tendencias (programado)',
    contenido: [parrafo('Un repaso por las tendencias que vemos crecer en los proyectos de este año.')],
  },
  {
    nombre: 'artículo del seed: métricas (programado)',
    contenido: [
      parrafo('Consultas, conversiones y tiempo de respuesta: las métricas que de verdad mueven el negocio.'),
    ],
  },
  { nombre: 'artículo del seed: checklist (borrador)', contenido: [parrafo('Borrador en preparación.')] },
  { nombre: 'artículo del seed: componentes (borrador vacío)', contenido: [] },
  {
    nombre: 'artículo del seed: beta (archivado)',
    contenido: [parrafo('Este anuncio ya no está vigente y quedó archivado.')],
  },
  {
    nombre: 'artículo del seed: guía visual de todos los bloques',
    contenido: [
      parrafo(
        'Este artículo reúne todos los bloques del editor.\n\nSirve para revisar que cada uno se vea bien.\nEste renglón va en la misma línea lógica que el anterior.',
      ),
      { id: id(), tipo: 'titulo', nivel: 2, texto: 'Imágenes y citas' },
      {
        id: id(),
        tipo: 'imagen',
        imagen: imagen('bloque-imagen', 'Boceto de una interfaz dibujado a mano'),
        leyenda: 'Un boceto antes de pasar a la pantalla.',
      },
      {
        id: id(),
        tipo: 'imagen',
        imagen: { ruta: 'https://picsum.photos/seed/decorativa/1600/900', ancho: 1600, alto: 900, decorativa: true },
      },
      {
        id: id(),
        tipo: 'cita',
        texto: 'El diseño no es solo cómo se ve, sino cómo funciona.',
        autor: 'Steve Jobs',
        fuente: 'https://www.nytimes.com',
      },
      {
        id: id(),
        tipo: 'lista',
        ordenada: true,
        items: ['Definir el objetivo.', 'Elegir el bloque adecuado.', 'Revisar en el celular.'],
      },
      {
        id: id(),
        tipo: 'galeria',
        columnas: 4,
        imagenes: [
          imagen('galeria-1', 'Paleta de colores impresa'),
          imagen('galeria-2', 'Tarjetas personales sobre papel kraft'),
          imagen('galeria-3', 'Pantalla con una grilla de diseño'),
          imagen('galeria-4', 'Cuaderno con tipografías dibujadas'),
        ],
      },
      {
        id: id(),
        tipo: 'cta',
        titulo: 'Conocé la documentación de accesibilidad',
        texto: 'Las pautas WCAG explican cómo hacer sitios para todas las personas.',
        etiquetaBoton: 'Ver las pautas',
        url: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
        variante: 'primaria',
      },
      { id: id(), tipo: 'separador' },
      { id: id(), tipo: 'titulo', nivel: 3, texto: 'Código y video' },
      {
        id: id(),
        tipo: 'codigo',
        codigo: '<script>alert(1)</script>\n<p>Este código se muestra como texto y nunca se ejecuta.</p>',
        lenguaje: 'html',
      },
      {
        id: id(),
        tipo: 'video',
        proveedor: 'youtube',
        idVideo: 'dQw4w9WgXcQ',
        titulo: 'Video de muestra del bloque de video',
      },
    ],
  },
  {
    nombre: 'artículo del seed: guía completa sin imagen destacada',
    contenido: [
      parrafo(
        'Este artículo no tiene imagen destacada: la tarjeta y la vista previa en redes usan la imagen genérica del sitio.',
      ),
    ],
  },
  {
    nombre: 'artículo del seed: dos fotos',
    contenido: [
      parrafo('A veces una galería tiene el mínimo de imágenes, y tiene que verse igual de bien.'),
      {
        id: id(),
        tipo: 'galeria',
        columnas: 3,
        imagenes: [
          imagen('foto-antes', 'Fachada de un local antes de la renovación'),
          imagen('foto-despues', 'La misma fachada con su cartel nuevo'),
        ],
      },
    ],
  },
  {
    nombre: 'artículo del seed: responder consultas',
    contenido: [parrafo('Responder en menos de una hora multiplica las chances de cerrar una venta.')],
  },
  {
    nombre: 'artículo del seed: fotos de producto',
    contenido: [parrafo('Con luz de ventana y un fondo liso alcanza para empezar.')],
  },
];
