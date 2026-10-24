// T052 (spec 003, H2-E5, CE-005), adaptado al editor de documento en la spec 005 (T058; H5 esc. 4, RF-011).
//
// Supuestos de interfaz (D13 de la 003), además del contrato de ./ayudas/editor.ts:
//   - Un guardado rechazado por `conflicto_version` NO recarga el formulario: muestra un `role="alert"` persistente con el
//     título "Alguien guardó cambios más nuevos", y el foco va a ese aviso. Lo escrito sigue en los campos y en el lienzo.
//   - El aviso trae dos botones: "Ver la versión vigente" y "Reemplazar con la vigente".
//   - "Ver la versión vigente" abre una región (`<section aria-labelledby>`, role "region") junto al formulario con los
//     rótulos "Tu versión" y "Versión vigente"; muestra en texto el título y el contenido de cada una.
//   - "Reemplazar con la vigente" abre un `alertdialog` con "Se descartarán tus cambios sin guardar en este artículo",
//     foco inicial en "Cancelar" y un botón de confirmar cuyo nombre empieza con "Reemplazar". Al confirmar, los campos
//     pasan a la versión vigente, el foco va al `h1` y un `role="status"` anuncia "Se cargó la versión vigente".
//   - Spec 005: «Reemplazar con la vigente» vuelve a crear el documento con lo vigente y con el historial vacío:
//     «Deshacer» queda con `aria-disabled="true"` y Mod+Z no trae de vuelta lo descartado.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { articuloPorId, limpiarArticulosE2E, parrafo, sembrarArticulo, elementosDe, textoDe } from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import {
  botonDeshacer,
  botonGuardar,
  esperarEditorListo,
  grupoDeBloque,
  guardarYEsperar,
  lienzo,
  reemplazarTextoDe,
} from './ayudas/editor';
import { ingresar, USUARIOS, type UsuarioDemo } from './ayudas/sesion';

const PREFIJO = 'e2e-co-';
test.afterAll(() => limpiarArticulosE2E(PREFIJO));

/** Dos personas distintas (cada una con su contexto de navegador) con el mismo artículo abierto. */
async function dosPersonasEnElMismoArticulo(browser: Browser) {
  const original = nombreDePrueba('co-original');
  const articulo = await sembrarArticulo({ titulo: original, contenido: [parrafo('Texto original')] });
  const abrir = async (usuario: UsuarioDemo) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const page = await contexto.newPage();
    await ingresar(page, usuario);
    await page.goto(`/articulos/${articulo.id}`);
    await esperarEditorListo(page);
    return { contexto, page };
  };
  const primera = await abrir(USUARIOS.editor);
  const segunda = await abrir(USUARIOS.editora);
  return { articulo, original, primera, segunda };
}

const campoTitulo = (page: Page) => page.getByLabel('Título', { exact: true });
const parrafoDelLienzo = (page: Page) => grupoDeBloque(page, 1, 'parrafo');
const avisoDeConflicto = (page: Page) =>
  page.getByRole('alert').filter({ hasText: 'Alguien guardó cambios más nuevos' });

async function reemplazarConLaVigente(page: Page) {
  await page.getByRole('button', { name: 'Reemplazar con la vigente' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Reemplazar/ })
    .click();
  // El foco pasa al `h1` poco después: escribir antes perdería letras.
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
}

test.describe('Edición concurrente (H2-E5, H5-E4, CE-005)', () => {
  test('H2-E5 / H5-E4: el segundo guardado se rechaza, avisa y conserva lo escrito (también en el lienzo)', async ({
    browser,
  }) => {
    const { articulo, primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    const tituloPrimera = nombreDePrueba('co-primera');
    const tituloSegunda = nombreDePrueba('co-segunda');

    await campoTitulo(primera.page).fill(tituloPrimera);
    await guardarYEsperar(primera.page);

    await campoTitulo(segunda.page).fill(tituloSegunda);
    await reemplazarTextoDe(segunda.page, parrafoDelLienzo(segunda.page), 'Lo que escribió la segunda');
    await botonGuardar(segunda.page).click();

    const aviso = avisoDeConflicto(segunda.page);
    await expect(aviso).toBeVisible();
    await expect(aviso).toBeFocused();
    await expect(campoTitulo(segunda.page)).toHaveValue(tituloSegunda);
    await expect(parrafoDelLienzo(segunda.page)).toHaveText('Lo que escribió la segunda');
    const enBase = await articuloPorId(articulo.id);
    expect(enBase.titulo).toBe(tituloPrimera);
    expect(elementosDe(enBase).map(textoDe)).toEqual(['Texto original']);

    await primera.contexto.close();
    await segunda.contexto.close();
  });

  test('H2-E5 / H5-E4: "Ver la versión vigente" muestra lo guardado junto a lo propio, con el texto del lienzo', async ({
    browser,
  }) => {
    const { primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    const tituloPrimera = nombreDePrueba('co-primera');
    const tituloSegunda = nombreDePrueba('co-segunda');
    await campoTitulo(primera.page).fill(tituloPrimera);
    await reemplazarTextoDe(primera.page, parrafoDelLienzo(primera.page), 'Texto de la primera');
    await guardarYEsperar(primera.page);
    await campoTitulo(segunda.page).fill(tituloSegunda);
    await reemplazarTextoDe(segunda.page, parrafoDelLienzo(segunda.page), 'Texto de la segunda');
    await botonGuardar(segunda.page).click();

    await segunda.page.getByRole('button', { name: 'Ver la versión vigente' }).click();

    const comparacion = segunda.page.getByRole('region').filter({ hasText: 'Versión vigente' });
    await expect(comparacion).toBeVisible();
    await expect(comparacion.getByText('Tu versión')).toBeVisible();
    await expect(comparacion).toContainText(tituloPrimera);
    await expect(comparacion).toContainText(tituloSegunda);
    await expect(comparacion).toContainText('Texto de la primera');
    await expect(comparacion).toContainText('Texto de la segunda');
    await expect(campoTitulo(segunda.page)).toHaveValue(tituloSegunda);
    await expect(parrafoDelLienzo(segunda.page)).toHaveText('Texto de la segunda');

    await primera.contexto.close();
    await segunda.contexto.close();
  });

  test('H2-E5: "Reemplazar con la vigente" pide confirmación; cancelar conserva lo propio y confirmar lo descarta', async ({
    browser,
  }) => {
    const { articulo, primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    const tituloPrimera = nombreDePrueba('co-primera');
    const tituloSegunda = nombreDePrueba('co-segunda');
    await campoTitulo(primera.page).fill(tituloPrimera);
    await guardarYEsperar(primera.page);
    await campoTitulo(segunda.page).fill(tituloSegunda);
    await botonGuardar(segunda.page).click();
    const reemplazar = segunda.page.getByRole('button', { name: 'Reemplazar con la vigente' });

    await reemplazar.click();
    const dialogo = segunda.page.getByRole('alertdialog');
    await expect(dialogo).toContainText('Se descartarán tus cambios sin guardar en este artículo');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(campoTitulo(segunda.page)).toHaveValue(tituloSegunda);

    await reemplazarConLaVigente(segunda.page);

    await expect(campoTitulo(segunda.page)).toHaveValue(tituloPrimera);
    await expect(segunda.page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(segunda.page.getByRole('status').filter({ hasText: 'Se cargó la versión vigente' })).toBeVisible();
    await expect(avisoDeConflicto(segunda.page)).toHaveCount(0);
    expect((await articuloPorId(articulo.id)).titulo).toBe(tituloPrimera);

    await primera.contexto.close();
    await segunda.contexto.close();
  });

  test('H5-E4 / RF-011: «Reemplazar con la vigente» reinicia el documento con lo vigente y vacía el historial', async ({
    browser,
  }) => {
    const { primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    await reemplazarTextoDe(primera.page, parrafoDelLienzo(primera.page), 'Texto de la primera');
    await guardarYEsperar(primera.page);
    await reemplazarTextoDe(segunda.page, parrafoDelLienzo(segunda.page), 'Texto de la segunda');
    await botonGuardar(segunda.page).click();
    await expect(avisoDeConflicto(segunda.page)).toBeVisible();

    await reemplazarConLaVigente(segunda.page);

    await expect(parrafoDelLienzo(segunda.page)).toHaveText('Texto de la primera');
    await expect(botonDeshacer(segunda.page)).toHaveAttribute('aria-disabled', 'true');
    await lienzo(segunda.page).focus();
    await segunda.page.keyboard.press('ControlOrMeta+z');
    await expect(parrafoDelLienzo(segunda.page)).toHaveText('Texto de la primera');
    await expect(lienzo(segunda.page)).not.toContainText('Texto de la segunda');

    await primera.contexto.close();
    await segunda.contexto.close();
  });

  test('H2-E5: después de reemplazar con la vigente, la segunda persona ya puede guardar', async ({ browser }) => {
    const { articulo, primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    await campoTitulo(primera.page).fill(nombreDePrueba('co-primera'));
    await guardarYEsperar(primera.page);
    await campoTitulo(segunda.page).fill(nombreDePrueba('co-segunda'));
    await botonGuardar(segunda.page).click();
    await reemplazarConLaVigente(segunda.page);
    const tituloNuevo = nombreDePrueba('co-despues');

    await campoTitulo(segunda.page).fill(tituloNuevo);
    await reemplazarTextoDe(segunda.page, parrafoDelLienzo(segunda.page), 'Escrito después de reemplazar');
    await guardarYEsperar(segunda.page);

    const guardado = await articuloPorId(articulo.id);
    expect(guardado.titulo).toBe(tituloNuevo);
    expect(elementosDe(guardado).map(textoDe)).toEqual(['Escrito después de reemplazar']);

    await primera.contexto.close();
    await segunda.contexto.close();
  });
});
