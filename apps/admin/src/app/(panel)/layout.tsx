import { puede } from '@blog/db';
import { NavegacionPanel } from '../../componentes/NavegacionPanel';
import { exigirMiembro } from '../../lib/sesion';

// Todo lo que está dentro exige un miembro activo; la autorización de cada acción se vuelve a comprobar
// en el servidor y en la base (RF-003).
export default async function LayoutPanel({ children }: LayoutProps<'/'>) {
  const miembro = await exigirMiembro();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <NavegacionPanel nombre={miembro.nombre} rol={miembro.rol} puedeVerEquipo={puede(miembro.rol, 'equipo.ver')} />
      <main id="contenido" tabIndex={-1} className="min-w-0 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
