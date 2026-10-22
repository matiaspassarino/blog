// T101 (spec 003, CE-006, RF-025): accesibilidad y responsive de todas las pantallas del panel.
//
// Decisiones:
// - axe se corre con wcag2a, wcag2aa, wcag21a y wcag21aa (un superconjunto de lo pedido, igual que el sitio público en
//   e2e/web/accesibilidad.spec.ts). Se excluye `nextjs-portal`, el botón de herramientas que Next inyecta solo en
//   desarrollo y que no es parte del panel.
// - axe solo revisa lo que está en pantalla. Por eso hay un bloque que muestra de verdad **todas las variantes** de `Badge`
//   (borrador, programado, publicado, archivado en la lista; activo, invitado y desactivado en el equipo) y de
//   `AvisoEstado` (éxito y error: el componente no tiene variantes de advertencia ni neutro; esos tonos viven en `Badge`)
//   sobre pantallas reales, sin una ruta de desarrollo, y corre axe con cada una a la vista.
// - Teclado: se marcan todos los elementos enfocables y visibles de la pantalla, se avanza con Tab y se comprueba que
//   cada uno recibe el foco (sin trampas), con un indicador de foco visible (outline o box-shadow en el elemento o en
//   un ancestro cercano, como en el sitio público).
// - Voseo: el patrón de la tarea (`\b(Revisá|...)\b`) no sirve en JavaScript: `\b` no reconoce la `á` como letra, así que
//   nunca coincide con una palabra que termina en vocal acentuada. Se usa `(?<!\p{L})...(?!\p{L})` con la bandera `u` y
//   un test comprueba que detecta "Revisá" y deja pasar "Revisa".
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pngDecodificable } from '../../packages/db/src/pruebas/imagenes';
import {
  diezBloques,
  imagenSemilla,
  limpiarArticulosE2E,
  parrafo,
  pasarAComoServicio,
  publicarComoServicio,
  sembrarArticulo,
  subirObjeto,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import { agregarBloque, esperarEditorListo, grupoDeBloque } from './ayudas/editor';
import { correoUnico, filaDelMiembro, estadoDeLaFila } from './ayudas/equipo';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { crearMiembro, eliminarPorCorreo, servicio, type MiembroDePrueba } from './ayudas/servicio';

const PREFIJO = 'e2e-ac-';
const titulo = (etiqueta: string) => nombreDePrueba(`ac-${etiqueta}`);
const ETIQUETAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const ANCHOS = [360, 768, 1024, 1440] as const;

let idDiezBloques = '';
let idTresParrafos = '';
let marcaEstados = '';
const miembros: MiembroDePrueba[] = [];
const correosInvitados: string[] = [];
let nombreInvitado = '';
let correoInvitado = '';
let nombreDesactivado = '';
let correoDesactivado = '';

test.beforeAll(async () => {
  const ruta = `pruebas-e2e/${crypto.randomUUID()}.png`;
  await subirObjeto(ruta, pngDecodificable(4, 3));
  idDiezBloques = (await sembrarArticulo({ titulo: titulo('diez'), contenido: diezBloques(imagenSemilla(ruta)) })).id;
  idTresParrafos = (
    await sembrarArticulo({
      titulo: titulo('tres'),
      contenido: [parrafo('Uno'), parrafo('Dos'), parrafo('Tres')],
    })
  ).id;

  // Un artículo en cada estado, con una marca común para filtrarlos desde la lista.
  marcaEstados = `acest${crypto.randomUUID().replaceAll('-', '').slice(0, 6)}`;
  const nombre = (estado: string) => `${PREFIJO}${marcaEstados} ${estado}`;
  await sembrarArticulo({ titulo: nombre('borrador') });
  const programado = await sembrarArticulo({ titulo: nombre('programado') });
  await pasarAComoServicio(programado.id, 'programado', new Date(Date.now() + 48 * 3_600_000));
  await publicarComoServicio((await sembrarArticulo({ titulo: nombre('publicado') })).id);
  const archivado = await publicarComoServicio((await sembrarArticulo({ titulo: nombre('archivado') })).id);
  await pasarAComoServicio(archivado.id, 'archivado');

  // Equipo: un invitado (cuenta sin confirmar) y un desactivado, además del admin y los editores del seed (activos).
  nombreInvitado = nombreDePrueba('ac-invitado');
  correoInvitado = correoUnico('ac-invitado');
  correosInvitados.push(correoInvitado);
  const { error } = await servicio().auth.admin.createUser({
    email: correoInvitado,
    email_confirm: false,
    user_metadata: { nombre: nombreInvitado },
    app_metadata: { rol: 'editor' },
  });
  if (error) throw new Error(`No se pudo crear el invitado de prueba: ${error.message}`);
  nombreDesactivado = nombreDePrueba('ac-desactivado');
  const desactivado = await crearMiembro(nombreDesactivado);
  await desactivado.desactivar();
  miembros.push(desactivado);
  correoDesactivado = desactivado.correo;
});

test.afterAll(async () => {
  await limpiarArticulosE2E(PREFIJO);
  for (const miembro of miembros.splice(0)) await miembro.eliminar();
  for (const correo of correosInvitados.splice(0)) await eliminarPorCorreo(correo);
});

// --- Ayudas ---------------------------------------------------------------------------------------------------------

type Pantalla = {
  nombre: string;
  ruta: () => string;
  /** `null`: sin sesión. */
  usuario: keyof typeof USUARIOS | null;
  listo?: (page: Page) => Promise<void>;
};

const PANTALLAS: Pantalla[] = [
  { nombre: 'el ingreso', ruta: () => '/ingreso', usuario: null },
  { nombre: 'la recuperación de contraseña', ruta: () => '/olvide-contrasena', usuario: null },
  { nombre: 'la lista de artículos', ruta: () => `/articulos?q=${PREFIJO}`, usuario: 'editor' },
  { nombre: 'un artículo nuevo', ruta: () => '/articulos/nuevo', usuario: 'editor', listo: esperarEditorListo },
  {
    nombre: 'el editor con los 10 bloques',
    ruta: () => `/articulos/${idDiezBloques}`,
    usuario: 'editor',
    listo: esperarEditorListo,
  },
  { nombre: 'la vista previa', ruta: () => `/articulos/${idDiezBloques}/vista-previa`, usuario: 'editor' },
  { nombre: 'las categorías', ruta: () => '/categorias', usuario: 'editor' },
  { nombre: 'las etiquetas', ruta: () => '/etiquetas', usuario: 'editor' },
  { nombre: 'el equipo', ruta: () => '/equipo', usuario: 'admin' },
  {
    nombre: 'el perfil',
    ruta: () => '/perfil',
    usuario: 'editor',
    listo: (page) => expect(page.locator('[data-perfil="listo"]')).toBeVisible(),
  },
];

async function abrir(page: Page, pantalla: Pantalla) {
  if (pantalla.usuario) await ingresar(page, USUARIOS[pantalla.usuario], pantalla.ruta());
  else await page.goto(pantalla.ruta());
  await page.waitForLoadState('load');
  await pantalla.listo?.(page);
}

async function violacionesDeAxe(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).exclude('nextjs-portal').analyze();
  return resultado.violations.flatMap((violacion) =>
    violacion.nodes.map(
      (nodo) =>
        `- ${violacion.id} (${violacion.impact ?? 's/impacto'}): ${violacion.help}\n` +
        `  selector: ${JSON.stringify(nodo.target)}\n` +
        `  html: ${nodo.html.slice(0, 200)}\n` +
        `  ${nodo.failureSummary?.replace(/\n/g, ' | ') ?? ''}`,
    ),
  );
}

async function esperarSinViolaciones(page: Page, donde: string) {
  const detalle = await violacionesDeAxe(page);
  expect(detalle, `violaciones de axe en ${donde}:\n${detalle.join('\n')}`).toEqual([]);
}

// --- axe, encabezados, desborde y teclado en cada pantalla -----------------------------------------------------------

for (const pantalla of PANTALLAS) {
  test.describe(`Accesibilidad de ${pantalla.nombre}`, () => {
    test(`CE-006: ${pantalla.nombre} no tiene violaciones de WCAG 2.1 AA según axe`, async ({ page }) => {
      await abrir(page, pantalla);

      await esperarSinViolaciones(page, pantalla.ruta());
    });

    test(`CE-006: ${pantalla.nombre} tiene un único h1 visible y un título de pestaña propio`, async ({ page }) => {
      await abrir(page, pantalla);

      await expect(page.locator('h1:visible')).toHaveCount(1);
      const titulo = await page.title();
      expect(titulo.trim().length).toBeGreaterThan(0);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    });

    test(`CE-006: ${pantalla.nombre} no desborda horizontalmente a 360, 768, 1024 y 1440 px`, async ({ page }) => {
      await abrir(page, pantalla);

      for (const ancho of ANCHOS) {
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.waitForTimeout(150);
        const medidas = await page.evaluate(() => ({
          desplazable: document.documentElement.scrollWidth,
          visible: document.documentElement.clientWidth,
        }));
        expect(medidas.desplazable, `${pantalla.ruta()} a ${ancho} px`).toBeLessThanOrEqual(medidas.visible);
      }
    });

    test(`RF-025: ${pantalla.nombre} se recorre completa solo con teclado, sin trampas y con foco visible`, async ({
      page,
    }) => {
      test.slow();
      await abrir(page, pantalla);

      const { esperados, visitados, trampa, sinIndicador } = await recorrerConTab(page);

      expect(esperados.length, 'la pantalla debería tener elementos enfocables').toBeGreaterThan(0);
      expect(trampa, 'el foco quedó atrapado: no volvió al inicio').toBe(false);
      expect(
        esperados.filter((e) => !visitados.includes(e)),
        'elementos que nunca recibieron el foco con Tab',
      ).toEqual([]);
      expect(sinIndicador, 'elementos enfocados sin indicador de foco visible').toEqual([]);
    });
  });
}

/**
 * Marca los elementos enfocables y visibles de la pantalla, avanza con Tab y devuelve cuáles recibieron el foco y si
 * alguno no mostró un indicador (outline o box-shadow en el elemento o en sus dos ancestros más cercanos).
 */
async function recorrerConTab(page: Page) {
  await page.waitForTimeout(500); // que React termine de hidratar antes de marcar los elementos
  const esperados = await page.evaluate(() => {
    const selector =
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const marcados: string[] = [];
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const estilo = getComputedStyle(el);
      const oculto =
        el.matches(':disabled') ||
        el.closest('[hidden], [inert], [aria-hidden="true"], nextjs-portal') !== null ||
        estilo.visibility === 'hidden' ||
        estilo.display === 'none' ||
        el.getClientRects().length === 0;
      if (oculto) return;
      const marca = `ac-${marcados.length}`;
      el.setAttribute('data-ac', marca);
      marcados.push(marca);
    });
    return marcados;
  });

  const visitados = new Set<string>();
  const sinIndicador: string[] = [];
  let trampa = false;
  // Un campo con `autofocus` (el ingreso) ya tiene el foco al abrir: cuenta como visitado y se suelta para que el
  // primer Tab empiece desde el inicio del documento.
  const inicial = await page.evaluate(() => {
    const marca = document.activeElement?.getAttribute('data-ac') ?? null;
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
    return marca;
  });
  if (inicial) visitados.add(inicial);
  // Margen amplio: los iframes (videos) y los campos con varios botones agregan paradas que no están marcadas.
  const limite = esperados.length * 2 + 30;
  for (let paso = 0; paso <= limite; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el.tagName === 'NEXTJS-PORTAL') return { salio: true as const };
      const tieneIndicador = (nodo: Element) => {
        const e = getComputedStyle(nodo);
        return (
          (e.outlineStyle !== 'none' && parseFloat(e.outlineWidth) > 0) ||
          (e.boxShadow !== 'none' && e.boxShadow !== '')
        );
      };
      let nodo: Element | null = el;
      let indicador = false;
      for (let nivel = 0; nodo && nivel < 3 && !indicador; nivel += 1, nodo = nodo.parentElement) {
        indicador = tieneIndicador(nodo);
      }
      return {
        salio: false as const,
        marca: el.getAttribute('data-ac'),
        indicador,
        // Un iframe pasa el foco a su documento y un campo de fecha resalta el segmento enfocado: el navegador los dibuja.
        propio:
          el.tagName === 'IFRAME' ||
          (el.tagName === 'INPUT' && /^(date|time|datetime-local)$/.test(el.getAttribute('type') ?? '')),
        descripcion: `${el.tagName.toLowerCase()}${el.getAttribute('type') ? `[${el.getAttribute('type')}]` : ''} #${el.id} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" en ${el.closest('[role="group"]')?.getAttribute('aria-label') ?? 'la pantalla'}`,
      };
    });
    if (foco.salio) {
      if (visitados.size === 0 && paso < 2) continue; // el primer Tab puede salir del documento antes de entrar
      break;
    }
    if (foco.marca) visitados.add(foco.marca);
    if (!foco.indicador && !foco.propio) sinIndicador.push(foco.descripcion);
    if (paso === limite) trampa = true;
    await page.waitForTimeout(30); // deja terminar la transición del anillo de foco antes de leer el estilo
  }
  return { esperados, visitados: [...visitados], trampa, sinIndicador };
}

// --- Teclado: flujos completos ----------------------------------------------------------------------------------------

/** Avanza con Tab hasta que el elemento enfocado tenga ese nombre (aria-label o texto) o ese `id`. */
async function tabHasta(page: Page, criterio: string | RegExp | { id: string }, maximo = 120) {
  for (let i = 0; i < maximo; i += 1) {
    await page.keyboard.press('Tab');
    const actual = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return { id: el?.id ?? '', nombre: (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim() };
    });
    const coincide =
      typeof criterio === 'string'
        ? actual.nombre === criterio
        : criterio instanceof RegExp
          ? criterio.test(actual.nombre)
          : actual.id === criterio.id;
    if (coincide) return;
  }
  throw new Error(`Con Tab no se llegó a ${JSON.stringify(String(criterio))} en ${maximo} pasos`);
}

test.describe('Recorridos solo con teclado (RF-025)', () => {
  test('RF-025: ingresar, abrir un artículo nuevo, escribir el título y guardarlo sin usar el mouse', async ({
    page,
  }) => {
    await page.goto('/ingreso');
    await page.keyboard.type(USUARIOS.editor.correo); // el campo Correo recibe el foco inicial
    await page.keyboard.press('Tab');
    await page.keyboard.type(USUARIOS.editor.contrasenia);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/articulos$/);
    await page.waitForLoadState('load');

    // Si la hidratación o un refresco de la ruta le quita el foco al enlace justo antes de Enter, se repite el recorrido.
    await expect(async () => {
      if (page.url().endsWith('/articulos/nuevo')) return;
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await tabHasta(page, /Nuevo artículo/);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/articulos\/nuevo$/, { timeout: 5_000 });
    }).toPass({ timeout: 40_000 }); // en desarrollo la ruta compila al primer uso
    await esperarEditorListo(page);

    const nombre = titulo('solo teclado');
    await tabHasta(page, { id: 'campo-titulo' });
    await page.keyboard.type(nombre);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(nombre);
    await tabHasta(page, 'Guardar');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
    await expect(page).toHaveURL(/\/articulos\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  });

  test('RF-025: reordenar bloques con "Bajar" y "Subir" desde el teclado, con el foco en un botón y el anuncio en voz', async ({
    page,
  }) => {
    await ingresar(page, USUARIOS.editor, `/articulos/${idTresParrafos}`);
    await esperarEditorListo(page);
    const texto = (posicion: number) => grupoDeBloque(page, posicion, 'parrafo').getByLabel('Texto', { exact: true });

    await tabHasta(page, 'Bajar bloque 1, párrafo');
    await page.keyboard.press('Enter');

    await expect(texto(1)).toHaveValue('Dos');
    await expect(texto(2)).toHaveValue('Uno');
    await expect(page.getByRole('status').filter({ hasText: 'Párrafo movido a la posición 2 de 3' })).toBeAttached();
    const focoEnBoton = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName === 'BUTTON' && el.closest('[role="group"]') !== null;
    });
    expect(focoEnBoton, 'tras mover, el foco debe quedar en un botón del bloque, no perderse en el body').toBe(true);

    await page.keyboard.press('Tab');
    await tabHasta(page, 'Subir bloque 3, párrafo');
    await page.keyboard.press('Space');
    await expect(texto(2)).toHaveValue('Tres');
    await expect(texto(3)).toHaveValue('Uno');
  });
});

// --- Variantes de Badge y de AvisoEstado a la vista ------------------------------------------------------------------

test.describe('Todas las variantes de Badge y de AvisoEstado, a la vista y revisadas con axe (CE-006)', () => {
  test('CE-006: la lista muestra Badge borrador, programado, publicado y archivado, con su palabra visible', async ({
    page,
  }) => {
    await ingresar(page, USUARIOS.editor, `/articulos?q=${encodeURIComponent(marcaEstados)}`);

    for (const estado of ['borrador', 'programado', 'publicado', 'archivado']) {
      const fila = page.getByRole('row').filter({ hasText: `${marcaEstados} ${estado}` });
      await expect(fila.getByText(new RegExp(`^${estado}$`, 'i'))).toBeVisible();
    }
    await esperarSinViolaciones(page, 'la lista con los 4 estados');
  });

  test('CE-006: el equipo muestra Badge activo, invitado y desactivado, con su palabra visible', async ({ page }) => {
    await ingresar(page, USUARIOS.admin, '/equipo');

    await expect(estadoDeLaFila(filaDelMiembro(page, USUARIOS.admin.correo))).toHaveText(/^activo$/i);
    await expect(estadoDeLaFila(filaDelMiembro(page, correoInvitado))).toHaveText(/^invitado$/i);
    await expect(estadoDeLaFila(filaDelMiembro(page, correoDesactivado))).toHaveText(/^desactivado$/i);
    await esperarSinViolaciones(page, 'el equipo con los 3 estados');
  });

  test('CE-006: AvisoEstado de error (ingreso con credenciales malas) y de éxito (perfil guardado), cada uno a la vista', async ({
    page,
  }) => {
    await page.goto('/ingreso');
    await page.getByLabel('Correo').fill(USUARIOS.editor.correo);
    await page.getByLabel('Contraseña', { exact: true }).fill('contrasenia-equivocada');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    const error = page.getByRole('alert').filter({ hasText: /incorrectos/ });
    await expect(error).toBeVisible();
    await esperarSinViolaciones(page, 'el aviso de error del ingreso');

    const miembro = await crearMiembro(nombreDePrueba('ac-aviso'));
    miembros.push(miembro);
    await ingresar(page, miembro, '/perfil');
    await expect(page.locator('[data-perfil="listo"]')).toBeVisible();
    await page.getByLabel('Biografía', { exact: true }).fill('Biografía de la prueba de accesibilidad');
    await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
    await esperarSinViolaciones(page, 'el aviso de éxito del perfil');
  });

  test('CE-006: el aviso de error del título vacío y los errores por campo de un bloque pasan axe', async ({
    page,
  }) => {
    await ingresar(page, USUARIOS.editor, '/articulos/nuevo');
    await esperarEditorListo(page);

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Escribe un título para el artículo.' })).toBeVisible();
    await esperarSinViolaciones(page, 'el editor con el aviso del título vacío');

    await page.getByLabel('Título', { exact: true }).fill(titulo('errores de bloque'));
    await agregarBloque(page, 'cta', 1);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /Revisa el bloque 1/ })).toBeVisible();
    await esperarSinViolaciones(page, 'el editor con errores en los campos de un bloque');
  });

  test('CE-006: un título vacío se señala en el propio campo (aria-invalid) y el foco va a él (rutas.md, "Campos con error")', async ({
    page,
  }) => {
    await ingresar(page, USUARIOS.editor, '/articulos/nuevo');
    await esperarEditorListo(page);

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page.getByLabel('Título', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Título', { exact: true })).toBeFocused();
  });

  test('CE-006: el diálogo de confirmación abierto pasa axe y atrapa el foco', async ({ page }) => {
    await ingresar(page, USUARIOS.admin, '/equipo');
    await page
      .getByRole('button', { name: `Desactivar ${nombreDesactivado}`, exact: true })
      .or(page.getByRole('button', { name: `Desactivar ${nombreInvitado}`, exact: true }))
      .first()
      .click();

    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await esperarSinViolaciones(page, 'la confirmación de desactivar');
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      const dentro = await page.evaluate(() => document.activeElement?.closest('[role="alertdialog"]') !== null);
      expect(dentro, 'el foco salió del diálogo').toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
  });
});

// --- Barrido de voseo -------------------------------------------------------------------------------------------------

const VOSEO =
  /(?<!\p{L})(Revisá|Elegí|Ingresá|Probá|Hablá|Tenés|Podés|Escribí|Hacé|Seleccioná|Completá|Agregá|Guardá|Confirmá|Volvé|Intentá|Esperá|Contactá|Mirá|Querés)(?!\p{L})/iu;

function archivosFuente(directorio: string): string[] {
  return readdirSync(directorio).flatMap((nombre) => {
    const ruta = join(directorio, nombre);
    if (statSync(ruta).isDirectory()) return nombre === 'node_modules' ? [] : archivosFuente(ruta);
    return /\.(ts|tsx|css)$/.test(nombre) && !/\.test\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

/** Quita los comentarios (los textos de la interfaz son literales y JSX, no comentarios). */
const sinComentarios = (codigo: string) =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test.describe('Sin voseo en los textos de la interfaz (tuteo neutro, constitución y RF-023)', () => {
  test('el patrón detecta el voseo con tilde final y deja pasar el tuteo', () => {
    for (const voseo of [
      'Revisá los campos',
      'elegí una categoría',
      'Ingresá tu correo',
      'Tenés cambios',
      'Podés volver',
    ]) {
      expect(VOSEO.test(voseo), voseo).toBe(true);
    }
    for (const tuteo of [
      'Revisa los campos',
      'Elige una categoría',
      'Ingresa tu correo',
      'Tienes cambios',
      'Puedes volver',
    ]) {
      expect(VOSEO.test(tuteo), tuteo).toBe(false);
    }
  });

  test('CE-006: ningún archivo de apps/admin/src contiene imperativos en voseo', () => {
    const raiz = join(process.cwd(), 'apps', 'admin', 'src');
    const archivos = archivosFuente(raiz);
    expect(archivos.length, 'el barrido debería leer los archivos del panel').toBeGreaterThan(50);
    const hallazgos = archivos.flatMap((archivo) =>
      sinComentarios(readFileSync(archivo, 'utf8'))
        .split('\n')
        .map((linea, i) => ({ archivo: archivo.replace(process.cwd(), ''), linea: i + 1, texto: linea.trim() }))
        .filter(({ texto }) => VOSEO.test(texto)),
    );
    expect(
      hallazgos,
      `voseo en el código:\n${hallazgos.map((h) => `${h.archivo}:${h.linea} ${h.texto}`).join('\n')}`,
    ).toEqual([]);
  });

  test('CE-006: ningún texto visible, nombre accesible ni mensaje de las pantallas contiene voseo', async ({
    page,
  }) => {
    test.slow();
    await ingresar(page, USUARIOS.admin);
    const hallazgos: string[] = [];
    for (const pantalla of PANTALLAS.filter((p) => p.usuario !== null)) {
      await page.goto(pantalla.ruta());
      await pantalla.listo?.(page);
      const textos = await page.evaluate(() => {
        const atributos = [...document.querySelectorAll('[aria-label], [title], [placeholder], [alt]')].flatMap((el) =>
          ['aria-label', 'title', 'placeholder', 'alt'].map((a) => el.getAttribute(a) ?? ''),
        );
        return [document.body.innerText, document.title, ...atributos].join('\n');
      });
      const coincidencia = VOSEO.exec(textos);
      if (coincidencia) hallazgos.push(`${pantalla.ruta()}: "${coincidencia[0]}"`);
    }
    // Pantallas públicas y mensajes de error del ingreso.
    await page.context().clearCookies();
    for (const ruta of ['/ingreso', '/olvide-contrasena', '/auth/confirmar?token_hash=inventado&type=recovery']) {
      await page.goto(ruta);
      const coincidencia = VOSEO.exec(await page.evaluate(() => document.body.innerText));
      if (coincidencia) hallazgos.push(`${ruta}: "${coincidencia[0]}"`);
    }
    expect(hallazgos).toEqual([]);
  });
});
