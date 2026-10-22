import { listarEquipo, puede } from '@blog/db';
import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { GestorEquipo } from '../../../componentes/equipo/GestorEquipo';
import { exigirMiembro } from '../../../lib/sesion';
import { crearClienteDeSesion } from '../../../lib/supabase';

export const metadata: Metadata = { title: 'Equipo' };

// Solo el admin: el editor recibe 403. La base lo vuelve a comprobar (`listar_equipo` exige admin).
export default async function PaginaEquipo() {
  const miembro = await exigirMiembro();
  if (!puede(miembro.rol, 'equipo.ver')) forbidden();

  const equipo = await listarEquipo(await crearClienteDeSesion());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-titulos text-titulo-2 font-semibold">Equipo</h1>
      <GestorEquipo equipo={equipo} miembroId={miembro.id} />
    </div>
  );
}
