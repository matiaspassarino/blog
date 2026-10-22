// Ayudas de los E2E de categorías y etiquetas (spec 003, H5). FASE ROJA: GestorTaxonomias (T083) no existe aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (T083/T084: `/categorias` y `/etiquetas`, misma implementación con la prop `tipo`).
// Si la interfaz real difiere, se ajusta aquí, en un solo lugar.
//   - `h1` "Categorías" / "Etiquetas".
//   - Alta: un formulario con nombre accesible "Nueva categoría" / "Nueva etiqueta" (`role="form"`, por `aria-label`),
//     siempre visible en la página, con los campos "Nombre", "Slug" y "Descripción" y el botón "Crear categoría" /
//     "Crear etiqueta". Al escribir el nombre, tras ~300 ms el campo "Slug" se completa con el slug sugerido
//     (`previsualizarSlugAccion`) mientras la persona no lo haya tocado.
//   - Tabla (`role="table"`) con columnas "Nombre", "Slug", "Descripción", "Artículos" (conteo) y "Acciones". Cada fila
//     (`role="row"`) tiene como nombre accesible su contenido, así que se ubica con el nombre de la taxonomía.
//   - Edición: el botón "Editar <nombre>" de la fila abre un `dialog` con nombre accesible "Editar <nombre>", con los mismos
//     campos ("Nombre", "Slug", "Descripción") y el botón "Guardar cambios" (y "Cancelar"). Cierra al guardar bien.
//   - Aviso de RF-019: dentro del diálogo, mientras el campo "Slug" difiere del guardado y la taxonomía tiene artículos
//     publicados, aparece un `role="status"` (o `role="alert"`) que dice que la dirección pública cambia y que la anterior
//     seguirá redirigiendo. No aparece si el slug no cambia o no hay artículos publicados.
//   - Baja: el botón "Eliminar <nombre>" abre un `alertdialog` (ConfirmarAccion) que dice cuántos artículos se verán
//     afectados ("N artículos" / "1 artículo"), con "Cancelar" y un botón de confirmación "Eliminar" (nombre exacto).
//   - Los errores de las acciones salen en un `role="alert"` con el texto de `mensajeDeError` (o el detalle de la acción):
//     "Ya existe una categoría con ese nombre" y "No se puede eliminar: la usan N artículos.".
import { expect, type Locator, type Page } from '@playwright/test';
import { publicarComoServicio, sembrarArticulo } from './articulos';
import { servicio } from './servicio';

const URL_SITIO = 'http://localhost:4321';

export type Tipo = 'categoria' | 'etiqueta';

export const TEXTOS = {
  categoria: {
    ruta: '/categorias',
    titulo: 'Categorías',
    formulario: 'Nueva categoría',
    crear: 'Crear categoría',
    tabla: 'categorias',
    rutaSitio: '/blog/categoria',
  },
  etiqueta: {
    ruta: '/etiquetas',
    titulo: 'Etiquetas',
    formulario: 'Nueva etiqueta',
    crear: 'Crear etiqueta',
    tabla: 'etiquetas',
    rutaSitio: '/blog/etiqueta',
  },
} as const;

export const formularioDeAlta = (page: Page, tipo: Tipo) =>
  page.getByRole('form', { name: TEXTOS[tipo].formulario, exact: true });

export const filaDe = (page: Page, nombre: string): Locator =>
  page.getByRole('row').filter({ has: page.getByText(nombre, { exact: true }) });

export const dialogoDeEdicion = (page: Page, nombre: string) =>
  page.getByRole('dialog', { name: `Editar ${nombre}`, exact: true });

/** Aviso (status o alert) dentro de un ámbito. */
export const avisoEn = (ambito: Locator) => ambito.getByRole('status').or(ambito.getByRole('alert'));

export const errorDelPanel = (page: Page) => page.getByRole('alert').filter({ hasText: /\S/ });

/** Llena el alta y la envía. Si se pasa `slug`, pisa la sugerencia. */
export async function crearPorLaInterfaz(
  page: Page,
  tipo: Tipo,
  campos: { nombre: string; slug?: string; descripcion?: string },
) {
  const formulario = formularioDeAlta(page, tipo);
  await formulario.getByLabel('Nombre', { exact: true }).fill(campos.nombre);
  if (campos.slug !== undefined) await formulario.getByLabel('Slug', { exact: true }).fill(campos.slug);
  if (campos.descripcion !== undefined) {
    await formulario.getByLabel('Descripción', { exact: true }).fill(campos.descripcion);
  }
  await formulario.getByRole('button', { name: TEXTOS[tipo].crear, exact: true }).click();
}

// --- Datos preparados con la clave de servicio (solo tests, §III.4) -----------------------------------------------

const TABLA = { categoria: 'categorias', etiqueta: 'etiquetas' } as const;

export async function sembrarTaxonomia(tipo: Tipo, nombre: string, descripcion?: string) {
  const { data, error } = await servicio()
    .from(TABLA[tipo])
    .insert({ nombre, slug: '', descripcion })
    .select('*')
    .single();
  if (error) throw new Error(`No se pudo sembrar la ${tipo}: ${error.message}`);
  return data;
}

export async function taxonomiaPorId(tipo: Tipo, id: string) {
  const { data } = await servicio().from(TABLA[tipo]).select('*').eq('id', id).maybeSingle();
  return data;
}

export async function taxonomiaPorNombre(tipo: Tipo, nombre: string) {
  const { data } = await servicio().from(TABLA[tipo]).select('*').eq('nombre', nombre).maybeSingle();
  return data;
}

/**
 * Artículo con la taxonomía asignada, publicado o en borrador. La categoría se asigna como categoría del artículo;
 * la etiqueta, en `articulos_etiquetas` (la clave de servicio puede escribirla directo).
 */
export async function sembrarArticuloConTaxonomia(tipo: Tipo, taxonomiaId: string, titulo: string, publicado: boolean) {
  const s = servicio();
  const articulo = await sembrarArticulo({ titulo });
  if (tipo === 'categoria') {
    const { error } = await s
      .from('articulos')
      .update({ categoria_id: taxonomiaId, version: articulo.version })
      .eq('id', articulo.id);
    if (error) throw new Error(`No se pudo asignar la categoría: ${error.message}`);
  } else {
    const { error } = await s
      .from('articulos_etiquetas')
      .insert({ articulo_id: articulo.id, etiqueta_id: taxonomiaId });
    if (error) throw new Error(`No se pudo asignar la etiqueta: ${error.message}`);
  }
  return publicado ? publicarComoServicio(articulo.id) : articulo;
}

export async function redireccionDe(tipo: Tipo, slugAnterior: string) {
  const { data } = await servicio()
    .from('redirecciones')
    .select('entidad_id')
    .eq('tipo_entidad', tipo)
    .eq('slug_anterior', slugAnterior)
    .maybeSingle();
  return data;
}

// --- Sitio público ------------------------------------------------------------------------------------------------

const urlEnElSitio = (tipo: Tipo, slug: string) => `${URL_SITIO}${TEXTOS[tipo].rutaSitio}/${slug}`;

/** Espera (hasta 60 s, CE-003) a que la página pública de la taxonomía responda 200 y contenga `texto`. */
export async function esperarTextoEnElSitio(page: Page, tipo: Tipo, slug: string, texto: string) {
  await expect
    .poll(
      async () => {
        const respuesta = await page.request.get(urlEnElSitio(tipo, slug), { maxRedirects: 0 });
        return respuesta.status() === 200 && (await respuesta.text()).includes(texto);
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 3_000], message: `el sitio debería mostrar "${texto}" en ${slug}` },
    )
    .toBe(true);
}

/** Espera (hasta 60 s) a que la dirección vieja responda 301 hacia la nueva. */
export async function esperarRedireccion301(page: Page, tipo: Tipo, slugViejo: string, slugNuevo: string) {
  await expect
    .poll(
      async () => {
        const respuesta = await page.request.get(urlEnElSitio(tipo, slugViejo), { maxRedirects: 0 });
        const destino = respuesta.headers()['location'] ?? '';
        return `${respuesta.status()} ${destino.endsWith(`${TEXTOS[tipo].rutaSitio}/${slugNuevo}`) ? 'a la nueva' : destino}`;
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 3_000], message: `${slugViejo} debería redirigir a ${slugNuevo}` },
    )
    .toBe('301 a la nueva');
}
