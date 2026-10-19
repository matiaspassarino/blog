// Ayudas compartidas por los E2E del sitio público (listados.spec.ts, seo.spec.ts).
import { execFileSync } from 'node:child_process';

/** Ejecuta SQL como postgres en la base local y devuelve la salida sin formato. */
export function sqlComoPostgres(sql: string) {
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
