'use client';

import { mensajeDeCampo } from '../../../lib/errores-campo';
import { CampoTexto, idDeCampoDeBloque } from '../CampoBloque';
import { ImagenEditable } from '../ImagenEditable';
import type { PropsEditorBloque } from './tipos';

const SIN_IMAGEN = { ruta: '', ancho: 0, alto: 0, alt: '', decorativa: false };

export function EditorImagen({ datos, indice, errores, cambiar }: PropsEditorBloque<'imagen'>) {
  return (
    <>
      <ImagenEditable
        imagen={datos.imagen}
        alCambiar={(imagen) => cambiar({ imagen: imagen ?? SIN_IMAGEN })}
        idRuta={idDeCampoDeBloque(indice, 'imagen.ruta')}
        idAlt={idDeCampoDeBloque(indice, 'imagen.alt')}
        errorRuta={mensajeDeCampo(errores, 'imagen.ruta')}
        errorAlt={mensajeDeCampo(errores, 'imagen.alt')}
      />
      <CampoTexto
        indice={indice}
        campo="leyenda"
        etiqueta="Leyenda"
        errores={errores}
        valor={datos.leyenda ?? ''}
        alCambiar={(leyenda) => cambiar({ leyenda: leyenda === '' ? undefined : leyenda })}
      />
    </>
  );
}
