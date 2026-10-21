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

export const parrafo = (texto: string) => ({ id: nuevoId(), tipo: 'parrafo', texto });

/** Los 10 tipos de bloque, completos y válidos (`imagen` va en el bloque de imagen y en la galería). */
export function diezBloques(imagen: ImagenSemilla) {
  return [
    parrafo('Primer párrafo con **negrita** y _cursiva_.'),
    { id: nuevoId(), tipo: 'titulo', nivel: 2, texto: 'Un subtítulo de nivel dos' },
    { id: nuevoId(), tipo: 'imagen', imagen, leyenda: 'Leyenda de la imagen' },
    {
      id: nuevoId(),
      tipo: 'cita',
      texto: 'Una cita memorable',
      autor: 'Alguien',
      fuente: 'https://example.com/fuente',
    },
    { id: nuevoId(), tipo: 'lista', ordenada: true, items: ['Primero', 'Segundo', 'Tercero'] },
    { id: nuevoId(), tipo: 'galeria', imagenes: [imagen, { ...imagen, alt: 'Otra imagen' }], columnas: 2 },
    {
      id: nuevoId(),
      tipo: 'cta',
      titulo: 'Llamada a la acción',
      texto: 'Un texto de apoyo',
      etiquetaBoton: 'Ir al sitio',
      url: 'https://example.com/destino',
    },
    { id: nuevoId(), tipo: 'separador' },
    { id: nuevoId(), tipo: 'codigo', codigo: 'const x = 1;', lenguaje: 'ts' },
    { id: nuevoId(), tipo: 'video', proveedor: 'youtube', idVideo: 'dQw4w9WgXcQ', titulo: 'Un video de prueba' },
  ];
}

type CamposSemilla = {
  titulo: string;
  contenido?: object[];
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
      contenido: (contenido ?? [parrafo('Texto inicial')]) as never,
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
