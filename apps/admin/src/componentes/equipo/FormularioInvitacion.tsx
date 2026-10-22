'use client';

// Invitación de una persona nueva (Historia 6, RF-027): nombre, correo y rol. El servidor envía el correo; acá solo
// se muestra el resultado. Con éxito el formulario queda vacío para invitar a la siguiente.
import { useRef, useState } from 'react';
import { invitarMiembro } from '../../acciones/equipo';
import { CampoFormulario } from '../CampoFormulario';
import { Button, estadoOcupado } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { TituloSeccion } from '../estructura/TituloSeccion';

type Props = { alExito: (mensaje: string) => void; alError: (mensaje: string | null) => void };

export function FormularioInvitacion({ alExito, alError }: Props) {
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const datos = new FormData(evento.currentTarget);
    const correo = String(datos.get('correo') ?? '').trim();
    alError(null);
    setEnviando(true);
    try {
      const resultado = await invitarMiembro({
        nombre: datos.get('nombre'),
        correo,
        rol: datos.get('rol'),
      });
      if (!resultado.ok) return alError(resultado.mensaje);
      formulario.current?.reset();
      alExito(`Invitación enviada a ${correo}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      ref={formulario}
      aria-label="Invitar a una persona"
      noValidate
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-md border border-borde p-4"
    >
      <TituloSeccion>Invitar a una persona</TituloSeccion>
      <div className="grid gap-4 md:grid-cols-3">
        <CampoFormulario etiqueta="Nombre">
          {(a) => <Input {...a} name="nombre" maxLength={80} autoComplete="off" />}
        </CampoFormulario>
        <CampoFormulario etiqueta="Correo">
          {(a) => <Input {...a} name="correo" type="email" maxLength={254} autoComplete="off" />}
        </CampoFormulario>
        <CampoFormulario etiqueta="Rol">
          {(a) => (
            <Select {...a} name="rol" defaultValue="editor">
              <option value="editor">Editor</option>
              <option value="admin">Administrador</option>
            </Select>
          )}
        </CampoFormulario>
      </div>
      <Button type="submit" variante="primaria" {...estadoOcupado(enviando, 'Enviando…')} className="self-start">
        Enviar invitación
      </Button>
    </form>
  );
}
