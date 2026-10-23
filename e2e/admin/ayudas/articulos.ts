// Datos de artículos para los E2E del editor (spec 003, H2): se preparan y se limpian con la clave de
// servicio (solo tests, §III.4). Los títulos llevan el prefijo `e2e-` para que la limpieza los encuentre.
import { servicio } from './servicio';

/** Ids del seed (supabase/seed.sql). */
const ID_EDITOR = '00000000-0000-4000-a000-000000000003';
export const ID_EDITORA = '00000000-0000-4000-a000-000000000002';

export type ImagenSemilla = { ruta: string; ancho: number; alto: number; alt: string; decorativa: boolean };

const nuevoId = () => crypto.randomUUID();

export const imagenSemilla = (ruta: string): ImagenSemilla => ({
  ruta,
  ancho: 4,
  alto: 3,
  alt: 'Imagen de prueba',
  decorativa: false,
});

type Marca = { type: string; attrs?: Record<string, unknown> };
type NodoEnLinea = { type: 'text'; text: string; marks?: Marca[] } | { type: 'hardBreak' };
/** Un elemento del documento guardado (contracts/documento.md de la spec 005). */
export type Elemento = { type: string; attrs: Record<string, unknown>; content?: Elemento[] | NodoEnLinea[] };

const negrita: Marca = { type: 'bold' };
const cursiva: Marca = { type: 'italic' };
export const salto: NodoEnLinea = { type: 'hardBreak' };

/** Los formatos en línea del contrato (spec 005, RF-009), para armar documentos en las pruebas. */
export const MARCAS = {
  negrita,
  cursiva,
  codigo: { type: 'code' } as Marca,
  enlace: (href: string): Marca => ({ type: 'link', attrs: { href } }),
  subrayado: { type: 'underline' } as Marca,
  tachado: { type: 'strike' } as Marca,
  resaltado: { type: 'highlight' } as Marca,
  superindice: { type: 'superscript' } as Marca,
  subindice: { type: 'subscript' } as Marca,
};

/** Un párrafo o título con alineación (spec 005, RF-024: la izquierda es la ausencia del atributo). */
export const alineado = (elemento: Elemento, textAlign: 'center' | 'right' | 'justify'): Elemento => ({
  ...elemento,
  attrs: { ...elemento.attrs, textAlign },
});

/** Un tramo de texto con sus marcas. */
export const texto = (contenido: string, ...marcas: Marca[]): NodoEnLinea =>
  marcas.length > 0 ? { type: 'text', text: contenido, marks: marcas } : { type: 'text', text: contenido };
const enLinea = (partes: (string | NodoEnLinea)[]) =>
  partes.map((parte) => (typeof parte === 'string' ? texto(parte) : parte));
const interno = (contenido: string) => ({ type: 'paragraph', content: [texto(contenido)] }) as unknown as Elemento;

export const parrafo = (...partes: (string | NodoEnLinea)[]): Elemento => ({
  type: 'paragraph',
  attrs: { id: nuevoId() },
  content: enLinea(partes),
});
export const titulo = (nivel: 2 | 3 | 4, contenido: string): Elemento => ({
  type: 'heading',
  attrs: { id: nuevoId(), level: nivel },
  content: [texto(contenido)],
});
export const imagenElemento = (imagen: ImagenSemilla, leyenda?: string): Elemento => ({
  type: 'imagen',
  attrs: { id: nuevoId(), imagen, ...(leyenda ? { leyenda } : {}) },
});
export const cita = (contenido: string, campos: { autor?: string; fuente?: string } = {}): Elemento => ({
  type: 'blockquote',
  attrs: { id: nuevoId(), ...campos },
  content: [interno(contenido)],
});
export const lista = (items: string[], ordenada = false): Elemento => ({
  type: ordenada ? 'orderedList' : 'bulletList',
  attrs: { id: nuevoId() },
  content: items.map((item) => ({ type: 'listItem', content: [interno(item)] }) as unknown as Elemento),
});
const galeria = (imagenes: ImagenSemilla[], columnas: 2 | 3 | 4 = 3): Elemento => ({
  type: 'galeria',
  attrs: { id: nuevoId(), imagenes, columnas },
});
export const cta = (campos: { titulo: string; texto?: string; etiquetaBoton: string; url: string }): Elemento => ({
  type: 'cta',
  attrs: { id: nuevoId(), ...campos },
});
export const separador = (): Elemento => ({ type: 'horizontalRule', attrs: { id: nuevoId() } });
export const codigo = (contenido: string, lenguaje?: string): Elemento => ({
  type: 'codeBlock',
  attrs: { id: nuevoId(), ...(lenguaje ? { lenguaje } : {}) },
  ...(contenido ? { content: [texto(contenido)] } : {}),
});
const video = (idVideo: string, tituloDelVideo: string): Elemento => ({
  type: 'video',
  attrs: { id: nuevoId(), proveedor: 'youtube', idVideo, titulo: tituloDelVideo },
});

/** Los 10 tipos de elemento del editor, completos y válidos (`imagen` va en el elemento de imagen y en la galería). */
export function diezElementos(imagen: ImagenSemilla): Elemento[] {
  return [
    parrafo('Primer párrafo con ', texto('negrita', negrita), ' y ', texto('cursiva', cursiva), '.'),
    titulo(2, 'Un subtítulo de nivel dos'),
    imagenElemento(imagen, 'Leyenda de la imagen'),
    cita('Una cita memorable', { autor: 'Alguien', fuente: 'https://example.com/fuente' }),
    lista(['Primero', 'Segundo', 'Tercero'], true),
    galeria([imagen, { ...imagen, alt: 'Otra imagen' }], 2),
    cta({
      titulo: 'Llamada a la acción',
      texto: 'Un texto de apoyo',
      etiquetaBoton: 'Ir al sitio',
      url: 'https://example.com/destino',
    }),
    separador(),
    codigo('const x = 1;', 'ts'),
    video('dQw4w9WgXcQ', 'Un video de prueba'),
  ];
}

const TIPO_VISIBLE: Record<string, string> = {
  paragraph: 'parrafo',
  heading: 'titulo',
  bulletList: 'lista',
  orderedList: 'lista',
  blockquote: 'cita',
  codeBlock: 'codigo',
  horizontalRule: 'separador',
};

/** El nombre del tipo como lo usa la interfaz (`parrafo`, `titulo`, `lista`…), el de `TIPOS` en `ayudas/editor.ts`. */
export const tipoVisible = (elemento: Elemento | undefined) =>
  TIPO_VISIBLE[elemento?.type ?? ''] ?? elemento?.type ?? '';

/** Los elementos del documento guardado de un artículo. */
export const elementosDe = (articulo: { contenido: unknown } | null | undefined) =>
  ((articulo?.contenido as { content?: Elemento[] } | undefined)?.content ?? []) as Elemento[];

/** El texto visible de un elemento, sin marcas: un salto de línea o cada ítem de una lista, en otra línea. */
export function textoDe(elemento: Elemento | undefined): string {
  const hijos = (elemento?.content ?? []) as (Elemento | NodoEnLinea)[];
  return hijos
    .map((hijo) => {
      if (hijo.type === 'text') return (hijo as { text: string }).text;
      if (hijo.type === 'hardBreak') return '\n';
      return textoDe(hijo as Elemento);
    })
    .join(['bulletList', 'orderedList'].includes(elemento?.type ?? '') ? '\n' : '');
}

type CamposSemilla = {
  titulo: string;
  contenido?: Elemento[];
  imagen_destacada?: ImagenSemilla | null;
  autorId?: string;
  slug?: string;
};

/** Borrador con categoría y contenido (por defecto, un párrafo), a nombre de `autorId` (por defecto, el editor demo). */
export async function sembrarArticulo({ autorId = ID_EDITOR, contenido, ...campos }: CamposSemilla) {
  const s = servicio();
  const { data: categoria } = await s.from('categorias').select('id').limit(1).single();
  const { data, error } = await s
    .from('articulos')
    .insert({
      slug: '',
      ...campos,
      contenido: { type: 'doc', content: contenido ?? [parrafo('Texto inicial')] } as never,
      imagen_destacada: campos.imagen_destacada as never,
      categoria_id: categoria?.id,
      autor_id: autorId,
    })
    .select('*')
    .single();
  if (error) throw new Error(`No se pudo sembrar el artículo: ${error.message}`);
  return data;
}

/** Pasa un borrador completo a publicado (como lo haría la persona desde el panel, sin pasar por la interfaz). */
export async function publicarComoServicio(id: string) {
  const s = servicio();
  const { data: actual } = await s.from('articulos').select('version').eq('id', id).single();
  const { data, error } = await s
    .from('articulos')
    .update({ estado: 'publicado', version: actual!.version })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data || data.estado !== 'publicado') {
    throw new Error(`No se pudo publicar: ${error?.message ?? data?.estado}`);
  }
  return data;
}

/**
 * Lleva un artículo a cualquier estado sin pasar por la interfaz (H3). La clave de servicio no es "cliente":
 * la base no le exige fecha futura al programar, así que `programadoPara` puede ser cualquiera.
 */
export async function pasarAComoServicio(
  id: string,
  estado: 'borrador' | 'programado' | 'publicado' | 'archivado',
  programadoPara?: Date,
) {
  const s = servicio();
  const { data: actual } = await s.from('articulos').select('version').eq('id', id).single();
  const { data, error } = await s
    .from('articulos')
    .update({
      estado,
      version: actual!.version,
      ...(programadoPara && { programado_para: programadoPara.toISOString() }),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data || data.estado !== estado) throw new Error(`No se pudo pasar a ${estado}: ${error?.message}`);
  return data;
}

/** Quita la categoría de un borrador (para probar el requisito de publicación "sin categoría"). */
export async function quitarCategoriaComoServicio(id: string) {
  const s = servicio();
  const { data: actual } = await s.from('articulos').select('version').eq('id', id).single();
  const { error } = await s.from('articulos').update({ categoria_id: null, version: actual!.version }).eq('id', id);
  if (error) throw new Error(`No se pudo quitar la categoría: ${error.message}`);
}

export async function articuloPorTitulo(titulo: string) {
  const { data } = await servicio().from('articulos').select('*').eq('titulo', titulo).maybeSingle();
  return data;
}

export async function articuloPorId(id: string) {
  const { data, error } = await servicio().from('articulos').select('*').eq('id', id).single();
  if (error) throw new Error(`No se pudo leer el artículo ${id}: ${error.message}`);
  return data;
}

/** Sube un objeto al bucket `medios` sin pasar por el panel (para preparar artículos con imágenes). */
export async function subirObjeto(ruta: string, contenido: Uint8Array, tipo = 'image/png') {
  const { error } = await servicio()
    .storage.from('medios')
    .upload(ruta, contenido, { contentType: tipo, upsert: true });
  if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`);
}

export async function existeObjeto(ruta: string) {
  return (await servicio().storage.from('medios').download(ruta)).data !== null;
}

/** Todas las rutas de imagen (`ruta`) que aparecen en el contenido y la imagen destacada. */
function rutasDe(valor: unknown, rutas = new Set<string>()): Set<string> {
  if (Array.isArray(valor)) valor.forEach((v) => rutasDe(v, rutas));
  else if (valor && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor)) {
      if (clave === 'ruta' && typeof v === 'string' && v !== '') rutas.add(v);
      else rutasDe(v, rutas);
    }
  }
  return rutas;
}

/**
 * Borra los artículos cuyo título empieza con `prefijo` y las imágenes que referencian (sin dejar objetos
 * huérfanos en el bucket local). Cada spec usa su propio prefijo (`e2e-ed-`, `e2e-me-`, …) para no borrar
 * los datos de otro archivo que corre en paralelo.
 */
export async function limpiarArticulosE2E(prefijo: string) {
  const s = servicio();
  const { data } = await s.from('articulos').select('id, contenido, imagen_destacada').like('titulo', `${prefijo}%`);
  const rutas = [...rutasDe(data ?? [])];
  await s.from('articulos').delete().like('titulo', `${prefijo}%`);
  if (rutas.length > 0) await s.storage.from('medios').remove(rutas);
}
