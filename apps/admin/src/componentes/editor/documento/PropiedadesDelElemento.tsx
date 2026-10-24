'use client';

// Propiedades del elemento seleccionado (contracts/componentes.md): un solo componente para la pestaña «Elemento» de
// la columna lateral (desde 1280 px) y para la hoja inferior (por debajo). Muestra el editor de campos del tipo del
// elemento; el texto de los elementos de texto se escribe en el lienzo.
import { useSyncExternalStore } from 'react';
import type { ErrorElemento } from '@blog/bloques';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/button';
import { nombreDeTipo, tipoVisibleDe } from '../anuncios';
import { EditorDeBloque } from '../bloques/EditorDeBloque';
import type { CambiosDeElemento } from '../bloques/tipos';
import { ALINEACIONES, type Alineacion } from './comandos';
import type { SeleccionDelDocumento } from './tipos';

export type AccionTabla =
  | 'fila_arriba'
  | 'fila_abajo'
  | 'columna_izquierda'
  | 'columna_derecha'
  | 'quitar_fila'
  | 'quitar_columna'
  | 'combinar'
  | 'separar'
  | 'encabezado';

type Props = {
  variante: 'lateral' | 'hoja';
  seleccion: SeleccionDelDocumento;
  /** Posición del elemento en el documento (desde 1). */
  posicion: number;
  /** Índice del elemento en el documento: forma los ids de los campos (`bloque-<indice>-<campo>`). */
  indice: number;
  errores: ErrorElemento[];
  alCambiar: (cambios: CambiosDeElemento) => void;
  /** Alinea el párrafo o el título (RF-020). */
  alAlinear?: (alineacion: Alineacion) => void;
  /** Ejecuta una acción de tabla sobre la referencia actual (RF-028). */
  alAccionTabla?: (accion: AccionTabla) => void;
  /** Solo en la hoja. */
  alCerrar?: () => void;
};

const suscribirMedia = (cb: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const mql = window.matchMedia('(min-width: 48rem)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};
const getSnapshotMedia = () => (typeof window === 'undefined' ? true : window.matchMedia('(min-width: 48rem)').matches);
const getServerSnapshotMedia = () => true;

export function PropiedadesDelElemento({
  variante,
  seleccion,
  posicion,
  indice,
  errores,
  alCambiar,
  alAlinear,
  alAccionTabla,
  alCerrar,
}: Props) {
  const anchoEscritorioTabla = useSyncExternalStore(suscribirMedia, getSnapshotMedia, getServerSnapshotMedia);
  const elementos = seleccion.tipo === 'elementos' ? seleccion.elementos : [];
  const elemento = elementos.length === 1 ? elementos[0] : undefined;
  const sinPropiedades = elemento?.type === 'horizontalRule';
  const alineacion =
    elemento?.type === 'paragraph' || elemento?.type === 'heading' ? (elemento.attrs.textAlign ?? null) : undefined;

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
      {elemento && !sinPropiedades && elemento.type !== 'paragraph' && (
        <EditorDeBloque elemento={elemento} indice={indice} errores={errores} cambiar={alCambiar} />
      )}
      {alineacion !== undefined && (
        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold">Alineación</legend>
          {ALINEACIONES.map((opcion) => (
            <label key={opcion.etiqueta} className="flex min-h-(--tactil-min) items-center gap-2">
              <input
                type="radio"
                name={`bloque-${indice}-alineacion`}
                className="size-5 accent-marca"
                checked={opcion.valor === alineacion}
                onChange={() => alAlinear?.(opcion.valor)}
              />
              {opcion.etiqueta}
            </label>
          ))}
        </fieldset>
      )}
      {elemento?.type === 'table' && (
        <section aria-label="Estructura de la tabla" className="flex flex-col gap-2">
          <h3 className="font-semibold text-sm">Estructura de la tabla</h3>
          {!anchoEscritorioTabla ? (
            <p className="text-sm text-texto-suave">
              Para cambiar filas, columnas o combinar celdas, usa una pantalla más ancha
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('encabezado')}
              >
                Fila de encabezado
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('fila_arriba')}
              >
                Insertar fila arriba
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('fila_abajo')}
              >
                Insertar fila abajo
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('columna_izquierda')}
              >
                Insertar columna a la izquierda
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('columna_derecha')}
              >
                Insertar columna a la derecha
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('quitar_fila')}
              >
                Quitar fila
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('quitar_columna')}
              >
                Quitar columna
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('combinar')}
              >
                Combinar celdas
              </Button>
              <Button
                type="button"
                variante="secundaria"
                tamanio="compacto"
                onClick={() => alAccionTabla?.('separar')}
              >
                Separar celdas
              </Button>
            </div>
          )}
        </section>
      )}
    </aside>
  );
}
