import { obtenerPerfilPropio } from '@blog/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormularioPerfil } from '../../../componentes/perfil/FormularioPerfil';
import { exigirMiembro } from '../../../lib/sesion';
import { crearClienteDeSesion } from '../../../lib/supabase';

export const metadata: Metadata = { title: 'Mi perfil' };

export default async function PaginaPerfil() {
  const miembro = await exigirMiembro();
  const perfil = await obtenerPerfilPropio(await crearClienteDeSesion(), miembro.id);
  if (!perfil) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-titulos text-titulo-2 font-semibold">Mi perfil</h1>
      <FormularioPerfil perfil={perfil} />
    </div>
  );
}
