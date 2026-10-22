// T050 (spec 003, H2-E1 a E3, E6, CE-001, CE-004). FASE ROJA: /articulos/nuevo y /articulos/[id] no existen aún.
// El caso de sesión vencida o miembro desactivado al guardar NO va aquí: es de T100.
//
// Supuestos de interfaz: ver el encabezado de ./ayudas/editor.ts (contrato completo de etiquetas y nombres).
// Además de ese contrato, este archivo asume:
//   - Campo "Slug" (textbox) que se rellena solo, con retardo de 300 ms, con el slug que normaliza la base.
//   - Resumen de errores al guardar: `role="alert"` con "Hay N error(es). Revisa el bloque X, campo <Campo>" (T061).
//   - Los campos con error tienen `aria-invalid="true"` y el mensaje (el de `validarContenido`) visible dentro del bloque.
//   - Barra de formato del texto: `role="toolbar"` dentro del bloque, con exactamente 4 botones: Negrita, Cursiva,
//     Código, Enlace. Insertan `**texto**`, `_texto_`, `` `texto` `` y `[texto](url)`; el foco vuelve al textarea.
//   - Indicador "Cambios sin guardar" (texto visible, spec 004: en la línea de estado de la barra "Acciones del artículo",
//     dentro de una región `aria-live`) mientras hay cambios. Salir por un enlace del panel abre un
//     `alertdialog` con "Seguir editando" (foco inicial) y "Salir sin guardar"; Esc lo cierra y devuelve el foco al enlace.
import { expect, test, type Page } from '@playwright/test';
import {
  articuloPorId,
  articuloPorTitulo,
  ID_EDITORA,
  limpiarArticulosE2E,
  parrafo,
  sembrarArticulo,
} from './ayudas/articulos';
import {
  agregarBloque,
  botonGuardar,
  completarBloque,
  esperarEditorListo,
  grupoDeBloque,
  guardarYEsperar,
  subirImagenConAlt,
  TIPOS,
  type TipoDeBloque,
} from './ayudas/editor';
import { nombreDePrueba } from './ayudas/datos';
import { barraDelEditor } from './ayudas/jerarquia';
import { ingresar, USUARIOS } from './ayudas/sesion';

const PREFIJO = 'e2e-ed-';
const titulo = (etiqueta: string) => nombreDePrueba(`ed-${etiqueta}`);
const URL_ARTICULO = /\/articulos\/[0-9a-f-]{36}$/;

test.afterAll(() => limpiarArticulosE2E(PREFIJO));

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
});

async function abrirNuevo(page: Page, tituloArticulo: string) {
  await page.goto('/articulos/nuevo');
  await page.getByLabel('Título', { exact: true }).fill(tituloArticulo);
}

async function idDeLaUrl(page: Page) {
  await expect(page).toHaveURL(URL_ARTICULO);
  return page.url().split('/').pop()!;
}

test.describe('Slug sugerido (H2-E1)', () => {
  test('H2-E1: al escribir el título aparece el slug normalizado, y se puede reemplazar', async ({ page }) => {
    const nombre = titulo('Cómo Empezar');
    await abrirNuevo(page, nombre);
    const slug = page.getByLabel('Slug', { exact: true });

    await expect(slug).toHaveValue(/^e2e-ed-como-empezar-[a-z0-9]{6}$/);

    await slug.fill('mi-direccion-propia');
    await page.getByLabel('Título', { exact: true }).fill(`${nombre} y más`);
    await page.waitForTimeout(600); // más que el retardo de 300 ms de la sugerencia
    await expect(slug).toHaveValue('mi-direccion-propia');

    await guardarYEsperar(page);
    const id = await idDeLaUrl(page);
    expect((await articuloPorId(id)).slug).toMatch(/^mi-direccion-propia/);
  });

  test('H2-E1: tras guardar muestra el slug definitivo que dejó la base', async ({ page }) => {
    const repetido = titulo('repetido');
    await sembrarArticulo({ titulo: repetido, slug: 'e2e-ed-slug-ocupado' });
    await abrirNuevo(page, titulo('otro'));
    await page.getByLabel('Slug', { exact: true }).fill('e2e-ed-slug-ocupado');

    await guardarYEsperar(page);

    const id = await idDeLaUrl(page);
    const guardado = await articuloPorId(id);
    expect(guardado.slug).not.toBe('e2e-ed-slug-ocupado');
    await expect(page.getByLabel('Slug', { exact: true })).toHaveValue(guardado.slug);
  });
});

test.describe('Bloques (H2-E2)', () => {
  test('H2-E2: los 10 tipos de bloque se guardan y al reabrir conservan contenido y orden', async ({ page }) => {
    test.slow();
    const nombre = titulo('diez');
    await abrirNuevo(page, nombre);

    for (const [i, tipo] of TIPOS.entries()) {
      const grupo = await agregarBloque(page, tipo, i + 1);
      await completarBloque(page, grupo, tipo);
    }
    await guardarYEsperar(page);
    const id = await idDeLaUrl(page);

    await page.goto(`/articulos/${id}`);
    for (const [i, tipo] of TIPOS.entries()) await expect(grupoDeBloque(page, i + 1, tipo)).toBeVisible();
    await expect(grupoDeBloque(page, 1, 'parrafo').getByLabel('Texto', { exact: true })).toHaveValue(
      'Primer párrafo con **negrita** y _cursiva_.',
    );
    await expect(grupoDeBloque(page, 4, 'cita').getByLabel('Autor', { exact: true })).toHaveValue('Alguien');
    await expect(grupoDeBloque(page, 5, 'lista').getByLabel('Ítem 3', { exact: true })).toHaveValue('Tercero');
    await expect(grupoDeBloque(page, 9, 'codigo').getByLabel('Código', { exact: true })).toHaveValue('const x = 1;');
    await expect(grupoDeBloque(page, 10, 'video').getByLabel('ID del video', { exact: true })).toHaveValue(
      'dQw4w9WgXcQ',
    );

    const guardado = await articuloPorId(id);
    const tipos = (guardado.contenido as { tipo: TipoDeBloque }[]).map((b) => b.tipo);
    expect(tipos).toEqual(TIPOS);
  });

  test('H2-E2: subir, bajar, duplicar y quitar bloques se guarda en el nuevo orden', async ({ page }) => {
    const articulo = await sembrarArticulo({
      titulo: titulo('orden'),
      contenido: [parrafo('Uno'), parrafo('Dos'), parrafo('Tres')],
    });
    await page.goto(`/articulos/${articulo.id}`);

    await page.getByRole('button', { name: 'Bajar bloque 1, párrafo' }).click(); // Dos, Uno, Tres
    await page.getByRole('button', { name: 'Subir bloque 3, párrafo' }).click(); // Dos, Tres, Uno
    await page.getByRole('button', { name: 'Duplicar bloque 1, párrafo' }).click(); // Dos, Dos, Tres, Uno
    await page.getByRole('button', { name: 'Quitar bloque 3, párrafo' }).click(); // Dos, Dos, Uno
    await guardarYEsperar(page);

    await page.reload();
    const textos = [1, 2, 3].map((n) => grupoDeBloque(page, n, 'parrafo').getByLabel('Texto', { exact: true }));
    await expect(textos[0]).toHaveValue('Dos');
    await expect(textos[1]).toHaveValue('Dos');
    await expect(textos[2]).toHaveValue('Uno');
    await expect(page.getByRole('group', { name: /^Bloque 4:/ })).toHaveCount(0);
  });

  test('CE-006: en los extremos, subir el primero y bajar el último usan aria-disabled y no hacen nada', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('extremos'), contenido: [parrafo('A'), parrafo('B')] });
    await page.goto(`/articulos/${articulo.id}`);

    const subirPrimero = page.getByRole('button', { name: 'Subir bloque 1, párrafo' });
    await expect(subirPrimero).toHaveAttribute('aria-disabled', 'true');
    // El botón usa aria-disabled a propósito (no pierde el foco): Playwright lo trata como deshabilitado. Se activa
    // con el teclado: un clic forzado cae sobre lo que tape el botón (la barra fija del editor).
    await subirPrimero.focus();
    await page.keyboard.press('Enter');

    await expect(grupoDeBloque(page, 1, 'parrafo').getByLabel('Texto', { exact: true })).toHaveValue('A');
  });
});

test.describe('Errores por bloque y campo (H2-E3, CE-004)', () => {
  test('H2-E3: una imagen sin texto alternativo rechaza el guardado completo, se señala el campo y se conserva lo escrito', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('sin-alt'), contenido: [parrafo('Original')] });
    await page.goto(`/articulos/${articulo.id}`);
    await esperarEditorListo(page);
    await grupoDeBloque(page, 1, 'parrafo')
      .getByLabel('Texto', { exact: true })
      .fill('Texto nuevo que no debe perderse');
    const imagen = await agregarBloque(page, 'imagen', 2);
    await subirImagenConAlt(page, imagen, 'Alt provisorio');
    await imagen.getByLabel('Texto alternativo', { exact: true }).fill(''); // sin alt y sin marca decorativa

    await botonGuardar(page).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Revisa el bloque 2, campo Texto alternativo' }),
    ).toBeVisible();
    const alt = imagen.getByLabel('Texto alternativo', { exact: true });
    await expect(alt).toBeFocused();
    await expect(alt).toHaveAttribute('aria-invalid', 'true');
    await expect(imagen.getByText('La imagen necesita un texto alternativo o marcarse como decorativa')).toBeVisible();
    await expect(grupoDeBloque(page, 1, 'parrafo').getByLabel('Texto', { exact: true })).toHaveValue(
      'Texto nuevo que no debe perderse',
    );
    const enBase = await articuloPorId(articulo.id);
    expect(enBase.version).toBe(articulo.version);
    expect((enBase.contenido as { texto: string }[])[0]?.texto).toBe('Original');
  });

  test('H2-E3: marcar la imagen como decorativa resuelve el error y deja guardar', async ({ page }) => {
    const nombre = titulo('decorativa');
    await abrirNuevo(page, nombre);
    const imagen = await agregarBloque(page, 'imagen', 1);
    await subirImagenConAlt(page, imagen, 'x');
    await imagen.getByLabel('Texto alternativo', { exact: true }).fill('');
    await botonGuardar(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Texto alternativo' })).toBeVisible();

    await imagen.getByLabel('Imagen decorativa').check();
    await expect(imagen.getByLabel('Texto alternativo', { exact: true })).toBeDisabled();
    await guardarYEsperar(page);

    expect(await articuloPorTitulo(nombre)).not.toBeNull();
  });

  const CAMPOS_OBLIGATORIOS: { tipo: TipoDeBloque; mensajes: string[] }[] = [
    { tipo: 'parrafo', mensajes: ['El texto no puede estar vacío'] },
    { tipo: 'titulo', mensajes: ['El título no puede estar vacío'] },
    { tipo: 'imagen', mensajes: ['La imagen necesita una ruta'] },
    { tipo: 'cita', mensajes: ['La cita no puede estar vacío'] },
    { tipo: 'lista', mensajes: ['La lista necesita al menos un item'] },
    { tipo: 'galeria', mensajes: ['La galería necesita al menos 2 imágenes'] },
    {
      tipo: 'cta',
      mensajes: [
        'El título no puede estar vacío',
        'La etiqueta del botón no puede estar vacío',
        'La URL debe ser interna (/…) o https',
      ],
    },
    { tipo: 'video', mensajes: ['El id de YouTube no es válido', 'El título del video no puede estar vacío'] },
  ];

  for (const { tipo, mensajes } of CAMPOS_OBLIGATORIOS) {
    test(`H2-E3 / CE-004: un bloque de ${tipo} vacío señala sus campos obligatorios dentro de ese bloque`, async ({
      page,
    }) => {
      const nombre = titulo(`vacio-${tipo}`);
      await abrirNuevo(page, nombre);
      const grupo = await agregarBloque(page, tipo, 1);

      await botonGuardar(page).click();

      for (const mensaje of mensajes) await expect(grupo.getByText(mensaje).first()).toBeVisible();
      await expect(page.getByRole('alert').filter({ hasText: /Revisa el bloque 1/ })).toBeVisible();
      expect(await articuloPorTitulo(nombre)).toBeNull();
    });
  }

  test('H2-E3: un bloque separador vacío es válido (no tiene campos obligatorios)', async ({ page }) => {
    const nombre = titulo('separador');
    await abrirNuevo(page, nombre);
    await agregarBloque(page, 'separador', 1);

    await guardarYEsperar(page);

    expect(await articuloPorTitulo(nombre)).not.toBeNull();
  });

  test('CE-004: el foco va al primer campo inválido cuando hay varios bloques con error', async ({ page }) => {
    await abrirNuevo(page, titulo('foco'));
    const primero = await agregarBloque(page, 'parrafo', 1);
    await agregarBloque(page, 'cita', 2);

    await botonGuardar(page).click();

    await expect(primero.getByLabel('Texto', { exact: true })).toBeFocused();
    await expect(page.getByRole('alert').filter({ hasText: /Hay 2 errores/ })).toBeVisible();
  });
});

test.describe('Barra de formato (H2-E2)', () => {
  test('la barra inserta solo negrita, cursiva, código y enlace; no hay HTML ni subrayado', async ({ page }) => {
    await abrirNuevo(page, titulo('formato'));
    const grupo = await agregarBloque(page, 'parrafo', 1);
    const texto = grupo.getByLabel('Texto', { exact: true });
    const barra = grupo.getByRole('toolbar');

    await expect(barra.getByRole('button')).toHaveCount(4);
    await expect(barra.getByRole('button', { name: /subray/i })).toHaveCount(0);

    const casos: [string, RegExp][] = [
      ['Negrita', /^\*\*hola\*\*$/],
      ['Cursiva', /^_hola_$/],
      ['Código', /^`hola`$/],
      ['Enlace', /^\[hola\]\(.*\)$/],
    ];
    for (const [boton, esperado] of casos) {
      await texto.fill('hola');
      await texto.press('ControlOrMeta+a');
      await barra.getByRole('button', { name: boton }).click();
      await expect(texto).toHaveValue(esperado);
      await expect(texto).toBeFocused();
    }
  });
});

test.describe('Cambios sin guardar (H2-E6)', () => {
  test('H2-E6: con cambios aparece el indicador, y desaparece al guardar', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('indicador') });
    await page.goto(`/articulos/${articulo.id}`);
    const aviso = barraDelEditor(page).getByText('Cambios sin guardar');
    await expect(barraDelEditor(page)).toBeVisible();
    await expect(aviso).toHaveCount(0);

    await page.getByLabel('Extracto', { exact: true }).fill('Un extracto nuevo');
    await expect(aviso).toBeVisible();
    await expect(aviso.locator('xpath=ancestor-or-self::*[@aria-live][1]')).toHaveCount(1); // se anuncia (región aria-live)

    await guardarYEsperar(page);
    await expect(aviso).toHaveCount(0);
  });

  // Recargar y cerrar la pestaña pasan por el mismo evento `beforeunload`; Playwright solo informa el diálogo
  // en la recarga (page.close con runBeforeUnload no lo emite), así que el aviso se comprueba recargando.
  test('H2-E6: cerrar o recargar la pestaña con cambios muestra el aviso del navegador', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('cerrar') });
    await page.goto(`/articulos/${articulo.id}`);
    await page.getByLabel('Extracto', { exact: true }).fill('Cambio sin guardar');
    // Chromium solo muestra el aviso de salida si hubo un gesto real de la persona en la página.
    await page.getByLabel('Extracto', { exact: true }).click();
    const tipos: string[] = [];
    page.on('dialog', (dialogo) => {
      tipos.push(dialogo.type());
      void dialogo.accept();
    });

    await page.reload();

    expect(tipos).toContain('beforeunload');
  });

  test('H2-E6: sin cambios, recargar la pestaña no muestra ningún aviso', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('limpio') });
    await page.goto(`/articulos/${articulo.id}`);
    const tipos: string[] = [];
    page.on('dialog', (dialogo) => {
      tipos.push(dialogo.type());
      void dialogo.accept();
    });

    await page.reload();

    expect(tipos).toEqual([]);
  });

  test('H2-E6: navegar por un enlace del panel con cambios pide confirmar; "Seguir editando" se queda', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('enlace') });
    await page.goto(`/articulos/${articulo.id}`);
    await page.getByLabel('Extracto', { exact: true }).fill('Cambio sin guardar');
    const enlace = page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Artículos' });

    await enlace.click();

    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Seguir editando' })).toBeFocused();
    await dialogo.getByRole('button', { name: 'Seguir editando' }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/articulos/${articulo.id}$`));
    await expect(page.getByLabel('Extracto', { exact: true })).toHaveValue('Cambio sin guardar');
  });

  test('H2-E6: Esc cierra el aviso y devuelve el foco al enlace', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('esc') });
    await page.goto(`/articulos/${articulo.id}`);
    await page.getByLabel('Extracto', { exact: true }).fill('Cambio sin guardar');
    const enlace = page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Artículos' });

    await enlace.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(enlace).toBeFocused();
  });

  test('H2-E6: "Salir sin guardar" descarta los cambios y navega', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('salir') });
    await page.goto(`/articulos/${articulo.id}`);
    await page.getByLabel('Extracto', { exact: true }).fill('Cambio que se descarta');

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Artículos' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Salir sin guardar' }).click();

    await expect(page).toHaveURL(/\/articulos$/);
    expect((await articuloPorId(articulo.id)).extracto).not.toBe('Cambio que se descarta');
  });

  test('H2-E6: sin cambios, el enlace navega directo, sin diálogo', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('directo') });
    await page.goto(`/articulos/${articulo.id}`);

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Artículos' }).click();

    await expect(page).toHaveURL(/\/articulos$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});

test.describe('Edición de un artículo ajeno (H2-E8)', () => {
  test('H2-E8: el editor guarda cambios en un artículo de otra persona y el autor no cambia', async ({ page }) => {
    const ajeno = await sembrarArticulo({ titulo: titulo('ajeno'), autorId: ID_EDITORA });
    await page.goto(`/articulos/${ajeno.id}`);

    await page.getByLabel('Extracto', { exact: true }).fill('Corregido por otra persona');
    await guardarYEsperar(page);

    const guardado = await articuloPorId(ajeno.id);
    expect(guardado.extracto).toBe('Corregido por otra persona');
    expect(guardado.autor_id).toBe(ajeno.autor_id);
  });
});
