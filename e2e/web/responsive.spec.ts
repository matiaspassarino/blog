// T095: sin desborde horizontal en los anchos de referencia (spec 002, CE-007, caso borde de
// galerías; constitución §VII.5).
//
// El proyecto `web` emula un Pixel 7; el ancho se cambia con `page.setViewportSize`. Además de
// `scrollWidth <= innerWidth` se compara contra el ancho configurado: en emulación móvil Chrome
// puede agrandar el viewport de layout cuando el contenido desborda, y entonces `innerWidth`
// crecería junto con el desborde y lo ocultaría. Si hay desborde, el mensaje lista los elementos
// que se salen por la derecha.
import { expect, test } from '@playwright/test';

const ANCHOS = [360, 768, 1024, 1440] as const;
const ALTO = 900;

const PAGINAS = [
  { nombre: 'la portada', ruta: '/' },
  { nombre: 'el listado del blog', ruta: '/blog' },
  { nombre: 'la guía de bloques (galería de 4 imágenes)', ruta: '/blog/guia-visual-todos-los-bloques-del-blog' },
  { nombre: 'el artículo con la galería de 2 imágenes', ruta: '/blog/dos-fotos-tambien-cuentan-una-historia' },
  { nombre: 'un autor', ruta: '/blog/autor/eva-editora' },
] as const;

for (const ancho of ANCHOS) {
  test.describe(`responsive a ${ancho} px`, () => {
    for (const { nombre, ruta } of PAGINAS) {
      test(`CE-007: ${nombre} no desborda horizontalmente a ${ancho} px`, async ({ page }) => {
        await page.setViewportSize({ width: ancho, height: ALTO });
        const respuesta = await page.goto(ruta);
        expect(respuesta?.status(), `${ruta} debería responder 200`).toBe(200);
        await page.waitForLoadState('load');

        const medida = await page.evaluate(() => {
          const anchoVisible = window.innerWidth;
          const limite = Math.min(anchoVisible, document.documentElement.clientWidth);
          const desbordados = Array.from(document.querySelectorAll('body *'))
            .filter((elemento) => {
              const caja = elemento.getBoundingClientRect();
              return caja.width > 0 && caja.right > limite + 1;
            })
            .slice(0, 10)
            .map((elemento) => {
              const caja = elemento.getBoundingClientRect();
              const clases = (elemento.getAttribute('class') ?? '').slice(0, 80);
              return `<${elemento.tagName.toLowerCase()} class="${clases}"> right=${Math.round(caja.right)} width=${Math.round(caja.width)}`;
            });
          return { scrollWidth: document.documentElement.scrollWidth, innerWidth: anchoVisible, desbordados };
        });

        const detalle = `${ruta} a ${ancho} px: scrollWidth=${medida.scrollWidth}, innerWidth=${medida.innerWidth}\n${medida.desbordados.join('\n')}`;
        expect(medida.scrollWidth, detalle).toBeLessThanOrEqual(medida.innerWidth);
        expect(medida.scrollWidth, detalle).toBeLessThanOrEqual(ancho);
      });
    }
  });
}
