// El formato anterior del contenido (la lista de bloques de la spec 001), solo para convertir los artículos existentes
// (research D25 y D31 C1). Se arma con los esquemas de campos de `../esquema`: solo agrega `{ id, tipo }`. Se elimina
// después del corte (T160).
import { z } from 'zod';
import {
  camposCita,
  camposCta,
  camposGaleria,
  camposImagen,
  camposVideo,
  lenguaje,
  nivelTitulo,
  texto,
} from '../esquema';

const base = { id: z.uuid({ error: 'El bloque necesita un id uuid' }) };

export const esquemaBloque = z.discriminatedUnion(
  'tipo',
  [
    z.object({ ...base, tipo: z.literal('parrafo'), texto: texto('El texto', 1, 5000) }),
    z.object({ ...base, tipo: z.literal('titulo'), nivel: nivelTitulo, texto: texto('El título', 1, 150) }),
    z.object({ ...base, tipo: z.literal('imagen'), ...camposImagen }),
    z.object({ ...base, tipo: z.literal('cita'), texto: texto('La cita', 1, 1000), ...camposCita }),
    z.object({
      ...base,
      tipo: z.literal('lista'),
      ordenada: z.boolean(),
      items: z
        .array(texto('El item', 1, 500))
        .min(1)
        .max(50),
    }),
    z.object({ ...base, tipo: z.literal('galeria'), ...camposGaleria, columnas: camposGaleria.columnas.default(3) }),
    z.object({ ...base, tipo: z.literal('cta'), ...camposCta }),
    z.object({ ...base, tipo: z.literal('separador') }),
    z.object({
      ...base,
      tipo: z.literal('codigo'),
      codigo: texto('El código', 0, 20000),
      lenguaje: lenguaje.optional(),
    }),
    z.object({ ...base, tipo: z.literal('video'), ...camposVideo.youtube }),
    z.object({ ...base, tipo: z.literal('video'), ...camposVideo.vimeo }),
  ],
  { error: 'Tipo de bloque desconocido' },
);

export type Bloque = z.infer<typeof esquemaBloque>;
export type Contenido = Bloque[];
