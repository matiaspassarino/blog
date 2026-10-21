import type { Metadata } from 'next';
import Link from 'next/link';
import { FormularioRecuperacion } from '../../../componentes/acceso/FormularioRecuperacion';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function PaginaOlvideContrasena() {
  return (
    <>
      <h1 className="font-titulos text-titulo-2 font-semibold">Recuperar mi contraseña</h1>
      <p className="text-texto-suave">Escribe tu correo y te enviamos un enlace para definir una nueva contraseña.</p>
      <FormularioRecuperacion />
      <Link href="/ingreso" className="flex min-h-(--tactil-min) items-center underline">
        Volver al ingreso
      </Link>
    </>
  );
}
