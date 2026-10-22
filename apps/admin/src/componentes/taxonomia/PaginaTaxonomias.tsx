// Pantalla de categorías o etiquetas (Historia 5): lee con la sesión del miembro y delega la gestión al cliente.
import { listarTaxonomiasConConteo } from '@blog/db';
import { crearClienteDeSesion } from '../../lib/supabase';
import { GestorTaxonomias } from './GestorTaxonomias';
import { TEXTOS, type Tipo } from './textos';

export async function PaginaTaxonomias({ tipo }: { tipo: Tipo }) {
  const taxonomias = await listarTaxonomiasConConteo(await crearClienteDeSesion(), tipo);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-titulos text-titulo-2 font-semibold">{TEXTOS[tipo].titulo}</h1>
      <GestorTaxonomias tipo={tipo} taxonomias={taxonomias} />
    </div>
  );
}
