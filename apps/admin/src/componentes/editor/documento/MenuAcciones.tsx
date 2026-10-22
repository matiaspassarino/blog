'use client';

// Menú de acciones sobre el elemento activo (contracts/componentes.md): lo abren el botón «Acciones» de la barra y el
// asa. Flechas, `Inicio`, `Fin`, escritura por letra, `Tab` y `Esc` (que devuelve el foco al lienzo). «Convertir en…»
// muestra los estilos en el mismo menú.
import type { Editor } from '@tiptap/core';
import { useState } from 'react';
import { cn } from '../../../lib/cn';
import { useMenuTeclado } from '../../../lib/menu-teclado';
import {
  convertirDesdeMenu,
  ejecutarAccion,
  ESTILOS_DE_CONVERSION,
  itemsDeAcciones,
  type ContextoDeAcciones,
} from './acciones-elemento';

type Props = {
  editor: Editor;
  contexto: ContextoDeAcciones;
  /** Cierra el menú; `devolverFoco` lleva el foco al lienzo (Esc y al elegir una acción). */
  alCerrar: (devolverFoco: boolean) => void;
  className?: string;
};

export function MenuAcciones({ editor, contexto, alCerrar, className }: Props) {
  const [vista, setVista] = useState<'principal' | 'convertir'>('principal');
  // Se calculan al abrir (y al cambiar de vista): el menú se vuelve a montar cada vez que se abre.
  const [items] = useState(() => itemsDeAcciones(editor));
  const lista =
    vista === 'principal'
      ? items.map((i) => ({ etiqueta: i.etiqueta, deshabilitado: i.deshabilitado }))
      : ESTILOS_DE_CONVERSION.map((e) => ({ etiqueta: e.etiqueta }));

  const { propsDeContenedor, propsDeItem } = useMenuTeclado({
    items: lista,
    abierto: true,
    enfocarPrimero: false,
    alCerrar: () => alCerrar(true),
    alElegir: (indice) => {
      if (vista === 'convertir') {
        const estilo = ESTILOS_DE_CONVERSION[indice];
        alCerrar(false);
        if (estilo) convertirDesdeMenu(editor, estilo, contexto);
        return;
      }
      const accion = items[indice];
      if (!accion) return;
      if (accion.id === 'convertir') return setVista('convertir');
      alCerrar(false);
      ejecutarAccion(editor, accion.id, contexto);
    },
  });

  return (
    <div
      {...propsDeContenedor}
      aria-label={vista === 'principal' ? 'Acciones del elemento' : 'Convertir en'}
      className={cn(
        'absolute z-20 mt-1 flex w-60 flex-col rounded-md border border-borde bg-fondo p-1 shadow-tarjeta outline-none',
        className,
      )}
    >
      {vista === 'principal'
        ? items.map((accion, indice) => (
            <button
              key={accion.id}
              type="button"
              className="flex min-h-(--tactil-min) items-center justify-between gap-3 rounded-sm px-3 text-left hover:bg-superficie focus:bg-marca-suave aria-disabled:opacity-60"
              {...propsDeItem(indice)}
            >
              <span>{accion.etiqueta}</span>
              {accion.atajo && <span className="text-sm text-texto-suave">{accion.atajo}</span>}
            </button>
          ))
        : ESTILOS_DE_CONVERSION.map((estilo, indice) => (
            <button
              key={estilo.etiqueta}
              type="button"
              className="min-h-(--tactil-min) rounded-sm px-3 text-left hover:bg-superficie focus:bg-marca-suave"
              {...propsDeItem(indice)}
            >
              {estilo.etiqueta}
            </button>
          ))}
    </div>
  );
}
