// Operaciones del equipo sobre artículos (contracts/db.md, "Operaciones del equipo").
import { validarContenido } from '@blog/bloques';
import type { ClienteBlog } from '../cliente';
import { ErrorDominio, traducirError } from '../errores';
import type { Database } from '../tipos';

type Tablas = Database['public']['Tables'];
type Insercion = Tablas['articulos']['Insert'];

export type Articulo = Tablas['articulos']['Row'];
export type TipoEntidad = Database['public']['Enums']['tipo_entidad'];

/** El autor es el usuario actual (default auth.uid()) y el slug lo genera la base si no viene. */
export type NuevoArticulo = Pick<Insercion, 'titulo'> &
  Partial<
    Pick<
      Insercion,
      'slug' | 'extracto' | 'titulo_seo' | 'descripcion_seo' | 'imagen_destacada' | 'contenido' | 'categoria_id'
    >
  >;

/** Campos editables. El estado se cambia con cambiarEstado (H2/H4) y los campos del sistema no se tocan. */
export type CambiosArticulo = Partial<
  Pick<
    Insercion,
    'titulo' | 'slug' | 'extracto' | 'titulo_seo' | 'descripcion_seo' | 'imagen_destacada' | 'contenido' | 'categoria_id'
  >
>;

/** Valida el contenido con @blog/bloques antes de llegar a la base (constitución §VI.4). */
function exigirContenidoValido(contenido: unknown) {
  if (contenido === undefined) return;
  const validacion = validarContenido(contenido);
  if (!validacion.ok) {
    throw new ErrorDominio('contenido_invalido', 'El contenido tiene bloques inválidos', {
      errores: validacion.errores,
    });
  }
}

/** Reintenta una vez si dos escrituras simultáneas calcularon el mismo slug (research D23). */
async function conReintentoDeSlug<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof ErrorDominio && error.codigo === 'slug_duplicado') return operacion();
    throw error;
  }
}

export async function crearArticulo(c: ClienteBlog, datos: NuevoArticulo): Promise<Articulo> {
  exigirContenidoValido(datos.contenido);
  return conReintentoDeSlug(async () => {
    const { data, error } = await c
      .from('articulos')
      .insert({ ...datos, slug: datos.slug ?? '' })
      .select()
      .single();
    if (error) throw traducirError(error);
    return data;
  });
}

/** Bloqueo optimista: la versión viaja en el cuerpo y en el filtro (RF-008, research D13). */
export async function actualizarArticulo(
  c: ClienteBlog,
  id: string,
  version: number,
  cambios: CambiosArticulo,
): Promise<Articulo> {
  exigirContenidoValido(cambios.contenido);
  const actualizado = await conReintentoDeSlug(async () => {
    const { data, error } = await c
      .from('articulos')
      .update({ ...cambios, version })
      .eq('id', id)
      .eq('version', version)
      .select()
      .maybeSingle();
    if (error) throw traducirError(error);
    return data;
  });
  if (actualizado) return actualizado;

  // 0 filas: o no existe (o no es visible), o la versión cambió.
  const { data: existente, error } = await c.from('articulos').select('id').eq('id', id).maybeSingle();
  if (error) throw traducirError(error);
  if (!existente) throw new ErrorDominio('no_encontrado', 'El artículo no existe');
  throw new ErrorDominio('conflicto_version', 'El artículo cambió desde que lo abriste');
}

export async function eliminarArticulo(c: ClienteBlog, id: string): Promise<void> {
  const { data, error } = await c.from('articulos').delete().eq('id', id).select('id');
  if (error) throw traducirError(error);
  // RLS filtra en silencio: sin filas borradas, o no existe o no hay permiso (solo admin).
  if (data.length === 0) throw new ErrorDominio('no_encontrado', 'El artículo no existe o no se puede eliminar');
}

export async function previsualizarSlug(c: ClienteBlog, texto: string, tipo: TipoEntidad): Promise<string> {
  const { data, error } = await c.rpc('previsualizar_slug', { texto, tipo });
  if (error) throw traducirError(error);
  return data;
}
