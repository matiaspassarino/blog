'use server';

// Subida de imágenes en dos pasos (research D9): el navegador sube directo a Storage con una URL firmada
// (Vercel limita el cuerpo de una función a 4,5 MB) y después `registrarMedio` comprueba en el servidor
// el tipo real y las dimensiones. El tipo declarado por el navegador se puede falsear.
import { detectarImagen } from '@blog/bloques';
import { borrarMedios, crearSubidaFirmada, descargarMedio } from '@blog/db';
import { z } from 'zod';
import { conPermiso } from '../lib/accion';
import { exito, fallo, type ResultadoAccion } from '../lib/resultado';

/** 5 MB: el mismo límite que tiene el bucket (RF-007). */
const LIMITE_BYTES = 5_242_880;
const MENSAJE_FORMATO = 'Solo se aceptan imágenes JPEG, PNG, WebP o AVIF.';

const esquemaFirma = z.object({ nombre: z.string().min(1).max(255), bytes: z.number() });

/** Extensión del nombre, solo letras y números: orienta el nombre del objeto, no decide qué es el archivo. */
const extensionDe = (nombre: string) => /\.([a-z0-9]{1,5})$/i.exec(nombre)?.[1]?.toLowerCase() ?? 'bin';

export async function firmarSubidaMedio(
  entrada: unknown,
): Promise<ResultadoAccion<{ ruta: string; token: string; urlFirmada: string }>> {
  return conPermiso('medio.subir', async ({ cliente }) => {
    const datos = esquemaFirma.safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    const { nombre, bytes } = datos.data;

    if (!Number.isInteger(bytes) || bytes <= 0) {
      return fallo('imagen_invalida', { detalle: 'No se pudo leer el tamaño del archivo.' });
    }
    if (bytes > LIMITE_BYTES) {
      return fallo('imagen_invalida', { detalle: 'La imagen supera los 5 MB. Elige una más liviana.' });
    }

    // Ruta sin "medios/" ni "/" inicial, relativa al bucket. El nombre original nunca forma parte de ella.
    const ahora = new Date();
    const mes = String(ahora.getUTCMonth() + 1).padStart(2, '0');
    const ruta = `articulos/${ahora.getUTCFullYear()}/${mes}/${crypto.randomUUID()}.${extensionDe(nombre)}`;
    return exito(await crearSubidaFirmada(cliente, ruta));
  });
}

const esquemaRegistro = z.object({
  ruta: z
    .string()
    .min(1)
    .refine((ruta) => !ruta.startsWith('/') && !ruta.split('/').includes('..'), 'ruta no permitida'),
});

export async function registrarMedio(
  entrada: unknown,
): Promise<ResultadoAccion<{ ruta: string; ancho: number; alto: number }>> {
  return conPermiso('medio.subir', async ({ cliente }) => {
    const datos = esquemaRegistro.safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    const { ruta } = datos.data;

    const imagen = detectarImagen(await descargarMedio(cliente, ruta));
    if (!imagen) {
      // No es una imagen válida: se borra el objeto para no dejar archivos ajenos en el bucket público.
      await borrarMedios(cliente, [ruta]);
      return fallo('imagen_invalida', { detalle: MENSAJE_FORMATO });
    }
    return exito({ ruta, ancho: imagen.ancho, alto: imagen.alto });
  });
}
