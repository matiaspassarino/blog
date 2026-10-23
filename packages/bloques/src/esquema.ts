import { z } from 'zod';
import { esquemaImagen, type Imagen } from './imagen';
import { hrefSeguro } from './render/enlaces';

// Lista permitida del documento guardado (specs/005-editor-estilo-documento/contracts/documento.md, constitución
// §VI). Objetos estrictos: una clave de más es un error. Los campos de los elementos especiales, de la cita, del
// nivel de título y del lenguaje de código son los de la spec 001: sus mensajes no cambian.

export const texto = (campo: string, min: number, max: number) =>
  z
    .string({ error: `${campo} debe ser texto` })
    .min(min, `${campo} no puede estar vacío`)
    .max(max, `${campo} admite hasta ${max} caracteres`);

export const urlHttps = (campo: string) =>
  z.string({ error: `${campo} debe ser texto` }).regex(/^https:\/\/[^\s/]+\.\S+$/, `${campo} debe ser una URL https`);

export const nivelTitulo = z.union([z.literal(2), z.literal(3), z.literal(4)], {
  error: 'El nivel debe ser 2, 3 o 4',
});

export const lenguaje = z
  .string({ error: 'El lenguaje debe ser texto' })
  .regex(/^[a-z0-9+#-]{1,20}$/, 'El lenguaje no es válido');

const columnasGaleria = z.union([z.literal(2), z.literal(3), z.literal(4)], {
  error: 'Las columnas deben ser 2, 3 o 4',
});

export const camposImagen = { imagen: esquemaImagen, leyenda: texto('La leyenda', 0, 300).optional() };

export const camposGaleria = {
  imagenes: z
    .array(esquemaImagen, { error: 'La galería necesita imágenes' })
    .min(2, 'La galería necesita al menos 2 imágenes')
    .max(24, 'La galería admite hasta 24 imágenes'),
  columnas: columnasGaleria,
};

export const camposCta = {
  titulo: texto('El título', 1, 120),
  texto: texto('El texto', 0, 300).optional(),
  etiquetaBoton: texto('La etiqueta del botón', 1, 40),
  // Interna: empieza con "/" pero no con "//" (eso sería una URL externa sin esquema).
  url: z
    .string({ error: 'La URL debe ser texto' })
    .regex(/^(\/(?!\/)\S*|https:\/\/[^\s/]+\.\S+)$/, 'La URL debe ser interna (/…) o https'),
  variante: z.enum(['primaria', 'secundaria'], { error: 'La variante debe ser primaria o secundaria' }).optional(),
};

const tituloVideo = texto('El título del video', 1, 150);
export const camposVideo = {
  youtube: {
    proveedor: z.literal('youtube'),
    idVideo: z
      .string({ error: 'Falta el id del video' })
      .regex(/^[A-Za-z0-9_-]{11}$/, 'El id de YouTube no es válido'),
    titulo: tituloVideo,
  },
  vimeo: {
    proveedor: z.literal('vimeo'),
    idVideo: z.string({ error: 'Falta el id del video' }).regex(/^\d+$/, 'El id de Vimeo no es válido'),
    titulo: tituloVideo,
  },
};

export const camposCita = { autor: texto('El autor', 1, 120).optional(), fuente: urlHttps('La fuente').optional() };

// --- Ayudas: objetos estrictos y tipos de nodo con los mensajes en español ---

const estricto = <T extends z.core.$ZodLooseShape>(nombre: string, forma: T) =>
  z.strictObject(forma, {
    error: (problema) =>
      problema.code === 'unrecognized_keys'
        ? `${nombre} tiene campos no permitidos: ${problema.keys.join(', ')}`
        : `${nombre} debe ser un objeto`,
  });

const tipo = <T extends string>(nombre: T) => z.literal(nombre, { error: `Se esperaba un nodo ${nombre}` });

const id = z.uuid({ error: 'El elemento necesita un id uuid' });

// --- En línea ---

const marca = z.discriminatedUnion(
  'type',
  [
    estricto('El enlace', {
      type: z.literal('link'),
      attrs: estricto('El enlace', {
        href: z
          .string({ error: 'El enlace necesita una dirección' })
          .refine((href) => hrefSeguro(href) === href, 'El enlace debe ser una ruta interna, http(s) o mailto'),
      }),
    }),
    estricto('La negrita', { type: z.literal('bold') }),
    estricto('La cursiva', { type: z.literal('italic') }),
    estricto('El código en línea', { type: z.literal('code') }),
  ],
  { error: 'Formato no permitido' },
);

const nodoTexto = estricto('El texto', {
  type: tipo('text'),
  text: z.string({ error: 'El texto debe ser texto' }).min(1, 'El texto no puede estar vacío'),
  marks: z.array(marca, { error: 'Las marcas deben ser una lista' }).optional(),
}).superRefine((nodo, ctx) => {
  const marcas = nodo.marks ?? [];
  if (marcas.some((m) => m.type === 'code') && marcas.length > 1) {
    ctx.addIssue({ code: 'custom', path: ['marks'], message: 'El código en línea no admite otros formatos' });
  }
});

const salto = estricto('El salto de línea', { type: z.literal('hardBreak') });

const enLinea = z.array(
  z.discriminatedUnion('type', [nodoTexto, salto], { error: 'Solo se admite texto y saltos de línea' }),
  { error: 'El contenido debe ser una lista' },
);

/** Largo del texto de un contenido en línea (sin contar las marcas ni los saltos). */
const largo = (contenido: readonly { type: string; text?: string }[] | undefined) =>
  (contenido ?? []).reduce((total, nodo) => total + (nodo.type === 'text' ? (nodo.text ?? '').length : 0), 0);

/** Agrega el error de largo de un texto (1 a `max`) en `ruta`. */
function limitarTexto(ctx: z.core.$RefinementCtx, cantidad: number, max: number, campo: string, ruta: PropertyKey[]) {
  if (cantidad === 0) ctx.addIssue({ code: 'custom', path: ruta, message: `${campo} no puede estar vacío` });
  else if (cantidad > max) {
    ctx.addIssue({ code: 'custom', path: ruta, message: `${campo} admite hasta ${max} caracteres` });
  }
}

/**
 * El texto del elemento tiene de 1 a `max` caracteres (campo `texto`). Se comprueba aunque otro campo ya haya
 * fallado (`when`), así un título vacío con un nivel inválido informa los dos errores.
 */
const conTexto = <T extends z.ZodType>(esquema: T, max: number, campo: string, contenido: (valor: unknown) => unknown) =>
  esquema.check(
    z.superRefine<unknown>(
      (valor, ctx) => {
        const nodos = contenido(valor);
        limitarTexto(ctx, largo(Array.isArray(nodos) ? nodos : undefined), max, campo, ['texto']);
      },
      { when: () => true },
    ),
  );
const contenidoDe = (valor: unknown) => (valor as { content?: unknown } | null)?.content;
const contenidoDelParrafo = (valor: unknown) => {
  const primero = (contenidoDe(valor) as unknown[] | undefined)?.[0];
  return contenidoDe(primero);
};

/** Párrafo dentro de un ítem o de una cita: sin atributos. */
const parrafoInterno = estricto('El párrafo', { type: tipo('paragraph'), content: enLinea.optional() });

// --- Elementos de primer nivel ---

const parrafo = conTexto(
  estricto('El párrafo', {
    type: z.literal('paragraph'),
    attrs: estricto('El párrafo', { id }),
    content: enLinea.optional(),
  }),
  5000,
  'El texto',
  contenidoDe,
);

const titulo = conTexto(
  estricto('El título', {
    type: z.literal('heading'),
    attrs: estricto('El título', { id, level: nivelTitulo }),
    content: z
      .array(z.discriminatedUnion('type', [nodoTexto], { error: 'El título no admite saltos de línea' }))
      .optional(),
  }),
  150,
  'El título',
  contenidoDe,
);

const itemDeLista = estricto('El item', {
  type: tipo('listItem'),
  content: z.tuple([parrafoInterno], { error: 'El item debe tener un solo párrafo' }),
});

const lista = <T extends 'bulletList' | 'orderedList'>(nombre: T) =>
  estricto('La lista', {
    type: z.literal(nombre),
    attrs: estricto('La lista', { id }),
    content: z
      .array(itemDeLista, { error: 'La lista necesita items' })
      .min(1, 'La lista necesita al menos un item')
      .max(50, 'La lista admite hasta 50 items'),
  }).superRefine((elemento, ctx) =>
    elemento.content.forEach((item, indice) =>
      limitarTexto(ctx, largo(item.content[0].content), 500, 'El item', ['content', indice]),
    ),
  );

const cita = conTexto(
  estricto('La cita', {
    type: z.literal('blockquote'),
    attrs: estricto('La cita', { id, ...camposCita }),
    content: z.tuple([parrafoInterno], { error: 'La cita debe tener un solo párrafo' }),
  }),
  1000,
  'La cita',
  contenidoDelParrafo,
);

const codigo = estricto('El código', {
  type: z.literal('codeBlock'),
  attrs: estricto('El código', { id, lenguaje: lenguaje.optional() }),
  content: z
    .array(estricto('El código', { type: tipo('text'), text: z.string().min(1, 'El código no puede estar vacío') }))
    .max(1, 'El código debe ser un solo texto')
    .optional(),
}).superRefine((elemento, ctx) => {
  if (largo(elemento.content) > 20000) {
    ctx.addIssue({ code: 'custom', path: ['codigo'], message: 'El código admite hasta 20000 caracteres' });
  }
});

const separador = estricto('El separador', {
  type: z.literal('horizontalRule'),
  attrs: estricto('El separador', { id }),
});

const imagen = estricto('La imagen', {
  type: z.literal('imagen'),
  attrs: estricto('La imagen', { id, ...camposImagen }),
});

const galeria = estricto('La galería', {
  type: z.literal('galeria'),
  attrs: estricto('La galería', { id, ...camposGaleria }),
});

const cta = estricto('La llamada a la acción', {
  type: z.literal('cta'),
  attrs: estricto('La llamada a la acción', { id, ...camposCta }),
});

const video = estricto('El video', {
  type: z.literal('video'),
  attrs: z.discriminatedUnion(
    'proveedor',
    [estricto('El video', { id, ...camposVideo.youtube }), estricto('El video', { id, ...camposVideo.vimeo })],
    { error: 'El proveedor debe ser youtube o vimeo' },
  ),
});

const elemento = z.discriminatedUnion(
  'type',
  [
    parrafo,
    titulo,
    lista('bulletList'),
    lista('orderedList'),
    cita,
    codigo,
    separador,
    imagen,
    galeria,
    cta,
    video,
  ],
  { error: 'Tipo de elemento desconocido' },
);

export const esquemaDocumento = estricto('El documento', {
  type: z.literal('doc', { error: 'El documento debe ser de tipo doc' }),
  content: z
    .array(elemento, { error: 'El contenido debe ser una lista de elementos' })
    .max(200, 'El contenido admite hasta 200 elementos'),
}).superRefine((documento, ctx) => {
  const vistos = new Set<string>();
  documento.content.forEach((actual, indice) => {
    if (vistos.has(actual.attrs.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['content', indice, 'attrs', 'id'],
        message: 'El id del elemento está repetido',
      });
    }
    vistos.add(actual.attrs.id);
  });
});

export type Documento = z.infer<typeof esquemaDocumento>;
export type Elemento = Documento['content'][number];
export type TipoElemento = Elemento['type'];
export type ElementoDe<T extends TipoElemento> = Extract<Elemento, { type: T }>;
export type Inline = z.infer<typeof enLinea>[number];
export type Texto = Extract<Inline, { type: 'text' }>;
export type Marca = NonNullable<Texto['marks']>[number];

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never;

/**
 * Los datos que reciben los ocho editores de campos del panel, con los nombres de la spec 001 (`nivel`,
 * `ordenada`…). El texto de los títulos, citas, listas y código se escribe en el lienzo, no en el panel.
 */
type DatosPorTipo = {
  imagen: { imagen: Imagen; leyenda?: string };
  galeria: { imagenes: Imagen[]; columnas: 2 | 3 | 4 };
  cta: SinId<ElementoDe<'cta'>['attrs']>;
  video: SinId<ElementoDe<'video'>['attrs']>;
  heading: { nivel: 2 | 3 | 4 };
  blockquote: { autor?: string; fuente?: string };
  bulletList: { ordenada: boolean };
  orderedList: { ordenada: boolean };
  codeBlock: { lenguaje?: string };
};
export type TipoConDatos = keyof DatosPorTipo;
export type DatosDe<T extends TipoConDatos> = DatosPorTipo[T];
