// T052 (spec 003, H2-E5, CE-005). FASE ROJA: el editor no existe aún.
//
// Supuestos de interfaz (T061, D13), además del contrato de ./ayudas/editor.ts:
//   - Un guardado rechazado por `conflicto_version` NO recarga el formulario: muestra un `role="alert"` persistente con el
//     título "Alguien guardó cambios más nuevos", y el foco va a ese aviso. Lo escrito sigue en los campos.
//   - El aviso trae dos botones: "Ver la versión vigente" y "Reemplazar con la vigente".
//   - "Ver la versión vigente" abre una región (`<section aria-labelledby>`, role "region") junto al formulario con los
//     rótulos "Tu versión" y "Versión vigente"; la vigente muestra el título guardado por la otra persona, en texto.
//   - "Reemplazar con la vigente" abre un `alertdialog` con "Se descartarán tus cambios sin guardar en este artículo",
//     foco inicial en "Cancelar" y un botón de confirmar cuyo nombre empieza con "Reemplazar". Al confirmar, los campos
//     pasan a la versión vigente, el foco va al `h1` y un `role="status"` anuncia "Se cargó la versión vigente".
import { expect, test, type Browser, type Page } from '@playwright/test';
import { articuloPorId, limpiarArticulosE2E, parrafo, sembrarArticulo } from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import { botonGuardar, grupoDeBloque, guardarYEsperar } from './ayudas/editor';
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
    return { contexto, page };
  };
  const primera = await abrir(USUARIOS.editor);
  const segunda = await abrir(USUARIOS.editora);
  return { articulo, original, primera, segunda };
}

const campoTitulo = (page: Page) => page.getByLabel('Título', { exact: true });

test.describe('Edición concurrente (H2-E5, CE-005)', () => {
  test('H2-E5: el segundo guardado se rechaza, avisa y conserva lo escrito sin escribir en la base', async ({
    browser,
  }) => {
    const { articulo, primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    const tituloPrimera = nombreDePrueba('co-primera');
    const tituloSegunda = nombreDePrueba('co-segunda');

    await campoTitulo(primera.page).fill(tituloPrimera);
    await guardarYEsperar(primera.page);

    await campoTitulo(segunda.page).fill(tituloSegunda);
    await grupoDeBloque(segunda.page, 1, 'parrafo')
      .getByLabel('Texto', { exact: true })
      .fill('Lo que escribió la segunda');
    await botonGuardar(segunda.page).click();

    const aviso = segunda.page.getByRole('alert').filter({ hasText: 'Alguien guardó cambios más nuevos' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toBeFocused();
    await expect(campoTitulo(segunda.page)).toHaveValue(tituloSegunda);
    await expect(grupoDeBloque(segunda.page, 1, 'parrafo').getByLabel('Texto', { exact: true })).toHaveValue(
      'Lo que escribió la segunda',
    );
    expect((await articuloPorId(articulo.id)).titulo).toBe(tituloPrimera);

    await primera.contexto.close();
    await segunda.contexto.close();
  });

  test('H2-E5: "Ver la versión vigente" muestra lo guardado junto a lo propio, sin perder lo propio', async ({
    browser,
  }) => {
    const { primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    const tituloPrimera = nombreDePrueba('co-primera');
    const tituloSegunda = nombreDePrueba('co-segunda');
    await campoTitulo(primera.page).fill(tituloPrimera);
    await guardarYEsperar(primera.page);
    await campoTitulo(segunda.page).fill(tituloSegunda);
    await botonGuardar(segunda.page).click();

    await segunda.page.getByRole('button', { name: 'Ver la versión vigente' }).click();

    const comparacion = segunda.page.getByRole('region').filter({ hasText: 'Versión vigente' });
    await expect(comparacion).toBeVisible();
    await expect(comparacion.getByText('Tu versión')).toBeVisible();
    await expect(comparacion).toContainText(tituloPrimera);
    await expect(comparacion).toContainText(tituloSegunda);
    await expect(campoTitulo(segunda.page)).toHaveValue(tituloSegunda);

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

    await reemplazar.click();
    await segunda.page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^Reemplazar/ })
      .click();

    await expect(campoTitulo(segunda.page)).toHaveValue(tituloPrimera);
    await expect(segunda.page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(segunda.page.getByRole('status').filter({ hasText: 'Se cargó la versión vigente' })).toBeVisible();
    await expect(segunda.page.getByRole('alert').filter({ hasText: 'Alguien guardó cambios más nuevos' })).toHaveCount(
      0,
    );
    expect((await articuloPorId(articulo.id)).titulo).toBe(tituloPrimera);

    await primera.contexto.close();
    await segunda.contexto.close();
  });

  test('H2-E5: después de reemplazar con la vigente, la segunda persona ya puede guardar', async ({ browser }) => {
    const { articulo, primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
    await campoTitulo(primera.page).fill(nombreDePrueba('co-primera'));
    await guardarYEsperar(primera.page);
    await campoTitulo(segunda.page).fill(nombreDePrueba('co-segunda'));
    await botonGuardar(segunda.page).click();
    await segunda.page.getByRole('button', { name: 'Reemplazar con la vigente' }).click();
    await segunda.page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^Reemplazar/ })
      .click();
    const tituloNuevo = nombreDePrueba('co-despues');

    await campoTitulo(segunda.page).fill(tituloNuevo);
    await guardarYEsperar(segunda.page);

    expect((await articuloPorId(articulo.id)).titulo).toBe(tituloNuevo);

    await primera.contexto.close();
    await segunda.contexto.close();
  });
});
