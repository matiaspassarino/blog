'use client';

// Asa flotante única (contracts/componentes.md): sigue al elemento sobre el que está el puntero o, si no, al elemento
// activo. Es solo para ratón y toque: tiene `tabindex=-1` y el camino de teclado y de lectores es el botón «Acciones» de
// la barra. Arrastrarla mueve el elemento con eventos de puntero (sirven igual con el dedo, porque el botón lleva
// `touch-action: none`); pulsarla abre el menú de acciones.
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { nombreDeTipo } from '../anuncios';
import { Icono } from '../../Icono';
import type { ContextoDeAcciones } from './acciones-elemento';
import { elementoActivo, moverElementoA, seleccionarElementos, tipoDeElemento } from './comandos';
import { MenuAcciones } from './MenuAcciones';

type Props = { editor: Editor; contexto: ContextoDeAcciones; contenedor: RefObject<HTMLElement | null> };

type Arrastre = { desde: number; indice: number; ranura: number };

/** Píxeles que hay que mover el asa para que cuente como arrastre y no como pulsación. */
const UMBRAL_DE_ARRASTRE_PX = 4;
const BORDE_DE_DESPLAZAMIENTO_PX = 72;
const PASO_DE_DESPLAZAMIENTO_PX = 14;

export function AsaDeElemento({ editor, contexto, contenedor }: Props) {
  const [sobre, setSobre] = useState<number | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [caja, setCaja] = useState<{ top: number; left: number } | null>(null);
  const inicio = useRef<{ x: number; y: number; moviendo: boolean } | null>(null);
  const venArrastre = useRef(false);
  const posicionDelPuntero = useRef({ x: 0, y: 0 });
  const activo = useEditorState({
    editor,
    selector: ({ editor: actual }) => (actual ? (elementoActivo(actual.state)?.posicion ?? null) : null),
  });
  const indice = sobre ?? (activo === null ? null : activo - 1);

  const hijos = () => {
    const filas: HTMLElement[] = [];
    editor.state.doc.forEach((_nodo, pos) => {
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) filas.push(dom);
    });
    return filas;
  };

  // El elemento sobre el que está el puntero (solo con ratón: con el dedo manda el elemento activo).
  useEffect(() => {
    const lienzo = editor.view.dom;
    const mover = (evento: globalThis.PointerEvent) => {
      if (evento.pointerType !== 'mouse' || inicio.current) return;
      const resultado = editor.view.posAtCoords({ left: evento.clientX, top: evento.clientY });
      if (!resultado) return;
      const $pos = editor.state.doc.resolve(resultado.inside >= 0 ? resultado.inside : resultado.pos);
      setSobre($pos.depth === 0 ? Math.min($pos.index(0), editor.state.doc.childCount - 1) : $pos.index(0));
    };
    const salir = (evento: globalThis.PointerEvent) => {
      const destino = evento.relatedTarget as Node | null;
      if (!destino || !contenedor.current?.contains(destino)) setSobre(null);
    };
    const raiz = contenedor.current;
    lienzo.addEventListener('pointermove', mover);
    raiz?.addEventListener('pointerleave', salir);
    return () => {
      lienzo.removeEventListener('pointermove', mover);
      raiz?.removeEventListener('pointerleave', salir);
    };
  }, [editor, contenedor]);

  // Ubicación junto al elemento: en un carril a la izquierda desde 768 px y sobre su esquina superior derecha debajo.
  // Se mide después de pintar (el documento y el elemento activo cambian con cada transacción).
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      const raiz = contenedor.current;
      const fila = indice === null ? undefined : hijos()[indice];
      if (!raiz || !fila) return setCaja(null);
      const a = raiz.getBoundingClientRect();
      const b = fila.getBoundingClientRect();
      const ancho = 44;
      const ancha = window.matchMedia('(min-width: 768px)').matches;
      const top = Math.round(b.top - a.top);
      const left = Math.round(ancha ? Math.max(b.left - a.left - ancho - 4, 0) : b.right - a.left - ancho);
      setCaja((previa) => (previa?.top === top && previa.left === left ? previa : { top, left }));
    });
    return () => cancelAnimationFrame(cuadro);
  });

  function ranuraDe(y: number) {
    const filas = hijos();
    const ranura = filas.findIndex((fila) => {
      const caja = fila.getBoundingClientRect();
      return y < caja.top + caja.height / 2;
    });
    return ranura === -1 ? filas.length : ranura;
  }

  function terminar(aplicar: boolean, evento?: PointerEvent) {
    const actual = arrastre;
    inicio.current = null;
    setArrastre(null);
    if (!aplicar || !actual || !evento) return;
    const raiz = contenedor.current?.getBoundingClientRect();
    const dentro =
      raiz &&
      evento.clientX >= raiz.left - 48 &&
      evento.clientX <= raiz.right + 48 &&
      evento.clientY >= raiz.top &&
      evento.clientY <= raiz.bottom;
    if (dentro) moverElementoA(actual.desde, actual.indice)(editor.state, (tr) => editor.view.dispatch(tr));
    editor.commands.focus();
  }

  // Desplazamiento automático cerca de los bordes de la pantalla mientras se arrastra.
  useEffect(() => {
    if (!arrastre) return;
    const paso = setInterval(() => {
      const { y } = posicionDelPuntero.current;
      if (y < BORDE_DE_DESPLAZAMIENTO_PX) window.scrollBy(0, -PASO_DE_DESPLAZAMIENTO_PX);
      else if (y > window.innerHeight - BORDE_DE_DESPLAZAMIENTO_PX) window.scrollBy(0, PASO_DE_DESPLAZAMIENTO_PX);
    }, 16);
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      evento.preventDefault();
      evento.stopPropagation();
      inicio.current = null;
      setArrastre(null);
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => {
      clearInterval(paso);
      window.removeEventListener('keydown', alTeclear, true);
    };
  }, [arrastre]);

  if (indice === null || !caja) return null;
  const nodo = editor.state.doc.maybeChild(indice);
  const tipo = nodo ? tipoDeElemento(nodo) : undefined;
  const nombre = `Acciones del elemento ${indice + 1}, ${tipo ? nombreDeTipo(tipo) : 'elemento'}`;
  const total = editor.state.doc.childCount;

  return (
    <>
      <div className="absolute z-10" style={{ top: caja.top, left: caja.left }}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={nombre}
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          className="flex size-(--tactil-min) touch-none items-center justify-center rounded-md border border-borde bg-fondo text-texto-suave hover:bg-superficie hover:text-texto"
          onPointerDown={(evento) => {
            if (evento.button !== 0) return;
            evento.currentTarget.setPointerCapture(evento.pointerId);
            posicionDelPuntero.current = { x: evento.clientX, y: evento.clientY };
            inicio.current = { x: evento.clientX, y: evento.clientY, moviendo: false };
            venArrastre.current = false;
          }}
          onPointerMove={(evento) => {
            const salida = inicio.current;
            if (!salida) return;
            posicionDelPuntero.current = { x: evento.clientX, y: evento.clientY };
            if (
              !salida.moviendo &&
              Math.hypot(evento.clientX - salida.x, evento.clientY - salida.y) < UMBRAL_DE_ARRASTRE_PX
            )
              return;
            salida.moviendo = true;
            venArrastre.current = true;
            setMenuAbierto(false);
            const ranura = ranuraDe(evento.clientY);
            const desde = arrastre?.desde ?? indice;
            setArrastre({ desde, ranura, indice: ranura > desde ? ranura - 1 : ranura });
          }}
          onPointerUp={(evento) => terminar(inicio.current?.moviendo === true, evento)}
          onPointerCancel={() => terminar(false)}
          onClick={(evento) => {
            if (venArrastre.current) {
              venArrastre.current = false;
              return;
            }
            // Mayús + clic entra al modo elementos con este elemento; un clic solo abre el menú de acciones.
            seleccionarElementos(indice, indice)(editor.state, (tr) => editor.view.dispatch(tr));
            if (!evento.shiftKey) setMenuAbierto((abierto) => !abierto);
          }}
        >
          <Icono nombre="asa" className="size-5" />
        </button>
        {menuAbierto && (
          <MenuAcciones
            editor={editor}
            contexto={contexto}
            alCerrar={(devolverFoco) => {
              setMenuAbierto(false);
              if (devolverFoco) editor.commands.focus();
            }}
            className="top-full left-0"
          />
        )}
      </div>
      {arrastre && <IndicadorDeDestino editor={editor} arrastre={arrastre} total={total} contenedor={contenedor} />}
    </>
  );
}

/** Línea de destino y el texto «Soltar aquí: posición 3 de 8» (no depende solo de la línea). */
function IndicadorDeDestino({
  editor,
  arrastre,
  total,
  contenedor,
}: {
  editor: Editor;
  arrastre: Arrastre;
  total: number;
  contenedor: RefObject<HTMLElement | null>;
}) {
  const raiz = contenedor.current?.getBoundingClientRect();
  if (!raiz) return null;
  const filas: HTMLElement[] = [];
  editor.state.doc.forEach((_nodo, pos) => {
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) filas.push(dom);
  });
  const referencia = filas[arrastre.ranura];
  const y = referencia
    ? referencia.getBoundingClientRect().top
    : (filas.at(-1)?.getBoundingClientRect().bottom ?? raiz.top);
  return (
    <div className="pointer-events-none absolute right-0 left-0 z-10" style={{ top: y - raiz.top - 2 }}>
      <div className="h-1 rounded-full bg-marca" />
      <p className="mt-1 inline-block rounded-sm bg-marca px-2 py-0.5 text-sm font-semibold text-marca-contraste">
        Soltar aquí: posición {arrastre.indice + 1} de {total}
      </p>
    </div>
  );
}
