import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '../componentes/ui/button';
import { EncabezadoPagina } from '../componentes/estructura/EncabezadoPagina';

export const metadata: Metadata = { title: 'No encontramos esta página' };

export default function NoEncontrada() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <EncabezadoPagina
        titulo="No encontramos esta página"
        descripcion="Puede que la dirección esté mal escrita o que ya no exista."
      />
      <Button asChild variante="secundaria" className="self-start">
        <Link href="/articulos">Ir a los artículos</Link>
      </Button>
    </main>
  );
}
