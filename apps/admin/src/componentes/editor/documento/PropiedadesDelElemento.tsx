'use client';

// Propiedades del elemento seleccionado (contracts/componentes.md): un solo componente para la pestaña «Elemento» de
// la columna lateral (desde 1280 px) y para la hoja inferior (por debajo). Muestra el editor de campos del tipo del
// elemento; el texto de los elementos de texto se escribe en el lienzo.
import type { ErrorBloque } from '@blog/bloques';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/button';
import { nombreDeTipo } from '../anuncios';
import { EditorDeBloque } from '../bloques/EditorDeBloque';
import type { CambiosDeBloque } from '../bloques/tipos';
import type { SeleccionDelDocumento } from './tipos';

type Props = {
  variante: 'lateral' | 'hoja';
  seleccion: SeleccionDelDocumento;
  /** Posición del elemento en el documento (desde 1). */
  posicion: number;
  /** Índice del bloque en la lista convertida: forma los ids de los campos (`bloque-<indice>-<campo>`). */
  indice: number;
  errores: ErrorBloque[];
  alCambiar: (cambios: CambiosDeBloque) => void;
  /** Solo en la hoja. */
  alCerrar?: () => void;
};

export function PropiedadesDelElemento({ variante, seleccion, posicion, indice, errores, alCambiar, alCerrar }: Props) {
  const bloques = seleccion.tipo === 'elementos' ? seleccion.bloques : [];
  const bloque = bloques.length === 1 ? bloques[0] : undefined;
  const sinPropiedades = bloque?.tipo === 'parrafo' || bloque?.tipo === 'separador';

  return (
    <aside
      aria-label={
        bloque ? `Propiedades del elemento ${posicion}, ${nombreDeTipo(bloque.tipo)}` : 'Propiedades del elemento'
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
      {bloques.length === 0 && <p className="text-texto-suave">Selecciona un elemento para editar sus propiedades</p>}
      {bloques.length > 1 && <p className="font-semibold">{bloques.length} elementos seleccionados</p>}
      {bloque && sinPropiedades && (
        <p className="text-texto-suave">Este elemento no tiene propiedades. Escribe en el documento.</p>
      )}
      {bloque && !sinPropiedades && (
        <EditorDeBloque bloque={bloque} indice={indice} errores={errores} cambiar={alCambiar} soloPropiedades />
      )}
    </aside>
  );
}
