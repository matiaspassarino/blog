// Markdown inline de los bloques de texto (research D9 de la spec 001): **negrita**,
// _cursiva_, `código` y [texto](url). Genera elementos React, nunca HTML: todo lo demás
// sale escapado (RF-003). Una marca sin cerrar se muestra literal.
import type { ReactNode } from 'react';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { atributosEnlace, CLASE_ENLACE, esExterno, hrefSeguro } from './enlaces';

const esPalabra = (caracter: string | undefined) => caracter !== undefined && /[\p{L}\p{N}]/u.test(caracter);

/** Cierre del enlace: `)` que balancea los paréntesis abiertos dentro de la URL. */
function finDeUrl(texto: string, desde: number): number {
  let abiertos = 0;
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === '(') abiertos++;
    else if (texto[i] === ')') {
      if (abiertos === 0) return i;
      abiertos--;
    }
  }
  return -1;
}

function analizar(texto: string, prefijo: string): ReactNode[] {
  const nodos: ReactNode[] = [];
  let literal = '';
  let i = 0;
  const empujar = (nodo: ReactNode) => {
    if (literal) nodos.push(literal);
    literal = '';
    nodos.push(nodo);
  };
  const clave = () => `${prefijo}-${nodos.length}`;

  while (i < texto.length) {
    const resto = texto.slice(i);

    if (resto.startsWith('`')) {
      const fin = texto.indexOf('`', i + 1);
      if (fin > i + 1) {
        empujar(<code key={clave()}>{texto.slice(i + 1, fin)}</code>);
        i = fin + 1;
        continue;
      }
    }

    if (resto.startsWith('**')) {
      const fin = texto.indexOf('**', i + 2);
      const interior = texto.slice(i + 2, fin);
      if (fin > i + 2 && interior.trim() === interior) {
        const k = clave();
        empujar(<strong key={k}>{analizar(interior, k)}</strong>);
        i = fin + 2;
        continue;
      }
    }

    if (resto.startsWith('_') && !esPalabra(texto[i - 1])) {
      let fin = texto.indexOf('_', i + 1);
      while (fin !== -1 && esPalabra(texto[fin + 1])) fin = texto.indexOf('_', fin + 1);
      const interior = texto.slice(i + 1, fin);
      if (fin > i + 1 && interior.trim() === interior) {
        const k = clave();
        empujar(<em key={k}>{analizar(interior, k)}</em>);
        i = fin + 1;
        continue;
      }
    }

    if (resto.startsWith('[')) {
      const cierre = texto.indexOf('](', i + 1);
      const fin = cierre === -1 ? -1 : finDeUrl(texto, cierre + 2);
      if (cierre > i + 1 && fin !== -1) {
        const k = clave();
        const etiqueta = analizar(texto.slice(i + 1, cierre), k);
        const href = hrefSeguro(texto.slice(cierre + 2, fin));
        empujar(
          href ? (
            <a key={k} {...atributosEnlace(href)} className={CLASE_ENLACE}>
              {etiqueta}
              {esExterno(href) && <AvisoOtraPestania />}
            </a>
          ) : (
            <span key={k}>{etiqueta}</span>
          ),
        );
        i = fin + 1;
        continue;
      }
    }

    literal += texto[i];
    i++;
  }
  if (literal) nodos.push(literal);
  return nodos;
}

export function TextoEnLinea({ texto }: { texto: string }) {
  return <>{analizar(texto, 't')}</>;
}
