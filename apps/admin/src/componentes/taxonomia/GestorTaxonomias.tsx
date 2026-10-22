'use client';

// Gestión de categorías o etiquetas (Historia 5, RF-018): alta, edición en un diálogo y baja con confirmación,
// con el número de artículos de cada una. La tabla es la responsive de `ui/table` (tarjetas debajo de 768 px).
import type { TaxonomiaConConteo } from '@blog/db';
import { useState } from 'react';
import { eliminarTaxonomiaAccion } from '../../acciones/taxonomias';
import { AvisoEstado } from '../AvisoEstado';
import { ConfirmarAccion } from '../ConfirmarAccion';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DialogoEdicion } from './DialogoEdicion';
import { FormularioAlta } from './FormularioAlta';
import { TEXTOS, cuentaDeArticulos, type Tipo } from './textos';
import { Icono } from '../Icono';

type Props = { tipo: Tipo; taxonomias: TaxonomiaConConteo[] };

/** Qué pasa con los artículos al eliminar: una categoría en uso no se puede borrar; una etiqueta se quita de ellos. */
function descripcionDeBaja(tipo: Tipo, conteo: number) {
  if (tipo === 'etiqueta') return `Se quitará de ${cuentaDeArticulos(conteo)}. Los artículos no se eliminan.`;
  return conteo > 0
    ? `La usan ${cuentaDeArticulos(conteo)}: mientras tenga artículos no se puede eliminar.`
    : `La usan ${cuentaDeArticulos(0)}. Se elimina para siempre.`;
}

export function GestorTaxonomias({ tipo, taxonomias }: Props) {
  const textos = TEXTOS[tipo];
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<TaxonomiaConConteo | null>(null);

  async function eliminar(taxonomia: TaxonomiaConConteo) {
    setError(null);
    const resultado = await eliminarTaxonomiaAccion({ tipo, id: taxonomia.id });
    if (!resultado.ok) setError(resultado.mensaje);
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <AvisoEstado tipo="error" enfocar>
          {error}
        </AvisoEstado>
      )}

      <FormularioAlta tipo={tipo} alError={setError} />

      {taxonomias.length === 0 ? (
        <p className="text-texto-suave">{textos.vacio}</p>
      ) : (
        <Table role="table">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Nombre</TableHead>
              <TableHead scope="col">Slug</TableHead>
              <TableHead scope="col">Descripción</TableHead>
              <TableHead scope="col">Artículos</TableHead>
              <TableHead scope="col">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxonomias.map((taxonomia) => (
              <TableRow key={taxonomia.id}>
                <TableCell etiqueta="Nombre" className="font-semibold">
                  {taxonomia.nombre}
                </TableCell>
                <TableCell etiqueta="Slug">{taxonomia.slug}</TableCell>
                <TableCell etiqueta="Descripción">{taxonomia.descripcion ?? ''}</TableCell>
                <TableCell etiqueta="Artículos">{taxonomia.conteo}</TableCell>
                <TableCell etiqueta="Acciones" className="max-md:flex-wrap">
                  <div className="flex flex-wrap gap-2">
                    <Button variante="secundaria" tamanio="compacto" onClick={() => setEditando(taxonomia)}>
                      Editar
                      <span className="sr-only"> {taxonomia.nombre}</span>
                    </Button>
                    <ConfirmarAccion
                      titulo={`¿Eliminar ${taxonomia.nombre}?`}
                      descripcion={descripcionDeBaja(tipo, taxonomia.conteo)}
                      etiquetaConfirmar="Eliminar"
                      variante="peligro"
                      onConfirmar={() => eliminar(taxonomia)}
                    >
                      <Button variante="peligro" tamanio="compacto">
                        Eliminar
                        <span className="sr-only"> {taxonomia.nombre}</span>
                        <Icono nombre="papelera" className="order-first" />
                      </Button>
                    </ConfirmarAccion>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editando && (
        <DialogoEdicion key={editando.id} tipo={tipo} taxonomia={editando} alCerrar={() => setEditando(null)} />
      )}
    </div>
  );
}
