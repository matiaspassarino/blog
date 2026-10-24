'use client';

// Diálogo «Atajos de teclado» (contracts/atajos.md): el foco inicial va a su título, `Tab` queda dentro y `Esc` lo
// cierra devolviendo el foco a quien lo abrió (`alCerrar` decide a dónde).
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { Button } from '../../ui/button';
import { teclaModificadora } from './acciones-elemento';
import { atajosDeIndices } from './atajos';

type Props = { alCerrar: () => void };

export function AyudaAtajos({ alCerrar }: Props) {
  const idTitulo = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const mod = teclaModificadora();
  const indices = atajosDeIndices();
  const atajos: [string, string][] = [
    ['Negrita, cursiva, subrayado y código', `${mod} + B, ${mod} + I, ${mod} + U, ${mod} + E`],
    ...(indices ? ([['Superíndice y subíndice', 'Ctrl + . y Ctrl + ,']] as [string, string][]) : []),
    ['Enlace', `${mod} + K`],
    ['Deshacer y rehacer', `${mod} + Z, ${mod} + Shift + Z`],
    ['Insertar un elemento', '/ en una línea vacía'],
    ['Entrar al modo elementos y volver al texto', 'Esc'],
    ['Ampliar la selección a los elementos contiguos', 'Shift + ↑, Shift + ↓'],
    ['Subir o bajar los elementos seleccionados', 'Alt + ↑, Alt + ↓'],
    ['Duplicar los elementos seleccionados', `${mod} + D`],
    ['Quitar los elementos seleccionados', 'Supr o Retroceso'],
    ['Abrir las propiedades del elemento', 'Enter (en el modo elementos)'],
  ];

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      alCerrar();
    }
    if (evento.key !== 'Tab') return;
    // El foco queda dentro del diálogo.
    const enfocables = Array.from(caja.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (!primero || !ultimo) return;
    if (evento.shiftKey && document.activeElement === titulo.current) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      titulo.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-overlay p-4" onKeyDown={alTeclear}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-md border border-borde bg-fondo p-6 shadow-tarjeta"
      >
        <h2 id={idTitulo} ref={titulo} tabIndex={-1} className="font-titulos text-xl font-semibold outline-none">
          Atajos de teclado
        </h2>
        <dl className="mt-4 flex flex-col gap-3">
          {atajos.map(([accion, teclas]) => (
            <div key={accion} className="flex flex-wrap justify-between gap-x-4">
              <dt>{accion}</dt>
              <dd className="font-semibold">{teclas}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-texto-suave">
          Todo lo que se hace con un atajo también se puede hacer con los botones de la barra y el menú «Acciones».
        </p>
        <div className="mt-6 flex justify-end">
          <Button variante="secundaria" onClick={alCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
