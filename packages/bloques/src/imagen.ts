import { z } from 'zod';

const MENSAJE_SIN_ALT = 'La imagen necesita un texto alternativo o marcarse como decorativa';

/** Sub-esquema compartido: bloques imagen y galería, imagen destacada y avatar (research D15). */
export const esquemaImagen = z
  .object(
    {
      ruta: z.string({ error: 'La imagen necesita una ruta' }).min(1, 'La imagen necesita una ruta'),
      ancho: z.int({ error: 'El ancho debe ser un entero' }).positive('El ancho debe ser mayor que 0'),
      alto: z.int({ error: 'El alto debe ser un entero' }).positive('El alto debe ser mayor que 0'),
      alt: z
        .string({ error: 'El texto alternativo debe ser texto' })
        .min(1, MENSAJE_SIN_ALT)
        .max(200, 'El texto alternativo admite hasta 200 caracteres')
        .optional(),
      decorativa: z.boolean({ error: 'decorativa debe ser verdadero o falso' }).default(false),
    },
    { error: 'La imagen debe ser un objeto' },
  )
  .superRefine((imagen, ctx) => {
    if (!imagen.decorativa && imagen.alt === undefined) {
      ctx.addIssue({ code: 'custom', path: ['alt'], message: MENSAJE_SIN_ALT });
    }
  });

export type Imagen = z.infer<typeof esquemaImagen>;
