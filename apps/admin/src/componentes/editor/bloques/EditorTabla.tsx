'use client';

// Editor de propiedades de la tabla (spec 005, RF-028; research D29 y D31 U15).
import { CampoTexto } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

export function EditorTabla({ datos, indice, errores, cambiar }: PropsEditorBloque<'table'>) {
  const tieneDescripcion = Boolean(datos.descripcion && datos.descripcion.trim().length > 0);

  return (
    <div className="flex flex-col gap-3">
      <CampoTexto
        indice={indice}
        campo="descripcion"
        etiqueta="Descripción"
        errores={errores}
        valor={datos.descripcion ?? ''}
        alCambiar={(descripcion) => cambiar({ descripcion: descripcion === '' ? undefined : descripcion })}
        ayuda="Explica brevemente de qué trata la tabla para quienes usan lectores de pantalla (máximo 150 caracteres)."
      />
      {!tieneDescripcion && (
        <p role="status" className="text-sm text-texto-suave">
          Agrega una descripción para los lectores de pantalla
        </p>
      )}
    </div>
  );
}
