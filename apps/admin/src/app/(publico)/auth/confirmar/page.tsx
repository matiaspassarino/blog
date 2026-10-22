import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfirmarEnlace } from '../../../../componentes/acceso/ConfirmarEnlace';
import { FormularioRecuperacion } from '../../../../componentes/acceso/FormularioRecuperacion';
import { EncabezadoPagina } from '../../../../componentes/estructura/EncabezadoPagina';

export const metadata: Metadata = { title: 'Confirmar enlace' };

const TIPOS = ['invite', 'recovery'] as const;

// Abrir el enlace no gasta el token: el canje ocurre al pulsar "Continuar" (research D7).
export default async function PaginaConfirmar({ searchParams }: PageProps<'/auth/confirmar'>) {
  const { token_hash: tokenHash, type } = await searchParams;
  const tipo = TIPOS.find((permitido) => permitido === type);
  const valido = typeof tokenHash === 'string' && tokenHash !== '' && tipo !== undefined;

  return (
    <>
      <EncabezadoPagina titulo={tipo === 'invite' ? 'Te invitaron al panel' : 'Define tu contraseña'} />
      {valido ? (
        <>
          <p className="text-sm text-texto-suave">Pulsa el botón para continuar y elegir tu contraseña.</p>
          <ConfirmarEnlace tokenHash={tokenHash} tipo={tipo} />
        </>
      ) : (
        <>
          <p role="alert">Este enlace ya se usó o venció.</p>
          {tipo === 'invite' ? (
            <p>Pídele a un administrador que te envíe otra invitación.</p>
          ) : (
            <>
              <p>Pide uno nuevo con tu correo.</p>
              <FormularioRecuperacion />
            </>
          )}
        </>
      )}
      <Link href="/ingreso" className="flex min-h-(--tactil-min) items-center underline">
        Ir al ingreso
      </Link>
    </>
  );
}
