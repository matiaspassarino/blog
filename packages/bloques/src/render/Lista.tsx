import type { BloqueDe } from '../esquema';
import { CLASES_LISTA, CLASES_LISTA_NUMERADA, CLASES_LISTA_VINETAS } from './clases';
import { TextoEnLinea } from './TextoEnLinea';

export function Lista({ bloque }: { bloque: BloqueDe<'lista'> }) {
  const Etiqueta = bloque.ordenada ? 'ol' : 'ul';
  return (
    <Etiqueta
      className={`${CLASES_LISTA} ${bloque.ordenada ? CLASES_LISTA_NUMERADA : CLASES_LISTA_VINETAS}`}
    >
      {bloque.items.map((item, i) => (
        <li key={i}>
          <TextoEnLinea texto={item} />
        </li>
      ))}
    </Etiqueta>
  );
}
