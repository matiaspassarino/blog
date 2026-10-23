// Estado del editor de artículos como funciones puras (spec 003, research D12 y D13). El componente
// `EditorArticulo` lo usa con `useReducer`; vive aparte para probarlo sin React.
import type { Documento, Imagen } from '@blog/bloques';

export type DatosArticulo = {
  version: number;
  titulo: string;
  slug: string;
  extracto: string | null;
  titulo_seo: string | null;
  descripcion_seo: string | null;
  imagen_destacada: Imagen | null;
  categoria_id: string | null;
  contenido: Documento;
  /** Ids de etiquetas. */
  etiquetas: string[];
};

export type EstadoEditor = {
  datos: DatosArticulo;
  /** Lo último que está guardado en el servidor: contra esto se detectan los cambios sin guardar. */
  guardado: DatosArticulo;
  /** Cierto cuando la persona escribió el slug a mano: el título deja de sugerirlo. */
  slugManual: boolean;
};

type CampoEditable =
  'titulo' | 'slug' | 'extracto' | 'titulo_seo' | 'descripcion_seo' | 'imagen_destacada' | 'categoria_id' | 'etiquetas';

export type AccionEditor =
  | { tipo: 'campo'; campo: CampoEditable; valor: unknown }
  | { tipo: 'sugerir_slug'; slug: string }
  | { tipo: 'contenido'; valor: Documento }
  | { tipo: 'guardado'; articulo: DatosArticulo }
  | { tipo: 'adoptar_vigente'; articulo: DatosArticulo };

/** En un artículo existente el slug es manual desde el inicio: cambiar el título no cambia su dirección. */
export function estadoInicial(datos: DatosArticulo, { nuevo }: { nuevo: boolean }): EstadoEditor {
  return { datos: structuredClone(datos), guardado: structuredClone(datos), slugManual: !nuevo };
}

export function iguales(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const clavesA = Object.keys(a);
  if (clavesA.length !== Object.keys(b).length) return false;
  return clavesA.every((clave) =>
    iguales((a as Record<string, unknown>)[clave], (b as Record<string, unknown>)[clave]),
  );
}

export const estaSucio = (estado: EstadoEditor) => !iguales(estado.datos, estado.guardado);

const conDatos = (estado: EstadoEditor, cambios: Partial<DatosArticulo>): EstadoEditor => ({
  ...estado,
  datos: { ...estado.datos, ...cambios },
});

export function reductor(estado: EstadoEditor, accion: AccionEditor): EstadoEditor {
  switch (accion.tipo) {
    case 'campo':
      return {
        ...conDatos(estado, { [accion.campo]: accion.valor }),
        // Escribir el slug lo hace manual; vaciarlo devuelve el control al título.
        slugManual: accion.campo === 'slug' ? accion.valor !== '' : estado.slugManual,
      };
    case 'sugerir_slug':
      return estado.slugManual ? estado : conDatos(estado, { slug: accion.slug });
    case 'contenido':
      return conDatos(estado, { contenido: accion.valor });
    case 'guardado':
    case 'adoptar_vigente':
      return {
        datos: structuredClone(accion.articulo),
        guardado: structuredClone(accion.articulo),
        slugManual: true,
      };
  }
}
