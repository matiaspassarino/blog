// Datos de prueba para los tests de integración: creación y limpieza. Solo para tests.
// Spec 005 (T098): el contenido es el documento (contracts/documento.md); `documentoDePrueba` arma uno con párrafos.
import type { Documento } from '@blog/bloques';
import type { ClienteBlog } from '../cliente';

/** Ids creados por una suite; `limpiar` los borra en orden (la categoría tiene FK restrict). */
export function registroDePrueba() {
  const registro = {
    articulos: [] as string[],
    categorias: [] as string[],
    etiquetas: [] as string[],
    /** El editor no puede borrar artículos: limpia un admin. */
    async limpiar(admin: ClienteBlog) {
      if (registro.articulos.length > 0) await admin.from('articulos').delete().in('id', registro.articulos);
      if (registro.categorias.length > 0) await admin.from('categorias').delete().in('id', registro.categorias);
      if (registro.etiquetas.length > 0) await admin.from('etiquetas').delete().in('id', registro.etiquetas);
    },
  };
  return registro;
}

export type RegistroDePrueba = ReturnType<typeof registroDePrueba>;

type DatosArticulo = {
  titulo: string;
  slug: string;
  contenido: Documento;
  categoriaId: string;
  extracto?: string;
  titulo_seo?: string;
  descripcion_seo?: string;
  /** Ids de etiquetas a asignar (vía asignar_etiquetas) antes de publicar. */
  etiquetas?: string[];
  publicar?: boolean;
};

/** Un documento con un párrafo por texto, cada uno con su id uuid (forma canónica). */
export function documentoDePrueba(...textos: string[]): Documento {
  return {
    type: 'doc',
    content: textos.map((texto) => ({
      type: 'paragraph',
      attrs: { id: crypto.randomUUID() },
      content: [{ type: 'text', text: texto }],
    })),
  } as Documento;
}

/** Crea un borrador con categoría y contenido (requisitos de RF-010), lo etiqueta y, si se pide, lo publica. */
export async function crearArticuloDePrueba(
  admin: ClienteBlog,
  registro: RegistroDePrueba,
  { categoriaId, etiquetas = [], publicar = true, ...campos }: DatosArticulo,
): Promise<{ id: string; slug: string; version: number }> {
  const { data: creado, error } = await admin
    .from('articulos')
    .insert({ ...campos, categoria_id: categoriaId })
    .select('id, slug, version')
    .single();
  if (error) throw new Error(`No se pudo crear el artículo de prueba: ${error.message}`);
  registro.articulos.push(creado.id);

  let version = creado.version;
  if (etiquetas.length > 0) {
    const { data, error: errorEtiquetas } = await admin.rpc('asignar_etiquetas', {
      articulo_id: creado.id,
      etiqueta_ids: etiquetas,
      version,
    });
    if (errorEtiquetas) throw new Error(`No se pudieron asignar las etiquetas: ${errorEtiquetas.message}`);
    version = data;
  }
  if (!publicar) return { ...creado, version };

  const { data: publicado, error: errorPublicar } = await admin
    .from('articulos')
    .update({ estado: 'publicado', version })
    .eq('id', creado.id)
    .select('id, slug, version, estado')
    .single();
  if (errorPublicar) throw new Error(`No se pudo publicar el artículo de prueba: ${errorPublicar.message}`);
  if (publicado.estado !== 'publicado') throw new Error('El artículo de prueba no quedó publicado');
  return { id: publicado.id, slug: publicado.slug, version: publicado.version };
}
