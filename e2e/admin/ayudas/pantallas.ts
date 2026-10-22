// Pantallas del panel y anchos de prueba, compartidos por los E2E de accesibilidad y de jerarquía visual
// (spec 004, T001): así no se duplican (jscpd también cuenta `e2e/`).
//
// Las rutas de la lista y del editor dependen de datos que siembra cada spec en su `beforeAll`: se publican en
// `datosDePantallas` y las pantallas los leen al abrirse.
import { expect, type Page } from '@playwright/test';
import { esperarEditorListo } from './editor';
import { ingresar, USUARIOS } from './sesion';

export const ANCHOS = [360, 768, 1024, 1440] as const;

export type Pantalla = {
  nombre: string;
  ruta: () => string;
  /** `null`: sin sesión. */
  usuario: keyof typeof USUARIOS | null;
  listo?: (page: Page) => Promise<void>;
};

/** Lo que el spec que usa `PANTALLAS` debe completar antes de abrirlas. */
export const datosDePantallas = {
  /** Prefijo de los títulos sembrados: filtra la lista (`/articulos?q=<prefijo>`). */
  prefijoLista: '',
  /** Un artículo con contenido, para el editor y la vista previa. */
  idArticulo: '',
};

export const PANTALLAS: Pantalla[] = [
  { nombre: 'el ingreso', ruta: () => '/ingreso', usuario: null },
  { nombre: 'la recuperación de contraseña', ruta: () => '/olvide-contrasena', usuario: null },
  { nombre: 'la lista de artículos', ruta: () => `/articulos?q=${datosDePantallas.prefijoLista}`, usuario: 'editor' },
  { nombre: 'un artículo nuevo', ruta: () => '/articulos/nuevo', usuario: 'editor', listo: esperarEditorListo },
  {
    nombre: 'el editor con los 10 bloques',
    ruta: () => `/articulos/${datosDePantallas.idArticulo}`,
    usuario: 'editor',
    listo: esperarEditorListo,
  },
  {
    nombre: 'la vista previa',
    ruta: () => `/articulos/${datosDePantallas.idArticulo}/vista-previa`,
    usuario: 'editor',
  },
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

/** Abre la pantalla (con su sesión, si la pide) y espera a que esté lista. */
export async function abrirPantalla(page: Page, pantalla: Pantalla) {
  if (pantalla.usuario) await ingresar(page, USUARIOS[pantalla.usuario], pantalla.ruta());
  else await page.goto(pantalla.ruta());
  await page.waitForLoadState('load');
  await pantalla.listo?.(page);
}
