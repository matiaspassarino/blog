// Ingreso por la interfaz con los usuarios demo del seed (supabase/seed.sql). Solo para E2E.
import { expect, type Page } from '@playwright/test';

export const USUARIOS = {
  admin: { correo: 'admin@demo.local', contrasenia: 'demo-admin-2026', nombre: 'Ana Admin' },
  editora: { correo: 'editora@demo.local', contrasenia: 'demo-editora-2026', nombre: 'Eva Editora' },
  editor: { correo: 'editor@demo.local', contrasenia: 'demo-editor-2026', nombre: 'Edu Editor' },
} as const;

export type UsuarioDemo = { correo: string; contrasenia: string };

/** Ingresa por el formulario y espera llegar al panel. `volver` es la ruta interna de destino. */
export async function ingresar(page: Page, usuario: UsuarioDemo, volver = '/articulos') {
  await page.goto(`/ingreso?volver=${encodeURIComponent(volver)}`);
  await page.getByLabel('Correo').fill(usuario.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(usuario.contrasenia);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  // `volver` puede traer caracteres de expresión regular (por ejemplo "?"): se escapan antes de comparar.
  const escapada = volver.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  await expect(page).toHaveURL(new RegExp(`${escapada}$`));
}
