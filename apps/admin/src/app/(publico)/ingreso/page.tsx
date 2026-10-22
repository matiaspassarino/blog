import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioIngreso } from '../../../componentes/acceso/FormularioIngreso';
import { obtenerMiembro } from '../../../lib/sesion';
import { rutaInterna } from '../../../lib/volver';
import { EncabezadoPagina } from '../../../componentes/estructura/EncabezadoPagina';

export const metadata: Metadata = { title: 'Ingresar' };

export default async function PaginaIngreso({ searchParams }: PageProps<'/ingreso'>) {
  const { volver, motivo } = await searchParams;
  const destino = typeof volver === 'string' ? rutaInterna(volver) : undefined;

  // Quien ya tiene la sesión abierta no vuelve a ver el formulario.
  const sesion = await obtenerMiembro();
  if (sesion.miembro) redirect(destino ?? '/articulos');

  return (
    <>
      <EncabezadoPagina titulo="Ingresar al panel" />
      <FormularioIngreso volver={destino} motivo={typeof motivo === 'string' ? motivo : undefined} />
    </>
  );
}
