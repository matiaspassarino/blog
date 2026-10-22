import Link from 'next/link';
import { Button } from '../ui/button';

type Props = {
  mensaje: string;
  accion?: { texto: string; href: string };
};

/** Estado vacío de una lista o tabla: el mismo formato en todo el panel (RF-014). */
export function EstadoVacio({ mensaje, accion }: Props) {
  return (
    <div data-estado="vacio" className="flex flex-col items-start gap-3 rounded-md border border-separador p-6">
      <p>{mensaje}</p>
      {accion && (
        <Button asChild variante="secundaria">
          <Link href={accion.href}>{accion.texto}</Link>
        </Button>
      )}
    </div>
  );
}
