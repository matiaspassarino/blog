import { test } from '@playwright/test';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { entrarAlModo, esperarEditorListo, textosDelLienzo } from './ayudas/editor';
import { parrafo, sembrarArticulo } from './ayudas/articulos';

test('debug', async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
  const a = await sembrarArticulo({ titulo: 'debug-modo2', contenido: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'].map(parrafo) });
  await page.goto(`/articulos/${a.id}`);
  await esperarEditorListo(page);
  await entrarAlModo(page, 'Tres');
  await page.keyboard.press('Alt+ArrowUp');
  for (const t of [50, 300, 700]) {
    await page.waitForTimeout(t);
    console.log('estado', t, JSON.stringify(await page.getByRole('status').allTextContents()), JSON.stringify(await textosDelLienzo(page)));
  }
});
