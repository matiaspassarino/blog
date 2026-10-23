// T050 (spec 003, H2-E1 a E3, E6, CE-001, CE-004), adaptado al editor de documento en la spec 005 (T057; H5 esc. 1, 3
// y 4, RF-013). El caso de sesión vencida o miembro desactivado al guardar NO va aquí: es de casos-borde.spec.ts.
//
// Supuestos de interfaz: ver el encabezado de ./ayudas/editor.ts (lienzo, «Insertar», panel de propiedades y nombres).
// Además de ese contrato, este archivo asume:
//   - Campo "Slug" (textbox) que se rellena solo, con retardo de 300 ms, con el slug que normaliza la base.
//   - Resumen de errores al guardar: `role="alert"` con "Hay N error(es). Revisa el elemento X, campo <Campo>".
//   - El elemento con error muestra el mensaje de `validarContenido` en el lienzo (la isla de un elemento especial, o junto
//     al elemento de texto) o en su panel de propiedades; el campo del panel con error tiene `aria-invalid="true"` y, si
//     es el primero, el foco. Un párrafo vacío no es un elemento (no se guarda): no tiene error.
//   - Formato del texto: la barra de herramientas «Formato del texto» con Negrita, Cursiva, Código y Enlace (campo "URL
//     del enlace"), sin subrayado ni tachado; se guardan como `**texto**`, `_texto_`, `` `texto` `` y `[texto](url)`.
//   - Mover en los extremos con el teclado: `Esc` entra al modo elementos y `Alt+↑`/`Alt+↓` mueven; en el menú
//     «Acciones», «Subir» y «Bajar» llevan `aria-disabled="true"` en los extremos y no hacen nada.
//   - Indicador "Cambios sin guardar" (texto visible, spec 004: en la línea de estado de la barra "Acciones del artículo",
//     dentro de una región `aria-live`) mientras hay cambios. Salir por un enlace del panel abre un
//     `alertdialog` con "Seguir editando" (foco inicial) y "Salir sin guardar"; Esc lo cierra y devuelve el foco al enlace.
import { expect, test, type Page } from '@playwright/test';
import {
  articuloPorId,
  articuloPorTitulo,
  diezElementos,
  elementosDe,
  ID_EDITORA,
  imagenSemilla,
  limpiarArticulosE2E,
  parrafo,
  sembrarArticulo,
  textoDe,
  tipoVisible,
} from './ayudas/articulos';
import {
  accionDelMenu,
  agregarBloque,
  barraDeFormato,
  botonAcciones,
  botonGuardar,
  camposDe,
  completarBloque,
  elegirAccion,
  escribirEnElemento,
  esperarEditorListo,
  grupoDeBloque,
  guardarYEsperar,
  lienzo,
  panelDePropiedades,
  reemplazarTextoDe,
  subirImagenConAlt,
  textosDelLienzo,
  TIPOS,
  type TipoDeBloque,
} from './ayudas/editor';
import { nombreDePrueba } from './ayudas/datos';
import { barraDelEditor } from './ayudas/jerarquia';
import { ingresar, USUARIOS } from './ayudas/sesion';

const PREFIJO = 'e2e-ed-';
const titulo = (etiqueta: string) => nombreDePrueba(`ed-${etiqueta}`);
const URL_ARTICULO = /\/articulos\/[0-9a-f-]{36}$/;
const MOD = 'ControlOrMeta';

test.afterAll(() => limpiarArticulosE2E(PREFIJO));

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
});

async function abrirNuevo(page: Page, tituloArticulo: string) {
  await page.goto('/articulos/nuevo');
  await esperarEditorListo(page);
  await page.getByLabel('Título', { exact: true }).fill(tituloArticulo);
}

async function abrirArticulo(page: Page, id: string) {
  await page.goto(`/articulos/${id}`);
  await esperarEditorListo(page);
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

test.describe('Elementos (H2-E2, H5-E1)', () => {
  test('H2-E2 / H5-E1: los 10 tipos se insertan, se guardan y al reabrir conservan contenido y orden', async ({
    page,
  }) => {
    test.slow();
    const nombre = titulo('diez');
    await abrirNuevo(page, nombre);

    // Se alterna «Insertar» y «/» para cubrir los dos caminos.
    for (const [i, tipo] of TIPOS.entries()) {
      const grupo = await agregarBloque(page, tipo, i + 1, i % 2 === 0 ? 'insertar' : 'barra-diagonal');
      await completarBloque(page, grupo, tipo);
    }
    await guardarYEsperar(page);
    const id = await idDeLaUrl(page);

    await abrirArticulo(page, id);
    for (const [i, tipo] of TIPOS.entries()) await expect(grupoDeBloque(page, i + 1, tipo), tipo).toBeVisible();
    await expect(grupoDeBloque(page, 1, 'parrafo')).toHaveText('Primer párrafo con negrita y cursiva.');
    await expect(grupoDeBloque(page, 1, 'parrafo').locator('strong')).toHaveText('negrita');
    await expect(grupoDeBloque(page, 5, 'lista').locator('li').nth(2)).toHaveText('Tercero');
    await expect(grupoDeBloque(page, 9, 'codigo')).toHaveText('const x = 1;');
    const cita = await camposDe(page, grupoDeBloque(page, 4, 'cita'));
    await expect(cita.getByLabel('Autor', { exact: true })).toHaveValue('Alguien');

    const guardado = elementosDe(await articuloPorId(id));
    expect(guardado.map(tipoVisible)).toEqual(TIPOS);
    // Lo mismo que `diezElementos`, salvo los ids y la imagen subida (ruta, ancho y alto nuevos).
    const esperado = diezElementos(imagenSemilla(''));
    for (const [i, elemento] of guardado.entries()) {
      const { id: _id, imagen, imagenes, ...resto } = esperado[i]!.attrs;
      expect(elemento, TIPOS[i]).toMatchObject({ type: esperado[i]!.type, attrs: resto });
      expect(textoDe(elemento), TIPOS[i]).toBe(textoDe(esperado[i]));
      if (imagen) expect(elemento.attrs.imagen).toMatchObject({ alt: 'Imagen de prueba', decorativa: false });
      if (imagenes) {
        const alts = (elemento.attrs.imagenes as { alt: string }[]).map((img) => img.alt);
        expect(alts).toEqual(['Imagen de prueba', 'Otra imagen']);
      }
    }
  });

  test('H2-E2: subir, bajar, duplicar y quitar elementos se guarda en el nuevo orden', async ({ page }) => {
    const articulo = await sembrarArticulo({
      titulo: titulo('orden'),
      contenido: [parrafo('Uno'), parrafo('Dos'), parrafo('Tres')],
    });
    await abrirArticulo(page, articulo.id);
    const elegirEn = async (texto: string, accion: string) => {
      await lienzo(page).getByText(texto, { exact: true }).first().click();
      await elegirAccion(page, accion);
    };

    await elegirEn('Uno', 'Bajar'); // Dos, Uno, Tres
    await elegirEn('Tres', 'Subir'); // Dos, Tres, Uno
    await elegirEn('Dos', 'Duplicar'); // Dos, Dos, Tres, Uno
    await elegirEn('Tres', 'Quitar'); // Dos, Dos, Uno
    await guardarYEsperar(page);

    await abrirArticulo(page, articulo.id);
    expect(await textosDelLienzo(page)).toEqual(['Dos', 'Dos', 'Uno']);
    expect(elementosDe(await articuloPorId(articulo.id)).map(textoDe)).toEqual(['Dos', 'Dos', 'Uno']);
  });

  test('CE-006 / H5: en los extremos, subir el primero y bajar el último no hacen nada, con el teclado', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('extremos'), contenido: [parrafo('A'), parrafo('B')] });
    await abrirArticulo(page, articulo.id);

    // Atajo del modo elementos.
    await lienzo(page).getByText('A', { exact: true }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+ArrowUp');
    expect(await textosDelLienzo(page)).toEqual(['A', 'B']);
    await page.keyboard.press('Escape');

    // «Acciones» con el teclado: «Subir» no está disponible y activarlo no cambia nada.
    await botonAcciones(page).focus();
    await page.keyboard.press('Enter');
    const subir = accionDelMenu(page, 'Subir');
    await expect(subir).toHaveAttribute('aria-disabled', 'true');
    await subir.focus();
    await page.keyboard.press('Enter');
    expect(await textosDelLienzo(page)).toEqual(['A', 'B']);
    await page.keyboard.press('Escape');

    await lienzo(page).getByText('B', { exact: true }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+ArrowDown');
    expect(await textosDelLienzo(page)).toEqual(['A', 'B']);
  });
});

test.describe('Errores por elemento y campo (H2-E3, H5-E3, CE-004)', () => {
  test('H2-E3 / H5-E3: una imagen sin texto alternativo rechaza el guardado, señala el campo y conserva lo escrito', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('sin-alt'), contenido: [parrafo('Original')] });
    await abrirArticulo(page, articulo.id);
    const primero = grupoDeBloque(page, 1, 'parrafo');
    await reemplazarTextoDe(page, primero, 'Texto nuevo que no debe perderse');
    const imagen = await agregarBloque(page, 'imagen', 2);
    await subirImagenConAlt(page, imagen, 'Alt provisorio');
    await panelDePropiedades(page).getByLabel('Texto alternativo', { exact: true }).fill(''); // sin alt ni decorativa
    await primero.click(); // la imagen deja de estar seleccionada

    await botonGuardar(page).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Revisa el elemento 2, campo Texto alternativo' }),
    ).toBeVisible();
    const alt = panelDePropiedades(page).getByLabel('Texto alternativo', { exact: true });
    await expect(alt).toBeFocused();
    await expect(alt).toHaveAttribute('aria-invalid', 'true');
    await expect(imagen).toContainText('La imagen necesita un texto alternativo o marcarse como decorativa');
    await expect(primero).toHaveText('Texto nuevo que no debe perderse');
    const enBase = await articuloPorId(articulo.id);
    expect(enBase.version).toBe(articulo.version);
    expect(textoDe(elementosDe(enBase)[0])).toBe('Original');
  });

  test('H2-E3: marcar la imagen como decorativa resuelve el error y deja guardar', async ({ page }) => {
    const nombre = titulo('decorativa');
    await abrirNuevo(page, nombre);
    const imagen = await agregarBloque(page, 'imagen', 1);
    await subirImagenConAlt(page, imagen, 'x');
    const panel = panelDePropiedades(page);
    await panel.getByLabel('Texto alternativo', { exact: true }).fill('');
    await botonGuardar(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Texto alternativo' })).toBeVisible();

    await panel.getByLabel('Imagen decorativa').check();
    await expect(panel.getByLabel('Texto alternativo', { exact: true })).toBeDisabled();
    await guardarYEsperar(page);

    expect(await articuloPorTitulo(nombre)).not.toBeNull();
  });

  // Un párrafo vacío no es un elemento (no se guarda) y un código vacío es válido: no figuran aquí.
  const CAMPOS_OBLIGATORIOS: { tipo: TipoDeBloque; mensajes: RegExp[] }[] = [
    { tipo: 'titulo', mensajes: [/El título no puede estar vacío/] },
    { tipo: 'imagen', mensajes: [/La imagen necesita una ruta/] },
    { tipo: 'cita', mensajes: [/La cita no puede estar vacío/] },
    { tipo: 'lista', mensajes: [/La lista necesita al menos un item|El item no puede estar vacío/] },
    { tipo: 'galeria', mensajes: [/La galería necesita al menos 2 imágenes/] },
    {
      tipo: 'cta',
      mensajes: [
        /El título no puede estar vacío/,
        /La etiqueta del botón no puede estar vacío/,
        /La URL debe ser interna \(\/…\) o https/,
      ],
    },
    { tipo: 'video', mensajes: [/El id de YouTube no es válido/, /El título del video no puede estar vacío/] },
  ];

  for (const { tipo, mensajes } of CAMPOS_OBLIGATORIOS) {
    test(`H2-E3 / H5-E3 / CE-004: un elemento de ${tipo} vacío señala sus campos obligatorios en ese elemento`, async ({
      page,
    }) => {
      const nombre = titulo(`vacio-${tipo}`);
      await abrirNuevo(page, nombre);
      const grupo = await agregarBloque(page, tipo, 1);

      await botonGuardar(page).click();

      await expect(page.getByRole('alert').filter({ hasText: /Revisa el elemento 1/ })).toBeVisible();
      // El mensaje se ve en el propio elemento del lienzo o en su panel de propiedades (como hoy, no solo con color).
      for (const mensaje of mensajes) {
        await expect(
          grupo
            .getByText(mensaje)
            .or(lienzo(page).getByText(mensaje))
            .or(panelDePropiedades(page).getByText(mensaje))
            .first(),
          String(mensaje),
        ).toBeVisible();
      }
      expect(await articuloPorTitulo(nombre)).toBeNull();
    });
  }

  test('H2-E3: un separador es válido (no tiene campos obligatorios)', async ({ page }) => {
    const nombre = titulo('separador');
    await abrirNuevo(page, nombre);
    await agregarBloque(page, 'separador', 1);

    await guardarYEsperar(page);

    expect(elementosDe(await articuloPorTitulo(nombre)).map(tipoVisible)).toEqual(['separador']);
  });

  test('CE-004 / H5-E3: el foco va al primer campo inválido cuando hay varios elementos con error', async ({ page }) => {
    await abrirNuevo(page, titulo('foco'));
    await agregarBloque(page, 'video', 1);
    await agregarBloque(page, 'cta', 2);

    await botonGuardar(page).click();

    await expect(panelDePropiedades(page).getByLabel('ID del video', { exact: true })).toBeFocused();
    await expect(page.getByRole('alert').filter({ hasText: /Hay \d+ errores\. Revisa el elemento 1/ })).toBeVisible();
  });
});

test.describe('Formato del texto (H2-E2, RF-003)', () => {
  test('la barra aplica negrita, cursiva, código y enlace; se guardan como marcas del documento y no hay subrayado', async ({
    page,
  }) => {
    const nombre = titulo('formato');
    await abrirNuevo(page, nombre);
    const barra = barraDeFormato(page);
    await expect(barra.getByRole('button', { name: /subray|tachad/i })).toHaveCount(0);

    for (const [i, boton] of ['Negrita', 'Cursiva', 'Código', 'Enlace'].entries()) {
      if (i > 0) await page.keyboard.press('Enter');
      else await lienzo(page).click();
      await page.keyboard.type('hola');
      await page.keyboard.press('Shift+Home');
      await barra.getByRole('button', { name: boton, exact: true }).click();
      if (boton === 'Enlace') {
        await page.getByLabel('URL del enlace', { exact: true }).fill('https://example.com/destino');
        await page.keyboard.press('Enter');
      }
      await page.keyboard.press('End');
      // Sale de la marca antes del párrafo siguiente.
      if (boton !== 'Enlace') await barra.getByRole('button', { name: boton, exact: true }).click();
    }
    await guardarYEsperar(page);

    expect(elementosDe(await articuloPorTitulo(nombre)).map((elemento) => elemento.content)).toEqual([
      [{ type: 'text', text: 'hola', marks: [{ type: 'bold' }] }],
      [{ type: 'text', text: 'hola', marks: [{ type: 'italic' }] }],
      [{ type: 'text', text: 'hola', marks: [{ type: 'code' }] }],
      [{ type: 'text', text: 'hola', marks: [{ type: 'link', attrs: { href: 'https://example.com/destino' } }] }],
    ]);
  });
});

test.describe('Cambios sin guardar en el lienzo (H2-E6, H5-E4)', () => {
  test('H5-E4: escribir en el lienzo muestra el indicador y deshacer hasta el original lo quita', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('lienzo-sucio'), contenido: [parrafo('Original')] });
    await abrirArticulo(page, articulo.id);
    const aviso = barraDelEditor(page).getByText('Cambios sin guardar');
    await expect(aviso).toHaveCount(0);

    await escribirEnElemento(page, grupoDeBloque(page, 1, 'parrafo'), ' y algo más');
    await expect(aviso).toBeVisible();

    await page.keyboard.press(`${MOD}+z`);
    await expect(grupoDeBloque(page, 1, 'parrafo')).toHaveText('Original');
    await expect(aviso).toHaveCount(0);
  });

  test('H5-E4: con cambios en el lienzo, salir por un enlace del panel pide confirmar y «Seguir editando» los conserva', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('lienzo-salir'), contenido: [parrafo('Original')] });
    await abrirArticulo(page, articulo.id);
    await escribirEnElemento(page, grupoDeBloque(page, 1, 'parrafo'), ' sin guardar');

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Artículos' }).click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Seguir editando' }).click();

    await expect(page).toHaveURL(new RegExp(`/articulos/${articulo.id}$`));
    await expect(grupoDeBloque(page, 1, 'parrafo')).toHaveText('Original sin guardar');
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
