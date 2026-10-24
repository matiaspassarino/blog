'use client';

// Formulario de ingreso (H1). Foco inicial en el correo, o en el aviso cuando hay un error; ante un error
// se conserva el correo y se vacía la contraseña. El mensaje de credenciales es genérico (H1-E2).
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ingresar } from '../../acciones/acceso';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { Button, estadoOcupado } from '../ui/button';
import { Input } from '../ui/input';

const MENSAJES_DEL_FORMULARIO = {
  credenciales_invalidas: 'Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo',
  cuenta_desactivada: 'Tu cuenta está desactivada. Contacta a una persona administradora',
} as const;

const AVISOS_DE_MOTIVO = {
  desactivada: 'Tu cuenta está desactivada. Contacta a una persona administradora',
  inactividad: 'Tu sesión se cerró por inactividad. Ingresa de nuevo.',
} as const;

type Props = { volver?: string; motivo?: string };

export function FormularioIngreso({ volver, motivo }: Props) {
  const [estado, accion, pendiente] = useActionState(ingresar, null);
  const [correo, setCorreo] = useState('');
  const [verContrasenia, setVerContrasenia] = useState(false);

  const error = estado && !estado.ok ? estado : null;
  const textoError =
    error && (MENSAJES_DEL_FORMULARIO[error.codigo as keyof typeof MENSAJES_DEL_FORMULARIO] ?? error.mensaje);
  const avisoDeMotivo = motivo ? AVISOS_DE_MOTIVO[motivo as keyof typeof AVISOS_DE_MOTIVO] : undefined;

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {textoError ? (
        <AvisoEstado tipo="error" enfocar cerrable={false}>
          {textoError}
        </AvisoEstado>
      ) : (
        avisoDeMotivo && (
          <AvisoEstado tipo="error" cerrable={false}>
            {avisoDeMotivo}
          </AvisoEstado>
        )
      )}
      {volver && <input type="hidden" name="volver" value={volver} />}
      <CampoFormulario etiqueta="Correo">
        {(atributos) => (
          <Input
            {...atributos}
            name="correo"
            type="email"
            autoComplete="email"
            autoFocus={!textoError}
            required
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
          />
        )}
      </CampoFormulario>
      <CampoFormulario etiqueta="Contraseña">
        {(atributos) => (
          <Input
            {...atributos}
            name="contrasenia"
            type={verContrasenia ? 'text' : 'password'}
            autoComplete="current-password"
            required
          />
        )}
      </CampoFormulario>
      <Button
        variante="terciaria"
        tamanio="compacto"
        className="self-start"
        aria-pressed={verContrasenia}
        onClick={() => setVerContrasenia((valor) => !valor)}
      >
        Mostrar contraseña
      </Button>
      <Button type="submit" variante="primaria" {...estadoOcupado(pendiente, 'Ingresando…')}>
        Ingresar
      </Button>
      <Link href="/olvide-contrasena" className="flex min-h-(--tactil-min) items-center underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
