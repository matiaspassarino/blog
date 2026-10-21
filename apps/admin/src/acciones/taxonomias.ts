'use server';

// Acciones de categorías y etiquetas (Historia 5, contracts/acciones.md, "Taxonomías"). Una sola implementación
// para las dos, con la prop `tipo`. Las reglas (nombre único, categoría en uso, redirecciones al cambiar el slug)
// las aplica la base; aquí se valida la forma y se traducen sus errores.
import {
  actualizarTaxonomia,
  crearTaxonomia,
  eliminarTaxonomia,
  ErrorDominio,
  leerTaxonomiaConPublicados,
  type Taxonomia,
} from '@blog/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { conPermiso } from '../lib/accion';
import { exito, fallo, type ResultadoAccion } from '../lib/resultado';

const TIPOS = ['categoria', 'etiqueta'] as const;
type Tipo = (typeof TIPOS)[number];

const RUTA: Record<Tipo, string> = { categoria: '/categorias', etiqueta: '/etiquetas' };
const NOMBRE_CON_ARTICULO: Record<Tipo, string> = { categoria: 'una categoría', etiqueta: 'una etiqueta' };

const campos = {
  nombre: z.string().trim().min(1).max(60),
  slug: z.string().optional(),
  descripcion: z.string().max(300).nullable().optional(),
};

/** El índice único del nombre lanza 23505; `traducirError` solo reconoce el del slug, así que se mapea aquí. */
function esNombreRepetido(error: unknown) {
  return error instanceof ErrorDominio && (error.cause as { code?: string } | undefined)?.code === '23505';
}

/** Ejecuta la operación y convierte el nombre repetido en un mensaje claro (H5-E2). */
async function conNombreUnico<T>(tipo: Tipo, operacion: () => Promise<T>): Promise<ResultadoAccion<T>> {
  try {
    return exito(await operacion());
  } catch (error) {
    if (esNombreRepetido(error)) {
      return fallo('validacion', { detalle: `Ya existe ${NOMBRE_CON_ARTICULO[tipo]} con ese nombre` });
    }
    throw error;
  }
}

const esquemaCrear = z.object({ tipo: z.enum(TIPOS), ...campos });

export async function crearTaxonomiaAccion(entrada: unknown): Promise<ResultadoAccion<Taxonomia>> {
  return conPermiso('taxonomia.gestionar', async ({ cliente }) => {
    const datos = esquemaCrear.safeParse(entrada);
    if (!datos.success)
      return fallo('validacion', { detalle: 'Revisa el nombre (hasta 60 caracteres) y la descripción (hasta 300).' });
    const { tipo, ...campos } = datos.data;

    const resultado = await conNombreUnico(tipo, () => crearTaxonomia(cliente, tipo, campos));
    if (resultado.ok) revalidatePath(RUTA[tipo]);
    return resultado;
  });
}

const esquemaActualizar = z.object({
  tipo: z.enum(TIPOS),
  id: z.uuid(),
  cambios: z.object(campos).partial(),
});

/** `avisoRedireccion` es cierto si el slug cambió y la taxonomía tiene artículos publicados (RF-019). */
export async function actualizarTaxonomiaAccion(
  entrada: unknown,
): Promise<ResultadoAccion<{ taxonomia: Taxonomia; avisoRedireccion: boolean }>> {
  return conPermiso('taxonomia.gestionar', async ({ cliente }) => {
    const datos = esquemaActualizar.safeParse(entrada);
    if (!datos.success)
      return fallo('validacion', { detalle: 'Revisa el nombre (hasta 60 caracteres) y la descripción (hasta 300).' });
    const { tipo, id, cambios } = datos.data;

    const antes = await leerTaxonomiaConPublicados(cliente, tipo, id);
    if (!antes) return fallo('no_encontrado');

    const resultado = await conNombreUnico(tipo, () => actualizarTaxonomia(cliente, tipo, id, cambios));
    if (!resultado.ok) return resultado;

    revalidatePath(RUTA[tipo]);
    const taxonomia = resultado.datos;
    return exito({ taxonomia, avisoRedireccion: taxonomia.slug !== antes.taxonomia.slug && antes.publicados > 0 });
  });
}

export async function eliminarTaxonomiaAccion(entrada: unknown): Promise<ResultadoAccion<void>> {
  return conPermiso('taxonomia.gestionar', async ({ cliente }) => {
    const datos = z.object({ tipo: z.enum(TIPOS), id: z.uuid() }).safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    await eliminarTaxonomia(cliente, datos.data.tipo, datos.data.id);
    revalidatePath(RUTA[datos.data.tipo]);
    return exito(undefined);
  });
}
