'use client';

// Barra contextual fija de la tabla (spec 005, RF-028, RF-029; research D29 y D31 U1, U2, U12, U13, U14).
// Aparece con el cursor en una celda o con la tabla seleccionada en modo elementos.
// Por debajo de 768 px muestra solo «Quitar tabla» y el texto de RF-029.
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { cn } from '../../../lib/cn';
import { Icono, type NombreIcono } from '../../Icono';
import { Button } from '../../ui/button';
import {
  anuncioCeldasCombinadas,
  anuncioCeldasSeparadas,
  anuncioColumnaAgregada,
  anuncioColumnaQuitada,
  anuncioFilaAgregada,
  anuncioFilaEncabezado,
  anuncioFilaQuitada,
  anuncioQuitado,
} from '../anuncios';
import {
  agregarColumna,
  agregarColumnaAntes,
  agregarFila,
  agregarFilaAntes,
  combinarCeldas,
  conmutarEncabezado,
  eliminarColumna,
  eliminarFila,
  quitarTabla,
  separarCeldas,
} from './tablas';
import { CellSelection, findTable, selectedRect } from '@tiptap/pm/tables';
import { NodeSelection } from '@tiptap/pm/state';
import { cuadricula, esRectangulo, LIMITES_TABLA, type TablaEstructural } from '@blog/bloques';

type PropsBarraTabla = {
  editor: Editor | null;
  deshabilitada?: boolean;
  alPropiedades?: () => void;
  anunciar?: (mensaje: string) => void;
};

type EstadoTabla = {
  enTabla: boolean;
  filas: number;
  columnas: number;
  puedeCombinar: boolean;
  razonCombinar?: string;
  puedeSeparar: boolean;
  tieneEncabezado: boolean;
  puedeAgregarFila: boolean;
  puedeAgregarColumna: boolean;
  puedeQuitarFila: boolean;
  puedeQuitarColumna: boolean;
};

function calcularEstadoTabla(editor: Editor | null): EstadoTabla {
  if (!editor) {
    return {
      enTabla: false,
      filas: 0,
      columnas: 0,
      puedeCombinar: false,
      puedeSeparar: false,
      tieneEncabezado: false,
      puedeAgregarFila: false,
      puedeAgregarColumna: false,
      puedeQuitarFila: false,
      puedeQuitarColumna: false,
    };
  }

  const { state } = editor;
  const { selection } = state;
  const esTablaSeleccionada =
    selection instanceof NodeSelection && selection.node.type.name === 'table';

  const pos = selection.from;
  const $pos = state.doc.resolve(pos);
  const table = findTable($pos);

  if (!table && !esTablaSeleccionada) {
    return {
      enTabla: false,
      filas: 0,
      columnas: 0,
      puedeCombinar: false,
      puedeSeparar: false,
      tieneEncabezado: false,
      puedeAgregarFila: false,
      puedeAgregarColumna: false,
      puedeQuitarFila: false,
      puedeQuitarColumna: false,
    };
  }

  const tableNode = esTablaSeleccionada ? (selection as NodeSelection).node : table!.node;
  const grid = cuadricula(tableNode.toJSON() as TablaEstructural);

  let puedeCombinar = false;
  let razonCombinar: string | undefined;

  if (selection instanceof CellSelection && selection.$anchorCell.pos !== selection.$headCell.pos) {
    const rect = selectedRect(state);
    if (rect.top === 0 && rect.bottom > 1) {
      puedeCombinar = false;
      razonCombinar = 'No se puede combinar el encabezado con el cuerpo';
    } else {
      const { map } = rect;
      const celdasSeleccionadas: { fila: number; columna: number }[] = [];
      const vistas = new Set<number>();
      for (let r = rect.top; r < rect.bottom; r++) {
        for (let c = rect.left; c < rect.right; c++) {
          const p = map.map[r * map.width + c];
          if (!vistas.has(p)) {
            vistas.add(p);
            celdasSeleccionadas.push({ fila: r, columna: c });
          }
        }
      }
      if (esRectangulo(celdasSeleccionadas)) {
        puedeCombinar = true;
      } else {
        puedeCombinar = false;
        razonCombinar = 'Las celdas no forman un rectángulo';
      }
    }
  } else {
    puedeCombinar = false;
    razonCombinar = 'Las celdas no forman un rectángulo';
  }

  let puedeSeparar = false;
  try {
    const rect = selectedRect(state);
    const cellPos = rect.map.map[rect.top * rect.map.width + rect.left];
    const cellNode = rect.table.nodeAt(cellPos);
    if (cellNode && (cellNode.attrs.colspan > 1 || cellNode.attrs.rowspan > 1)) {
      puedeSeparar = true;
    }
  } catch {
    puedeSeparar = false;
  }

  const primeraFila = tableNode.childCount > 0 ? tableNode.child(0) : null;
  const tieneEncabezado = Boolean(
    primeraFila &&
      primeraFila.childCount > 0 &&
      primeraFila.child(0).type.name === 'tableHeader',
  );

  return {
    enTabla: true,
    filas: grid.filas,
    columnas: grid.columnas,
    puedeCombinar,
    razonCombinar,
    puedeSeparar,
    tieneEncabezado,
    puedeAgregarFila: grid.filas < LIMITES_TABLA.MAX_FILAS,
    puedeAgregarColumna: grid.columnas < LIMITES_TABLA.MAX_COLUMNAS,
    puedeQuitarFila: grid.filas > LIMITES_TABLA.MIN_FILAS,
    puedeQuitarColumna: grid.columnas > LIMITES_TABLA.MIN_COLUMNAS,
  };
}

export function BarraTabla({ editor, deshabilitada = false, alPropiedades: _alPropiedades, anunciar }: PropsBarraTabla) {
  const [esMenor768, setEsMenor768] = useState(false);
  const [activo, setActivo] = useState('fila-arriba');
  const [avisoDeshacer, setAvisoDeshacer] = useState(false);
  const barra = useRef<HTMLDivElement>(null);

  const idRazonFila = useId();
  const idRazonColumna = useId();
  const idRazonMinFila = useId();
  const idRazonMinColumna = useId();
  const idRazonCombinar = useId();
  const idRazonSeparar = useId();

  const estado =
    useEditorState({ editor, selector: ({ editor: e }) => calcularEstadoTabla(e) }) ??
    calcularEstadoTabla(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 48rem)');
    const actualizar = () => setEsMenor768(!mql.matches);
    actualizar();
    mql.addEventListener('change', actualizar);
    return () => mql.removeEventListener('change', actualizar);
  }, []);

  const sinEditor = editor === null || deshabilitada;

  const ctl = (id: string, razonId?: string) => ({
    'data-barra': id,
    tabIndex: (activo === id || (esMenor768 && id === 'quitar-tabla')) ? 0 : -1,
    onFocus: () => setActivo(id),
    onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
    ...(razonId ? { 'aria-describedby': razonId } : {}),
  });

  const alTeclear = (evento: React.KeyboardEvent) => {
    const teclas = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!teclas.includes(evento.key)) return;
    const controles = Array.from(barra.current?.querySelectorAll<HTMLElement>('[data-barra]') ?? []).filter(
      (el) => el.offsetParent !== null,
    );
    const actual = controles.indexOf(document.activeElement as HTMLElement);
    if (controles.length === 0 || actual < 0) return;
    evento.preventDefault();
    const destino =
      evento.key === 'Home'
        ? 0
        : evento.key === 'End'
          ? controles.length - 1
          : (actual + (evento.key === 'ArrowRight' ? 1 : -1) + controles.length) % controles.length;
    controles[destino]?.focus();
  };

  const ejecutarAccion = (accion: () => boolean, anuncioTexto?: string) => {
    if (!editor || sinEditor) return;
    const pudo = accion();
    if (pudo && anuncioTexto && anunciar) {
      anunciar(anuncioTexto);
    }
  };

  const boton = (
    id: string,
    nombre: string,
    icono: NombreIcono,
    accion: () => boolean,
    anuncioTexto?: string,
    deshabilitado = false,
    razonId?: string,
    extra: ComponentProps<'button'> = {},
  ) => (
    <Button
      key={id}
      variante="terciaria"
      tamanio="compacto"
      soloIcono
      aria-label={nombre}
      onClick={() => !deshabilitado && ejecutarAccion(accion, anuncioTexto)}
      aria-disabled={deshabilitado || sinEditor || undefined}
      {...ctl(id, deshabilitado ? razonId : undefined)}
      {...extra}
    >
      <Icono nombre={icono} />
    </Button>
  );

  const alQuitarTabla = () => {
    if (!editor || sinEditor) return;
    quitarTabla(editor);
    if (anunciar) anunciar(anuncioQuitado(1));
    if (esMenor768) {
      setAvisoDeshacer(true);
    }
  };

  if (!estado.enTabla && !avisoDeshacer) {
    return null;
  }

  if (avisoDeshacer) {
    return (
      <div
        role="region"
        aria-label="Aviso de tabla quitada"
        className="flex items-center justify-between gap-2 rounded-md border border-borde bg-superficie px-3 py-2 text-sm"
      >
        <span>Elemento quitado</span>
        <Button
          variante="secundaria"
          tamanio="compacto"
          onClick={() => {
            editor?.chain().focus().undo().run();
            setAvisoDeshacer(false);
          }}
        >
          Deshacer
        </Button>
      </div>
    );
  }

  if (esMenor768) {
    return (
      <div
        ref={barra}
        role="toolbar"
        aria-label="Tabla"
        onKeyDown={alTeclear}
        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borde bg-fondo p-1 text-xs text-texto-suave @container"
      >
        <span className="flex-1 px-1">
          Para cambiar filas, columnas o combinar celdas, usa una pantalla más ancha
        </span>
        <Button
          variante="terciaria"
          tamanio="compacto"
          aria-label="Quitar tabla"
          onClick={alQuitarTabla}
          {...ctl('quitar-tabla')}
        >
          <Icono nombre="quitar" />
          Quitar tabla
        </Button>
      </div>
    );
  }

  const accionesPrincipales = [
    boton(
      'fila-arriba',
      'Insertar fila arriba',
      'fila_arriba',
      () => agregarFilaAntes(editor!),
      anuncioFilaAgregada(estado.filas + 1),
      !estado.puedeAgregarFila,
      idRazonFila,
    ),
    boton(
      'fila-abajo',
      'Insertar fila abajo',
      'fila_abajo',
      () => agregarFila(editor!),
      anuncioFilaAgregada(estado.filas + 1),
      !estado.puedeAgregarFila,
      idRazonFila,
    ),
    boton(
      'columna-izquierda',
      'Insertar columna a la izquierda',
      'columna_izquierda',
      () => agregarColumnaAntes(editor!),
      anuncioColumnaAgregada(estado.columnas + 1),
      !estado.puedeAgregarColumna,
      idRazonColumna,
    ),
    boton(
      'columna-derecha',
      'Insertar columna a la derecha',
      'columna_derecha',
      () => agregarColumna(editor!),
      anuncioColumnaAgregada(estado.columnas + 1),
      !estado.puedeAgregarColumna,
      idRazonColumna,
    ),
    boton(
      'quitar-fila',
      'Quitar fila',
      'quitar_fila',
      () => eliminarFila(editor!),
      anuncioFilaQuitada(estado.filas - 1),
      !estado.puedeQuitarFila,
      idRazonMinFila,
    ),
    boton(
      'quitar-columna',
      'Quitar columna',
      'quitar_columna',
      () => eliminarColumna(editor!),
      anuncioColumnaQuitada(estado.columnas - 1),
      !estado.puedeQuitarColumna,
      idRazonMinColumna,
    ),
    <Button
      key="combinar"
      variante="terciaria"
      tamanio="compacto"
      aria-label="Combinar celdas"
      onClick={() => ejecutarAccion(() => combinarCeldas(editor!), anuncioCeldasCombinadas())}
      aria-disabled={!estado.puedeCombinar || sinEditor || undefined}
      {...ctl('combinar', !estado.puedeCombinar ? idRazonCombinar : undefined)}
    >
      <Icono nombre="combinar_celdas" />
      Combinar celdas
    </Button>,
    boton(
      'separar',
      'Separar celdas',
      'separar_celdas',
      () => separarCeldas(editor!),
      anuncioCeldasSeparadas(),
      !estado.puedeSeparar,
      idRazonSeparar,
    ),
    boton(
      'encabezado',
      'Fila de encabezado',
      'encabezado_tabla',
      () => conmutarEncabezado(editor!),
      anuncioFilaEncabezado(!estado.tieneEncabezado),
      false,
      undefined,
      { 'aria-pressed': estado.tieneEncabezado },
    ),
  ];

  return (
    <div
      ref={barra}
      role="toolbar"
      aria-label="Tabla"
      onKeyDown={alTeclear}
      className={cn(
        'sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-md border border-borde bg-fondo p-1 @container',
      )}
    >
      <span className="px-2 text-xs font-semibold text-texto-suave">
        Esc: salir de la tabla
      </span>
      {accionesPrincipales}
      <Button
        variante="terciaria"
        tamanio="compacto"
        aria-label="Quitar tabla"
        onClick={alQuitarTabla}
        {...ctl('quitar-tabla')}
      >
        <Icono nombre="quitar" />
        Quitar tabla
      </Button>

      <span id={idRazonFila} className="sr-only">
        Se alcanzó el máximo de 50 filas
      </span>
      <span id={idRazonColumna} className="sr-only">
        Se alcanzó el máximo de 10 columnas
      </span>
      <span id={idRazonMinFila} className="sr-only">
        Usa «Quitar tabla»
      </span>
      <span id={idRazonMinColumna} className="sr-only">
        Usa «Quitar tabla»
      </span>
      <span id={idRazonCombinar} className="sr-only">
        {estado.razonCombinar ?? 'Las celdas no forman un rectángulo'}
      </span>
      <span id={idRazonSeparar} className="sr-only">
        La celda no está combinada
      </span>
    </div>
  );
}
