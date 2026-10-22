'use client';

// Lista de bloques del editor (RF-005, T059): agregar, subir, bajar, duplicar y quitar sin arrastrar. Cada
// bloque es un grupo con nombre ("Bloque 2: párrafo"); los botones llevan acción, posición y tipo. Los
// extremos usan aria-disabled para no perder el foco. Tras cada acción el foco queda en un lugar útil y
// una región role="status" anuncia lo que pasó.
import { agruparPorBloque } from '../../lib/errores-campo';
import { TIPOS_BLOQUE, type Contenido, type ErrorBloque, type TipoBloque } from '@blog/bloques';
import { useEffect, useRef, useState, type Dispatch } from 'react';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Icono, type NombreIcono } from '../Icono';
import { CampoFormulario } from '../CampoFormulario';
import { EditorDeBloque } from './bloques/EditorDeBloque';
import { anuncioDeMovimiento, anuncioDeQuitado, etiquetaDeBloque, nombreDeBoton, nombreDeTipo } from './anuncios';
import type { AccionEditor } from './reductor';

type Foco = { tipo: 'boton'; id: string; accion: string } | { tipo: 'grupo'; indice: number } | { tipo: 'agregar' };

type Props = {
  contenido: Contenido;
  errores: ErrorBloque[];
  despachar: Dispatch<AccionEditor>;
  anunciar: (mensaje: string) => void;
};

const OPCIONES = TIPOS_BLOQUE.map((tipo) => ({
  tipo,
  texto: nombreDeTipo(tipo).charAt(0).toUpperCase() + nombreDeTipo(tipo).slice(1),
}));

export function ListaBloques({ contenido, errores, despachar, anunciar }: Props) {
  const [tipoNuevo, setTipoNuevo] = useState<TipoBloque>('parrafo');
  const foco = useRef<Foco | null>(null);
  const porBloque = agruparPorBloque(errores);

  // Después de cada render lleva el foco adonde la última acción lo dejó pendiente.
  useEffect(() => {
    const pendiente = foco.current;
    if (!pendiente) return;
    foco.current = null;
    const grupos = document.querySelectorAll<HTMLElement>('[data-bloque]');
    if (pendiente.tipo === 'boton') {
      document
        .querySelector<HTMLElement>(`[data-bloque="${pendiente.id}"] [data-accion="${pendiente.accion}"]`)
        ?.focus();
    } else if (pendiente.tipo === 'grupo') {
      grupos[pendiente.indice]?.focus();
    } else {
      document.getElementById('tipo-bloque-nuevo')?.focus();
    }
  });

  function mover(indice: number, destino: number, accion: 'subir' | 'bajar') {
    const bloque = contenido[indice];
    if (!bloque || destino < 0 || destino >= contenido.length) return;
    foco.current = { tipo: 'boton', id: bloque.id, accion };
    despachar({ tipo: 'mover_bloque', indice, destino });
    anunciar(anuncioDeMovimiento(bloque.tipo, destino + 1, contenido.length));
  }

  function quitar(indice: number) {
    const bloque = contenido[indice];
    if (!bloque) return;
    const quedan = contenido.length - 1;
    foco.current = quedan === 0 ? { tipo: 'agregar' } : { tipo: 'grupo', indice: Math.min(indice, quedan - 1) };
    despachar({ tipo: 'quitar_bloque', indice });
    anunciar(anuncioDeQuitado(indice + 1, bloque.tipo, quedan));
  }

  return (
    <div className="flex flex-col gap-4">
      {contenido.map((bloque, indice) => {
        const posicion = indice + 1;
        const botones: { accion: 'subir' | 'bajar' | 'duplicar' | 'quitar'; icono: NombreIcono; texto: string }[] = [
          { accion: 'subir', icono: 'subir', texto: 'Subir' },
          { accion: 'bajar', icono: 'bajar', texto: 'Bajar' },
          { accion: 'duplicar', icono: 'duplicar', texto: 'Duplicar' },
          { accion: 'quitar', icono: 'quitar', texto: 'Quitar' },
        ];
        const alHacerClic = {
          subir: () => mover(indice, indice - 1, 'subir'),
          bajar: () => mover(indice, indice + 1, 'bajar'),
          duplicar: () => {
            foco.current = { tipo: 'grupo', indice: indice + 1 };
            despachar({ tipo: 'duplicar_bloque', indice });
            anunciar(`Bloque ${posicion}, ${nombreDeTipo(bloque.tipo)}, duplicado`);
          },
          quitar: () => quitar(indice),
        };
        const deshabilitado = { subir: indice === 0, bajar: indice === contenido.length - 1 };

        return (
          <div
            key={bloque.id}
            role="group"
            aria-label={etiquetaDeBloque(posicion, bloque.tipo)}
            data-bloque={bloque.id}
            tabIndex={-1}
            className="flex flex-col gap-4 rounded-md border border-borde p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-titulos font-semibold" aria-hidden="true">
                {etiquetaDeBloque(posicion, bloque.tipo)}
              </p>
              <div className="flex flex-wrap gap-2">
                {botones.map(({ accion, icono, texto }) => {
                  const sinEfecto =
                    accion === 'subir' ? deshabilitado.subir : accion === 'bajar' ? deshabilitado.bajar : false;
                  return (
                    <Button
                      key={accion}
                      variante="terciaria"
                      tamanio="compacto"
                      data-accion={accion}
                      aria-label={nombreDeBoton(accion, posicion, bloque.tipo)}
                      aria-disabled={sinEfecto || undefined}
                      onClick={sinEfecto ? undefined : alHacerClic[accion]}
                    >
                      <Icono nombre={icono} />
                      <span className="max-sm:sr-only">{texto}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <EditorDeBloque
              bloque={bloque}
              indice={indice}
              errores={porBloque.get(indice) ?? []}
              cambiar={(cambios) => despachar({ tipo: 'actualizar_bloque', indice, cambios })}
            />
          </div>
        );
      })}

      <div className="flex flex-wrap items-end gap-3">
        <CampoFormulario etiqueta="Tipo de bloque a agregar" id="tipo-bloque-nuevo">
          {(atributos) => (
            <Select {...atributos} value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value as TipoBloque)}>
              {OPCIONES.map(({ tipo, texto }) => (
                <option key={tipo} value={tipo}>
                  {texto}
                </option>
              ))}
            </Select>
          )}
        </CampoFormulario>
        <Button
          variante="secundaria"
          onClick={() => {
            foco.current = { tipo: 'grupo', indice: contenido.length };
            despachar({ tipo: 'agregar_bloque', bloque: tipoNuevo });
            anunciar(`Bloque ${contenido.length + 1}, ${nombreDeTipo(tipoNuevo)}, agregado`);
          }}
        >
          Agregar bloque
        </Button>
      </div>
    </div>
  );
}
