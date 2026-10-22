'use client';

// Carga el editor bajo demanda (la librería pesa ~140 KB comprimida y no hace falta en el resto del panel).
// Mientras llega muestra un esqueleto y, si falla (red caída), un aviso con «Reintentar».
import { useEffect, useState, type ComponentType } from 'react';
import { AvisoEstado } from '../../AvisoEstado';
import { Button } from '../../ui/button';
import type { PropsEditorDocumento } from './EditorDocumento';

export function CargadorDeEditorDocumento(props: PropsEditorDocumento) {
  const [Editor, setEditor] = useState<ComponentType<PropsEditorDocumento> | null>(null);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    import('./EditorDocumento')
      .then((modulo) => {
        if (vigente) setEditor(() => modulo.default);
      })
      .catch(() => {
        if (vigente) setFallo(true);
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  if (Editor) return <Editor key={props.reinicio} {...props} />;
  if (fallo) {
    return (
      <AvisoEstado tipo="error" cerrable={false}>
        No se pudo cargar el editor.{' '}
        <Button
          variante="secundaria"
          tamanio="compacto"
          onClick={() => {
            setFallo(false);
            setIntento((n) => n + 1);
          }}
        >
          Reintentar
        </Button>
      </AvisoEstado>
    );
  }
  return (
    <div
      role="status"
      aria-busy="true"
      className="min-h-64 animate-pulse rounded-md bg-superficie p-4 text-texto-suave"
    >
      Cargando el editor…
    </div>
  );
}
