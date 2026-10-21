// Operaciones del equipo sobre artículos (contracts/db.md, "Operaciones del equipo").
import { validarContenido, type Contenido, type ErrorBloque } from '@blog/bloques';
import type { ClienteBlog } from '../cliente';
import { ErrorDominio, traducirError } from '../errores';
import type { Database, Json } from '../tipos';
import type { EstadoArticulo, TipoEntidad } from '../tipos-dominio';
import { validarImagen } from '../validar-imagen';

type Tablas = Database['public']['Tables'];
type Insercion = Tablas['articulos']['Insert'];

/** Sin `busqueda`: es un tsvector interno que mantiene a50 (validación A7-M3). */
export type Articulo = Omit<Tablas['articulos']['Row'], 'busqueda'>;

// Un solo literal: supabase-js deriva el tipo del resultado a partir del texto.
const COLUMNAS_ARTICULO =
  'id, titulo, slug, extracto, titulo_seo, descripcion_seo, imagen_destacada, contenido, categoria_id, autor_id, estado, programado_para, publicado_en, version, creado_en, actualizado_en';

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
    | 'titulo'
    | 'slug'
    | 'extracto'
    | 'titulo_seo'
    | 'descripcion_seo'
    | 'imagen_destacada'
    | 'contenido'
    | 'categoria_id'
  >
>;

type CamposValidables = Pick<CambiosArticulo, 'contenido' | 'imagen_destacada'>;

/**
 * Valida contenido e imagen destacada con @blog/bloques antes de llegar a la base
 * (constitución §VI.4) y devuelve los valores parseados, con sus valores por defecto.
 * Los errores de la imagen destacada usan `indice: -1` y `campo: 'imagen_destacada.…'`.
 */
function validarCampos(datos: CamposValidables): CamposValidables {
  const errores: ErrorBloque[] = [];
  const validados: CamposValidables = {};

  if (datos.contenido !== undefined) {
    const validacion = validarContenido(datos.contenido);
    if (validacion.ok) validados.contenido = validacion.contenido satisfies Contenido as NonNullable<Json>;
    else errores.push(...validacion.errores);
  }

  if (datos.imagen_destacada !== undefined && datos.imagen_destacada !== null) {
    const validacion = validarImagen(datos.imagen_destacada, 'imagen_destacada');
    if (validacion.ok) validados.imagen_destacada = validacion.imagen;
    else errores.push(...validacion.errores);
  } else if (datos.imagen_destacada === null) {
    validados.imagen_destacada = null;
  }

  if (errores.length > 0) {
    throw new ErrorDominio('contenido_invalido', 'El artículo tiene campos inválidos', { errores });
  }
  return validados;
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
  const validados = validarCampos(datos);
  return conReintentoDeSlug(async () => {
    const { data, error } = await c
      .from('articulos')
      .insert({ ...datos, ...validados, slug: datos.slug ?? '' })
      .select(COLUMNAS_ARTICULO)
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
  const validados = validarCampos(cambios);
  const actualizado = await conReintentoDeSlug(async () => {
    const { data, error } = await c
      .from('articulos')
      .update({ ...cambios, ...validados, version })
      .eq('id', id)
      .eq('version', version)
      .select(COLUMNAS_ARTICULO)
      .maybeSingle();
    if (error) throw traducirError(error);
    return data;
  });
  if (actualizado) return actualizado;
  return rechazoSinFilas(c, id);
}

/** Un update con filtro de versión afectó 0 filas: o no existe (o no es visible), o la versión cambió. */
async function rechazoSinFilas(c: ClienteBlog, id: string): Promise<never> {
  const { data: existente, error } = await c.from('articulos').select('id').eq('id', id).maybeSingle();
  if (error) throw traducirError(error);
  if (!existente) throw new ErrorDominio('no_encontrado', 'El artículo no existe');
  throw new ErrorDominio('conflicto_version', 'El artículo cambió desde que lo abriste');
}

/**
 * Transición de estado con bloqueo optimista (RF-009 a RF-011). La matriz, los requisitos
 * de publicación y la fecha futura los valida la base (a40); acá solo se traducen los errores.
 * Cancelar una programación es volver a 'borrador': la base limpia programado_para.
 */
export async function cambiarEstado(
  c: ClienteBlog,
  id: string,
  version: number,
  destino: EstadoArticulo,
  opciones: { programadoPara?: Date } = {},
): Promise<Articulo> {
  const { data, error } = await c
    .from('articulos')
    .update({
      estado: destino,
      version,
      ...(opciones.programadoPara && { programado_para: opciones.programadoPara.toISOString() }),
    })
    .eq('id', id)
    .eq('version', version)
    .select(COLUMNAS_ARTICULO)
    .maybeSingle();
  if (error) throw traducirError(error);
  return data ?? rechazoSinFilas(c, id);
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
