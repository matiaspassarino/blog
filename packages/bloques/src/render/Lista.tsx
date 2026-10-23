import type { ElementoDe } from '../esquema';
import { CLASES_LISTA, CLASES_LISTA_NUMERADA, CLASES_LISTA_VINETAS } from './clases';
import { EnLinea } from './EnLinea';

export function Lista({ elemento }: { elemento: ElementoDe<'bulletList' | 'orderedList'> }) {
  const ordenada = elemento.type === 'orderedList';
  const Etiqueta = ordenada ? 'ol' : 'ul';
  return (
    <Etiqueta
      className={`${CLASES_LISTA} ${ordenada ? CLASES_LISTA_NUMERADA : CLASES_LISTA_VINETAS}`}
    >
      {elemento.content.map((item, i) => (
        <li key={i}>
          <EnLinea contenido={item.content[0].content} />
        </li>
      ))}
    </Etiqueta>
  );
}
