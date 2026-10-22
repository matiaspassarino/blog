import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioNuevaContrasena } from '../../../componentes/acceso/FormularioNuevaContrasena';
import { crearClienteDeSesion } from '../../../lib/supabase';

export const metadata: Metadata = { title: 'Definir contraseña' };

export default async function PaginaDefinirContrasena() {
  // Solo se llega con la sesión que abre el enlace del correo.
  const cliente = await crearClienteDeSesion();
  const { data } = await cliente.auth.getClaims();
  if (!data?.claims.sub) redirect('/ingreso');

  return (
    <>
      <h1 className="font-titulos text-titulo-2 font-semibold">Define tu contraseña</h1>
      <FormularioNuevaContrasena />
    </>
  );
}
