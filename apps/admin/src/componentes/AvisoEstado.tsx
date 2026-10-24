'use client';

// Aviso de éxito, error o advertencia. No desaparece solo: se queda hasta que la persona lo cierra o aparece
// otro (WCAG 2.2.1). El error se anuncia con role="alert"; el éxito y la advertencia con role="status".
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icono } from './Icono';
import { Button } from './ui/button';

type Tipo = 'exito' | 'error' | 'advertencia';

const ESTILOS: Record<Tipo, string> = {
  exito: 'border-exito-borde bg-exito-suave text-exito',
  error: 'border-error-borde bg-error-suave text-error',
  advertencia: 'border-advertencia-borde bg-advertencia-suave text-advertencia',
};

type Props = {
  tipo: Tipo;
  children: ReactNode;
  titulo?: string;
  /** Acciones al final del aviso (por ejemplo, las del aviso de conflicto). */
  acciones?: ReactNode;
  cerrable?: boolean;
  /** Lleva el foco al aviso al aparecer: lo usan los errores de un formulario. */
  enfocar?: boolean;
};

export function AvisoEstado({ tipo, children, titulo, acciones, cerrable = true, enfocar = false }: Props) {
  const [cerrado, setCerrado] = useState(false);
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (enfocar) aviso.current?.focus();
  }, [enfocar]);
  if (cerrado) return null;

  return (
    <div
      ref={aviso}
      tabIndex={enfocar ? -1 : undefined}
      role={tipo === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-md border p-3', ESTILOS[tipo])}
    >
      <Icono nombre={tipo === 'exito' ? 'check' : 'prohibido'} className="mt-1 shrink-0" />
      <div className="flex grow flex-col gap-3">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div>{children}</div>
        {acciones && <div className="flex flex-wrap items-stretch gap-3">{acciones}</div>}
      </div>
      {cerrable && (
        <Button
          variante="terciaria"
          tamanio="compacto"
          soloIcono
          aria-label="Cerrar aviso"
          onClick={() => setCerrado(true)}
        >
          <Icono nombre="cerrar" />
        </Button>
      )}
    </div>
  );
}
