'use client';

// Pide el enlace para definir una nueva contraseña. Responde lo mismo exista o no el correo (RF-026):
// el texto de éxito no depende del resultado real.
import { useActionState } from 'react';
import { pedirRecuperacion } from '../../acciones/acceso';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const MENSAJE_ENVIADO = 'Si el correo pertenece al equipo, te enviamos un enlace. Revisa también la carpeta de spam';

export function FormularioRecuperacion() {
  const [estado, accion, pendiente] = useActionState(pedirRecuperacion, null);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {estado?.ok && (
        <AvisoEstado tipo="exito" enfocar cerrable={false}>
          {MENSAJE_ENVIADO}
        </AvisoEstado>
      )}
      {estado && !estado.ok && (
        <AvisoEstado tipo="error" enfocar cerrable={false}>
          {estado.mensaje}
        </AvisoEstado>
      )}
      <CampoFormulario etiqueta="Correo">
        {(atributos) => <Input {...atributos} name="correo" type="email" autoComplete="email" autoFocus required />}
      </CampoFormulario>
      <Button type="submit" aria-disabled={pendiente} disabled={pendiente}>
        {pendiente ? 'Enviando…' : 'Enviar enlace'}
      </Button>
    </form>
  );
}
