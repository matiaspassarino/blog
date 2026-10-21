'use client';

import { mensajeDeCampo } from '../../../lib/errores-campo';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { CampoTexto, idDeCampoDeBloque } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

export function EditorLista({ bloque, indice, errores, cambiar }: PropsEditorBloque<'lista'>) {
  const errorDeLista = mensajeDeCampo(errores, 'items');
  const cambiarItem = (posicion: number, valor: string) =>
    cambiar({ items: bloque.items.map((item, i) => (i === posicion ? valor : item)) });

  return (
    <>
      <label className="flex min-h-(--tactil-min) items-center gap-2">
        <Checkbox checked={bloque.ordenada} onChange={(e) => cambiar({ ordenada: e.target.checked })} />
        Lista ordenada
      </label>
      {bloque.items.map((item, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="grow">
            <CampoTexto
              indice={indice}
              campo={`items.${i}`}
              etiqueta={`Ítem ${i + 1}`}
              errores={errores}
              valor={item}
              alCambiar={(valor) => cambiarItem(i, valor)}
            />
          </div>
          <Button
            variante="secundaria"
            onClick={() => cambiar({ items: bloque.items.filter((_item, otro) => otro !== i) })}
          >
            {`Quitar ítem ${i + 1}`}
          </Button>
        </div>
      ))}
      <Button
        id={idDeCampoDeBloque(indice, 'items')}
        variante="secundaria"
        className="self-start"
        aria-invalid={errorDeLista ? true : undefined}
        onClick={() => cambiar({ items: [...bloque.items, ''] })}
      >
        Agregar ítem
      </Button>
      {errorDeLista && <p className="text-sm font-semibold text-error">{errorDeLista}</p>}
    </>
  );
}
