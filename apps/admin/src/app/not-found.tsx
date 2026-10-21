import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '../componentes/ui/button';

export const metadata: Metadata = { title: 'No encontramos esta página' };

export default function NoEncontrada() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="font-titulos text-titulo-2 font-semibold">No encontramos esta página</h1>
      <p className="text-texto-suave">Puede que la dirección esté mal escrita o que ya no exista.</p>
      <Button asChild className="self-start">
        <Link href="/articulos">Ir a los artículos</Link>
      </Button>
    </main>
  );
}
