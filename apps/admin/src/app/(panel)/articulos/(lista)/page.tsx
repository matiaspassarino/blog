import type { Metadata } from 'next';
import Link from 'next/link';
import { FiltrosArticulos, hayFiltros } from '../../../../componentes/articulo/FiltrosArticulos';
import { Paginacion } from '../../../../componentes/articulo/Paginacion';
import { TablaArticulos } from '../../../../componentes/articulo/TablaArticulos';
import { Button } from '../../../../componentes/ui/button';
import { listarArticulosDelPanel } from '../../../../consultas/articulos';
import { leerFiltros } from '../../../../lib/filtros';
import { EncabezadoPagina } from '../../../../componentes/estructura/EncabezadoPagina';
import { EstadoVacio } from '../../../../componentes/estructura/EstadoVacio';

export const metadata: Metadata = { title: 'Artículos' };

export default async function PaginaArticulos({ searchParams }: PageProps<'/articulos'>) {
  const filtros = leerFiltros(await searchParams);
  const { pagina, categorias, autores } = await listarArticulosDelPanel(filtros);
  const sinResultados = pagina.items.length === 0;

  return (
    <div className="flex flex-col gap-panel-seccion">
      <EncabezadoPagina
        titulo="Artículos"
        acciones={
          <Button asChild variante="primaria">
            <Link href="/articulos/nuevo">Nuevo artículo</Link>
          </Button>
        }
      />

      <FiltrosArticulos filtros={filtros} categorias={categorias} autores={autores} />

      <p role="status" className="text-sm text-texto-suave">
        {pagina.total} {pagina.total === 1 ? 'artículo' : 'artículos'}
      </p>

      {sinResultados ? (
        <EstadoVacio
          mensaje={`No hay artículos ${hayFiltros(filtros) ? 'que coincidan con los filtros' : 'todavía'}.`}
          accion={
            hayFiltros(filtros)
              ? { texto: 'Quitar filtros', href: '/articulos' }
              : { texto: 'Escribir el primero', href: '/articulos/nuevo' }
          }
        />
      ) : (
        <TablaArticulos filas={pagina.items} />
      )}

      <Paginacion filtros={filtros} pagina={pagina.pagina} totalPaginas={pagina.totalPaginas} />
    </div>
  );
}
