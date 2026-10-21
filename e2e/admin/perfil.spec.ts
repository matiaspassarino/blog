// T092 (spec 003, H6-E7, H6-E8, RF-025). FASE ROJA: /perfil no existe aún.
//
// Supuestos de interfaz (T097), además del contrato del selector de imagen de ./ayudas/editor.ts:
//   - `/perfil` (cualquier miembro): `h1` "Mi perfil"; enlace "Mi perfil" en la navegación principal.
//   - Un formulario (`<form>`) con los campos "Nombre" y "Biografía", el grupo `role="group"` "Foto de perfil" con el selector
//     de imagen ("Elegir imagen", "Texto alternativo", casilla "Imagen decorativa", "Quitar imagen" con confirmación en un
//     `alertdialog` cuyo botón empieza con "Quitar") y el botón "Guardar perfil". Éxito en `role="status"` ("Perfil guardado");
//     errores en `role="alert"`. El campo con error lleva `aria-invalid="true"`.
//   - El formulario se marca como hidratado con `data-perfil="listo"` (como `data-editor="listo"` en el editor de artículos).
//   - NO ofrece rol ni estado: ni campos "Rol"/"Estado", ni listas desplegables, ni casillas (salvo "Imagen decorativa"
//     cuando hay una foto).
// El sitio público (:4321) muestra la ficha del autor en `/blog/autor/<slug>` y se actualiza en menos de 60 s (CE-003).
import { expect, test, type Page } from '@playwright/test';
import { pngDecodificable } from '../../packages/db/src/pruebas/imagenes';
import { actualizarPerfilPorApi, tokenDe } from './ayudas/api';
import {
  existeObjeto,
  limpiarArticulosE2E,
  publicarComoServicio,
  sembrarArticulo,
  subirObjeto,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import { elegirImagen, subirImagenConAlt } from './ayudas/editor';
import { perfilPorId } from './ayudas/equipo';
import { URL_SITIO } from './ayudas/estado';
import { crearMiembro, servicio, type MiembroDePrueba } from './ayudas/servicio';
import { ingresar } from './ayudas/sesion';

const PREFIJO = 'e2e-pf-';
const miembros: MiembroDePrueba[] = [];

test.afterEach(async () => {
  for (const miembro of miembros.splice(0)) {
    const avatar = (await perfilPorId(miembro.id))?.avatar as { ruta?: string } | null;
    if (avatar?.ruta) await servicio().storage.from('medios').remove([avatar.ruta]);
    await miembro.eliminar();
  }
});
test.afterAll(() => limpiarArticulosE2E(PREFIJO));

async function nuevoMiembro(etiqueta: string) {
  const nombre = nombreDePrueba(`pf-${etiqueta}`);
  const miembro = await crearMiembro(nombre);
  miembros.push(miembro);
  return { ...miembro, nombre };
}

const foto = (page: Page) => page.getByRole('group', { name: 'Foto de perfil' });
const botonGuardar = (page: Page) => page.getByRole('button', { name: 'Guardar perfil', exact: true });
const esperarPerfilListo = (page: Page) => expect(page.locator('[data-perfil="listo"]')).toBeVisible();

async function abrirPerfil(page: Page, miembro: { correo: string; contrasenia: string }) {
  await ingresar(page, miembro, '/perfil');
  await esperarPerfilListo(page);
}

async function guardarYEsperar(page: Page) {
  await botonGuardar(page).click();
  await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
}

test.describe('Editar el perfil propio (H6-E7)', () => {
  test('H6-E7: la pantalla muestra los datos actuales y se llega desde "Mi perfil" de la navegación', async ({
    page,
  }) => {
    const miembro = await nuevoMiembro('ver');
    await ingresar(page, miembro);

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Mi perfil' }).click();

    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil', exact: true })).toBeVisible();
    await esperarPerfilListo(page);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(miembro.nombre);
  });

  test('H6-E7: edita nombre, biografía y foto (con texto alternativo) y todo queda guardado', async ({ page }) => {
    const miembro = await nuevoMiembro('editar');
    await abrirPerfil(page, miembro);
    const nuevoNombre = nombreDePrueba('pf-renombrado');

    await page.getByLabel('Nombre', { exact: true }).fill(nuevoNombre);
    await page.getByLabel('Biografía', { exact: true }).fill('Escribo sobre pruebas de extremo a extremo.');
    await subirImagenConAlt(page, foto(page), 'Retrato de prueba');
    await guardarYEsperar(page);

    const perfil = await perfilPorId(miembro.id);
    expect(perfil).toMatchObject({ nombre: nuevoNombre, biografia: 'Escribo sobre pruebas de extremo a extremo.' });
    expect(perfil?.avatar).toMatchObject({ alt: 'Retrato de prueba', decorativa: false, ancho: 4, alto: 3 });
    expect(await existeObjeto((perfil?.avatar as { ruta: string }).ruta)).toBe(true);
    await page.reload();
    await esperarPerfilListo(page);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(nuevoNombre);
    await expect(page.getByLabel('Biografía', { exact: true })).toHaveValue(
      'Escribo sobre pruebas de extremo a extremo.',
    );
    await expect(foto(page).getByLabel('Texto alternativo', { exact: true })).toHaveValue('Retrato de prueba');
    await expect(page.getByRole('banner')).toContainText(nuevoNombre);
  });

  test('H6-E7: una foto decorativa se guarda sin texto alternativo', async ({ page }) => {
    const miembro = await nuevoMiembro('decorativa');
    await abrirPerfil(page, miembro);

    await elegirImagen(page, foto(page), {
      name: 'decorativa.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngDecodificable(4, 3)),
    });
    await foto(page).getByLabel('Imagen decorativa').check();
    await guardarYEsperar(page);

    expect((await perfilPorId(miembro.id))?.avatar).toMatchObject({ decorativa: true });
  });

  test('H6-E7: una foto sin texto alternativo ni marcada como decorativa no se guarda y se explica', async ({
    page,
  }) => {
    const miembro = await nuevoMiembro('sin-alt');
    await abrirPerfil(page, miembro);

    await elegirImagen(page, foto(page), {
      name: 'sin-alt.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngDecodificable(4, 3)),
    });
    await botonGuardar(page).click();

    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /texto alternativo|decorativa/i })
        .first(),
    ).toBeVisible();
    await expect(foto(page).getByLabel('Texto alternativo', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    expect((await perfilPorId(miembro.id))?.avatar).toBeNull();
  });

  test('RF-025: un nombre vacío no se guarda, se avisa y el perfil conserva el anterior', async ({ page }) => {
    const miembro = await nuevoMiembro('nombre-vacio');
    await abrirPerfil(page, miembro);

    await page.getByLabel('Nombre', { exact: true }).fill('   ');
    await botonGuardar(page).click();

    await expect(page.getByRole('alert').filter({ hasText: /\S/ }).first()).toBeVisible();
    expect((await perfilPorId(miembro.id))?.nombre).toBe(miembro.nombre);
  });

  test('D11: quitar la foto (con confirmación) y guardar borra la imagen del almacenamiento', async ({ page }) => {
    const miembro = await nuevoMiembro('quitar-foto');
    const ruta = `perfiles/${miembro.id}/${crypto.randomUUID()}.png`;
    await subirObjeto(ruta, pngDecodificable(4, 3));
    await servicio()
      .from('perfiles')
      .update({ avatar: { ruta, ancho: 4, alto: 3, alt: 'Foto actual', decorativa: false } })
      .eq('id', miembro.id);
    await abrirPerfil(page, miembro);

    await foto(page).getByRole('button', { name: 'Quitar imagen' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^Quitar/ })
      .click();
    await guardarYEsperar(page);

    expect((await perfilPorId(miembro.id))?.avatar).toBeNull();
    await expect.poll(() => existeObjeto(ruta), { timeout: 10_000 }).toBe(false);
  });

  test('RF-025: sin sesión, /perfil lleva al ingreso con la ruta para volver', async ({ page }) => {
    await page.goto('/perfil');

    await expect(page).toHaveURL(/\/ingreso\?volver=%2Fperfil/);
  });
});

test.describe('Cambios visibles en el sitio (H6-E7)', () => {
  test('H6-E7: con artículos publicados, el nombre y la biografía nuevos se ven en su ficha de autor en menos de 1 minuto', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const miembro = await nuevoMiembro('sitio');
    const articulo = await sembrarArticulo({ titulo: nombreDePrueba('pf-art'), autorId: miembro.id });
    await publicarComoServicio(articulo.id);
    const fichaAntes = `${URL_SITIO}/blog/autor/${(await perfilPorId(miembro.id))?.slug}`;
    await expect
      .poll(async () => (await page.request.get(fichaAntes)).status(), { timeout: 60_000, intervals: [1_000, 2_000] })
      .toBe(200);
    await abrirPerfil(page, miembro);
    const nuevoNombre = nombreDePrueba('pf-con-ficha');
    const biografia = `Biografía nueva ${crypto.randomUUID().slice(0, 8)}`;

    await page.getByLabel('Nombre', { exact: true }).fill(nuevoNombre);
    await page.getByLabel('Biografía', { exact: true }).fill(biografia);
    await guardarYEsperar(page);

    const ficha = `${URL_SITIO}/blog/autor/${(await perfilPorId(miembro.id))?.slug}`;
    await expect
      .poll(
        async () => {
          const respuesta = await page.request.get(ficha);
          const html = respuesta.ok() ? await respuesta.text() : '';
          return html.includes(nuevoNombre) && html.includes(biografia);
        },
        {
          timeout: 60_000,
          intervals: [1_000, 2_000, 3_000],
          message: 'la ficha del autor debería mostrar el perfil nuevo',
        },
      )
      .toBe(true);
  });
});

test.describe('Rol y estado no se pueden cambiar (H6-E8)', () => {
  test('H6-E8: el formulario no ofrece rol ni estado', async ({ page }) => {
    const miembro = await nuevoMiembro('sin-rol');
    await abrirPerfil(page, miembro);

    await expect(page.getByLabel(/^(Rol|Estado|Activo)/)).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /rol|desactivar|administrador/i })).toHaveCount(0);
  });

  test('H6-E8: saltándose la interfaz, la API tampoco deja cambiar el propio rol ni el estado', async () => {
    const miembro = await nuevoMiembro('api');
    const token = await tokenDe(miembro);

    const ascenso = await actualizarPerfilPorApi(token, miembro.id, { rol: 'admin' });
    const baja = await actualizarPerfilPorApi(token, miembro.id, { activo: false });

    expect(ascenso.filas).toHaveLength(0);
    expect(baja.filas).toHaveLength(0);
    expect(await perfilPorId(miembro.id)).toMatchObject({ rol: 'editor', activo: true });
  });
});
