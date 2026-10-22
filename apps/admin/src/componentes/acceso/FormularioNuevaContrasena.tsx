'use client';

// Define la contraseña tras abrir el enlace de invitación o de recuperación. La regla se muestra
// de antemano y queda enlazada con aria-describedby (RF-028).
import { useActionState } from 'react';
import { definirContrasena } from '../../acciones/acceso';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { Button, estadoOcupado } from '../ui/button';
import { Input } from '../ui/input';

export function FormularioNuevaContrasena() {
  const [estado, accion, pendiente] = useActionState(definirContrasena, null);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {estado && !estado.ok && (
        <AvisoEstado tipo="error" enfocar cerrable={false}>
          {estado.mensaje}
        </AvisoEstado>
      )}
      <CampoFormulario etiqueta="Nueva contraseña" ayuda="Al menos 8 caracteres">
        {(atributos) => (
          <Input {...atributos} name="contrasenia" type="password" autoComplete="new-password" autoFocus required />
        )}
      </CampoFormulario>
      <CampoFormulario etiqueta="Repite la contraseña">
        {(atributos) => <Input {...atributos} name="repetir" type="password" autoComplete="new-password" required />}
      </CampoFormulario>
      <Button type="submit" variante="primaria" {...estadoOcupado(pendiente, 'Guardando…')}>
        Guardar contraseña
      </Button>
    </form>
  );
}
