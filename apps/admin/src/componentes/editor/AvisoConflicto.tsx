'use client';

// Aviso persistente cuando otro guardado se adelantó (RF-009, D13). No es un toast: se queda hasta que la
// persona decide, recibe el foco al aparecer y lo escrito sigue intacto en el formulario.
import { useEffect, useRef } from 'react';
import { ConfirmarAccion } from '../ConfirmarAccion';
import { Button } from '../ui/button';
import { Icono } from '../Icono';

type Props = { alVerVigente: () => void; alReemplazar: () => void };

export function AvisoConflicto({ alVerVigente, alReemplazar }: Props) {
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => aviso.current?.focus(), []);

  return (
    <div
      ref={aviso}
      tabIndex={-1}
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-error-borde bg-error-suave p-4 text-error"
    >
      <p className="font-titulos text-lg font-semibold">Alguien guardó cambios más nuevos</p>
      <p>
        Tu texto sigue aquí y no se perdió, pero no se guardó para no pisar lo que escribió la otra persona. Mira la
        versión vigente y decide.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variante="secundaria" onClick={alVerVigente}>
          Ver la versión vigente
        </Button>
        <ConfirmarAccion
          titulo="¿Reemplazar con la versión vigente?"
          descripcion="Se descartarán tus cambios sin guardar en este artículo."
          etiquetaConfirmar="Reemplazar"
          variante="peligro"
          onConfirmar={alReemplazar}
        >
          <Button variante="peligro">
            <Icono nombre="prohibido" />
            Reemplazar con la vigente
          </Button>
        </ConfirmarAccion>
      </div>
    </div>
  );
}
