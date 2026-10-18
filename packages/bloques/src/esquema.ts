import { z } from 'zod';
import { esquemaImagen } from './imagen';
import type { TipoBloque } from './tipos-bloque';

// Reglas de cada tipo: specs/001-modelo-de-contenido/contracts/bloques.md.

const texto = (campo: string, min: number, max: number) =>
  z
    .string({ error: `${campo} debe ser texto` })
    .min(min, `${campo} no puede estar vacío`)
    .max(max, `${campo} admite hasta ${max} caracteres`);

const urlHttps = (campo: string) =>
  z
    .string({ error: `${campo} debe ser texto` })
    .regex(/^https:\/\/[^\s/]+\.\S+$/, `${campo} debe ser una URL https`);

const base = { id: z.uuid({ error: 'El bloque necesita un id uuid' }) };

const nivelTitulo = z.union([z.literal(2), z.literal(3), z.literal(4)], {
  error: 'El nivel debe ser 2, 3 o 4',
});

const columnasGaleria = z.union([z.literal(2), z.literal(3), z.literal(4)], {
  error: 'Las columnas deben ser 2, 3 o 4',
});

const parrafo = z.object({ ...base, tipo: z.literal('parrafo'), texto: texto('El texto', 1, 5000) });

const titulo = z.object({ ...base, tipo: z.literal('titulo'), nivel: nivelTitulo, texto: texto('El título', 1, 150) });

const imagen = z.object({
  ...base,
  tipo: z.literal('imagen'),
  imagen: esquemaImagen,
  leyenda: texto('La leyenda', 0, 300).optional(),
});

const cita = z.object({
  ...base,
  tipo: z.literal('cita'),
  texto: texto('La cita', 1, 1000),
  autor: texto('El autor', 1, 120).optional(),
  fuente: urlHttps('La fuente').optional(),
});

const lista = z.object({
  ...base,
  tipo: z.literal('lista'),
  ordenada: z.boolean({ error: 'Indicá si la lista es ordenada' }),
  items: z
    .array(texto('El item', 1, 500), { error: 'La lista necesita items' })
    .min(1, 'La lista necesita al menos un item')
    .max(50, 'La lista admite hasta 50 items'),
});

const galeria = z.object({
  ...base,
  tipo: z.literal('galeria'),
  imagenes: z
    .array(esquemaImagen, { error: 'La galería necesita imágenes' })
    .min(2, 'La galería necesita al menos 2 imágenes')
    .max(24, 'La galería admite hasta 24 imágenes'),
  columnas: columnasGaleria.default(3),
});

const cta = z.object({
  ...base,
  tipo: z.literal('cta'),
  titulo: texto('El título', 1, 120),
  texto: texto('El texto', 0, 300).optional(),
  etiquetaBoton: texto('La etiqueta del botón', 1, 40),
  // Interna: empieza con "/" pero no con "//" (eso sería una URL externa sin esquema).
  url: z
    .string({ error: 'La URL debe ser texto' })
    .regex(/^(\/(?!\/)\S*|https:\/\/[^\s/]+\.\S+)$/, 'La URL debe ser interna (/…) o https'),
  variante: z.enum(['primaria', 'secundaria'], { error: 'La variante debe ser primaria o secundaria' }).optional(),
});

const separador = z.object({ ...base, tipo: z.literal('separador') });

const codigo = z.object({
  ...base,
  tipo: z.literal('codigo'),
  codigo: texto('El código', 0, 20000),
  lenguaje: z
    .string({ error: 'El lenguaje debe ser texto' })
    .regex(/^[a-z0-9+#-]{1,20}$/, 'El lenguaje no es válido')
    .optional(),
});

const tituloVideo = texto('El título del video', 1, 150);
const video = z.discriminatedUnion(
  'proveedor',
  [
    z.object({
      ...base,
      tipo: z.literal('video'),
      proveedor: z.literal('youtube'),
      idVideo: z
        .string({ error: 'Falta el id del video' })
        .regex(/^[A-Za-z0-9_-]{11}$/, 'El id de YouTube no es válido'),
      titulo: tituloVideo,
    }),
    z.object({
      ...base,
      tipo: z.literal('video'),
      proveedor: z.literal('vimeo'),
      idVideo: z.string({ error: 'Falta el id del video' }).regex(/^\d+$/, 'El id de Vimeo no es válido'),
      titulo: tituloVideo,
    }),
  ],
  { error: 'El proveedor debe ser youtube o vimeo' },
);

export const esquemaBloque = z.discriminatedUnion(
  'tipo',
  [parrafo, titulo, imagen, cita, lista, galeria, cta, separador, codigo, video],
  { error: 'Tipo de bloque desconocido' },
);

export const esquemaContenido = z
  .array(esquemaBloque, { error: 'El contenido debe ser una lista de bloques' })
  .max(200, 'El contenido admite hasta 200 bloques');

export type Bloque = z.infer<typeof esquemaBloque>;
export type BloqueDe<T extends TipoBloque> = Extract<Bloque, { tipo: T }>;
export type Contenido = Bloque[];

// El esquema cubre exactamente TIPOS_BLOQUE: falla la compilación si divergen.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const cubreTodosLosTipos: Igual<Bloque['tipo'], TipoBloque> = true;
void cubreTodosLosTipos;
