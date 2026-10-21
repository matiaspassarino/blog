'use client';

// Aviso de éxito o de error. No desaparece solo: se queda hasta que la persona lo cierra o aparece
// otro (WCAG 2.2.1). El éxito se anuncia con role="status" y el error con role="alert".
import { useState } from 'react';
import { cn } from '../lib/cn';
import { Icono } from './Icono';

type Props = { tipo: 'exito' | 'error'; children: string; titulo?: string; cerrable?: boolean };

export function AvisoEstado({ tipo, children, titulo, cerrable = true }: Props) {
  const [cerrado, setCerrado] = useState(false);
  if (cerrado) return null;

  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3',
        tipo === 'error'
          ? 'border-error-borde bg-error-suave text-error'
          : 'border-exito-borde bg-exito-suave text-exito',
      )}
    >
      <Icono nombre={tipo === 'error' ? 'prohibido' : 'check'} className="mt-1 shrink-0" />
      <div className="grow">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <p>{children}</p>
      </div>
      {cerrable && (
        <button
          type="button"
          onClick={() => setCerrado(true)}
          aria-label="Cerrar aviso"
          className="inline-flex min-h-(--tactil-min) min-w-(--tactil-min) items-center justify-center rounded-md"
        >
          <Icono nombre="cerrar" />
        </button>
      )}
    </div>
  );
}
