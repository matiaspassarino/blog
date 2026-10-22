// Filtros de la lista (RF-016, RF-017): un formulario GET, así la dirección conserva el filtro y se puede
// compartir o recargar. Apilados a 360 px, en dos columnas desde 768 y en una fila desde 1024.
import type { FiltrosPanel } from '@blog/db';
import Link from 'next/link';
import { aSearchParams } from '../../lib/filtros';
import { CampoFormulario } from '../CampoFormulario';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';

type Props = {
  filtros: FiltrosPanel;
  categorias: { id: string; nombre: string }[];
  autores: { id: string; nombre: string }[];
};

const ESTADOS = [
  { valor: 'borrador', texto: 'Borrador' },
  { valor: 'programado', texto: 'Programado' },
  { valor: 'publicado', texto: 'Publicado' },
  { valor: 'archivado', texto: 'Archivado' },
];

export function hayFiltros({ estado, categoria, autor, q }: FiltrosPanel) {
  return Boolean(estado || categoria || autor || q);
}

export function FiltrosArticulos({ filtros, categorias, autores }: Props) {
  return (
    <form
      // Los valores de los campos son iniciales: al cambiar los filtros por navegación se vuelve a montar.
      key={aSearchParams(filtros).toString()}
      method="get"
      action="/articulos"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
    >
      <CampoFormulario etiqueta="Estado">
        {(a) => (
          <Select {...a} name="estado" defaultValue={filtros.estado ?? ''}>
            <option value="">Todos</option>
            {ESTADOS.map(({ valor, texto }) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </Select>
        )}
      </CampoFormulario>
      <CampoFormulario etiqueta="Categoría">
        {(a) => (
          <Select {...a} name="categoria" defaultValue={filtros.categoria ?? ''}>
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </Select>
        )}
      </CampoFormulario>
      <CampoFormulario etiqueta="Autor">
        {(a) => (
          <Select {...a} name="autor" defaultValue={filtros.autor ?? ''}>
            <option value="">Todos</option>
            {autores.map((autor) => (
              <option key={autor.id} value={autor.id}>
                {autor.nombre}
              </option>
            ))}
          </Select>
        )}
      </CampoFormulario>
      <CampoFormulario etiqueta="Buscar por título">
        {(a) => <Input {...a} name="q" type="search" defaultValue={filtros.q ?? ''} maxLength={100} />}
      </CampoFormulario>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2 lg:col-span-1">
        <Button type="submit" variante="secundaria">
          Filtrar
        </Button>
        {hayFiltros(filtros) && (
          <Link href="/articulos" className="flex min-h-(--tactil-min) items-center underline">
            Quitar filtros
          </Link>
        )}
      </div>
    </form>
  );
}
