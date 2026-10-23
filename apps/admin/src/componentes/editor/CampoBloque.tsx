'use client';

// Campos de un bloque: cada uno lleva el id `bloque-<indice>-<campo>` (el mismo que `idDeCampo`), así el
// guardado fallido puede enfocarlo, y muestra el mensaje de `validarContenido` de su campo (RF-006).
import type { ErrorElemento } from '@blog/bloques';
import type { ReactNode } from 'react';
import { mensajeDeCampo } from '../../lib/errores-campo';
import { CampoFormulario } from '../CampoFormulario';
import { Input } from '../ui/input';
import { Select } from '../ui/select';

type Base = { indice: number; campo: string; etiqueta: string; errores: ErrorElemento[]; ayuda?: string };

export const idDeCampoDeBloque = (indice: number, campo: string) => `bloque-${indice}-${campo}`;

function CampoBloque({
  indice,
  campo,
  etiqueta,
  errores,
  ayuda,
  children,
}: Base & { children: Parameters<typeof CampoFormulario>[0]['children'] }) {
  return (
    <CampoFormulario
      etiqueta={etiqueta}
      id={idDeCampoDeBloque(indice, campo)}
      ayuda={ayuda}
      error={mensajeDeCampo(errores, campo)}
    >
      {children}
    </CampoFormulario>
  );
}

type ConValor = Base & { valor: string; alCambiar: (valor: string) => void };

export function CampoTexto({ valor, alCambiar, ...base }: ConValor & { type?: 'text' | 'url' }) {
  return (
    <CampoBloque {...base}>
      {(atributos) => <Input {...atributos} value={valor} onChange={(e) => alCambiar(e.target.value)} />}
    </CampoBloque>
  );
}


export function CampoSelect({
  valor,
  alCambiar,
  opciones,
  ...base
}: ConValor & { opciones: readonly { valor: string; texto: string }[] }): ReactNode {
  return (
    <CampoBloque {...base}>
      {(atributos) => (
        <Select {...atributos} value={valor} onChange={(e) => alCambiar(e.target.value)}>
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.texto}
            </option>
          ))}
        </Select>
      )}
    </CampoBloque>
  );
}
