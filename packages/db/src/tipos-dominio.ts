// Tipos de dominio derivados del esquema generado, compartidos por las consultas.
import type { Database } from './tipos';

type Enums = Database['public']['Enums'];

export type TipoEntidad = Enums['tipo_entidad'];
export type EstadoArticulo = Enums['estado_articulo'];
export type RolMiembro = Enums['rol_miembro'];

type Tablas = Database['public']['Tables'];

/** Fila completa de categoría o etiqueta (id, nombre, slug, descripcion y fechas). */
export type Categoria = Tablas['categorias']['Row'];
export type Etiqueta = Tablas['etiquetas']['Row'];
export type Taxonomia = Categoria | Etiqueta;
export type TipoTaxonomia = Exclude<TipoEntidad, 'articulo' | 'autor'>;

/** Tabla de cada tipo de taxonomía (única fuente; la usan listados y operaciones del equipo). */
export const TABLA_TAXONOMIA = { categoria: 'categorias', etiqueta: 'etiquetas' } as const satisfies Record<
  TipoTaxonomia,
  string
>;
