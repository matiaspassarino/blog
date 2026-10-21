// T081 (spec 003, H5-E1 a E5, RF-018, RF-019, CE-003). FASE ROJA: /categorias y /etiquetas (T083, T084) no existen aún.
//
// Supuestos de interfaz: ver el encabezado de ./ayudas/taxonomias.ts (formulario "Nueva …", tabla con "Editar <nombre>" y
// "Eliminar <nombre>", diálogo "Editar <nombre>", aviso de redirección con role=status/alert, alertdialog de baja).
// Las dos pantallas comparten implementación, así que los escenarios corren para ambos tipos con `test.describe` por tipo.
// Requiere el sitio público en :4321 leyendo la misma base local (playwright.config.ts lo levanta).
// Datos propios con prefijo `e2e-ta-`; `afterAll` borra artículos y luego las taxonomías (una categoría en uso no se borra).
import { expect, test } from '@playwright/test';
import { limpiarArticulosE2E, sembrarArticulo } from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { servicio } from './ayudas/servicio';
import {
  avisoEn,
  crearPorLaInterfaz,
  dialogoDeEdicion,
  errorDelPanel,
  esperarRedireccion301,
  esperarTextoEnElSitio,
  filaDe,
  formularioDeAlta,
  redireccionDe,
  sembrarArticuloConTaxonomia,
  sembrarTaxonomia,
  taxonomiaPorId,
  taxonomiaPorNombre,
  TEXTOS,
  type Tipo,
} from './ayudas/taxonomias';

const PREFIJO = 'e2e-ta-';
const nombre = (etiqueta: string) => nombreDePrueba(`ta-${etiqueta}`);

test.afterAll(async () => {
  await limpiarArticulosE2E(PREFIJO);
  const s = servicio();
  await s.from('categorias').delete().like('nombre', `${PREFIJO}%`);
  await s.from('etiquetas').delete().like('nombre', `${PREFIJO}%`);
});

for (const tipo of ['categoria', 'etiqueta'] as Tipo[]) {
  const t = TEXTOS[tipo];
  const articulo = tipo === 'categoria' ? 'una categoría' : 'una etiqueta';

  test.describe(`${t.titulo} (H5)`, () => {
    test.beforeEach(async ({ page }) => {
      await ingresar(page, USUARIOS.editor, t.ruta);
    });

    test(`H5-E1: la pantalla ${t.ruta} muestra el título y la tabla con sus columnas`, async ({ page }) => {
      const sembrada = await sembrarTaxonomia(tipo, nombre('lista'), 'Descripción visible');
      await sembrarArticuloConTaxonomia(tipo, sembrada.id, nombre('art-lista'), true);
      await page.goto(t.ruta);

      await expect(page.getByRole('heading', { level: 1, name: t.titulo, exact: true })).toBeVisible();
      for (const columna of ['Nombre', 'Slug', 'Descripción', 'Artículos', 'Acciones']) {
        await expect(page.getByRole('columnheader', { name: columna, exact: true })).toBeVisible();
      }
      const fila = filaDe(page, sembrada.nombre);
      await expect(fila).toContainText(sembrada.slug);
      await expect(fila).toContainText('Descripción visible');
      await expect(fila.getByRole('cell', { name: '1', exact: true })).toBeVisible();
    });

    test(`H5-E1: se crea ${articulo} con el slug sugerido desde el nombre y aparece en la tabla`, async ({ page }) => {
      const texto = nombre('crear');
      await page.goto(t.ruta);
      const formulario = formularioDeAlta(page, tipo);

      await formulario.getByLabel('Nombre', { exact: true }).fill(texto);
      await expect(formulario.getByLabel('Slug', { exact: true })).toHaveValue(texto.toLowerCase(), { timeout: 5_000 });
      await formulario.getByLabel('Descripción', { exact: true }).fill('Creada por la interfaz');
      await formulario.getByRole('button', { name: t.crear, exact: true }).click();

      const fila = filaDe(page, texto);
      await expect(fila).toBeVisible();
      await expect(fila).toContainText(texto.toLowerCase());
      await expect(fila).toContainText('Creada por la interfaz');
      expect(await taxonomiaPorNombre(tipo, texto)).toMatchObject({ slug: texto.toLowerCase() });
      await expect(formulario.getByLabel('Nombre', { exact: true })).toHaveValue('');
    });

    test(`H5-E2: un nombre repetido muestra "Ya existe ${articulo} con ese nombre" y no crea otra`, async ({
      page,
    }) => {
      const existente = await sembrarTaxonomia(tipo, nombre('repetida'));
      await page.goto(t.ruta);

      await crearPorLaInterfaz(page, tipo, { nombre: existente.nombre });

      await expect(errorDelPanel(page)).toContainText(`Ya existe ${articulo} con ese nombre`);
      await expect(page.getByRole('row').filter({ hasText: existente.nombre })).toHaveCount(1);
    });

    test('RF-018: sin nombre no se crea y se avisa del problema', async ({ page }) => {
      await page.goto(t.ruta);

      await formularioDeAlta(page, tipo).getByRole('button', { name: t.crear, exact: true }).click();

      await expect(errorDelPanel(page)).toBeVisible();
    });

    test('H5-E3: renombrar actualiza la tabla y el nombre nuevo se ve en el sitio en menos de 60 s', async ({
      page,
    }) => {
      const sembrada = await sembrarTaxonomia(tipo, nombre('renombrar'));
      await sembrarArticuloConTaxonomia(tipo, sembrada.id, nombre('art-renombrar'), true);
      await esperarTextoEnElSitio(page, tipo, sembrada.slug, sembrada.nombre);
      const nuevo = nombre('renombrada');
      await page.goto(t.ruta);

      await filaDe(page, sembrada.nombre)
        .getByRole('button', { name: `Editar ${sembrada.nombre}`, exact: true })
        .click();
      const dialogo = dialogoDeEdicion(page, sembrada.nombre);
      await dialogo.getByLabel('Nombre', { exact: true }).fill(nuevo);
      await expect(avisoEn(dialogo)).toHaveCount(0); // el slug no cambia: sin aviso de redirección
      await dialogo.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

      await expect(filaDe(page, nuevo)).toBeVisible();
      expect(await taxonomiaPorId(tipo, sembrada.id)).toMatchObject({ nombre: nuevo, slug: sembrada.slug });
      await esperarTextoEnElSitio(page, tipo, sembrada.slug, nuevo);
    });

    test('H5-E3: se puede cambiar la descripción', async ({ page }) => {
      const sembrada = await sembrarTaxonomia(tipo, nombre('describir'), 'Antes');
      await page.goto(t.ruta);

      await filaDe(page, sembrada.nombre)
        .getByRole('button', { name: `Editar ${sembrada.nombre}`, exact: true })
        .click();
      const dialogo = dialogoDeEdicion(page, sembrada.nombre);
      await dialogo.getByLabel('Descripción', { exact: true }).fill('Después');
      await dialogo.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

      await expect(filaDe(page, sembrada.nombre)).toContainText('Después');
      expect(await taxonomiaPorId(tipo, sembrada.id)).toMatchObject({ descripcion: 'Después' });
    });

    test('RF-019: cambiar el slug con artículos publicados avisa antes de guardar y la URL vieja responde 301 a la nueva', async ({
      page,
    }) => {
      const sembrada = await sembrarTaxonomia(tipo, nombre('slug'));
      await sembrarArticuloConTaxonomia(tipo, sembrada.id, nombre('art-slug'), true);
      const slugNuevo = `${sembrada.slug}-nuevo`;
      await esperarTextoEnElSitio(page, tipo, sembrada.slug, sembrada.nombre);
      await page.goto(t.ruta);

      await filaDe(page, sembrada.nombre)
        .getByRole('button', { name: `Editar ${sembrada.nombre}`, exact: true })
        .click();
      const dialogo = dialogoDeEdicion(page, sembrada.nombre);
      await expect(avisoEn(dialogo)).toHaveCount(0);
      await dialogo.getByLabel('Slug', { exact: true }).fill(slugNuevo);

      // El aviso aparece ANTES de guardar: nada cambió todavía en la base.
      const aviso = avisoEn(dialogo);
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(/direcci[oó]n p[uú]blica/i);
      await expect(aviso).toContainText(/anterior.*redirigiendo/i);
      expect((await taxonomiaPorId(tipo, sembrada.id))?.slug).toBe(sembrada.slug);

      await dialogo.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

      await expect(filaDe(page, sembrada.nombre)).toContainText(slugNuevo);
      expect(await redireccionDe(tipo, sembrada.slug)).toEqual({ entidad_id: sembrada.id });
      await esperarRedireccion301(page, tipo, sembrada.slug, slugNuevo);
      await esperarTextoEnElSitio(page, tipo, slugNuevo, sembrada.nombre);
    });

    test('RF-019: si el slug vuelve al valor guardado, el aviso desaparece', async ({ page }) => {
      const sembrada = await sembrarTaxonomia(tipo, nombre('aviso-quita'));
      await sembrarArticuloConTaxonomia(tipo, sembrada.id, nombre('art-aviso'), true);
      await page.goto(t.ruta);

      await filaDe(page, sembrada.nombre)
        .getByRole('button', { name: `Editar ${sembrada.nombre}`, exact: true })
        .click();
      const dialogo = dialogoDeEdicion(page, sembrada.nombre);
      await dialogo.getByLabel('Slug', { exact: true }).fill(`${sembrada.slug}-otro`);
      await expect(avisoEn(dialogo)).toBeVisible();
      await dialogo.getByLabel('Slug', { exact: true }).fill(sembrada.slug);

      await expect(avisoEn(dialogo)).toHaveCount(0);
    });

    test('RF-019: sin artículos publicados, cambiar el slug no muestra el aviso', async ({ page }) => {
      const sembrada = await sembrarTaxonomia(tipo, nombre('sin-publicados'));
      await sembrarArticuloConTaxonomia(tipo, sembrada.id, nombre('art-borrador'), false);
      await page.goto(t.ruta);

      await filaDe(page, sembrada.nombre)
        .getByRole('button', { name: `Editar ${sembrada.nombre}`, exact: true })
        .click();
      const dialogo = dialogoDeEdicion(page, sembrada.nombre);
      await dialogo.getByLabel('Slug', { exact: true }).fill(`${sembrada.slug}-otro`);

      await expect(avisoEn(dialogo)).toHaveCount(0);
    });

    test('H5-E5: se elimina con confirmación que dice cuántos artículos se verán afectados', async ({ page }) => {
      const sembrada = await sembrarTaxonomia(tipo, nombre('baja'));
      if (tipo === 'etiqueta') {
        await sembrarArticuloConTaxonomia(tipo, sembrada.id, nombre('art-baja-1'), true);
        await sembrarArticuloConTaxonomia(tipo, sembrada.id, nombre('art-baja-2'), false);
      }
      await page.goto(t.ruta);

      await filaDe(page, sembrada.nombre)
        .getByRole('button', { name: `Eliminar ${sembrada.nombre}`, exact: true })
        .click();
      const confirmacion = page.getByRole('alertdialog');
      await expect(confirmacion).toBeVisible();
      await expect(confirmacion).toContainText(
        tipo === 'etiqueta' ? /2 art[ií]culos/ : /0 art[ií]culos|ning[uú]n art[ií]culo/,
      );
      await confirmacion.getByRole('button', { name: 'Cancelar', exact: true }).click();
      expect(await taxonomiaPorId(tipo, sembrada.id)).not.toBeNull();

      await filaDe(page, sembrada.nombre)
        .getByRole('button', { name: `Eliminar ${sembrada.nombre}`, exact: true })
        .click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();

      await expect(filaDe(page, sembrada.nombre)).toHaveCount(0);
      expect(await taxonomiaPorId(tipo, sembrada.id)).toBeNull();
    });
  });
}

test.describe('Categorías en uso (H5-E4)', () => {
  test.beforeEach(async ({ page }) => {
    await ingresar(page, USUARIOS.editor, '/categorias');
  });

  test('H5-E4: eliminar una categoría en uso muestra el número de artículos y no la borra', async ({ page }) => {
    const categoria = await sembrarTaxonomia('categoria', nombre('en-uso'));
    await sembrarArticuloConTaxonomia('categoria', categoria.id, nombre('art-uso-1'), true);
    await sembrarArticuloConTaxonomia('categoria', categoria.id, nombre('art-uso-2'), false);
    await page.goto('/categorias');

    await filaDe(page, categoria.nombre)
      .getByRole('button', { name: `Eliminar ${categoria.nombre}`, exact: true })
      .click();
    const confirmacion = page.getByRole('alertdialog');
    await expect(confirmacion).toContainText(/2 art[ií]culos/);
    await confirmacion.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(errorDelPanel(page)).toContainText('No se puede eliminar: la usan 2 artículos.');
    await expect(filaDe(page, categoria.nombre)).toBeVisible();
    expect(await taxonomiaPorId('categoria', categoria.id)).not.toBeNull();
  });

  test('H5-E1: la categoría creada se puede asignar a un artículo desde el editor', async ({ page }) => {
    const texto = nombre('asignable');
    await page.goto('/categorias');
    await crearPorLaInterfaz(page, 'categoria', { nombre: texto });
    await expect(filaDe(page, texto)).toBeVisible();
    const categoria = await taxonomiaPorNombre('categoria', texto);
    const articulo = await sembrarArticulo({ titulo: nombre('art-asignar') });

    await page.goto(`/articulos/${articulo.id}`);
    await page.getByLabel('Categoría', { exact: true }).selectOption({ label: texto });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect
      .poll(
        async () =>
          (await servicio().from('articulos').select('categoria_id').eq('id', articulo.id).single()).data?.categoria_id,
      )
      .toBe(categoria!.id);
  });
});

test.describe('Permisos (RF-024)', () => {
  test('RF-024: el administrador también gestiona categorías y etiquetas', async ({ page }) => {
    await ingresar(page, USUARIOS.admin, '/etiquetas');
    const texto = nombre('admin');

    await crearPorLaInterfaz(page, 'etiqueta', { nombre: texto });

    await expect(filaDe(page, texto)).toBeVisible();
  });

  test('RF-024: sin sesión, /categorias lleva al ingreso con la ruta para volver', async ({ page }) => {
    await page.goto('/categorias');

    await expect(page).toHaveURL(/\/ingreso\?volver=%2Fcategorias/);
  });
});
