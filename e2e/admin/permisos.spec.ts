// T069 (spec 003, H3-E8, CE-002 parcial). FASE ROJA: AccionesEstado (T072) no existe aún en /articulos/[id].
//
// Este archivo se AMPLÍA en T099 (matriz completa de permisos por rol) y en H6 (equipo). Por eso queda organizado en
// bloques por tema: cada historia agrega su `test.describe` aquí, con su propio prefijo de datos y sin tocar los demás.
//   - [H3] Eliminar artículos (este bloque).
//   - [T099] Pendiente: matriz completa editor/admin de la tabla "Requisitos de permisos" de la spec.
//   - [H6] Pendiente: gestión del equipo, solo admin.
//
// Supuestos de interfaz: ver ./ayudas/estado.ts (botón "Eliminar" en el grupo "Publicación", solo admin; `alertdialog`
// con "Cancelar" y "Eliminar"; al confirmar navega a /articulos). "Por fuera de la interfaz" se prueba con la API de
// Supabase y la sesión real del editor (./ayudas/api.ts): la base rechaza el DELETE (RLS) y el artículo sigue existiendo.
// Una Server Action no se puede invocar a mano sin su identificador interno, así que su rechazo (`sin_permiso`) lo cubre
// la prueba de integración de acciones/articulos.test.ts.
import { expect, test } from '@playwright/test';
import { articuloPorId, limpiarArticulosE2E, publicarComoServicio, sembrarArticulo } from './ayudas/articulos';
import { eliminarArticuloPorApi, tokenDe } from './ayudas/api';
import { nombreDePrueba } from './ayudas/datos';
import { botonDeEstado, esperarEnElSitio, panelPublicacion, urlDelArticulo } from './ayudas/estado';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { servicio } from './ayudas/servicio';

const PREFIJO_H3 = 'e2e-perm-';
const tituloH3 = (etiqueta: string) => nombreDePrueba(`perm-${etiqueta}`);

test.afterAll(() => limpiarArticulosE2E(PREFIJO_H3));

async function existe(id: string) {
  const { data } = await servicio().from('articulos').select('id').eq('id', id);
  return (data ?? []).length === 1;
}

test.describe('[H3] Eliminar artículos (H3-E8, CE-002)', () => {
  test('H3-E8: el editor no ve "Eliminar" y, por fuera de la interfaz, la base rechaza el borrado', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: tituloH3('editor') });
    await ingresar(page, USUARIOS.editor);
    await page.goto(urlDelArticulo(articulo.id));

    await expect(panelPublicacion(page)).toBeVisible();
    await expect(botonDeEstado(page, 'Eliminar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /eliminar/i })).toHaveCount(0);

    const borradas = await eliminarArticuloPorApi(await tokenDe(USUARIOS.editor), articulo.id);
    expect(borradas).toEqual([]);
    expect(await existe(articulo.id)).toBe(true);
  });

  test('H3-E8: el editor tampoco ve "Eliminar" en un artículo publicado', async ({ page }) => {
    const publicado = await publicarComoServicio((await sembrarArticulo({ titulo: tituloH3('editor publicado') })).id);
    await ingresar(page, USUARIOS.editor);
    await page.goto(urlDelArticulo(publicado.id));

    await expect(panelPublicacion(page)).toBeVisible();

    await expect(botonDeEstado(page, 'Eliminar')).toHaveCount(0);
  });

  test('H3-E8: el admin ve "Eliminar", confirma, y el artículo desaparece del panel y del sitio', async ({ page }) => {
    const articulo = await publicarComoServicio((await sembrarArticulo({ titulo: tituloH3('admin elimina') })).id);
    await esperarEnElSitio(page, articulo.slug, true);
    await ingresar(page, USUARIOS.admin);
    await page.goto(urlDelArticulo(articulo.id));

    await botonDeEstado(page, 'Eliminar').click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(/eliminar/i);
    expect(await existe(articulo.id)).toBe(true); // aún no se eliminó: falta confirmar
    await dialogo.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(page).toHaveURL(/\/articulos$/);
    await expect(page.getByText(articulo.titulo)).toHaveCount(0);
    expect(await existe(articulo.id)).toBe(false);
    await esperarEnElSitio(page, articulo.slug, false);
  });

  test('H3-E8: el admin que cancela la confirmación no elimina nada', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: tituloH3('admin cancela') });
    await ingresar(page, USUARIOS.admin);
    await page.goto(urlDelArticulo(articulo.id));

    await botonDeEstado(page, 'Eliminar').click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
    await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).click();

    await expect(dialogo).toHaveCount(0);
    await expect(page).toHaveURL(urlDelArticulo(articulo.id));
    expect((await articuloPorId(articulo.id)).id).toBe(articulo.id);
  });

  test('H3-E8: el admin puede eliminar también por la API con su sesión (la base lo permite solo a él)', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: tituloH3('admin api') });
    await ingresar(page, USUARIOS.admin);
    await page.goto(urlDelArticulo(articulo.id));
    await expect(botonDeEstado(page, 'Eliminar')).toBeVisible(); // la interfaz y la base coinciden

    const borradas = await eliminarArticuloPorApi(await tokenDe(USUARIOS.admin), articulo.id);

    expect(borradas).toEqual([{ id: articulo.id }]);
    expect(await existe(articulo.id)).toBe(false);
  });
});

// [T099] y [H6]: se agregan más bloques `test.describe` debajo de este comentario, cada uno con su prefijo y su
// `test.afterAll(() => limpiarArticulosE2E(...))`.
