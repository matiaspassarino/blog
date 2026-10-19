// Ayudas compartidas por los E2E del sitio público.
import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

/** Abre la ruta y verifica que responde 200. */
export async function abrir(page: Page, ruta: string) {
  const respuesta = await page.goto(ruta);
  expect(respuesta?.status(), `${ruta} debería responder 200`).toBe(200);
}

/** Lo que identifica a la página 404, para compararla entre casos. */
async function huellaDe404(page: Page) {
  return {
    titulo: await page.title(),
    principal: await page.getByRole('main').innerText(),
    robots: await page.locator('meta[name="robots"]').getAttribute('content'),
  };
}

/** Abre la ruta y verifica la página "no encontrado" completa (RF-016). Devuelve su huella. */
export async function esperar404(page: Page, ruta: string) {
  const respuesta = await page.goto(ruta);
  expect(respuesta?.status(), `${ruta} debería responder 404`).toBe(404);

  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeAttached();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Ir a la portada' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('main').getByRole('link', { name: 'Ver el blog' })).toHaveAttribute('href', '/blog');
  return huellaDe404(page);
}

/** Ejecuta SQL como postgres en la base local y devuelve la salida sin formato. */
function sqlComoPostgres(sql: string) {
  return execFileSync(
    'docker',
    ['exec', 'supabase_db_blog', 'psql', '-U', 'postgres', '-d', 'postgres', '-qtA', '-c', sql],
    {
      encoding: 'utf8',
    },
  ).trim();
}

/**
 * Una categoría y una etiqueta sin artículos (RSEO-009), con un nombre único por worker.
 * `crear()` las inserta y guarda sus slugs; `borrar()` las elimina. Al no tener artículos no
 * cambian ningún listado ni el sitemap de las demás suites.
 */
export function taxonomiasVacias() {
  const sufijo = crypto.randomUUID().slice(0, 8);
  const nombre = `E2E Vacía ${sufijo}`;
  const taxonomias = {
    nombre,
    slugCategoria: '',
    slugEtiqueta: '',
    crear() {
      taxonomias.slugCategoria = sqlComoPostgres(
        `insert into public.categorias (nombre, descripcion) values ('${nombre}', 'Categoría sin artículos.') returning slug`,
      );
      taxonomias.slugEtiqueta = sqlComoPostgres(
        `insert into public.etiquetas (nombre) values ('${nombre}') returning slug`,
      );
    },
    borrar() {
      sqlComoPostgres(`delete from public.categorias where nombre = '${nombre}'`);
      sqlComoPostgres(`delete from public.etiquetas where nombre = '${nombre}'`);
    },
  };
  return taxonomias;
}
