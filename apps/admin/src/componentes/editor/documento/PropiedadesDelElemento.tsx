'use client';

// Propiedades del elemento seleccionado (contracts/componentes.md): un solo componente para la pestaña «Elemento» de
// la columna lateral (desde 1280 px) y para la hoja inferior (por debajo). Muestra el editor de campos del tipo del
// elemento; el texto de los elementos de texto se escribe en el lienzo.
import type { ErrorElemento } from '@blog/bloques';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/button';
import { nombreDeTipo, tipoVisibleDe } from '../anuncios';
import { EditorDeBloque } from '../bloques/EditorDeBloque';
import type { CambiosDeElemento } from '../bloques/tipos';
import type { SeleccionDelDocumento } from './tipos';

type Props = {
  variante: 'lateral' | 'hoja';
  seleccion: SeleccionDelDocumento;
  /** Posición del elemento en el documento (desde 1). */
  posicion: number;
  /** Índice del elemento en el documento: forma los ids de los campos (`bloque-<indice>-<campo>`). */
  indice: number;
  errores: ErrorElemento[];
  alCambiar: (cambios: CambiosDeElemento) => void;
  /** Solo en la hoja. */
  alCerrar?: () => void;
};

export function PropiedadesDelElemento({ variante, seleccion, posicion, indice, errores, alCambiar, alCerrar }: Props) {
  const elementos = seleccion.tipo === 'elementos' ? seleccion.elementos : [];
  const elemento = elementos.length === 1 ? elementos[0] : undefined;
  const sinPropiedades = elemento?.type === 'paragraph' || elemento?.type === 'horizontalRule';

  return (
    <aside
      aria-label={
        elemento
          ? `Propiedades del elemento ${posicion}, ${nombreDeTipo(tipoVisibleDe(elemento.type))}`
          : 'Propiedades del elemento'
      }
      data-variante={variante}
      className={cn(
        'flex flex-col gap-4 rounded-md border border-borde bg-fondo p-4',
        variante === 'hoja' && 'max-h-(--alto-hoja-propiedades) overflow-y-auto',
      )}
    >
      {variante === 'hoja' && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-titulos text-lg font-semibold">Propiedades</h2>
          <Button variante="secundaria" tamanio="compacto" onClick={alCerrar}>
            Cerrar
          </Button>
        </div>
      )}
      {elementos.length === 0 && <p className="text-texto-suave">Selecciona un elemento para editar sus propiedades</p>}
      {elementos.length > 1 && <p className="font-semibold">{elementos.length} elementos seleccionados</p>}
      {elemento && sinPropiedades && (
        <p className="text-texto-suave">Este elemento no tiene propiedades. Escribe en el documento.</p>
      )}
      {elemento && !sinPropiedades && (
        <EditorDeBloque elemento={elemento} indice={indice} errores={errores} cambiar={alCambiar} />
      )}
    </aside>
  );
}
