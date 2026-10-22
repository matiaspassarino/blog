import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '../componentes/ui/button';
import { EncabezadoPagina } from '../componentes/estructura/EncabezadoPagina';

export const metadata: Metadata = { title: 'Sin permiso' };

// Se muestra cuando una pantalla llama a forbidden() (por ejemplo /equipo para un editor).
export default function SinPermiso() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <EncabezadoPagina
        titulo="No tienes permiso para ver esta página"
        descripcion="Si crees que es un error, habla con un administrador."
      />
      <Button asChild variante="secundaria" className="self-start">
        <Link href="/articulos">Ir a los artículos</Link>
      </Button>
    </main>
  );
}
