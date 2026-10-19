// T094: accesibilidad del sitio público (spec 002, CE-006, CE-008, RSEO-008, RF-017;
// constitución §IV.7 y §VII.4).
//
// Decisiones:
// - axe se corre con las etiquetas wcag2a, wcag2aa, wcag21a y wcag21aa. axe entra a los iframes
//   (el video de la guía usa `iframe srcdoc`): las violaciones de adentro del iframe se informan
//   por separado en el mensaje (su `target` tiene más de un selector).
// - Teclado: el proyecto `web` emula un Pixel 7 (táctil), pero `page.keyboard.press('Tab')` mueve
//   el foco igual en Chromium, así que no hace falta cambiar de dispositivo.
// - Foco visible: se compara el estilo del elemento enfocado y de sus ancestros con foco y sin
//   foco (`blur()`). Hay indicador si en esa cadena cambia `outline` o `box-shadow`. Cubre el
//   patrón de las tarjetas: el enlace del título tiene `focus-visible:outline-none` y el anillo
//   (`focus-within:ring`) lo dibuja el `<article>` contenedor. Las transiciones se anulan para
//   leer el estilo final. También se miran los descendientes (el enlace del video, dentro del
//   documento srcdoc, dibuja el anillo en un hijo) y, si el foco está dentro del iframe, se
//   evalúa el elemento enfocado de ese documento.
// - Sin JS de cliente (CE-008): `astro dev` inyecta scripts propios (cliente de Vite, dev
//   toolbar y el CSS como módulo para HMR). Se excluyen los `src` que empiezan con `/@vite`,
//   `/@id/` o `/@fs/`, que terminan en `.css` o que contienen `dev-toolbar` o `astro:toolbar`, y
//   los inline cuyo texto los importa o define `window.__astro_dev_toolbar__`. El recorrido con
//   Tab termina al llegar a `<astro-dev-toolbar>`, que va al final del body. El criterio real se
//   vuelve a verificar sobre el build en el preview de Vercel (T099).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGINAS = [
  { nombre: 'la portada', ruta: '/', estado: 200 },
  { nombre: 'el listado del blog', ruta: '/blog', estado: 200 },
  { nombre: 'la guía de bloques', ruta: '/blog/guia-visual-todos-los-bloques-del-blog', estado: 200 },
  { nombre: 'una categoría', ruta: '/blog/categoria/diseno', estado: 200 },
  { nombre: 'un autor', ruta: '/blog/autor/eva-editora', estado: 200 },
  { nombre: 'la 404', ruta: '/no-existe', estado: 404 },
] as const;

const ETIQUETAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Abre la ruta y verifica el estado HTTP esperado. */
async function abrir(page: Page, ruta: string, estado: number) {
  const respuesta = await page.goto(ruta);
  expect(respuesta?.status(), `${ruta} debería responder ${estado}`).toBe(estado);
  await page.waitForLoadState('load');
}

for (const { nombre, ruta, estado } of PAGINAS) {
  test.describe(`accesibilidad de ${nombre} (${ruta})`, () => {
    test(`CE-006: ${nombre} no tiene violaciones de WCAG 2.1 AA según axe`, async ({ page }) => {
      await abrir(page, ruta, estado);

      const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();

      const detalle = resultado.violations.flatMap((violacion) =>
        violacion.nodes.map((nodo) => {
          const enIframe = nodo.target.length > 1 ? ' [DENTRO DEL IFRAME]' : '';
          return (
            `- ${violacion.id} (${violacion.impact ?? 's/impacto'})${enIframe}: ${violacion.help}\n` +
            `  selector: ${JSON.stringify(nodo.target)}\n` +
            `  html: ${nodo.html.slice(0, 200)}\n` +
            `  ${nodo.failureSummary?.replace(/\n/g, ' | ') ?? ''}`
          );
        }),
      );
      expect(detalle, `violaciones de axe en ${ruta}:\n${detalle.join('\n')}`).toEqual([]);
    });

    test(`RSEO-008: ${nombre} tiene un único h1 y no saltea niveles de encabezado`, async ({ page }) => {
      await abrir(page, ruta, estado);

      const niveles = await page.evaluate(() =>
        Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .filter((encabezado) => !encabezado.closest('[hidden], [aria-hidden="true"]'))
          .map((encabezado) => ({
            nivel: Number(encabezado.tagName.slice(1)),
            texto: (encabezado.textContent ?? '').trim().slice(0, 60),
          })),
      );

      expect(
        niveles.filter(({ nivel }) => nivel === 1),
        'debería haber exactamente un h1',
      ).toHaveLength(1);
      expect(niveles[0]?.nivel, 'el primer encabezado debería ser el h1').toBe(1);

      const saltos = niveles
        .map((actual, indice) => ({ anterior: niveles[indice - 1], actual }))
        .filter(({ anterior, actual }) => anterior && actual.nivel > anterior.nivel + 1)
        .map(({ anterior, actual }) => `h${anterior!.nivel} "${anterior!.texto}" → h${actual.nivel} "${actual.texto}"`);
      expect(saltos, `saltos de nivel en ${ruta}:\n${saltos.join('\n')}`).toEqual([]);
    });

    test(`RF-017: en ${nombre}, el primer Tab enfoca "Saltar al contenido" y lleva a #contenido`, async ({ page }) => {
      await abrir(page, ruta, estado);

      await page.keyboard.press('Tab');
      const saltar = page.getByRole('link', { name: 'Saltar al contenido' });
      await expect(saltar).toBeFocused();
      await expect(saltar).toBeVisible();
      await expect(saltar).toHaveAttribute('href', '#contenido');

      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#contenido$/);
      await expect(page.locator('#contenido')).toBeFocused();
    });

    test(`CE-006: en ${nombre}, recorrer con Tab todos los enlaces muestra un foco visible`, async ({ page }) => {
      await abrir(page, ruta, estado);
      await page.addStyleTag({
        content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
      });

      const sinFocoVisible: string[] = [];
      const recorridos: string[] = [];
      for (let paso = 0; paso < 300; paso++) {
        await page.keyboard.press('Tab');
        const resultado = await page.evaluate(() => {
          let activo = document.activeElement as HTMLElement | null;
          // Si el foco entró al iframe del video (srcdoc, mismo origen), se mira su documento.
          while (activo instanceof HTMLIFrameElement && activo.contentDocument?.activeElement) {
            const interno = activo.contentDocument.activeElement as HTMLElement;
            if (interno === activo.contentDocument.body) break;
            activo = interno;
          }
          if (!activo || activo === activo.ownerDocument.body || activo === activo.ownerDocument.documentElement) {
            return null;
          }
          // La barra de herramientas de `astro dev` va al final del body: ahí termina la página.
          if (activo.closest('astro-dev-toolbar')) return null;

          const etiqueta = activo.tagName.toLowerCase();
          const enIframe = activo.ownerDocument !== document ? ' [dentro del iframe del video]' : '';
          const descripcion = `<${etiqueta}${activo.getAttribute('href') ? ` href="${activo.getAttribute('href')}"` : ''}> "${(activo.getAttribute('aria-label') ?? activo.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)}"${enIframe}`;

          // Ancestros (para el patrón focus-within del <article>) y descendientes (el video
          // dibuja el anillo en un hijo con `a:focus-visible b`).
          const cadena: Element[] = [];
          for (
            let nodo: Element | null = activo;
            nodo && nodo !== activo.ownerDocument.body;
            nodo = nodo.parentElement
          ) {
            cadena.push(nodo);
          }
          cadena.push(...Array.from(activo.querySelectorAll('*')).slice(0, 50));
          const vista = activo.ownerDocument.defaultView ?? window;
          const estilos = () =>
            cadena.map((nodo) => {
              const estilo = vista.getComputedStyle(nodo);
              const conOutline = estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) > 0;
              return `${conOutline ? `${estilo.outlineStyle} ${estilo.outlineWidth} ${estilo.outlineColor}` : 'none'}|${estilo.boxShadow}`;
            });
          const conFoco = estilos();
          const outlinePropio = conFoco[0]!.split('|')[0] !== 'none';
          activo.blur();
          const sinFoco = estilos();
          activo.focus();
          const cambia = conFoco.some((valor, indice) => valor !== sinFoco[indice]);
          return { descripcion, visible: outlinePropio || cambia };
        });
        if (!resultado) break;
        if (recorridos.includes(resultado.descripcion) && resultado.descripcion === recorridos[0]) break;
        recorridos.push(resultado.descripcion);
        if (!resultado.visible) sinFocoVisible.push(resultado.descripcion);
      }

      expect(recorridos.length, 'el recorrido con Tab debería pasar por algún elemento').toBeGreaterThan(1);
      expect(
        sinFocoVisible,
        `elementos sin foco visible en ${ruta} (recorridos: ${recorridos.length}):\n${sinFocoVisible.join('\n')}`,
      ).toEqual([]);
    });

    test(`CE-008: ${nombre} no tiene <script> salvo JSON-LD (sin JS de cliente)`, async ({ page }) => {
      await abrir(page, ruta, estado);

      const scripts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('script')).map((script) => ({
          tipo: script.getAttribute('type') ?? '',
          src: script.getAttribute('src') ?? '',
          texto: (script.textContent ?? '').trim().slice(0, 300),
        })),
      );
      const esDelServidorDeDesarrollo = ({ src, texto }: { src: string; texto: string }) =>
        /^\/@(vite|id|fs)\//.test(src) ||
        /dev-toolbar|astro:toolbar/.test(src) ||
        /\.css(\?|$)/.test(src) ||
        /\/@vite\/client|dev-toolbar|astro:toolbar|__astro_dev_toolbar__/.test(texto);

      const prohibidos = scripts.filter(
        (script) => script.tipo !== 'application/ld+json' && !esDelServidorDeDesarrollo(script),
      );
      expect(
        prohibidos,
        `scripts de cliente en ${ruta}:\n${prohibidos.map((script) => JSON.stringify(script)).join('\n')}`,
      ).toEqual([]);
    });
  });
}
