// Lista de artículos (H4): una tabla desde 768 px y tarjetas por fila debajo (componente `ui/table`). El estado
// se ve como texto además de por su forma y su color (WCAG 1.4.1).
import type { FilaArticuloPanel } from '@blog/db';
import Link from 'next/link';
import { FechaLocal } from '../FechaLocal';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

/** La fecha que importa según el estado: cuándo se publica, cuándo se publicó o la última modificación. */
function fechaRelevante(fila: FilaArticuloPanel) {
  if (fila.estado === 'programado' && fila.programado_para) return fila.programado_para;
  if (fila.estado === 'publicado' && fila.publicado_en) return fila.publicado_en;
  return fila.actualizado_en;
}

export function TablaArticulos({ filas }: { filas: FilaArticuloPanel[] }) {
  return (
    <Table role="table">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Título</TableHead>
          <TableHead scope="col">Estado</TableHead>
          <TableHead scope="col">Autor</TableHead>
          <TableHead scope="col">Categoría</TableHead>
          <TableHead scope="col">Fecha</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => (
          <TableRow key={fila.id}>
            <TableCell etiqueta="Título" className="font-semibold">
              <Link href={`/articulos/${fila.id}`} className="underline">
                {fila.titulo}
              </Link>
            </TableCell>
            <TableCell etiqueta="Estado">
              <Badge estado={fila.estado}>{fila.estado}</Badge>
            </TableCell>
            <TableCell etiqueta="Autor">{fila.autor_nombre ?? 'Sin autor'}</TableCell>
            <TableCell etiqueta="Categoría">{fila.categoria_nombre ?? 'Sin categoría'}</TableCell>
            <TableCell etiqueta="Fecha">
              <FechaLocal iso={fechaRelevante(fila)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
