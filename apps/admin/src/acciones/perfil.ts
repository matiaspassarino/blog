'use server';

// Perfil propio (Historia 6, contracts/acciones.md, "Perfil propio"). Cualquier miembro activo edita el suyo.
// El esquema solo conoce nombre, biografía y avatar: `rol` y `activo` se descartan (y la base los rechaza igual).
// El avatar lo valida `@blog/db` (texto alternativo obligatorio salvo decorativa) y devuelve `contenido_invalido`.
import type { Imagen } from '@blog/bloques';
import { actualizarPerfilPropio, borrarMedios, obtenerPerfilPropio, rutasEnUso, type Perfil } from '@blog/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { conPermiso } from '../lib/accion';
import { exito, fallo, type ResultadoAccion } from '../lib/resultado';

const esquemaPerfil = z.object({
  nombre: z.string().trim().min(1).max(80),
  biografia: z.string().max(500).nullable().optional(),
  avatar: z.looseObject({}).nullable().optional(),
});

/** Borra la foto anterior si ya no la usa nadie (D11). Mejor esfuerzo: el guardado ya ocurrió. */
async function borrarAvatarSinUso(
  cliente: Parameters<typeof rutasEnUso>[0],
  anterior: Imagen | null,
  actual: Imagen | null,
) {
  if (!anterior || anterior.ruta === actual?.ruta) return;
  try {
    if ((await rutasEnUso(cliente, [anterior.ruta])).length > 0) return;
    const noBorradas = await borrarMedios(cliente, [anterior.ruta]);
    if (noBorradas.length > 0) console.error('No se pudo borrar el avatar sin uso', noBorradas);
  } catch (error) {
    console.error('No se pudo borrar el avatar sin uso', error);
  }
}

export async function guardarPerfil(entrada: unknown): Promise<ResultadoAccion<Perfil>> {
  return conPermiso('perfil.editar_propio', async ({ miembro, cliente }) => {
    const datos = esquemaPerfil.safeParse(entrada);
    if (!datos.success) {
      return fallo('validacion', { detalle: 'Revisa el nombre (hasta 80 caracteres) y la biografía (hasta 500).' });
    }
    const { nombre, biografia, avatar } = datos.data;

    const anterior = (await obtenerPerfilPropio(cliente, miembro.id))?.avatar as Imagen | null | undefined;
    const perfil = await actualizarPerfilPropio(cliente, {
      nombre,
      ...(biografia !== undefined && { biografia }),
      ...(avatar !== undefined && { avatar: avatar as Imagen | null }),
    });

    if (avatar !== undefined) await borrarAvatarSinUso(cliente, anterior ?? null, perfil.avatar as Imagen | null);

    revalidatePath('/perfil');
    return exito(perfil);
  });
}
