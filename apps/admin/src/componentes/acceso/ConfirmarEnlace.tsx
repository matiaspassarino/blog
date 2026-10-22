'use client';

// Paso intermedio del enlace de un correo (research D7): abrir el enlace no gasta el token; recién
// al pulsar "Continuar" se canjea. Un enlace usado o vencido se explica y ofrece el siguiente paso.
import { useActionState } from 'react';
import { confirmarEnlace } from '../../acciones/acceso';
import { AvisoEstado } from '../AvisoEstado';
import { Button } from '../ui/button';
import { FormularioRecuperacion } from './FormularioRecuperacion';

type Props = { tokenHash: string; tipo: 'invite' | 'recovery' };

export function ConfirmarEnlace({ tokenHash, tipo }: Props) {
  const [estado, accion, pendiente] = useActionState(confirmarEnlace, null);

  if (estado && !estado.ok) {
    return (
      <div className="flex flex-col gap-4">
        <AvisoEstado tipo="error" enfocar cerrable={false}>
          {estado.mensaje}
        </AvisoEstado>
        {tipo === 'recovery' ? (
          <>
            <p>Pide uno nuevo con tu correo.</p>
            <FormularioRecuperacion />
          </>
        ) : (
          <p>Pídele a un administrador que te envíe otra invitación.</p>
        )}
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <input type="hidden" name="tipo" value={tipo} />
      <Button type="submit" aria-disabled={pendiente} disabled={pendiente} autoFocus>
        {pendiente ? 'Verificando…' : 'Continuar'}
      </Button>
    </form>
  );
}
