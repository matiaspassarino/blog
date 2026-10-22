// Markdown inline de los bloques de texto (research D9 de la spec 001): **negrita**,
// _cursiva_, `código` y [texto](url). Genera elementos React, nunca HTML: todo lo demás
// sale escapado (RF-003). Una marca sin cerrar se muestra literal. La gramática es la de
// `../en-linea` (la misma que usa el editor).
import type { ReactNode } from 'react';
import { analizarEnLinea, type NodoEnLinea } from '../en-linea';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { atributosEnlace, CLASE_ENLACE, esExterno, hrefSeguro } from './enlaces';

function pintar(nodos: NodoEnLinea[]): ReactNode[] {
  return nodos.map((nodo, i) => {
    switch (nodo.tipo) {
      case 'texto':
        return nodo.texto;
      case 'codigo':
        return <code key={i}>{nodo.texto}</code>;
      case 'negrita':
        return <strong key={i}>{pintar(nodo.hijos)}</strong>;
      case 'cursiva':
        return <em key={i}>{pintar(nodo.hijos)}</em>;
      case 'enlace': {
        const href = hrefSeguro(nodo.href);
        return href ? (
          <a key={i} {...atributosEnlace(href)} className={CLASE_ENLACE}>
            {pintar(nodo.hijos)}
            {esExterno(href) && <AvisoOtraPestania />}
          </a>
        ) : (
          <span key={i}>{pintar(nodo.hijos)}</span>
        );
      }
    }
  });
}

export function TextoEnLinea({ texto }: { texto: string }) {
  return <>{pintar(analizarEnLinea(texto))}</>;
}
