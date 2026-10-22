// Cierra la sesión y lleva al ingreso. Es el único lugar donde se pueden borrar las cookies cuando el
// motivo es el vencimiento o la desactivación (al renderizar no se puede; research D2 de la spec 003).
import { NextResponse, type NextRequest } from 'next/server';
import { borrarActividad } from '../../lib/cookie-actividad';
import { crearClienteDeSesion } from '../../lib/supabase';

const MOTIVOS = ['desactivada', 'inactividad', 'sesion'];

export async function GET(request: NextRequest) {
  const cliente = await crearClienteDeSesion();
  await cliente.auth.signOut();
  await borrarActividad();

  const destino = request.nextUrl.clone();
  destino.pathname = '/ingreso';
  destino.search = '';
  const motivo = request.nextUrl.searchParams.get('motivo');
  // El motivo se valida contra una lista: cualquier otro valor se descarta.
  if (motivo && MOTIVOS.includes(motivo)) destino.searchParams.set('motivo', motivo);
  return NextResponse.redirect(destino);
}
