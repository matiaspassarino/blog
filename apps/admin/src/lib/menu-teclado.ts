'use client';

// Teclado de los menús del editor (spec 005, contracts/componentes.md): flechas, `Inicio`, `Fin`, escribir la
// primera letra (typeahead), `Tab` y `Esc`. Las funciones puras devuelven un índice, o -1 si no hay a dónde ir;
// `useDesplegable` sigue a cargo del clic afuera y del cierre al navegar.
import { useEffect, useRef, type KeyboardEvent } from 'react';

export type ItemMenu = { etiqueta: string; deshabilitado?: boolean };

const habilitado = (items: ItemMenu[], indice: number) => items[indice] !== undefined && !items[indice].deshabilitado;

/** Recorre el menú desde `actual` en el sentido `paso`, con vuelta, hasta el primer ítem habilitado (el propio incluido al final). */
function buscar(items: ItemMenu[], actual: number, paso: 1 | -1): number {
  const total = items.length;
  if (total === 0) return -1;
  const inicio = actual < 0 ? (paso === 1 ? -1 : total) : actual;
  for (let i = 1; i <= total; i++) {
    const indice = (((inicio + paso * i) % total) + total) % total;
    if (habilitado(items, indice)) return indice;
  }
  return -1;
}

export const indiceSiguiente = (items: ItemMenu[], actual: number) => buscar(items, actual, 1);
export const indiceAnterior = (items: ItemMenu[], actual: number) => buscar(items, actual, -1);
export const indicePrimero = (items: ItemMenu[]) => buscar(items, -1, 1);
export const indiceUltimo = (items: ItemMenu[]) => buscar(items, -1, -1);

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Typeahead: el siguiente ítem habilitado, después de `actual` y con vuelta, cuya etiqueta empieza con `escrito`. */
export function indicePorLetra(items: ItemMenu[], actual: number, escrito: string): number {
  const prefijo = sinTildes(escrito);
  if (!prefijo) return -1;
  const total = items.length;
  for (let i = 1; i <= total; i++) {
    const indice = ((((actual < 0 ? -1 : actual) + i) % total) + total) % total;
    if (habilitado(items, indice) && sinTildes(items[indice]?.etiqueta ?? '').startsWith(prefijo)) return indice;
  }
  return -1;
}

type Opciones = {
  items: ItemMenu[];
  abierto: boolean;
  alCerrar: () => void;
  alElegir: (indice: number) => void;
};

const PAUSA_DE_ESCRITURA_MS = 700;

/** Props de un menú de botones (`role="menu"`): el foco entra al primer ítem al abrir y se mueve con el teclado. */
export function useMenuTeclado({ items, abierto, alCerrar, alElegir }: Opciones) {
  const itemsActuales = useRef(items);
  const elementos = useRef<(HTMLElement | null)[]>([]);
  const escrito = useRef({ texto: '', hasta: 0 });

  useEffect(() => {
    itemsActuales.current = items;
  });

  useEffect(() => {
    if (!abierto) return;
    const primero = indicePrimero(itemsActuales.current);
    if (primero >= 0) elementos.current[primero]?.focus();
  }, [abierto]);

  const enfocar = (indice: number) => {
    if (indice >= 0) elementos.current[indice]?.focus();
  };

  const alTeclear = (evento: KeyboardEvent) => {
    const actual = elementos.current.findIndex((elemento) => elemento === document.activeElement);
    const mover = (indice: number) => {
      evento.preventDefault();
      enfocar(indice);
    };
    switch (evento.key) {
      case 'ArrowDown':
        return mover(indiceSiguiente(items, actual));
      case 'ArrowUp':
        return mover(indiceAnterior(items, actual));
      case 'Home':
        return mover(indicePrimero(items));
      case 'End':
        return mover(indiceUltimo(items));
      case 'Escape':
      case 'Tab':
        return alCerrar();
    }
    if (evento.key.length !== 1 || evento.ctrlKey || evento.metaKey || evento.altKey || evento.key === ' ') return;
    const ahora = Date.now();
    const texto = (ahora > escrito.current.hasta ? '' : escrito.current.texto) + evento.key;
    escrito.current = { texto, hasta: ahora + PAUSA_DE_ESCRITURA_MS };
    // La misma letra repetida avanza entre los que empiezan igual; varias letras buscan el prefijo completo.
    const repetida = [...texto].every((letra) => letra === texto[0]);
    const indice = indicePorLetra(items, actual, repetida ? texto[0]! : texto);
    if (indice >= 0) mover(indice);
  };

  return {
    propsDeContenedor: { role: 'menu' as const, onKeyDown: alTeclear },
    propsDeItem: (indice: number) => ({
      role: 'menuitem' as const,
      tabIndex: -1,
      ref: (elemento: HTMLElement | null) => {
        elementos.current[indice] = elemento;
      },
      'aria-disabled': items[indice]?.deshabilitado ? (true as const) : undefined,
      onClick: () => {
        if (habilitado(items, indice)) alElegir(indice);
      },
    }),
  };
}
