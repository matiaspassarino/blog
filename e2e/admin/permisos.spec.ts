// T069 (spec 003, H3-E8, CE-002 parcial). Acciones de estado del editor por rol.
//
// Este archivo se AMPLÍA en T099 (matriz completa de permisos por rol) y en H6 (equipo). Por eso queda organizado en
// bloques por tema: cada historia agrega su `test.describe` aquí, con su propio prefijo de datos y sin tocar los demás.
//   - [H3] Eliminar artículos (este bloque).
//   - [T099] Matriz completa de la tabla "Requisitos de permisos" de la spec (CE-002): por la interfaz y por intento
//     directo contra la API (PostgREST, Storage y Auth) con la sesión de cada actor: anónimo, miembro desactivado
//     (editor y admin), editor y admin. Un miembro desactivado se comporta como anónimo en cada fila.
//   - [H6] Gestión del equipo, solo admin: ver también equipo.spec.ts; aquí se cubre la fila de la tabla.
//
// Supuestos de interfaz: ver ./ayudas/estado.ts (botón "Eliminar" en la barra "Acciones del artículo", solo admin; `alertdialog`
// con "Cancelar" y "Eliminar"; al confirmar navega a /articulos). "Por fuera de la interfaz" se prueba con la API de
// Supabase y la sesión real del editor (./ayudas/api.ts): la base rechaza el DELETE (RLS) y el artículo sigue existiendo.
// Una Server Action no se puede invocar a mano sin su identificador interno, así que su rechazo (`sin_permiso`) lo cubre
// la prueba de integración de acciones/articulos.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { pngDecodificable } from '../../packages/db/src/pruebas/imagenes';
import {
  articuloPorId,
  existeObjeto,
  ID_EDITORA,
  limpiarArticulosE2E,
  pasarAComoServicio,
  publicarComoServicio,
  sembrarArticulo,
} from './ayudas/articulos';
import { actualizarPerfilPorApi, eliminarArticuloPorApi, llamarApi, tokenDe } from './ayudas/api';
import { fechaFutura, nombreDePrueba } from './ayudas/datos';
import { elegirImagen, guardarYEsperar } from './ayudas/editor';
import {
  correoUnico,
  filaDelMiembro,
  ID_ADMIN_DEMO,
  invitarPorLaInterfaz,
  perfilPorId,
  botonDeFila,
  estadoDeLaFila,
  avisoDeExito,
} from './ayudas/equipo';
import {
  botonDeEstado,
  esperarEnElSitio,
  esperarEstado,
  panelPublicacion,
  programarArticulo,
  urlDelArticulo,
} from './ayudas/estado';
import { barraDelEditor } from './ayudas/jerarquia';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { crearMiembro, eliminarPorCorreo, servicio, type MiembroDePrueba } from './ayudas/servicio';
import { crearPorLaInterfaz, filaDe } from './ayudas/taxonomias';

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

    // La barra tiene que existir y tener "Guardar": si no, la ausencia de "Eliminar" pasaría en falso.
    await expect(panelPublicacion(page)).toBeVisible();
    await expect(barraDelEditor(page)).toBeVisible();
    await expect(barraDelEditor(page).getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
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
    await expect(barraDelEditor(page).getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();

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

// =====================================================================================================================
// [T099] Matriz completa de permisos (CE-002). Una Server Action no se puede invocar a mano sin su identificador interno
// de Next, así que "por fuera de la interfaz" se prueba contra la API de Supabase con la sesión real de cada actor: lo
// que la interfaz oculta lo tiene que rechazar la base (RLS, privilegios, Storage y Auth). El rechazo de las acciones
// (`sin_permiso`, `no_autenticado`) lo cubren además los Vitest de integración de apps/admin/src/acciones.
// Datos propios con el prefijo `e2e-perm-` (los limpia el afterAll de arriba y el de taxonomías de abajo).
// =====================================================================================================================

const tituloT099 = (etiqueta: string) => nombreDePrueba(`perm-t99-${etiqueta}`);
const nombreTaxonomia = (etiqueta: string) => nombreDePrueba(`perm-${etiqueta}`);
const ID_EDITOR_DEMO = '00000000-0000-4000-a000-000000000003';

const miembros: MiembroDePrueba[] = [];
const correosInvitados: string[] = [];

test.afterEach(async () => {
  for (const miembro of miembros.splice(0)) await miembro.eliminar();
  for (const correo of correosInvitados.splice(0)) await eliminarPorCorreo(correo);
});
test.afterAll(async () => {
  const s = servicio();
  await s.from('categorias').delete().like('nombre', 'e2e-perm-%');
  await s.from('etiquetas').delete().like('nombre', 'e2e-perm-%');
});

async function nuevoMiembro(etiqueta: string) {
  const nombre = nombreDePrueba(`perm-${etiqueta}`);
  const miembro = await crearMiembro(nombre);
  miembros.push(miembro);
  return { ...miembro, nombre };
}

/** Rutas internas del panel que pide la fila "Ver cualquier pantalla interna". */
const rutasInternas = (idArticulo: string) => [
  '/articulos',
  '/articulos/nuevo',
  `/articulos/${idArticulo}`,
  `/articulos/${idArticulo}/vista-previa`,
  '/categorias',
  '/etiquetas',
  '/perfil',
];

const titulo1 = (page: Page) => page.getByRole('heading', { level: 1 }).first();

test.describe('[T099] Fila "Ver la pantalla de ingreso y pedir olvidé mi contraseña" (CE-002)', () => {
  test('T099-F1: el anónimo ve el ingreso y la recuperación', async ({ page }) => {
    await page.goto('/ingreso');
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar al panel' })).toBeVisible();
    await page.goto('/olvide-contrasena');
    await expect(page.getByRole('heading', { level: 1, name: 'Recuperar mi contraseña' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar enlace' })).toBeVisible();
  });

  for (const rol of ['editor', 'admin'] as const) {
    test(`T099-F1: el ${rol} con sesión puede abrir la recuperación y el ingreso no le da un error`, async ({
      page,
    }) => {
      await ingresar(page, USUARIOS[rol]);

      const recuperacion = await page.goto('/olvide-contrasena');
      expect(recuperacion?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: 'Recuperar mi contraseña' })).toBeVisible();

      await page.goto('/ingreso');
      await expect(page).toHaveURL(/\/articulos$/); // quien ya está dentro no vuelve a ver el formulario
    });
  }

  test('T099-F1: un miembro desactivado se comporta como anónimo: ve el formulario de ingreso y la recuperación', async ({
    page,
  }) => {
    const miembro = await nuevoMiembro('f1-desactivado');
    await ingresar(page, miembro);
    await miembro.desactivar();

    await page.goto('/ingreso');
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar al panel' })).toBeVisible();
    await page.goto('/olvide-contrasena');
    await expect(page.getByRole('heading', { level: 1, name: 'Recuperar mi contraseña' })).toBeVisible();
  });
});

test.describe('[T099] Fila "Definir la contraseña con un enlace válido" (CE-002)', () => {
  test('T099-F2: el anónimo sin enlace no puede definir una contraseña, ni por la pantalla ni por la API', async ({
    page,
  }) => {
    await page.goto('/definir-contrasena');
    await expect(page).toHaveURL(/\/ingreso/);

    const respuesta = await llamarApi(null, 'PUT', '/auth/v1/user', { cuerpo: { password: 'nueva-contrasenia-123' } });
    expect([401, 403]).toContain(respuesta.estado);
  });

  for (const rol of ['editor', 'admin'] as const) {
    test(`T099-F2: el ${rol} que llega con la sesión de un enlace válido ve el formulario de contraseña`, async ({
      page,
    }) => {
      // La sesión que abre el enlace del correo equivale a una sesión abierta: no se envía el formulario para no
      // cambiar la contraseña de un usuario del seed.
      await ingresar(page, USUARIOS[rol]);
      await page.goto('/definir-contrasena');
      await expect(page.getByRole('heading', { level: 1, name: 'Define tu contraseña' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toBeVisible();
    });
  }

  test('T099-F2: un miembro desactivado que define su contraseña no obtiene acceso al panel', async ({ page }) => {
    const miembro = await nuevoMiembro('f2-desactivado');
    await ingresar(page, miembro);
    await miembro.desactivar();
    const nueva = `nueva-${crypto.randomUUID()}`;

    await page.goto('/definir-contrasena');
    await page.getByLabel(/nueva/i).fill(nueva);
    await page.getByLabel(/repit/i).fill(nueva);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();

    await expect(page).toHaveURL(/\/ingreso/);
    await page.goto('/articulos');
    await expect(page).toHaveURL(/\/ingreso/);
    await page.getByLabel('Correo').fill(miembro.correo);
    await page.getByLabel('Contraseña', { exact: true }).fill(nueva);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Tu cuenta está desactivada' })).toBeVisible();
  });
});

test.describe('[T099] Fila "Ver cualquier pantalla interna" (CE-002)', () => {
  test('T099-F3: el anónimo es llevado al ingreso desde cada pantalla interna, incluida /equipo', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: tituloT099('rutas anonimo') });

    for (const ruta of [...rutasInternas(articulo.id), '/equipo']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/ingreso\?/);
      expect(new URL(page.url()).searchParams.get('volver'), ruta).toBe(ruta);
    }
  });

  test('T099-F3: el editor abre todas las pantallas internas; /equipo le da 403 y la navegación no la ofrece', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: tituloT099('rutas editor') });
    await ingresar(page, USUARIOS.editor);

    for (const ruta of rutasInternas(articulo.id)) {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status(), ruta).toBe(200);
      await expect(titulo1(page), ruta).toBeVisible();
    }
    await page.goto('/articulos');
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Equipo' })).toHaveCount(
      0,
    );
    const equipo = await page.goto('/equipo');
    expect(equipo?.status()).toBe(403);
    await expect(page.getByText('No tienes permiso para ver esta página')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('T099-F3: el admin abre todas las pantallas internas, incluido /equipo, y la navegación lo ofrece', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: tituloT099('rutas admin') });
    await ingresar(page, USUARIOS.admin);

    for (const ruta of [...rutasInternas(articulo.id), '/equipo']) {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status(), ruta).toBe(200);
      await expect(titulo1(page), ruta).toBeVisible();
    }
    await expect(
      page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Equipo' }),
    ).toBeVisible();
  });

  test('T099-F3: un miembro desactivado con la sesión abierta es sacado y cada pantalla interna lo lleva al ingreso', async ({
    page,
  }) => {
    const miembro = await nuevoMiembro('f3-desactivado');
    const articulo = await sembrarArticulo({ titulo: tituloT099('rutas desactivado') });
    await ingresar(page, miembro);
    await miembro.desactivar();

    await page.goto('/articulos');
    await expect(page).toHaveURL(/\/ingreso\?motivo=desactivada$/);
    for (const ruta of [...rutasInternas(articulo.id), '/equipo']) {
      await page.goto(ruta);
      expect(new URL(page.url()).pathname, ruta).toBe('/ingreso');
    }
  });
});

test.describe('[T099] Filas de artículos por la interfaz (editor y admin) (CE-002)', () => {
  for (const rol of ['editor', 'admin'] as const) {
    test(`T099-F4: el ${rol} crea un artículo, edita el de otra persona sin cambiar su autor y abre su vista previa`, async ({
      page,
    }) => {
      const ajeno = await sembrarArticulo({ titulo: tituloT099(`ajeno ${rol}`), autorId: ID_EDITORA });
      await ingresar(page, USUARIOS[rol]);

      await page.goto('/articulos/nuevo');
      const propio = tituloT099(`propio ${rol}`);
      await page.getByLabel('Título', { exact: true }).fill(propio);
      await guardarYEsperar(page);
      await expect(page).toHaveURL(/\/articulos\/[0-9a-f-]{36}$/);

      await page.goto(urlDelArticulo(ajeno.id));
      const nuevoTitulo = tituloT099(`editado ${rol}`);
      await page.getByLabel('Título', { exact: true }).fill(nuevoTitulo);
      await guardarYEsperar(page);
      const guardado = await articuloPorId(ajeno.id);
      expect(guardado.titulo).toBe(nuevoTitulo);
      expect(guardado.autor_id).toBe(ID_EDITORA);

      const vistaPrevia = await page.goto(`/articulos/${ajeno.id}/vista-previa`);
      expect(vistaPrevia?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: nuevoTitulo })).toBeVisible();
    });

    test(`T099-F5: el ${rol} publica, vuelve a borrador, programa, cancela y archiva`, async ({ page }) => {
      const articulo = await sembrarArticulo({ titulo: tituloT099(`estados ${rol}`) });
      await ingresar(page, USUARIOS[rol]);
      await page.goto(urlDelArticulo(articulo.id));

      await botonDeEstado(page, 'Publicar').click();
      await esperarEstado(page, 'publicado');
      await botonDeEstado(page, 'Volver a borrador').click();
      await esperarEstado(page, 'borrador');
      await programarArticulo(page, fechaFutura(60 * 24));
      await esperarEstado(page, 'programado');
      await botonDeEstado(page, 'Cancelar programación').click();
      await esperarEstado(page, 'borrador');
      await botonDeEstado(page, 'Publicar').click();
      await esperarEstado(page, 'publicado');
      await botonDeEstado(page, 'Archivar').click();
      await esperarEstado(page, 'archivado');

      expect((await articuloPorId(articulo.id)).estado).toBe('archivado');
      await expect(botonDeEstado(page, 'Eliminar')).toHaveCount(rol === 'admin' ? 1 : 0);
    });

    test(`T099-F7: el ${rol} sube una imagen destacada y queda registrada con su ancho y alto`, async ({ page }) => {
      await ingresar(page, USUARIOS[rol]);
      await page.goto('/articulos/nuevo');
      const nombre = tituloT099(`imagen ${rol}`);
      await page.getByLabel('Título', { exact: true }).fill(nombre);
      const destacada = page.getByRole('group', { name: 'Imagen destacada' });

      await elegirImagen(page, destacada, {
        name: 'foto.png',
        mimeType: 'image/png',
        buffer: Buffer.from(pngDecodificable(4, 3)),
      });
      await destacada.getByLabel('Texto alternativo', { exact: true }).fill('Imagen de la prueba de permisos');
      await guardarYEsperar(page);

      const { data } = await servicio().from('articulos').select('imagen_destacada').eq('titulo', nombre).single();
      expect(data?.imagen_destacada).toMatchObject({ ancho: 4, alto: 3 });
    });
  }
});

test.describe('[T099] Fila "Crear, editar y eliminar categorías y etiquetas" por la interfaz (CE-002)', () => {
  for (const rol of ['editor', 'admin'] as const) {
    for (const tipo of ['categoria', 'etiqueta'] as const) {
      test(`T099-F8: el ${rol} crea, renombra y elimina una ${tipo}`, async ({ page }) => {
        const nombre = nombreTaxonomia(`${tipo}-${rol}`);
        const renombrada = `${nombre}-r`;
        await ingresar(page, USUARIOS[rol], tipo === 'categoria' ? '/categorias' : '/etiquetas');

        await crearPorLaInterfaz(page, tipo, { nombre });
        await expect(filaDe(page, nombre)).toBeVisible();

        await filaDe(page, nombre)
          .getByRole('button', { name: `Editar ${nombre}`, exact: true })
          .click();
        const dialogo = page.getByRole('dialog', { name: `Editar ${nombre}`, exact: true });
        await dialogo.getByLabel('Nombre', { exact: true }).fill(renombrada);
        await dialogo.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
        await expect(filaDe(page, renombrada)).toBeVisible();

        await filaDe(page, renombrada)
          .getByRole('button', { name: `Eliminar ${renombrada}`, exact: true })
          .click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
        await expect(filaDe(page, renombrada)).toHaveCount(0);
      });
    }
  }
});

test.describe('[T099] Fila "Editar el perfil propio" por la interfaz (CE-002)', () => {
  test('T099-F9: el editor edita su nombre y su biografía', async ({ page }) => {
    const miembro = await nuevoMiembro('perfil');
    await ingresar(page, miembro, '/perfil');
    await expect(page.locator('[data-perfil="listo"]')).toBeVisible();

    await page.getByLabel('Nombre', { exact: true }).fill(`${miembro.nombre}-nuevo`);
    await page.getByLabel('Biografía', { exact: true }).fill('Biografía de la prueba de permisos');
    await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click();

    await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
    expect(await perfilPorId(miembro.id)).toMatchObject({
      nombre: `${miembro.nombre}-nuevo`,
      biografia: 'Biografía de la prueba de permisos',
    });
  });

  test('T099-F9: el admin edita su biografía (se restaura al terminar)', async ({ page }) => {
    const antes = (await perfilPorId(ID_ADMIN_DEMO))?.biografia ?? null;
    try {
      await ingresar(page, USUARIOS.admin, '/perfil');
      await expect(page.locator('[data-perfil="listo"]')).toBeVisible();

      await page.getByLabel('Biografía', { exact: true }).fill('e2e-perm biografía del admin');
      await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click();

      await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
      expect((await perfilPorId(ID_ADMIN_DEMO))?.biografia).toBe('e2e-perm biografía del admin');
    } finally {
      await servicio().from('perfiles').update({ biografia: antes }).eq('id', ID_ADMIN_DEMO);
    }
  });
});

test.describe('[T099] Fila "Ver el equipo, invitar, cambiar roles y desactivar" por la interfaz (CE-002)', () => {
  test('T099-F10: el admin ve el equipo, invita a un editor, reenvía la invitación, lo desactiva y lo reactiva', async ({
    page,
  }) => {
    // El cambio de rol (a admin y de vuelta) está en equipo.spec.ts (H6-E4): aquí no se crea ningún admin extra.
    const nombre = nombreDePrueba('perm-invitado');
    const correo = correoUnico('perm');
    correosInvitados.push(correo);
    await ingresar(page, USUARIOS.admin, '/equipo');
    await expect(page.getByRole('heading', { level: 1, name: 'Equipo', exact: true })).toBeVisible();

    await invitarPorLaInterfaz(page, { nombre, correo, rol: 'editor' });
    await expect(avisoDeExito(page, `Invitación enviada a ${correo}`)).toBeVisible();
    const fila = filaDelMiembro(page, correo);
    await expect(estadoDeLaFila(fila)).toHaveText(/invitado/i);

    await botonDeFila(fila, 'Reenviar invitación a', nombre).click();
    await expect(avisoDeExito(page, `Invitación reenviada a ${correo}`)).toBeVisible();

    await botonDeFila(fila, 'Desactivar', nombre).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Desactivar', exact: true }).click();
    await expect(estadoDeLaFila(fila)).toHaveText(/desactivado/i);

    await botonDeFila(fila, 'Reactivar', nombre).click();
    await expect(estadoDeLaFila(fila)).toHaveText(/invitado|activo/i);
  });

  test('T099-F10: el editor no ve ninguna acción de equipo: ni enlace, ni lista, ni formulario de invitación', async ({
    page,
  }) => {
    await ingresar(page, USUARIOS.editor);
    await expect(page.getByRole('link', { name: 'Equipo', exact: true })).toHaveCount(0);

    await page.goto('/equipo');
    await expect(page.getByText('No tienes permiso para ver esta página')).toBeVisible();
    await expect(page.getByRole('form', { name: 'Invitar a una persona' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Desactivar|Reactivar|Reenviar)/ })).toHaveCount(0);
  });
});

test.describe('[T099] Un miembro desactivado no puede usar las acciones de una pantalla abierta (CE-002)', () => {
  test('T099-F4: el desactivado que guarda un artículo es sacado y el cambio no se escribe', async ({ page }) => {
    const miembro = await nuevoMiembro('guarda-desactivado');
    const original = tituloT099('guarda desactivado');
    const articulo = await sembrarArticulo({ titulo: original });
    await ingresar(page, miembro);
    await page.goto(urlDelArticulo(articulo.id));
    await page.getByLabel('Título', { exact: true }).fill(tituloT099('no deberia guardarse'));
    await miembro.desactivar();

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page).toHaveURL(/\/ingreso\?motivo=desactivada$/);
    expect((await articuloPorId(articulo.id)).titulo).toBe(original);
  });

  test('T099-F5: el desactivado que cambia el estado de un artículo desde una pantalla abierta es sacado', async ({
    page,
  }) => {
    const miembro = await nuevoMiembro('estado-desactivado');
    const articulo = await sembrarArticulo({ titulo: tituloT099('estado desactivado') });
    await ingresar(page, miembro);
    await page.goto(urlDelArticulo(articulo.id));
    await expect(panelPublicacion(page)).toBeVisible();
    await miembro.desactivar();

    await botonDeEstado(page, 'Publicar').click();

    await expect(page).toHaveURL(/\/ingreso\?motivo=desactivada$/);
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Intento directo contra la API: la misma tabla, fila por fila, con la sesión de cada actor.
// ---------------------------------------------------------------------------------------------------------------------

type RolDeActor = 'anonimo' | 'desactivado editor' | 'desactivado admin' | 'editor' | 'admin';
type Actor = { rol: RolDeActor; token: string | null; id: string | null };
type FilaApi = {
  fila: string;
  /** ¿La tabla de la spec lo permite? Anónimo y desactivados nunca. */
  editor: boolean;
  admin: boolean;
  /** Intenta la acción con la sesión del actor y devuelve si **tuvo efecto** (se comprueba leyendo con la clave de servicio). */
  ejecutar: (actor: Actor) => Promise<boolean>;
};

const idDe = (actor: Actor) => actor.id ?? ID_ADMIN_DEMO;
const futuro = () => new Date(Date.now() + 24 * 3_600_000).toISOString();

async function cambiarEstadoPorApi(
  actor: Actor,
  etiqueta: string,
  preparar: (id: string) => Promise<void>,
  destino: 'publicado' | 'programado' | 'borrador' | 'archivado',
) {
  const articulo = await sembrarArticulo({ titulo: tituloT099(etiqueta), autorId: ID_EDITORA });
  await preparar(articulo.id);
  const actual = await articuloPorId(articulo.id);
  await llamarApi(actor.token, 'PATCH', `/rest/v1/articulos?id=eq.${articulo.id}`, {
    cuerpo: {
      estado: destino,
      version: actual.version,
      ...(destino === 'programado' && { programado_para: futuro() }),
    },
  });
  return (await articuloPorId(articulo.id)).estado === destino;
}

const sinPreparar = async () => {};

function filasDeTaxonomia(tabla: 'categorias' | 'etiquetas', singular: string): FilaApi[] {
  const sembrar = async (etiqueta: string) => {
    const { data } = await servicio()
      .from(tabla)
      .insert({ nombre: nombreTaxonomia(etiqueta), slug: '' })
      .select('*')
      .single();
    return data!;
  };
  return [
    {
      fila: `Crear una ${singular}`,
      editor: true,
      admin: true,
      ejecutar: async (actor) => {
        const nombre = nombreTaxonomia(`crear-${singular}`);
        await llamarApi(actor.token, 'POST', `/rest/v1/${tabla}`, { cuerpo: { nombre, slug: '' } });
        const { data } = await servicio().from(tabla).select('id').eq('nombre', nombre);
        return (data ?? []).length === 1;
      },
    },
    {
      fila: `Editar una ${singular}`,
      editor: true,
      admin: true,
      ejecutar: async (actor) => {
        const existente = await sembrar(`editar-${singular}`);
        const nuevo = nombreTaxonomia(`editada-${singular}`);
        await llamarApi(actor.token, 'PATCH', `/rest/v1/${tabla}?id=eq.${existente.id}`, { cuerpo: { nombre: nuevo } });
        const { data } = await servicio().from(tabla).select('nombre').eq('id', existente.id).single();
        return data?.nombre === nuevo;
      },
    },
    {
      fila: `Eliminar una ${singular}`,
      editor: true,
      admin: true,
      ejecutar: async (actor) => {
        const existente = await sembrar(`eliminar-${singular}`);
        await llamarApi(actor.token, 'DELETE', `/rest/v1/${tabla}?id=eq.${existente.id}`);
        const { data } = await servicio().from(tabla).select('id').eq('id', existente.id);
        return (data ?? []).length === 0;
      },
    },
  ];
}

const FILAS_API: FilaApi[] = [
  {
    fila: 'Ver artículos en borrador de cualquier autor',
    editor: true,
    admin: true,
    ejecutar: async (actor) => {
      const articulo = await sembrarArticulo({ titulo: tituloT099('leer'), autorId: ID_EDITORA });
      const respuesta = await llamarApi(actor.token, 'GET', `/rest/v1/articulos?id=eq.${articulo.id}&select=id`);
      return Array.isArray(respuesta.cuerpo) && respuesta.cuerpo.length === 1;
    },
  },
  {
    fila: 'Crear un artículo',
    editor: true,
    admin: true,
    ejecutar: async (actor) => {
      const titulo = tituloT099('crear');
      await llamarApi(actor.token, 'POST', '/rest/v1/articulos', {
        cuerpo: { titulo, slug: '', autor_id: idDe(actor), contenido: [] },
        prefer: 'return=minimal',
      });
      const { data } = await servicio().from('articulos').select('id').eq('titulo', titulo);
      return (data ?? []).length === 1;
    },
  },
  {
    fila: 'Editar un artículo de otro autor',
    editor: true,
    admin: true,
    ejecutar: async (actor) => {
      const articulo = await sembrarArticulo({ titulo: tituloT099('editar'), autorId: ID_EDITORA });
      const nuevo = tituloT099('editado');
      await llamarApi(actor.token, 'PATCH', `/rest/v1/articulos?id=eq.${articulo.id}`, {
        cuerpo: { titulo: nuevo, version: articulo.version },
      });
      return (await articuloPorId(articulo.id)).titulo === nuevo;
    },
  },
  {
    fila: 'Publicar',
    editor: true,
    admin: true,
    ejecutar: (actor) => cambiarEstadoPorApi(actor, 'publicar', sinPreparar, 'publicado'),
  },
  {
    fila: 'Programar',
    editor: true,
    admin: true,
    ejecutar: (actor) => cambiarEstadoPorApi(actor, 'programar', sinPreparar, 'programado'),
  },
  {
    fila: 'Cancelar la programación',
    editor: true,
    admin: true,
    ejecutar: (actor) =>
      cambiarEstadoPorApi(
        actor,
        'cancelar',
        async (id) => void (await pasarAComoServicio(id, 'programado', new Date(Date.now() + 24 * 3_600_000))),
        'borrador',
      ),
  },
  {
    fila: 'Despublicar (volver a borrador)',
    editor: true,
    admin: true,
    ejecutar: (actor) =>
      cambiarEstadoPorApi(actor, 'despublicar', async (id) => void (await publicarComoServicio(id)), 'borrador'),
  },
  {
    fila: 'Archivar',
    editor: true,
    admin: true,
    ejecutar: (actor) =>
      cambiarEstadoPorApi(actor, 'archivar', async (id) => void (await publicarComoServicio(id)), 'archivado'),
  },
  {
    fila: 'Eliminar un artículo definitivamente',
    editor: false,
    admin: true,
    ejecutar: async (actor) => {
      const articulo = await sembrarArticulo({ titulo: tituloT099('eliminar'), autorId: ID_EDITORA });
      await llamarApi(actor.token, 'DELETE', `/rest/v1/articulos?id=eq.${articulo.id}`);
      const { data } = await servicio().from('articulos').select('id').eq('id', articulo.id);
      return (data ?? []).length === 0;
    },
  },
  {
    fila: 'Subir una imagen al almacenamiento',
    editor: true,
    admin: true,
    ejecutar: async (actor) => {
      const ruta = `pruebas-e2e/perm-${crypto.randomUUID()}.png`;
      await llamarApi(actor.token, 'POST', `/storage/v1/object/medios/${ruta}`, {
        cuerpo: new Uint8Array(pngDecodificable(4, 3)),
        tipoDeContenido: 'image/png',
      });
      const existe = await existeObjeto(ruta);
      if (existe) await servicio().storage.from('medios').remove([ruta]);
      return existe;
    },
  },
  {
    fila: 'Pedir una URL firmada de subida (lo que usa el panel)',
    editor: true,
    admin: true,
    ejecutar: async (actor) => {
      const ruta = `pruebas-e2e/perm-firmada-${crypto.randomUUID()}.png`;
      const respuesta = await llamarApi(actor.token, 'POST', `/storage/v1/object/upload/sign/medios/${ruta}`, {
        cuerpo: {},
      });
      return respuesta.estado === 200;
    },
  },
  ...filasDeTaxonomia('categorias', 'categoría'),
  ...filasDeTaxonomia('etiquetas', 'etiqueta'),
  {
    fila: 'Editar el perfil propio',
    editor: true,
    admin: true,
    ejecutar: async (actor) => {
      const id = idDe(actor);
      const antes = (await perfilPorId(id))?.biografia ?? null;
      const marca = `e2e-perm bio ${crypto.randomUUID().slice(0, 8)}`;
      try {
        await llamarApi(actor.token, 'PATCH', `/rest/v1/perfiles?id=eq.${id}`, { cuerpo: { biografia: marca } });
        return (await perfilPorId(id))?.biografia === marca;
      } finally {
        await servicio().from('perfiles').update({ biografia: antes }).eq('id', id);
      }
    },
  },
  {
    fila: 'Ver el equipo',
    editor: false,
    admin: true,
    ejecutar: async (actor) => {
      const respuesta = await llamarApi(actor.token, 'POST', '/rest/v1/rpc/listar_equipo', { cuerpo: {} });
      return respuesta.estado === 200 && Array.isArray(respuesta.cuerpo) && respuesta.cuerpo.length > 0;
    },
  },
  {
    fila: 'Cambiar el rol de un miembro',
    editor: false,
    admin: true,
    ejecutar: async (actor) => {
      // El objetivo está desactivado: promoverlo no crea un admin activo (no interfiere con "el único admin").
      const objetivo = await nuevoMiembro('rol-objetivo');
      await objetivo.desactivar();
      await llamarApi(actor.token, 'PATCH', `/rest/v1/perfiles?id=eq.${objetivo.id}`, { cuerpo: { rol: 'admin' } });
      return (await perfilPorId(objetivo.id))?.rol === 'admin';
    },
  },
  {
    fila: 'Desactivar un miembro',
    editor: false,
    admin: true,
    ejecutar: async (actor) => {
      const objetivo = await nuevoMiembro('desactivar-objetivo');
      await llamarApi(actor.token, 'PATCH', `/rest/v1/perfiles?id=eq.${objetivo.id}`, { cuerpo: { activo: false } });
      return (await perfilPorId(objetivo.id))?.activo === false;
    },
  },
  {
    fila: 'Reactivar un miembro',
    editor: false,
    admin: true,
    ejecutar: async (actor) => {
      const objetivo = await nuevoMiembro('reactivar-objetivo');
      await objetivo.desactivar();
      await llamarApi(actor.token, 'PATCH', `/rest/v1/perfiles?id=eq.${objetivo.id}`, { cuerpo: { activo: true } });
      return (await perfilPorId(objetivo.id))?.activo === true;
    },
  },
];

test.describe('[T099] Intento directo contra la API: todas las filas de la tabla, por actor (CE-002)', () => {
  const desactivados: MiembroDePrueba[] = [];
  const actores: Actor[] = [];

  test.beforeAll(async () => {
    const editorDesactivado = await crearMiembro(nombreDePrueba('perm-api-desact-editor'));
    await editorDesactivado.desactivar();
    // Un admin desactivado: se crea como editor, se desactiva y recién entonces se asciende, para no tener nunca
    // un segundo admin activo (otros specs asumen un único admin).
    const adminDesactivado = await crearMiembro(nombreDePrueba('perm-api-desact-admin'));
    await adminDesactivado.desactivar();
    await servicio().from('perfiles').update({ rol: 'admin' }).eq('id', adminDesactivado.id);
    desactivados.push(editorDesactivado, adminDesactivado);

    actores.push(
      { rol: 'anonimo', token: null, id: null },
      { rol: 'desactivado editor', token: await tokenDe(editorDesactivado), id: editorDesactivado.id },
      { rol: 'desactivado admin', token: await tokenDe(adminDesactivado), id: adminDesactivado.id },
      { rol: 'editor', token: await tokenDe(USUARIOS.editor), id: ID_EDITOR_DEMO },
      { rol: 'admin', token: await tokenDe(USUARIOS.admin), id: ID_ADMIN_DEMO },
    );
  });
  test.afterAll(async () => {
    for (const miembro of desactivados.splice(0)) await miembro.eliminar();
  });

  for (const { fila, editor, admin, ejecutar } of FILAS_API) {
    test(`T099-API: "${fila}": solo ${editor ? 'editor y admin' : 'admin'} lo logran`, async () => {
      const esperado: Record<string, boolean> = {};
      const obtenido: Record<string, boolean> = {};
      for (const actor of actores) {
        esperado[actor.rol] = actor.rol === 'editor' ? editor : actor.rol === 'admin' ? admin : false;
        obtenido[actor.rol] = await ejecutar(actor);
      }
      expect(obtenido).toEqual(esperado);
    });
  }

  test('T099-API: un admin desactivado no puede reactivarse a sí mismo', async () => {
    const adminDesactivado = actores.find((a) => a.rol === 'desactivado admin')!;

    await llamarApi(adminDesactivado.token, 'PATCH', `/rest/v1/perfiles?id=eq.${adminDesactivado.id}`, {
      cuerpo: { activo: true },
    });

    expect((await perfilPorId(adminDesactivado.id!))?.activo).toBe(false);
  });

  test('T099-API: el editor no puede cambiar rol ni estado de nadie, ni siquiera de sí mismo', async () => {
    const editor = actores.find((a) => a.rol === 'editor')!;
    const objetivo = await nuevoMiembro('api-editor-objetivo');

    const ajeno = await actualizarPerfilPorApi(editor.token!, objetivo.id, { rol: 'admin', activo: false });
    const propio = await actualizarPerfilPorApi(editor.token!, ID_EDITOR_DEMO, { rol: 'admin' });

    expect(ajeno.filas).toEqual([]);
    expect(propio.filas).toEqual([]);
    expect(await perfilPorId(objetivo.id)).toMatchObject({ rol: 'editor', activo: true });
    expect((await perfilPorId(ID_EDITOR_DEMO))?.rol).toBe('editor');
  });

  test('T099-API: invitar solo existe como Server Action con la clave de servicio: la API de Auth lo rechaza con cualquier sesión', async () => {
    for (const rol of ['anonimo', 'editor', 'admin'] as const) {
      const actor = actores.find((a) => a.rol === rol)!;
      const correo = correoUnico(`api-invita-${rol}`);
      correosInvitados.push(correo);

      const respuesta = await llamarApi(actor.token, 'POST', '/auth/v1/invite', { cuerpo: { email: correo } });

      expect(respuesta.estado, rol).toBeGreaterThanOrEqual(400);
      const { data } = await servicio().auth.admin.listUsers({ perPage: 200 });
      expect(
        data.users.some((u) => u.email === correo),
        rol,
      ).toBe(false);
    }
  });
});
