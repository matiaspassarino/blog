'use client';

// Diálogo de "Programar" (spec 004, RF-018): el campo de fecha y hora con el foco, y "Programar" como acción
// principal. Sin fecha, con fecha pasada o con rechazo de la base no se cierra: el mensaje va junto al campo.
import { useRef, useState } from 'react';
import { ahoraLocal, aIsoUtc } from '../../lib/fechas';
import { CampoFormulario } from '../CampoFormulario';
import { ConfirmarAccion } from '../ConfirmarAccion';
import { Input } from '../ui/input';

type Props = {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  onProgramar: (programadoParaIso: string) => Promise<{ ok: true } | { ok: false; mensaje: string }>;
  alCerrar: (motivo: 'confirmado' | 'cancelado') => void;
};

export function DialogoProgramar({ abierto, alCambiarAbierto, onProgramar, alCerrar }: Props) {
  // Campo sin controlar: se lee al confirmar (un datetime-local controlado no se entera de un valor asignado
  // desde fuera de React, como el autocompletado del navegador o las herramientas de prueba).
  const campo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  function rechazar(mensaje: string) {
    setError(mensaje);
    campo.current?.focus();
    return false;
  }

  async function programar() {
    const iso = aIsoUtc(campo.current?.value ?? '');
    if (!iso) return rechazar('Elige la fecha y hora de publicación.');
    const resultado = await onProgramar(iso);
    return resultado.ok ? undefined : rechazar(resultado.mensaje);
  }

  return (
    <ConfirmarAccion
      titulo="Programar la publicación"
      descripcion="El artículo se publica solo en la fecha y hora que elijas."
      etiquetaConfirmar="Programar"
      variante="primaria"
      abierto={abierto}
      alCambiarAbierto={(nuevo) => {
        if (nuevo) setError(undefined);
        alCambiarAbierto(nuevo);
      }}
      alCerrar={alCerrar}
      focoInicial={campo}
      onConfirmar={programar}
      cuerpo={
        <div className="mt-4">
          <CampoFormulario etiqueta="Fecha y hora de publicación" error={error} alerta>
            {(atributos) => <Input {...atributos} ref={campo} type="datetime-local" min={ahoraLocal()} />}
          </CampoFormulario>
        </div>
      }
    />
  );
}
