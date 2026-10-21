'use server';

// Acciones de artículos de la Historia 2 (contracts/acciones.md, "Artículos"): previsualizar el slug,
// crear y guardar. Cambiar el estado y eliminar llegan con la Historia 3.
import type { Contenido, Imagen } from '@blog/bloques';
import { rutasQuitadas } from '@blog/bloques';
import {
  actualizarArticulo,
  asignarEtiquetas,
  borrarMedios,
  cambiarEstado,
  crearArticulo,
  eliminarArticulo,
  obtenerArticuloParaEditar,
  previsualizarSlug,
  rutasEnUso,
  type ArticuloParaEditar,
  type Articulo,
  type CambiosArticulo,
  type NuevoArticulo,
} from '@blog/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { conPermiso } from '../lib/accion';
import { exito, fallo, type ResultadoAccion } from '../lib/resultado';

const esquemaSlug = z.object({
  texto: z.string().max(300),
  tipo: z.enum(['articulo', 'categoria', 'etiqueta', 'autor']),
});

export async function previsualizarSlugAccion(entrada: z.input<typeof esquemaSlug>): Promise<ResultadoAccion<string>> {
  return conPermiso('articulo.editar', async ({ cliente }) => {
    const datos = esquemaSlug.safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    return exito(await previsualizarSlug(cliente, datos.data.texto, datos.data.tipo));
  });
}

// Los campos de contenido se validan a fondo en @blog/db con el esquema de @blog/bloques (§VI.4): aquí solo
// se comprueba la forma general de lo que llega desde el navegador.
const esquemaEtiquetas = z.array(z.uuid()).max(50);
// Un artículo nuevo exige título; al guardar, cualquier campo puede faltar (solo viaja lo que cambió).
const camposDelArticulo = z.object({
  titulo: z.string().trim().min(1),
  slug: z.string(),
  extracto: z.string().nullable(),
  titulo_seo: z.string().nullable(),
  descripcion_seo: z.string().nullable(),
  imagen_destacada: z.unknown(),
  contenido: z.array(z.unknown()),
  categoria_id: z.uuid().nullable(),
});
const esquemaNuevo = camposDelArticulo
  .partial()
  .required({ titulo: true })
  .extend({ etiquetas: esquemaEtiquetas.default([]) });

export async function crearArticuloAccion(entrada: unknown): Promise<ResultadoAccion<Articulo>> {
  return conPermiso('articulo.crear', async ({ cliente }) => {
    const datos = esquemaNuevo.safeParse(entrada);
    if (!datos.success) return fallo('validacion', { detalle: 'Escribe un título para el artículo.' });

    const { etiquetas, ...campos } = datos.data;
    let articulo = await crearArticulo(cliente, campos as NuevoArticulo);
    // Asignar etiquetas sube la versión del artículo: se devuelve la vigente (D22 de la spec 001).
    if (etiquetas.length > 0) {
      const { version } = await asignarEtiquetas(cliente, articulo.id, articulo.version, etiquetas);
      articulo = { ...articulo, version };
    }

    revalidatePath('/articulos');
    return exito(articulo);
  });
}

const esquemaGuardado = z.object({
  id: z.uuid(),
  version: z.int().positive(),
  cambios: camposDelArticulo.partial(),
  etiquetas: esquemaEtiquetas.optional(),
});

const mismasEtiquetas = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

/** Imágenes de un artículo, en la forma que usa `rutasQuitadas`. */
const imagenesDe = (articulo: Pick<Articulo, 'contenido' | 'imagen_destacada'>) => ({
  contenido: articulo.contenido as Contenido,
  imagen_destacada: articulo.imagen_destacada as Imagen | null,
});

/**
 * Borra del almacenamiento las imágenes que el guardado quitó y que ningún otro contenido usa (D11).
 * Mejor esfuerzo: un fallo se registra y no revierte el guardado, que ya ocurrió.
 */
async function borrarImagenesSinUso(
  cliente: Parameters<typeof rutasEnUso>[0],
  anterior: ReturnType<typeof imagenesDe>,
  actual: ReturnType<typeof imagenesDe>,
) {
  try {
    const quitadas = rutasQuitadas(anterior, actual);
    if (quitadas.length === 0) return;
    const enUso = new Set(await rutasEnUso(cliente, quitadas));
    const noBorradas = await borrarMedios(
      cliente,
      quitadas.filter((ruta) => !enUso.has(ruta)),
    );
    if (noBorradas.length > 0) console.error('No se pudieron borrar imágenes sin uso', noBorradas);
  } catch (error) {
    console.error('No se pudieron borrar imágenes sin uso', error);
  }
}

export async function guardarArticulo(entrada: unknown): Promise<ResultadoAccion<Articulo>> {
  return conPermiso('articulo.editar', async ({ cliente }) => {
    const datos = esquemaGuardado.safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    const { id, version, cambios, etiquetas } = datos.data;

    const anterior = await obtenerArticuloParaEditar(cliente, id);
    let articulo = await actualizarArticulo(cliente, id, version, cambios as CambiosArticulo);
    // Solo si el conjunto cambió: asignar etiquetas sube la versión del artículo.
    if (etiquetas && !mismasEtiquetas(etiquetas, anterior?.etiquetas ?? [])) {
      const { version: vigente } = await asignarEtiquetas(cliente, id, articulo.version, etiquetas);
      articulo = { ...articulo, version: vigente };
    }

    if (anterior) await borrarImagenesSinUso(cliente, imagenesDe(anterior), imagenesDe(articulo));

    revalidatePath('/articulos');
    revalidatePath(`/articulos/${id}`);
    return exito(articulo);
  });
}

/**
 * Lee la versión vigente de un artículo (con sus etiquetas): el editor la usa para mostrarla junto a lo
 * escrito y para "Reemplazar con la vigente" cuando un guardado chocó con otro (D13).
 */
export async function leerArticuloVigente(entrada: unknown): Promise<ResultadoAccion<ArticuloParaEditar>> {
  return conPermiso('articulo.editar', async ({ cliente }) => {
    const datos = z.object({ id: z.uuid() }).safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    const articulo = await obtenerArticuloParaEditar(cliente, datos.data.id);
    return articulo ? exito(articulo) : fallo('no_encontrado');
  });
}

const esquemaEstado = z.object({
  id: z.uuid(),
  version: z.int().positive(),
  destino: z.enum(['borrador', 'programado', 'publicado', 'archivado']),
  programadoPara: z.iso.datetime().optional(),
});

/**
 * Publica, programa, cancela, vuelve a borrador o archiva (RF-012, RF-013). La matriz de transiciones, los
 * requisitos de publicación y la fecha futura los valida la base; aquí solo se traducen sus errores.
 */
export async function cambiarEstadoAccion(entrada: unknown): Promise<ResultadoAccion<Articulo>> {
  return conPermiso('articulo.cambiar_estado', async ({ cliente }) => {
    const datos = esquemaEstado.safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    const { id, version, destino, programadoPara } = datos.data;
    if (destino === 'programado' && !programadoPara) {
      return fallo('validacion', { detalle: 'Elige la fecha y hora de publicación.' });
    }

    const articulo = await cambiarEstado(cliente, id, version, destino, {
      programadoPara: programadoPara ? new Date(programadoPara) : undefined,
    });

    revalidatePath('/articulos');
    revalidatePath(`/articulos/${id}`);
    return exito(articulo);
  });
}

/** Solo el admin elimina (RF-015); la confirmación la pide la interfaz. Borra las imágenes que nadie más usa (D11). */
export async function eliminarArticuloAccion(entrada: unknown): Promise<ResultadoAccion<void>> {
  return conPermiso('articulo.eliminar', async ({ cliente }) => {
    const datos = z.object({ id: z.uuid() }).safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    const { id } = datos.data;

    const anterior = await obtenerArticuloParaEditar(cliente, id);
    await eliminarArticulo(cliente, id);
    if (anterior) await borrarImagenesSinUso(cliente, imagenesDe(anterior), { contenido: [], imagen_destacada: null });

    revalidatePath('/articulos');
    return exito(undefined);
  });
}
