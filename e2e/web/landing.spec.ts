// T068: portada (spec 002, H3-E1 a H3-E4; RF-012 a RF-015, RF-026).
// Reemplaza a humo.spec.ts.
// Los textos se copian de apps/web/src/contenido/landing.ts: ese módulo importa imágenes
// (.jpg) para astro:assets y Playwright no puede cargarlo. Si cambia el contenido de la demo,
// hay que actualizar CONTENIDO. Los enlaces de contacto sí se arman con lib/contacto.ts, que no
// tiene dependencias de Astro.
// "Los 3 publicados más recientes" se toman de las 3 primeras tarjetas de /blog, para no atar
// el test a los títulos del seed.
// H3-E3 (sin artículos publicados, la sección no aparece) lo cubre el test de componente de
// T069 (apps/web/src/components/landing/UltimosArticulos.test.ts): acá no se vacía la base.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { enlaceCorreo, enlaceWhatsapp } from '../../apps/web/src/lib/contacto';

const CONTENIDO = {
  sitio: {
    nombre: 'Estudio Demo',
    descripcion:
      'Diseñamos y desarrollamos sitios rápidos y accesibles, con un blog que posiciona tu negocio en los buscadores.',
  },
  hero: {
    titulo: 'Tu negocio, encontrado por quienes lo buscan',
    cta: 'Hablemos por WhatsApp',
    alt: 'Maqueta de un sitio web con secciones de servicios y artículos',
  },
  propuesta: { titulo: 'Un sitio que trabaja para vos' },
  servicios: {
    titulo: 'Qué hacemos',
    items: ['Estrategia digital', 'Diseño de identidad', 'Desarrollo web', 'Posicionamiento SEO'],
  },
  testimonios: {
    titulo: 'Lo que dicen nuestros clientes',
    leyenda: 'Testimonios de ejemplo',
    nombres: ['Lucía Fernández', 'Martín Gómez', 'Sofía Ramírez'],
  },
  blog: { titulo: 'Últimos artículos' },
  contacto: {
    titulo: '¿Hablamos de tu proyecto?',
    whatsapp: '5491100000000',
    mensaje: 'Hola, vi su sitio y quiero hacer una consulta.',
    correo: 'hola@estudiodemo.com',
    asunto: 'Consulta desde el sitio',
  },
};

const ENLACE_WHATSAPP = enlaceWhatsapp(CONTENIDO.contacto.whatsapp, CONTENIDO.contacto.mensaje);
const ENLACE_CORREO = enlaceCorreo(CONTENIDO.contacto.correo, CONTENIDO.contacto.asunto);

/** Abre la ruta y verifica que responde 200. */
async function abrir(page: Page, ruta: string) {
  const respuesta = await page.goto(ruta);
  expect(respuesta?.status(), `${ruta} debería responder 200`).toBe(200);
}

/** La sección (<section>) que contiene el encabezado con ese texto. */
function seccionDe(page: Page, titulo: string): Locator {
  return page
    .getByRole('main')
    .getByRole('heading', { name: titulo, exact: true })
    .locator('xpath=ancestor::section[1]');
}

/** Títulos de las tarjetas (TarjetaArticulo es un <article>) dentro del contenedor. */
function titulosDeTarjetas(contenedor: Locator) {
  return contenedor.getByRole('article').getByRole('heading').allInnerTexts();
}

test.describe('Portada', () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page, '/');
  });

  test('H3-E1: hay un único h1 y es el título del hero, con título y metadescripción del sitio', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(CONTENIDO.hero.titulo);
    await expect(page).toHaveTitle(new RegExp(CONTENIDO.sitio.nombre));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', CONTENIDO.sitio.descripcion);
  });

  test('H3-E1 / RF-012: las seis secciones aparecen en orden en el DOM', async ({ page }) => {
    const titulosEnOrden = [
      CONTENIDO.hero.titulo,
      CONTENIDO.propuesta.titulo,
      CONTENIDO.servicios.titulo,
      CONTENIDO.testimonios.titulo,
      CONTENIDO.blog.titulo,
      CONTENIDO.contacto.titulo,
    ];
    const encabezados = page.getByRole('main').locator('h1, h2');
    const textos = (await encabezados.allInnerTexts()).map((texto) => texto.trim());

    const posiciones = titulosEnOrden.map((titulo) => textos.indexOf(titulo));
    for (const [indice, titulo] of titulosEnOrden.entries()) {
      expect(posiciones[indice], `falta la sección "${titulo}"`).toBeGreaterThanOrEqual(0);
    }
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));

    // Cada sección es un bloque propio: los encabezados no comparten <section>.
    for (const titulo of titulosEnOrden.slice(1)) {
      await expect(seccionDe(page, titulo), `"${titulo}" debería estar en su <section>`).toHaveCount(1);
    }
  });

  test('H3-E1: servicios y testimonios muestran su contenido, con la leyenda "Testimonios de ejemplo"', async ({
    page,
  }) => {
    const servicios = seccionDe(page, CONTENIDO.servicios.titulo);
    for (const servicio of CONTENIDO.servicios.items) {
      await expect(servicios.getByRole('heading', { name: servicio })).toBeVisible();
    }

    const testimonios = seccionDe(page, CONTENIDO.testimonios.titulo);
    await expect(testimonios.getByText(CONTENIDO.testimonios.leyenda)).toBeVisible();
    for (const nombre of CONTENIDO.testimonios.nombres) {
      await expect(testimonios.getByText(nombre)).toBeVisible();
    }
  });

  test('H3-E2 / RF-012: muestra 3 tarjetas y son los 3 publicados más recientes de /blog', async ({ page }) => {
    await abrir(page, '/blog');
    const masRecientes = (await titulosDeTarjetas(page.getByRole('main'))).slice(0, 3);
    expect(masRecientes).toHaveLength(3);

    await abrir(page, '/');
    const ultimos = seccionDe(page, CONTENIDO.blog.titulo);
    await expect(ultimos.getByRole('article')).toHaveCount(3);
    // Nivel 3 bajo el h2 de la sección (sin saltos de encabezado, RSEO-008).
    await expect(ultimos.getByRole('article').getByRole('heading', { level: 3 })).toHaveCount(3);
    expect(await titulosDeTarjetas(ultimos)).toEqual(masRecientes);
  });

  test('H3-E4 / RF-013b: el CTA del hero, el de la cabecera y el final abren WhatsApp con el mensaje', async ({
    page,
  }) => {
    const ctaHero = page.getByRole('main').getByRole('link', { name: CONTENIDO.hero.cta });
    await expect(ctaHero.first()).toHaveAttribute('href', ENLACE_WHATSAPP);

    const ctaCabecera = page.getByRole('banner').getByRole('link', { name: /WhatsApp/ });
    await expect(ctaCabecera).toHaveAttribute('href', ENLACE_WHATSAPP);

    const contacto = page.locator('#contacto');
    await expect(contacto.getByRole('heading', { name: CONTENIDO.contacto.titulo })).toBeVisible();
    const ctaFinal = contacto.locator(`a[href^="https://wa.me/"]`);
    await expect(ctaFinal).toHaveCount(1);
    await expect(ctaFinal).toHaveAttribute('href', ENLACE_WHATSAPP);
    await expect(ctaFinal).toBeVisible();
  });

  test('H3-E4 / RF-013b: la llamada final ofrece un enlace de correo con asunto', async ({ page }) => {
    const correo = page.locator('#contacto').locator('a[href^="mailto:"]');
    await expect(correo).toHaveCount(1);
    await expect(correo).toHaveAttribute('href', ENLACE_CORREO);
    await expect(correo).toHaveAttribute('href', /\?subject=/);
    await expect(correo).toBeVisible();
  });

  test('RF-013b / RF-015: el pie muestra el número y el correo como texto y enlaza al blog y al feed', async ({
    page,
  }) => {
    const pie = page.getByRole('contentinfo');
    await expect(pie.getByText(`+${CONTENIDO.contacto.whatsapp}`)).toBeVisible();
    await expect(pie.getByText(CONTENIDO.contacto.correo)).toBeVisible();
    await expect(pie.getByRole('link', { name: 'Blog', exact: true })).toHaveAttribute('href', '/blog');
    await expect(pie.locator('a[href="/rss.xml"]')).toBeVisible();
  });

  test('RF-015: la cabecera tiene el logo y la navegación Inicio, Blog y Contacto', async ({ page }) => {
    const cabecera = page.getByRole('banner');
    const logo = cabecera.getByRole('link', { name: new RegExp(`${CONTENIDO.sitio.nombre}, ir al inicio`) });
    await expect(logo).toHaveAttribute('href', '/');
    await expect(logo.locator('img')).toBeVisible();

    const navegacion = cabecera.getByRole('navigation', { name: 'Principal' });
    await expect(navegacion.getByRole('link')).toHaveText(['Inicio', 'Blog', 'Contacto']);
    await expect(navegacion.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    await expect(navegacion.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    await expect(navegacion.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    await expect(navegacion.getByRole('link', { name: 'Contacto' })).toHaveAttribute('href', '/#contacto');
  });

  test('RF-026: la imagen del hero tiene dimensiones explícitas y carga con prioridad', async ({ page }) => {
    const imagenHero = page.getByRole('main').getByRole('img', { name: CONTENIDO.hero.alt });
    await expect(imagenHero).toBeVisible();
    await expect(imagenHero).toHaveAttribute('width', /^\d+$/);
    await expect(imagenHero).toHaveAttribute('height', /^\d+$/);
    await expect(imagenHero).toHaveAttribute('fetchpriority', 'high');
    await expect(imagenHero).not.toHaveAttribute('loading', 'lazy');
  });
});
