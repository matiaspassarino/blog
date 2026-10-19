// Operaciones del equipo sobre categorías y etiquetas (contracts/db.md).
import type { ClienteBlog } from '../cliente';
import { ErrorDominio, traducirError } from '../errores';
import { TABLA_TAXONOMIA, type Taxonomia, type TipoTaxonomia } from '../tipos-dominio';

export type NuevaTaxonomia = { nombre: string; slug?: string; descripcion?: string | null };
export type CambiosTaxonomia = Partial<NuevaTaxonomia>;

/** El slug lo genera la base si no viene (a10_asignar_slug). */
export async function crearTaxonomia(c: ClienteBlog, tipo: TipoTaxonomia, datos: NuevaTaxonomia): Promise<Taxonomia> {
  const { data, error } = await c
    .from(TABLA_TAXONOMIA[tipo])
    .insert({ ...datos, slug: datos.slug ?? '' })
    .select()
    .single();
  if (error) throw traducirError(error);
  return data;
}

export async function actualizarTaxonomia(
  c: ClienteBlog,
  tipo: TipoTaxonomia,
  id: string,
  cambios: CambiosTaxonomia,
): Promise<Taxonomia> {
  const { data, error } = await c.from(TABLA_TAXONOMIA[tipo]).update(cambios).eq('id', id).select().maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ErrorDominio('no_encontrado', 'La taxonomía no existe');
  return data;
}

/** Una categoría con artículos lanza categoria_en_uso con el conteo en `detalle` (RF-016). */
export async function eliminarTaxonomia(c: ClienteBlog, tipo: TipoTaxonomia, id: string): Promise<void> {
  const { data, error } = await c.from(TABLA_TAXONOMIA[tipo]).delete().eq('id', id).select('id');
  if (error) throw traducirError(error);
  if (data.length === 0) throw new ErrorDominio('no_encontrado', 'La taxonomía no existe');
}

/** Atómica y con bloqueo optimista: devuelve la versión nueva del artículo (D22). */
export async function asignarEtiquetas(
  c: ClienteBlog,
  articuloId: string,
  version: number,
  etiquetaIds: string[],
): Promise<{ version: number }> {
  const { data, error } = await c.rpc('asignar_etiquetas', {
    articulo_id: articuloId,
    etiqueta_ids: etiquetaIds,
    version,
  });
  if (error) throw traducirError(error);
  return { version: data };
}
