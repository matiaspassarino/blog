// Pantalla de categorías o etiquetas (Historia 5): lee con la sesión del miembro y delega la gestión al cliente.
import { listarTaxonomiasConConteo } from '@blog/db';
import { crearClienteDeSesion } from '../../lib/supabase';
import { GestorTaxonomias } from './GestorTaxonomias';
import { TEXTOS, type Tipo } from './textos';
import { EncabezadoPagina } from '../estructura/EncabezadoPagina';

export async function PaginaTaxonomias({ tipo }: { tipo: Tipo }) {
  const taxonomias = await listarTaxonomiasConConteo(await crearClienteDeSesion(), tipo);

  return (
    <div className="flex flex-col gap-panel-seccion">
      <EncabezadoPagina titulo={TEXTOS[tipo].titulo} />
      <GestorTaxonomias tipo={tipo} taxonomias={taxonomias} />
    </div>
  );
}
