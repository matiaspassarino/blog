// Lecturas del panel de administración (spec 003, contracts/acciones.md y data-model). Todas se hacen
// con la sesión del miembro: RLS y las funciones del panel deciden qué ve cada rol.
import type { ClienteBlog } from '../cliente';
import { traducirError } from '../errores';
import { aPagina, rangoDe, type Pagina } from '../paginacion';
import type { Database } from '../tipos';
import type { EstadoArticulo, Taxonomia, TipoTaxonomia } from '../tipos-dominio';
import type { Articulo } from './equipo-articulos';
import type { Perfil } from './equipo-perfiles';
import type { ReferenciaTaxonomia } from './tipos-publicos';

type Funciones = Database['public']['Functions'];

/** RF-016: 20 por página en la lista del panel. */
const POR_PAGINA_PANEL = 20;

export type FiltrosPanel = {
  estado?: EstadoArticulo;
  categoria?: string;
  autor?: string;
  /** Texto del título, sin distinguir mayúsculas ni tildes. */
  q?: string;
  pagina?: number;
};

export type FilaArticuloPanel = {
  id: string;
  titulo: string;
  slug: string;
  estado: EstadoArticulo;
  categoria_id: string | null;
  categoria_nombre: string | null;
  autor_id: string | null;
  autor_nombre: string | null;
  programado_para: string | null;
  publicado_en: string | null;
  actualizado_en: string;
};

type FilaCruda = Funciones['listar_articulos_panel']['Returns'][number];

async function consultarLista(c: ClienteBlog, filtros: FiltrosPanel, desde: number) {
  const { data, error } = await c.rpc('listar_articulos_panel', {
    p_estado: filtros.estado,
    p_categoria_id: filtros.categoria,
    p_autor_id: filtros.autor,
    p_texto: filtros.q,
    p_limite: POR_PAGINA_PANEL,
    p_desplazamiento: desde,
  });
  if (error) throw traducirError(error);
  return data as FilaCruda[];
}

/**
 * Lista de todos los artículos, de cualquier autor y estado (H4). Una página fuera de rango devuelve
 * `items` vacío con el `total` real, para que quien llama pueda volver a la primera página.
 */
export async function listarArticulosPanel(
  c: ClienteBlog,
  filtros: FiltrosPanel = {},
): Promise<Pagina<FilaArticuloPanel>> {
  const { pagina, porPagina, desde } = rangoDe({ pagina: filtros.pagina, porPagina: POR_PAGINA_PANEL });
  const filas = await consultarLista(c, filtros, desde);

  let total = filas[0]?.total ?? 0;
  if (filas.length === 0 && pagina > 1) total = (await consultarLista(c, filtros, 0))[0]?.total ?? 0;

  const items = filas.map(({ total: _total, ...fila }) => fila as FilaArticuloPanel);
  return aPagina(items, Number(total), pagina, porPagina);
}

export type FilaEquipo = {
  id: string;
  nombre: string;
  correo: string;
  rol: Perfil['rol'];
  activo: boolean;
  acceso: 'activo' | 'invitado' | 'desactivado';
  creado_en: string;
};

/** Equipo con correo y estado de acceso. Solo el admin; para otro rol lanza `sin_permiso` (H6). */
export async function listarEquipo(c: ClienteBlog): Promise<FilaEquipo[]> {
  const { data, error } = await c.rpc('listar_equipo');
  if (error) throw traducirError(error);
  return data as FilaEquipo[];
}

/** Rutas (relativas al bucket) que algún artículo o perfil sigue usando (D11). */
export async function rutasEnUso(c: ClienteBlog, rutas: string[]): Promise<string[]> {
  if (rutas.length === 0) return [];
  const { data, error } = await c.rpc('rutas_en_uso', { p_rutas: rutas });
  if (error) throw traducirError(error);
  return data;
}

/** Perfil de la sesión; `null` sin sesión. Con `id` se evita releer la sesión (ya verificada por quien llama). */
export async function obtenerPerfilPropio(c: ClienteBlog, id?: string): Promise<Perfil | null> {
  const idPerfil = id ?? (await c.auth.getSession()).data.session?.user.id;
  if (!idPerfil) return null;
  const { data, error } = await c.from('perfiles').select('*').eq('id', idPerfil).maybeSingle();
  if (error) throw traducirError(error);
  return data;
}

/** Miembros del equipo para el filtro por autor; lo puede leer cualquier miembro (sin correo ni rol). */
export async function listarAutores(c: ClienteBlog): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await c.from('perfiles').select('id, nombre').order('nombre').order('id');
  // Un anónimo no tiene ni permiso de lectura sobre perfiles: para él no hay autores que listar.
  if (error?.code === '42501') return [];
  if (error) throw traducirError(error);
  return data;
}

export type TaxonomiaConConteo = Taxonomia & {
  /** Artículos que la usan, en cualquier estado (así cuenta `categoria_en_uso`). */
  conteo: number;
  /** De esos, los publicados: solo ellos tienen una dirección pública que cambiar (RF-019). */
  publicados: number;
};

/** Cuántas veces aparece cada id: sirve para contar filas agrupadas por taxonomía. */
function contarPorId(ids: (string | null)[]): Map<string, number> {
  const cuentas = new Map<string, number>();
  for (const id of ids) if (id) cuentas.set(id, (cuentas.get(id) ?? 0) + 1);
  return cuentas;
}

/** Artículos publicados por categoría o etiqueta, como mapa id -> cantidad. */
async function publicadosPorTaxonomia(c: ClienteBlog, tipo: TipoTaxonomia): Promise<Map<string, number>> {
  if (tipo === 'categoria') {
    const { data, error } = await c.from('articulos').select('categoria_id').eq('estado', 'publicado');
    if (error) throw traducirError(error);
    return contarPorId(data.map((fila) => fila.categoria_id));
  }
  const { data, error } = await c
    .from('articulos_etiquetas')
    .select('etiqueta_id, articulos!inner(estado)')
    .eq('articulos.estado', 'publicado');
  if (error) throw traducirError(error);
  return contarPorId(data.map((fila) => fila.etiqueta_id));
}

/** Categorías o etiquetas con la cantidad de artículos que las usan (H5). */
export async function listarTaxonomiasConConteo(c: ClienteBlog, tipo: TipoTaxonomia): Promise<TaxonomiaConConteo[]> {
  const publicados = await publicadosPorTaxonomia(c, tipo);
  if (tipo === 'categoria') {
    const { data, error } = await c.from('categorias').select('*, articulos(count)').order('nombre');
    if (error) throw traducirError(error);
    return data.map(({ articulos, ...taxonomia }) => ({
      ...taxonomia,
      conteo: articulos[0]?.count ?? 0,
      publicados: publicados.get(taxonomia.id) ?? 0,
    }));
  }
  const { data, error } = await c.from('etiquetas').select('*, articulos_etiquetas(count)').order('nombre');
  if (error) throw traducirError(error);
  return data.map(({ articulos_etiquetas, ...taxonomia }) => ({
    ...taxonomia,
    conteo: articulos_etiquetas[0]?.count ?? 0,
    publicados: publicados.get(taxonomia.id) ?? 0,
  }));
}

/** Una categoría o etiqueta con sus artículos publicados; `null` si no existe. */
export async function leerTaxonomiaConPublicados(
  c: ClienteBlog,
  tipo: TipoTaxonomia,
  id: string,
): Promise<{ taxonomia: Taxonomia; publicados: number } | null> {
  const tabla = tipo === 'categoria' ? 'categorias' : 'etiquetas';
  const { data, error } = await c.from(tabla).select('*').eq('id', id).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) return null;
  return { taxonomia: data, publicados: (await publicadosPorTaxonomia(c, tipo)).get(id) ?? 0 };
}

async function listarReferencias(c: ClienteBlog, tabla: 'categorias' | 'etiquetas'): Promise<ReferenciaTaxonomia[]> {
  const { data, error } = await c.from(tabla).select('id, nombre, slug').order('nombre');
  if (error) throw traducirError(error);
  return data;
}

/** Categorías para el selector del editor. */
export const listarCategoriasPanel = (c: ClienteBlog) => listarReferencias(c, 'categorias');

/** Etiquetas para el selector del editor. */
export const listarEtiquetasPanel = (c: ClienteBlog) => listarReferencias(c, 'etiquetas');

export type ArticuloParaEditar = Articulo & { etiquetas: string[] };

/** Artículo completo con los ids de sus etiquetas; `null` si no existe o no es visible. */
export async function obtenerArticuloParaEditar(c: ClienteBlog, id: string): Promise<ArticuloParaEditar | null> {
  const { data, error } = await c
    .from('articulos')
    .select('*, articulos_etiquetas(etiqueta_id)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw traducirError(error);
  if (!data) return null;
  const { busqueda: _busqueda, articulos_etiquetas, ...articulo } = data;
  return { ...articulo, etiquetas: articulos_etiquetas.map((fila) => fila.etiqueta_id) };
}
