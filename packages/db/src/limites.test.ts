// T007 (a) (spec 003): límites de importación entre capas (constitucion.md §III.1 a §III.4). `apps/web` no
// tiene ESLint y knip no hace cumplir límites, así que este test recorre el código fuente. Sin base de datos.
//  - §III.4: `service_role` (`@blog/db/servicio`, `lib/servicio`, la clave) no llega a `apps/web`, a los
//    componentes, a las páginas ni a ningún archivo `'use client'` de `apps/admin`.
//  - §III.1: ningún paquete importa de `apps/`, y `apps/web` y `apps/admin` no se importan entre sí.
//  - §III.2: `apps/admin/src` no importa `@supabase/supabase-js` ni `@supabase/ssr` directamente.
//  - §II (spec 005, RF-021): la librería del editor (`@tiptap/*`) solo se importa desde `apps/admin`.
// Las reglas viven en funciones puras (`importaciones`, `violaciones*`) que se prueban con fixtures
// en memoria, para que un cambio en el detector no deje pasar una violación sin que nadie lo note.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const EXTENSIONES = /\.(ts|tsx|mts|js|jsx|mjs|astro)$/;
const IGNORADAS = new Set(['node_modules', '.next', '.astro', 'dist', '.vercel', '.turbo']);

type Archivo = { ruta: string; relativa: string; contenido: string };

function recorrer(directorio: string): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(directorio);
  } catch {
    return [];
  }
  return entradas.flatMap((nombre) => {
    if (IGNORADAS.has(nombre)) return [];
    const ruta = join(directorio, nombre);
    return statSync(ruta).isDirectory() ? recorrer(ruta) : [ruta];
  });
}

function leer(directorio: string, filtro: (relativa: string) => boolean = () => true): Archivo[] {
  return recorrer(join(RAIZ, directorio))
    .filter((ruta) => EXTENSIONES.test(ruta))
    .map((ruta) => ({
      ruta,
      relativa: relative(RAIZ, ruta).split(sep).join('/'),
      contenido: readFileSync(ruta, 'utf8'),
    }))
    .filter((archivo) => filtro(archivo.relativa));
}

/** Especificadores de `import … from 'x'`, `export … from 'x'`, `import('x')` y `require('x')`. */
function importaciones(contenido: string): string[] {
  const resultado: string[] = [];
  const patrones = [
    /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const patron of patrones) for (const m of contenido.matchAll(patron)) resultado.push(m[1] as string);
  return resultado;
}

const esClienteReact = (contenido: string) =>
  /^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(contenido);

/** Ruta absoluta a la que apunta un especificador relativo o con el alias `@/` (raíz `apps/admin/src`). */
function destinoDe(archivo: Archivo, especificador: string): string | null {
  if (especificador.startsWith('.')) return resolve(dirname(archivo.ruta), especificador);
  if (especificador.startsWith('@/')) return resolve(RAIZ, 'apps/admin/src', especificador.slice(2));
  return null;
}

const dentroDe = (ruta: string, carpeta: string) => {
  const base = resolve(RAIZ, carpeta);
  return ruta === base || ruta.startsWith(base + sep);
};

// --- Reglas -------------------------------------------------------------------------------------

const SECRETO_DE_SERVICIO = /@blog\/db\/servicio|lib\/servicio|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE/;

function violacionesDeServicio(archivos: Archivo[]): string[] {
  return archivos.filter((a) => SECRETO_DE_SERVICIO.test(a.contenido)).map((a) => a.relativa);
}

function violacionesDeAppsEnPaquetes(archivos: Archivo[]): string[] {
  return archivos
    .filter((a) =>
      importaciones(a.contenido).some((e) => /(^|\/)apps\//.test(e) || dentroDe(destinoDe(a, e) ?? '', 'apps')),
    )
    .map((a) => a.relativa);
}

function violacionesEntreApps(archivos: Archivo[], origen: 'apps/web' | 'apps/admin'): string[] {
  const otra = origen === 'apps/web' ? 'apps/admin' : 'apps/web';
  const nombreOtra = otra.split('/')[1] as string;
  return archivos
    .filter((a) =>
      importaciones(a.contenido).some(
        (e) =>
          e === nombreOtra ||
          e.startsWith(`${nombreOtra}/`) ||
          e.includes(otra) ||
          dentroDe(destinoDe(a, e) ?? '', otra),
      ),
    )
    .map((a) => a.relativa);
}

function violacionesDeSupabaseDirecto(archivos: Archivo[]): string[] {
  return archivos
    .filter((a) =>
      importaciones(a.contenido).some(
        (e) => e === '@supabase/supabase-js' || e === '@supabase/ssr' || e.startsWith('@supabase/ssr/'),
      ),
    )
    .map((a) => a.relativa);
}

function violacionesDeTiptap(archivos: Archivo[]): string[] {
  return archivos
    .filter((a) => importaciones(a.contenido).some((e) => e.startsWith('@tiptap/')))
    .map((a) => a.relativa);
}

// --- Detectores sobre fixtures en memoria --------------------------------------------------------

const fixture = (relativa: string, contenido: string): Archivo => ({
  ruta: resolve(RAIZ, relativa),
  relativa,
  contenido,
});

describe('detectores de límites (fixtures en memoria)', () => {
  it('§III.4: detecta cada forma de llegar a service_role', () => {
    const malos = [
      fixture('a.ts', "import { crearClienteAdmin } from '@blog/db/servicio';"),
      fixture('b.ts', "import { x } from '../lib/servicio';"),
      fixture('c.ts', 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;'),
      fixture('d.ts', 'const k = SERVICE_ROLE;'),
    ];

    expect(violacionesDeServicio(malos)).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
    expect(violacionesDeServicio([fixture('e.ts', "import { listarEquipo } from '@blog/db';")])).toEqual([]);
  });

  it('§III.1: detecta importaciones de apps/ desde un paquete', () => {
    const malos = [
      fixture('packages/x/src/a.ts', "import { y } from '../../../apps/admin/src/lib/z';"),
      fixture('packages/x/src/b.ts', "import { y } from 'apps/web/src/z';"),
    ];

    expect(violacionesDeAppsEnPaquetes(malos)).toHaveLength(2);
    expect(violacionesDeAppsEnPaquetes([fixture('packages/x/src/c.ts', "import { y } from './z';")])).toEqual([]);
  });

  it('§III.1: detecta importaciones cruzadas entre apps/web y apps/admin', () => {
    const deWeb = fixture('apps/web/src/a.ts', "import { y } from '../../admin/src/lib/z';");
    const deAdmin = fixture('apps/admin/src/a.ts', "import { y } from '../../web/src/lib/z';");

    expect(violacionesEntreApps([deWeb], 'apps/web')).toEqual(['apps/web/src/a.ts']);
    expect(violacionesEntreApps([deAdmin], 'apps/admin')).toEqual(['apps/admin/src/a.ts']);
    expect(violacionesEntreApps([fixture('apps/web/src/b.ts', "import { y } from './z';")], 'apps/web')).toEqual([]);
  });

  it('§III.2: detecta @supabase/supabase-js y @supabase/ssr directos', () => {
    const malos = [
      fixture('a.ts', "import { createClient } from '@supabase/supabase-js';"),
      fixture('b.ts', "import { createServerClient } from '@supabase/ssr';"),
    ];

    expect(violacionesDeSupabaseDirecto(malos)).toEqual(['a.ts', 'b.ts']);
    expect(
      violacionesDeSupabaseDirecto([fixture('c.ts', "import { crearClienteServidor } from '@blog/db/servidor';")]),
    ).toEqual([]);
  });

  it('RF-021: detecta importaciones de @tiptap/*', () => {
    const malos = [
      fixture('a.ts', "import { Editor } from '@tiptap/core';"),
      fixture('b.tsx', "const t = await import('@tiptap/extension-table');"),
    ];

    expect(violacionesDeTiptap(malos)).toEqual(['a.ts', 'b.tsx']);
    expect(violacionesDeTiptap([fixture('c.ts', "import { Documento } from '@blog/bloques/render';")])).toEqual([]);
  });

  it("§III.4: reconoce los archivos 'use client' (con comentarios o líneas en blanco antes)", () => {
    expect(esClienteReact("'use client';\nexport const a = 1;")).toBe(true);
    expect(esClienteReact('// nota\n\n"use client"\nexport const a = 1;')).toBe(true);
    expect(esClienteReact("export const a = 1; // 'use client'")).toBe(false);
  });
});

// --- Código real ---------------------------------------------------------------------------------

describe('límites de importación del repositorio', () => {
  const web = leer('apps/web/src');
  const admin = leer('apps/admin/src');
  const componentesAdmin = admin.filter((a) => a.relativa.startsWith('apps/admin/src/componentes/'));
  const paginasAdmin = admin.filter((a) => /^apps\/admin\/src\/app\/(?:.*\/)?page\.tsx$/.test(a.relativa));
  const clientesAdmin = admin.filter((a) => esClienteReact(a.contenido));
  const paquetes = leer(
    'packages',
    (relativa) => /^packages\/[^/]+\/src\//.test(relativa) && !relativa.endsWith('limites.test.ts'),
  );

  it('el recorrido encuentra los archivos de cada conjunto (los patrones no quedaron vacíos)', () => {
    expect(web.length).toBeGreaterThan(0);
    expect(paquetes.length).toBeGreaterThan(0);
    expect(paginasAdmin.length).toBeGreaterThan(0);
    // Quedan vacíos hasta T036/T038 (esqueleto del panel): hoy no hay componentes.
    expect(componentesAdmin.length).toBeGreaterThan(0);
  });

  it('§III.4: apps/web no usa service_role', () => {
    expect(violacionesDeServicio(web)).toEqual([]);
  });

  it('§III.2: apps/web no carga @supabase/ssr (@blog/db/servidor ni @blog/db/navegador son del panel)', () => {
    const conSsr = web.filter((a) => /@blog\/db\/(?:servidor|navegador)|@supabase\/ssr/.test(a.contenido));

    expect(conSsr.map((a) => a.relativa)).toEqual([]);
  });

  it('§III.4: los componentes del panel no usan service_role', () => {
    expect(violacionesDeServicio(componentesAdmin)).toEqual([]);
  });

  it('§III.4: las páginas (page.tsx) del panel no usan service_role', () => {
    expect(violacionesDeServicio(paginasAdmin)).toEqual([]);
  });

  it("§III.4: ningún archivo 'use client' del panel usa service_role", () => {
    expect(violacionesDeServicio(clientesAdmin)).toEqual([]);
  });

  it('§III.4: service_role solo vive en acciones/equipo.ts y lib/servicio.ts dentro de apps/admin/src', () => {
    const permitidos = new Set(['apps/admin/src/acciones/equipo.ts', 'apps/admin/src/lib/servicio.ts']);

    const fuera = violacionesDeServicio(admin).filter(
      (relativa) => !permitidos.has(relativa) && !relativa.endsWith('.test.ts'),
    );

    expect(fuera).toEqual([]);
  });

  it('§III.1: ningún archivo de packages/**/src importa de apps/', () => {
    expect(violacionesDeAppsEnPaquetes(paquetes)).toEqual([]);
  });

  it('§III.1: apps/web no importa de apps/admin', () => {
    expect(violacionesEntreApps(web, 'apps/web')).toEqual([]);
  });

  it('§III.1: apps/admin no importa de apps/web', () => {
    expect(violacionesEntreApps(admin, 'apps/admin')).toEqual([]);
  });

  it('§III.2: apps/admin/src no importa @supabase/supabase-js ni @supabase/ssr directamente', () => {
    expect(violacionesDeSupabaseDirecto(admin)).toEqual([]);
  });

  it('RF-021: apps/web y los paquetes no importan la librería del editor (@tiptap/*)', () => {
    const scripts = leer('packages', (relativa) => /^packages\/[^/]+\/scripts\//.test(relativa));

    expect(violacionesDeTiptap([...web, ...paquetes, ...scripts])).toEqual([]);
  });
});
