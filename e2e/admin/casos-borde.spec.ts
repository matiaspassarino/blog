// T100 (spec 003, casos borde de la spec, CE-005, RF-002, RF-006, RF-007, RF-013). Cada caso borde tiene su prueba, con
// el prefijo `CB-` y el texto del caso de la spec.
//
// Supuestos de interfaz (los mismos contratos de ./ayudas/editor.ts, ./ayudas/estado.ts y los specs de H1 a H3):
//   - Sesión vencida: la cookie de actividad `blog_actividad` guarda la hora del último uso en milisegundos; con más de 8 h
//     el proxy lleva a `/salir?motivo=inactividad`, que cierra la sesión y deja en `/ingreso?motivo=inactividad` con el
//     aviso "Tu sesión se cerró por inactividad". Al guardar con la sesión vencida, lo no guardado se descarta.
//   - Subida fallida: el selector de imagen explica el motivo en un `role="alert"` y deja el bloque sin imagen.
//   - Etiquetas del editor: casillas con el nombre de la etiqueta dentro del grupo "Etiquetas" (`fieldset`).
//   - Guardado de un artículo nuevo con slug repetido: el campo "Slug" pasa al slug definitivo con sufijo numérico.
//   - Un publicado al que se le quitan todos los bloques no puede quedar publicado: o se rechaza el guardado, o hay que
//     volver a borrador antes; en ningún caso la base queda con un publicado sin bloques.
import { expect, test, type Page } from '@playwright/test';
import {
  articuloPorId,
  limpiarArticulosE2E,
  pasarAComoServicio,
  publicarComoServicio,
  sembrarArticulo,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import { botonGuardar, elegirImagen, guardarYEsperar } from './ayudas/editor';
import {
  botonDeEstado,
  errorDelPanel,
  esperarEstado,
  panelPublicacion,
  URL_SITIO,
  urlDelArticulo,
} from './ayudas/estado';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { crearMiembro, servicio, type MiembroDePrueba } from './ayudas/servicio';
import { sembrarTaxonomia } from './ayudas/taxonomias';
import { pngDecodificable } from '../../packages/db/src/pruebas/imagenes';

const PREFIJO = 'e2e-cb-';
const titulo = (etiqueta: string) => nombreDePrueba(`cb-${etiqueta}`);
const miembros: MiembroDePrueba[] = [];

test.afterEach(async () => {
  for (const miembro of miembros.splice(0)) await miembro.eliminar();
});
test.afterAll(async () => {
  await limpiarArticulosE2E(PREFIJO);
  await servicio().from('etiquetas').delete().like('nombre', `${PREFIJO}%`);
});

const campoTitulo = (page: Page) => page.getByLabel('Título', { exact: true });

/** Deja la cookie de actividad con la hora de hace `horas` (más de 8 h = sesión vencida por inactividad). */
async function envejecerActividad(page: Page, horas: number) {
  const url = test.info().project.use.baseURL!;
  await page
    .context()
    .addCookies([{ name: 'blog_actividad', value: String(Date.now() - horas * 3_600_000), url, httpOnly: true }]);
}

test.describe('Casos borde: sesión vencida mientras se escribe (RF-002)', () => {
  test('CB-sesion: al guardar con la sesión vencida el panel avisa, cierra la sesión y descarta lo no guardado', async ({
    page,
    context,
  }) => {
    const original = titulo('sesion vencida');
    const articulo = await sembrarArticulo({ titulo: original });
    await ingresar(page, USUARIOS.editor);
    await page.goto(urlDelArticulo(articulo.id));
    await campoTitulo(page).fill(titulo('escrito sin guardar'));
    // Next precarga los enlaces visibles; con la sesión ya vencida esas precargas la cerrarían antes de guardar.
    await page.waitForLoadState('networkidle');
    await envejecerActividad(page, 9);

    await botonGuardar(page).click();

    await expect(page).toHaveURL(/\/ingreso\?motivo=(inactividad|sesion)$/);
    await expect(page.getByRole('alert').filter({ hasText: /sesión/i })).toBeVisible();
    expect((await articuloPorId(articulo.id)).titulo).toBe(original);
    const cookies = await context.cookies();
    expect(cookies.filter((c) => /auth-token/.test(c.name))).toEqual([]);
    await page.goto(urlDelArticulo(articulo.id));
    await expect(page).toHaveURL(/\/ingreso\?volver=/);
  });

  test('CB-sesion: abrir cualquier pantalla con la sesión vencida lleva al ingreso con el motivo de inactividad', async ({
    page,
  }) => {
    await ingresar(page, USUARIOS.editor);
    await envejecerActividad(page, 9);

    await page.goto('/articulos');

    await expect(page).toHaveURL(/\/ingreso\?motivo=inactividad$/);
    await expect(page.getByRole('alert').filter({ hasText: 'Tu sesión se cerró por inactividad' })).toBeVisible();
  });

  test('CB-sesion: con la actividad reciente (menos de 8 h) la sesión sigue y se renueva', async ({
    page,
    context,
  }) => {
    await ingresar(page, USUARIOS.editor);
    await envejecerActividad(page, 7);

    await page.goto('/categorias');

    await expect(page).toHaveURL(/\/categorias$/);
    const cookie = (await context.cookies()).find((c) => c.name === 'blog_actividad');
    expect(Date.now() - Number(cookie?.value)).toBeLessThan(60_000);
  });
});

test.describe('Casos borde: la subida de una imagen falla (RF-007)', () => {
  const png = { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(pngDecodificable(4, 3)) };

  for (const [nombre, simular] of [
    ['la conexión se corta', (ruta: import('@playwright/test').Route) => ruta.abort('failed')],
    [
      'el almacenamiento responde con un error del servidor',
      (ruta: import('@playwright/test').Route) =>
        ruta.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"fallo"}' }),
    ],
  ] as const) {
    test(`CB-subida: si ${nombre}, el bloque queda sin imagen, se explica el motivo y el resto del artículo se conserva`, async ({
      page,
    }) => {
      await ingresar(page, USUARIOS.editor);
      await page.goto('/articulos/nuevo');
      const nombreArticulo = titulo('subida fallida');
      await campoTitulo(page).fill(nombreArticulo);
      await page.getByLabel('Extracto', { exact: true }).fill('Un extracto que debe conservarse');
      await page.route('**/storage/v1/object/upload/sign/**', simular);
      const destacada = page.getByRole('group', { name: 'Imagen destacada' });

      await elegirImagen(page, destacada, png);

      const aviso = destacada.getByRole('alert');
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(/\S+/);
      await expect(destacada.getByRole('button', { name: /Quitar imagen/ })).toHaveCount(0);
      await expect(destacada.getByLabel('Texto alternativo', { exact: true })).toHaveCount(0);
      await expect(campoTitulo(page)).toHaveValue(nombreArticulo);
      await expect(page.getByLabel('Extracto', { exact: true })).toHaveValue('Un extracto que debe conservarse');

      await page.unroute('**/storage/v1/object/upload/sign/**');
      await guardarYEsperar(page);
      const { data } = await servicio()
        .from('articulos')
        .select('imagen_destacada')
        .eq('titulo', nombreArticulo)
        .single();
      expect(data?.imagen_destacada).toBeNull();
    });
  }
});

test.describe('Casos borde: edición concurrente con una publicación automática (CE-005)', () => {
  test('CB-programado: guardar sobre un programado que se publicó mientras estaba abierto se rechaza y conserva lo escrito', async ({
    page,
  }) => {
    const original = titulo('programado abierto');
    const articulo = await sembrarArticulo({ titulo: original });
    await pasarAComoServicio(articulo.id, 'programado', new Date(Date.now() + 24 * 3_600_000));
    await ingresar(page, USUARIOS.editor);
    await page.goto(urlDelArticulo(articulo.id));
    await esperarEstado(page, 'programado');
    const escrito = titulo('escrito durante la publicacion');
    await campoTitulo(page).fill(escrito);

    // Lo que hace pg_cron cuando llega la hora: el artículo pasa a publicado mientras la pantalla sigue abierta.
    await pasarAComoServicio(articulo.id, 'publicado');
    await botonGuardar(page).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Alguien guardó cambios más nuevos' })).toBeVisible();
    await expect(campoTitulo(page)).toHaveValue(escrito);
    const guardado = await articuloPorId(articulo.id);
    expect(guardado.titulo).toBe(original);
    expect(guardado.estado).toBe('publicado');
  });
});

test.describe('Casos borde: el autor del artículo fue desactivado', () => {
  test('CB-autor: el artículo sigue apareciendo con su autor y se puede editar y publicar', async ({ page }) => {
    const nombreAutor = nombreDePrueba('cb-autor-baja');
    const autor = await crearMiembro(nombreAutor);
    miembros.push(autor);
    const original = titulo('autor desactivado');
    const articulo = await sembrarArticulo({ titulo: original, autorId: autor.id });
    await autor.desactivar();
    await ingresar(page, USUARIOS.editor);

    await page.goto(`/articulos?q=${encodeURIComponent(original)}`);
    const fila = page.getByRole('row').filter({ hasText: original });
    await expect(fila).toContainText(nombreAutor);

    await page.goto(urlDelArticulo(articulo.id));
    const nuevo = titulo('autor desactivado editado');
    await campoTitulo(page).fill(nuevo);
    await guardarYEsperar(page);
    await botonDeEstado(page, 'Publicar').click();
    await esperarEstado(page, 'publicado');

    const guardado = await articuloPorId(articulo.id);
    expect(guardado).toMatchObject({ titulo: nuevo, estado: 'publicado', autor_id: autor.id });
  });
});

test.describe('Casos borde: quitar todas las etiquetas de un artículo publicado', () => {
  test('CB-etiquetas: se guarda sin etiquetas y el sitio deja de mostrarlas', async ({ page }) => {
    test.slow();
    const etiquetas = [
      await sembrarTaxonomia('etiqueta', titulo('etiqueta uno')),
      await sembrarTaxonomia('etiqueta', titulo('etiqueta dos')),
    ];
    const articulo = await sembrarArticulo({ titulo: titulo('sin etiquetas') });
    await servicio()
      .from('articulos_etiquetas')
      .insert(etiquetas.map((etiqueta) => ({ articulo_id: articulo.id, etiqueta_id: etiqueta.id })));
    const publicado = await publicarComoServicio(articulo.id);
    const enElSitio = async () => {
      const respuesta = await page.request.get(`${URL_SITIO}/blog/${publicado.slug}`);
      const texto = await respuesta.text();
      return etiquetas.map((e) => texto.includes(e.nombre));
    };
    await expect
      .poll(enElSitio, {
        timeout: 60_000,
        intervals: [1_000, 2_000, 3_000],
        message: 'el sitio debería mostrar las etiquetas',
      })
      .toEqual([true, true]);
    await ingresar(page, USUARIOS.editor);
    await page.goto(urlDelArticulo(articulo.id));
    for (const etiqueta of etiquetas) await expect(page.getByLabel(etiqueta.nombre, { exact: true })).toBeChecked();

    for (const etiqueta of etiquetas) await page.getByLabel(etiqueta.nombre, { exact: true }).uncheck();
    await guardarYEsperar(page);

    const { data } = await servicio().from('articulos_etiquetas').select('etiqueta_id').eq('articulo_id', articulo.id);
    expect(data).toEqual([]);
    expect((await articuloPorId(articulo.id)).estado).toBe('publicado');
    await page.reload();
    for (const etiqueta of etiquetas) await expect(page.getByLabel(etiqueta.nombre, { exact: true })).not.toBeChecked();
    await expect
      .poll(enElSitio, {
        timeout: 60_000,
        intervals: [1_000, 2_000, 3_000],
        message: 'el sitio debería dejar de mostrar las etiquetas',
      })
      .toEqual([false, false]);
  });
});

test.describe('Casos borde: un slug manual que ya existe (RF-008)', () => {
  test('CB-slug: se acepta con el sufijo numérico del sistema y el panel muestra el slug final', async ({ page }) => {
    const ocupado = `${PREFIJO}ocupado-${crypto.randomUUID().slice(0, 6)}`;
    await sembrarArticulo({ titulo: titulo('slug dueño'), slug: ocupado });
    await ingresar(page, USUARIOS.editor);
    await page.goto('/articulos/nuevo');
    const nombre = titulo('slug repetido');
    await campoTitulo(page).fill(nombre);
    await page.getByLabel('Slug', { exact: true }).fill(ocupado);

    await guardarYEsperar(page);

    const { data } = await servicio().from('articulos').select('slug').eq('titulo', nombre).single();
    expect(data?.slug).toMatch(new RegExp(`^${ocupado}-\\d+$`));
    await expect(page.getByLabel('Slug', { exact: true })).toHaveValue(data!.slug);
  });

  test('CB-slug: el mensaje de éxito nombra el slug final cuando difiere del escrito (contracts/acciones.md, guardarArticulo)', async ({
    page,
  }) => {
    const ocupado = `${PREFIJO}ocupado-${crypto.randomUUID().slice(0, 6)}`;
    await sembrarArticulo({ titulo: titulo('slug dueño msj'), slug: ocupado });
    await ingresar(page, USUARIOS.editor);
    await page.goto('/articulos/nuevo');
    const nombre = titulo('slug repetido msj');
    await campoTitulo(page).fill(nombre);
    await page.getByLabel('Slug', { exact: true }).fill(ocupado);

    await guardarYEsperar(page);

    const { data } = await servicio().from('articulos').select('slug').eq('titulo', nombre).single();
    await expect(page.getByRole('status').filter({ hasText: data!.slug })).toBeVisible();
  });
});

test.describe('Casos borde: un publicado sin bloques', () => {
  test('CB-sin-bloques: quitar todos los bloques y volver a publicar se rechaza por los requisitos de publicación', async ({
    page,
  }) => {
    const articulo = await publicarComoServicio((await sembrarArticulo({ titulo: titulo('sin bloques') })).id);
    await ingresar(page, USUARIOS.editor);
    await page.goto(urlDelArticulo(articulo.id));
    await botonDeEstado(page, 'Volver a borrador').click();
    await esperarEstado(page, 'borrador');

    await page.getByRole('button', { name: 'Quitar bloque 1, párrafo' }).click();
    await guardarYEsperar(page);
    await botonDeEstado(page, 'Publicar').click();

    await expect(errorDelPanel(page)).toContainText(/sin bloques/i);
    await esperarEstado(page, 'borrador');
    expect(await articuloPorId(articulo.id)).toMatchObject({ estado: 'borrador', contenido: [] });
  });

  test('CB-sin-bloques: quitar todos los bloques de un publicado nunca deja la base con un publicado vacío', async ({
    page,
  }) => {
    const articulo = await publicarComoServicio((await sembrarArticulo({ titulo: titulo('publicado vacio') })).id);
    await ingresar(page, USUARIOS.editor);
    await page.goto(urlDelArticulo(articulo.id));
    await expect(panelPublicacion(page)).toBeVisible();

    await page.getByRole('button', { name: 'Quitar bloque 1, párrafo' }).click();
    await botonGuardar(page).click();
    // Sea cual sea la respuesta (rechazo del guardado o aviso), se espera a que la pantalla la muestre.
    await expect(page.getByRole('alert').or(page.getByRole('status').filter({ hasText: /guardad/i }))).toBeVisible();

    const guardado = await articuloPorId(articulo.id);
    const vacio = (guardado.contenido as unknown[]).length === 0;
    expect(guardado.estado === 'publicado' && vacio, 'un publicado no puede quedar sin bloques').toBe(false);
  });
});
