import { listarEquipo, puede } from '@blog/db';
import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { GestorEquipo } from '../../../componentes/equipo/GestorEquipo';
import { exigirMiembro } from '../../../lib/sesion';
import { crearClienteDeSesion } from '../../../lib/supabase';
import { EncabezadoPagina } from '../../../componentes/estructura/EncabezadoPagina';

export const metadata: Metadata = { title: 'Equipo' };

// Solo el admin: el editor recibe 403. La base lo vuelve a comprobar (`listar_equipo` exige admin).
export default async function PaginaEquipo() {
  const miembro = await exigirMiembro();
  if (!puede(miembro.rol, 'equipo.ver')) forbidden();

  const equipo = await listarEquipo(await crearClienteDeSesion());

  return (
    <div className="flex flex-col gap-panel-seccion">
      <EncabezadoPagina titulo="Equipo" />
      <GestorEquipo equipo={equipo} miembroId={miembro.id} />
    </div>
  );
}
