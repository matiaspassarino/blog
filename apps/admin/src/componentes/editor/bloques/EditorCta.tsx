'use client';

import { CampoTexto } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

export function EditorCta({ datos, indice, errores, cambiar }: PropsEditorBloque<'cta'>) {
  return (
    <>
      <CampoTexto
        indice={indice}
        campo="titulo"
        etiqueta="Título"
        errores={errores}
        valor={datos.titulo}
        alCambiar={(titulo) => cambiar({ titulo })}
      />
      <CampoTexto
        indice={indice}
        campo="texto"
        etiqueta="Texto"
        errores={errores}
        valor={datos.texto ?? ''}
        alCambiar={(texto) => cambiar({ texto: texto === '' ? undefined : texto })}
      />
      <CampoTexto
        indice={indice}
        campo="etiquetaBoton"
        etiqueta="Texto del botón"
        errores={errores}
        valor={datos.etiquetaBoton}
        alCambiar={(etiquetaBoton) => cambiar({ etiquetaBoton })}
      />
      <CampoTexto
        indice={indice}
        campo="url"
        etiqueta="URL"
        ayuda="Una dirección interna (/blog) o una que empiece con https://"
        errores={errores}
        valor={datos.url}
        alCambiar={(url) => cambiar({ url })}
      />
    </>
  );
}
