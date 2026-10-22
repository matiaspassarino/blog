import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '../componentes/ui/button';

export const metadata: Metadata = { title: 'Sin permiso' };

// Se muestra cuando una pantalla llama a forbidden() (por ejemplo /equipo para un editor).
export default function SinPermiso() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="font-titulos text-titulo-2 font-semibold">No tienes permiso para ver esta página</h1>
      <p className="text-texto-suave">Si crees que es un error, habla con un administrador.</p>
      <Button asChild variante="secundaria" className="self-start">
        <Link href="/articulos">Ir a los artículos</Link>
      </Button>
    </main>
  );
}
