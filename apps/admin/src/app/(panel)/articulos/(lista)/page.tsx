import type { Metadata } from 'next';
import Link from 'next/link';
import { FiltrosArticulos, hayFiltros } from '../../../../componentes/articulo/FiltrosArticulos';
import { Paginacion } from '../../../../componentes/articulo/Paginacion';
import { TablaArticulos } from '../../../../componentes/articulo/TablaArticulos';
import { Button } from '../../../../componentes/ui/button';
import { listarArticulosDelPanel } from '../../../../consultas/articulos';
import { leerFiltros } from '../../../../lib/filtros';

export const metadata: Metadata = { title: 'Artículos' };

export default async function PaginaArticulos({ searchParams }: PageProps<'/articulos'>) {
  const filtros = leerFiltros(await searchParams);
  const { pagina, categorias, autores } = await listarArticulosDelPanel(filtros);
  const sinResultados = pagina.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titulos text-titulo-2 font-semibold">Artículos</h1>
        <Button asChild variante="primaria">
          <Link href="/articulos/nuevo">Nuevo artículo</Link>
        </Button>
      </div>

      <FiltrosArticulos filtros={filtros} categorias={categorias} autores={autores} />

      <p role="status" className="text-texto-suave">
        {pagina.total} {pagina.total === 1 ? 'artículo' : 'artículos'}
      </p>

      {sinResultados ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-separador p-6">
          <p className="font-semibold">
            No hay artículos {hayFiltros(filtros) ? 'que coincidan con los filtros' : 'todavía'}.
          </p>
          {hayFiltros(filtros) ? (
            <Link href="/articulos" className="flex min-h-(--tactil-min) items-center underline">
              Quitar filtros
            </Link>
          ) : (
            <Link href="/articulos/nuevo" className="flex min-h-(--tactil-min) items-center underline">
              Escribir el primero
            </Link>
          )}
        </div>
      ) : (
        <TablaArticulos filas={pagina.items} />
      )}

      <Paginacion filtros={filtros} pagina={pagina.pagina} totalPaginas={pagina.totalPaginas} />
    </div>
  );
}
