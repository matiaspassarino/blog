import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfirmarEnlace } from '../../../../componentes/acceso/ConfirmarEnlace';
import { FormularioRecuperacion } from '../../../../componentes/acceso/FormularioRecuperacion';

export const metadata: Metadata = { title: 'Confirmar enlace' };

const TIPOS = ['invite', 'recovery'] as const;

// Abrir el enlace no gasta el token: el canje ocurre al pulsar "Continuar" (research D7).
export default async function PaginaConfirmar({ searchParams }: PageProps<'/auth/confirmar'>) {
  const { token_hash: tokenHash, type } = await searchParams;
  const tipo = TIPOS.find((permitido) => permitido === type);
  const valido = typeof tokenHash === 'string' && tokenHash !== '' && tipo !== undefined;

  return (
    <>
      <h1 className="font-titulos text-titulo-2 font-semibold">
        {tipo === 'invite' ? 'Te invitaron al panel' : 'Define tu contraseña'}
      </h1>
      {valido ? (
        <>
          <p className="text-texto-suave">Pulsa el botón para continuar y elegir tu contraseña.</p>
          <ConfirmarEnlace tokenHash={tokenHash} tipo={tipo} />
        </>
      ) : (
        <>
          <p role="alert">Este enlace ya se usó o venció.</p>
          <p>Pide uno nuevo con tu correo.</p>
          <FormularioRecuperacion />
        </>
      )}
      <Link href="/ingreso" className="flex min-h-(--tactil-min) items-center underline">
        Ir al ingreso
      </Link>
    </>
  );
}
