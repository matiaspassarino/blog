// Esquema del contenido de la landing (specs/002-sitio-publico/contracts/landing.md, RF-013c).
// Si el contenido no lo cumple, astro build falla con la ruta del campo.
import type { ImageMetadata } from 'astro';
import { z } from 'astro/zod';
import { NOMBRES_ICONOS } from '../components/iconos/nombres';

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Imagen importada de src/assets: ancho y alto salen de sus metadatos. */
const imagenLocal = z.object({
  src: z.custom<ImageMetadata>(
    (valor) => typeof valor === 'object' && valor !== null && 'src' in valor && 'width' in valor && 'height' in valor,
    { message: 'Debe ser una imagen importada de src/assets' },
  ),
  alt: texto(1, 200),
});

export const esquemaLanding = z.object({
  sitio: z.object({
    nombre: texto(1, 40),
    lema: texto(1, 60),
    descripcion: texto(50, 160),
  }),
  hero: z.object({
    titulo: texto(1, 80),
    bajada: texto(1, 200),
    cta: texto(1, 30),
    imagen: imagenLocal,
  }),
  propuesta: z.object({
    titulo: texto(1, 80),
    texto: texto(1, 400),
    puntos: z.array(texto(1, 120)).min(1).max(4),
  }),
  servicios: z.object({
    titulo: texto(1, 80),
    items: z
      .array(
        z.object({
          titulo: texto(1, 60),
          descripcion: texto(1, 200),
          icono: z.enum(NOMBRES_ICONOS),
        }),
      )
      .min(3)
      .max(6),
  }),
  testimonios: z.object({
    titulo: texto(1, 80),
    items: z
      .array(
        z.object({
          cita: texto(1, 300),
          nombre: texto(1, 60),
          cargo: texto(1, 80),
          foto: imagenLocal.optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
  blog: z.object({
    titulo: texto(1, 80),
    descripcion: texto(50, 160),
  }),
  contacto: z
    .object({
      titulo: texto(1, 80),
      texto: texto(1, 300),
      whatsapp: z.string().regex(/^\d{8,15}$/, 'Número en formato E.164 sin "+" ni espacios'),
      /** El mismo número con formato legible, para mostrarlo como texto (por ejemplo, en el pie). */
      whatsappVisible: z
        .string()
        .trim()
        .regex(/^\+?[\d\s().-]{8,25}$/, 'Solo dígitos, espacios, "+", "-" y paréntesis'),
      mensaje: texto(1, 200),
      correo: z.email(),
      asunto: texto(1, 80),
    })
    .refine((contacto) => contacto.whatsappVisible.replace(/\D/g, '') === contacto.whatsapp, {
      message: 'Debe tener los mismos dígitos que contacto.whatsapp',
      path: ['whatsappVisible'],
    }),
});
