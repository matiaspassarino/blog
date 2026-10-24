import type { Metadata } from 'next';
import Link from 'next/link';
import { FormularioRecuperacion } from '../../../componentes/acceso/FormularioRecuperacion';
import { EncabezadoPagina } from '../../../componentes/estructura/EncabezadoPagina';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function PaginaOlvideContrasena() {
  return (
    <>
      <EncabezadoPagina
        titulo="Recuperar mi contraseña"
        descripcion="Escribe tu correo y te enviamos un enlace para definir una nueva contraseña."
      />
      <FormularioRecuperacion />
      <Link href="/ingreso" className="flex min-h-(--tactil-min) items-center underline">
        Volver al ingreso
      </Link>
    </>
  );
}
