'use client';

import { mensajeDeCampo } from '../../../lib/errores-campo';
import { CampoSelect, idDeCampoDeBloque } from '../CampoBloque';
import { ImagenEditable } from '../ImagenEditable';
import { SelectorImagen } from '../SelectorImagen';
import type { PropsEditorBloque } from './tipos';

const COLUMNAS = [2, 3, 4].map((n) => ({ valor: String(n), texto: `${n} columnas` }));

export function EditorGaleria({ datos, indice, errores, cambiar }: PropsEditorBloque<'galeria'>) {
  const id = (campo: string) => idDeCampoDeBloque(indice, campo);

  return (
    <>
      <CampoSelect
        indice={indice}
        campo="columnas"
        etiqueta="Columnas"
        errores={errores}
        opciones={COLUMNAS}
        valor={String(datos.columnas)}
        alCambiar={(valor) => cambiar({ columnas: Number(valor) as 2 | 3 | 4 })}
      />
      {datos.imagenes.map((imagen, i) => (
        <ImagenEditable
          key={`${imagen.ruta}-${i}`}
          imagen={imagen}
          alCambiar={(nueva) =>
            cambiar({
              imagenes: nueva
                ? datos.imagenes.map((actual, otra) => (otra === i ? nueva : actual))
                : datos.imagenes.filter((_actual, otra) => otra !== i),
            })
          }
          idRuta={id(`imagenes.${i}.ruta`)}
          idAlt={id(`imagenes.${i}.alt`)}
          errorAlt={mensajeDeCampo(errores, `imagenes.${i}.alt`)}
        />
      ))}
      <SelectorImagen
        etiqueta="Agregar imagen"
        idBoton={id('imagenes')}
        error={mensajeDeCampo(errores, 'imagenes')}
        // Función: dos subidas que terminan casi juntas se suman en lugar de pisarse.
        alSubir={({ ruta, ancho, alto }) =>
          cambiar((actual) => ({
            imagenes: [...actual.imagenes, { ruta, ancho, alto, alt: '', decorativa: false }],
          }))
        }
      />
    </>
  );
}
