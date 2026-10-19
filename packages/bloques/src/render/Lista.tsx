import type { BloqueDe } from '../esquema';
import { TextoEnLinea } from './TextoEnLinea';

export function Lista({ bloque }: { bloque: BloqueDe<'lista'> }) {
  const Etiqueta = bloque.ordenada ? 'ol' : 'ul';
  return (
    <Etiqueta
      className={`mt-bloque space-y-2 pl-6 text-lg leading-relaxed ${bloque.ordenada ? 'list-decimal' : 'list-disc'}`}
    >
      {bloque.items.map((item, i) => (
        <li key={i}>
          <TextoEnLinea texto={item} />
        </li>
      ))}
    </Etiqueta>
  );
}
