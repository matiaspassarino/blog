'use client';

// Pantalla de equipo (Historia 6): invitación, avisos y tabla. Un solo aviso a la vez, de éxito (role="status")
// o de error (role="alert"); cada aviso nuevo reemplaza al anterior.
import type { FilaEquipo } from '@blog/db';
import { useState } from 'react';
import { AvisoEstado } from '../AvisoEstado';
import { FormularioInvitacion } from './FormularioInvitacion';
import { TablaEquipo } from './TablaEquipo';

type Aviso = { id: number; tipo: 'exito' | 'error'; texto: string };

export function GestorEquipo({ equipo, miembroId }: { equipo: FilaEquipo[]; miembroId: string }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // El id nuevo remonta el aviso: si se repite el mismo texto, vuelve a anunciarse y a aparecer tras cerrarlo.
  const avisar = (tipo: Aviso['tipo']) => (texto: string | null) =>
    setAviso((previo) => (texto === null ? null : { id: (previo?.id ?? 0) + 1, tipo, texto }));

  return (
    <div className="flex flex-col gap-panel-seccion">
      {aviso && (
        <AvisoEstado key={aviso.id} tipo={aviso.tipo} enfocar={aviso.tipo === 'error'}>
          {aviso.texto}
        </AvisoEstado>
      )}
      <FormularioInvitacion alExito={avisar('exito')} alError={avisar('error')} />
      <TablaEquipo equipo={equipo} miembroId={miembroId} alExito={avisar('exito')} alError={avisar('error')} />
    </div>
  );
}
