'use client';

// Barra de herramientas del lienzo (contracts/componentes.md y atajos.md): `role="toolbar"` con un solo tope de
// tabulación y flechas entre controles. Los botones son los del panel (`terciaria`, `compacto`); el estado activo
// se ve con `aria-pressed` además del color. Sin editor (servidor o librería cargando) se dibuja completa y
// deshabilitada con `aria-disabled`.
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useDesplegable } from '../../../lib/desplegable';
import { cn } from '../../../lib/cn';
import { useMenuTeclado } from '../../../lib/menu-teclado';
import { MasAcciones } from '../../estructura/MasAcciones';
import { nombreDeTipo } from '../anuncios';
import { Icono, type NombreIcono } from '../../Icono';
import { Button } from '../../ui/button';
import { esEnlacePermitido } from './extensiones';
import { filtrarItems, type ItemDeInsercion } from './menu-insercion';
import { deshacerORehacer, type ContextoDeAcciones } from './acciones-elemento';
import { elementoActivo, salirDelModo, sincronizarConElDom } from './comandos';
import { MenuAcciones } from './MenuAcciones';
import { MenuInsertar } from './MenuInsertar';
import type { SeleccionDelDocumento } from './tipos';

type Props = {
  editor: Editor | null;
  deshabilitada: boolean;
  seleccion: SeleccionDelDocumento;
  /** Abre el panel de propiedades del elemento seleccionado. */
  alPropiedades?: () => void;
  /** Lo que necesita el menú «Acciones»; sin él (servidor o librería cargando) el botón se dibuja deshabilitado. */
  contextoDeAcciones?: ContextoDeAcciones;
};

type Estilo = { nombre: string; activo: (editor: Editor) => boolean; aplicar: (editor: Editor) => void };

const ESTILOS: Estilo[] = [
  {
    nombre: 'Párrafo',
    activo: (e) => e.isActive('paragraph') && !e.isActive('blockquote'),
    aplicar: (e) => {
      if (e.isActive('blockquote')) e.chain().focus().lift('blockquote').run();
      else e.chain().focus().setParagraph().run();
    },
  },
  ...([2, 3, 4] as const).map((nivel): Estilo => ({
    nombre: `Título ${nivel}`,
    activo: (e) => e.isActive('heading', { level: nivel }),
    aplicar: (e) => e.chain().focus().setHeading({ level: nivel }).run(),
  })),
  {
    nombre: 'Cita',
    activo: (e) => e.isActive('blockquote'),
    aplicar: (e) => e.chain().focus().setParagraph().wrapIn('blockquote').run(),
  },
];

const estiloVigente = (editor: Editor | null) =>
  ESTILOS.find((estilo) => editor && estilo.activo(editor))?.nombre ?? 'Párrafo';

/** Nombre del botón «Acciones»: dice sobre qué elemento actúa. */
function etiquetaDeAcciones(editor: Editor | null) {
  const activo = editor ? elementoActivo(editor.state) : null;
  return activo ? `Acciones del elemento ${activo.posicion}, ${nombreDeTipo(activo.tipo)}` : 'Acciones';
}

function estadoDe(editor: Editor | null) {
  return {
    negrita: editor?.isActive('bold') ?? false,
    cursiva: editor?.isActive('italic') ?? false,
    codigo: editor?.isActive('code') ?? false,
    enlace: editor?.isActive('link') ?? false,
    viniietas: editor?.isActive('bulletList') ?? false,
    numerada: editor?.isActive('orderedList') ?? false,
    estilo: estiloVigente(editor),
    sinMarcas: editor ? editor.isActive('heading') || editor.isActive('codeBlock') : false,
    sinListas: editor
      ? editor.isActive('heading') || editor.isActive('codeBlock') || editor.isActive('blockquote')
      : false,
    etiquetaAcciones: etiquetaDeAcciones(editor),
    puedeDeshacer: editor?.can().undo() ?? false,
    puedeRehacer: editor?.can().redo() ?? false,
  };
}

/** Menú del selector de estilo de párrafo: muestra el vigente como texto y abre los estilos con el teclado. */
function SelectorDeEstilo({
  editor,
  ctl,
  estilo,
  bloqueado,
}: {
  editor: Editor | null;
  ctl: (id: string) => ControlProps;
  estilo: string;
  bloqueado: boolean;
}) {
  const idPanel = useId();
  const refBoton = useRef<HTMLButtonElement>(null);
  const refPanel = useRef<HTMLDivElement>(null);
  const { abierto, cerrar, alternar } = useDesplegable({ refBoton, refPanel });
  const items = ESTILOS.map((e) => ({ etiqueta: e.nombre }));
  const { propsDeContenedor, propsDeItem } = useMenuTeclado({
    items,
    abierto,
    alCerrar: () => cerrar(true),
    alElegir: (indice) => {
      cerrar();
      if (editor) ESTILOS[indice]?.aplicar(editor);
    },
  });
  return (
    <div className="relative">
      <Button
        ref={refBoton}
        variante="terciaria"
        tamanio="compacto"
        aria-label={`Estilo de párrafo: ${estilo}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        aria-disabled={bloqueado || undefined}
        onClick={() => !bloqueado && alternar()}
        {...ctl('estilo')}
      >
        {estilo}
        <Icono nombre="bajar" />
      </Button>
      {abierto && (
        <div
          id={idPanel}
          aria-label="Estilo de párrafo"
          className="absolute top-full left-0 z-20 mt-1 flex w-44 flex-col rounded-md border border-borde bg-fondo p-1 shadow-tarjeta"
          {...propsDeContenedor}
          ref={(elemento) => {
            refPanel.current = elemento;
            propsDeContenedor.ref(elemento);
          }}
        >
          {ESTILOS.map((e, indice) => (
            <button
              key={e.nombre}
              type="button"
              className="min-h-(--tactil-min) rounded-sm px-3 text-left hover:bg-superficie aria-checked:bg-marca-suave"
              {...propsDeItem(indice)}
              role="menuitemradio"
              aria-checked={e.nombre === estilo}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Botón «Acciones» con su menú: actúa sobre el elemento del cursor o sobre los seleccionados. */
function BotonAcciones({
  editor,
  contexto,
  etiqueta,
  bloqueado,
  ctl,
}: {
  editor: Editor | null;
  contexto: ContextoDeAcciones | undefined;
  etiqueta: string;
  bloqueado: boolean;
  ctl: ControlProps;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', alPulsar);
    return () => document.removeEventListener('pointerdown', alPulsar);
  }, [abierto]);
  return (
    <div ref={raiz} className="relative">
      <Button
        variante="terciaria"
        tamanio="compacto"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-disabled={bloqueado || undefined}
        onClick={() => {
          if (bloqueado) return;
          if (editor) sincronizarConElDom(editor);
          setAbierto((previo) => !previo);
        }}
        {...ctl}
      >
        <Icono nombre="acciones" />
        Acciones
      </Button>
      {abierto && editor && contexto && (
        <MenuAcciones
          editor={editor}
          contexto={contexto}
          alCerrar={(devolverFoco) => {
            setAbierto(false);
            if (devolverFoco) editor.commands.focus();
          }}
          className="top-full left-0"
        />
      )}
    </div>
  );
}

type ControlProps = {
  'data-barra': string;
  tabIndex: number;
  onFocus: () => void;
  onPointerDown: (evento: React.PointerEvent) => void;
};

export function BarraHerramientas({ editor, deshabilitada, seleccion, alPropiedades, contextoDeAcciones }: Props) {
  const barra = useRef<HTMLDivElement>(null);
  const idInsertar = useId();
  const idEnlace = useId();
  const [activo, setActivo] = useState('estilo');
  const [insertarAbierto, setInsertarAbierto] = useState(false);
  const [itemInsertar, setItemInsertar] = useState(0);
  const [enlace, setEnlace] = useState<{ valor: string; error: boolean } | null>(null);
  const estado = useEditorState({ editor, selector: ({ editor: e }) => estadoDe(e) }) ?? estadoDe(null);

  const sinEditor = editor === null || deshabilitada;
  const ctl = (id: string): ControlProps => ({
    'data-barra': id,
    tabIndex: activo === id ? 0 : -1,
    onFocus: () => setActivo(id),
    // Con el puntero no se pierde el foco del lienzo (ni el teclado virtual).
    onPointerDown: (evento) => evento.preventDefault(),
  });
  const bloqueo = (cond = false) => (sinEditor || cond ? { 'aria-disabled': true as const } : {});
  const ejecutar =
    (orden: (e: Editor) => void, cond = false) =>
    () => {
      if (editor && !sinEditor && !cond) orden(editor);
    };

  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.target instanceof HTMLInputElement) return;
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

  const abrirEnlace = () => {
    if (!editor || sinEditor || estado.sinMarcas) return;
    setEnlace({ valor: (editor.getAttributes('link').href as string | undefined) ?? '', error: false });
  };
  const aplicarEnlace = (evento: FormEvent) => {
    evento.preventDefault();
    if (!editor || !enlace) return;
    const valor = enlace.valor.trim();
    if (valor === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else if (esEnlacePermitido(valor)) editor.chain().focus().extendMarkRange('link').setLink({ href: valor }).run();
    else return setEnlace({ valor: enlace.valor, error: true });
    setEnlace(null);
  };
  // `Mod+K` (en las reglas del lienzo) pide abrir el campo del enlace.
  useEffect(() => {
    const lienzo = editor?.view.dom;
    if (!lienzo) return;
    const abrir = () => abrirEnlace();
    lienzo.addEventListener('abrir-enlace', abrir);
    return () => lienzo.removeEventListener('abrir-enlace', abrir);
  });
  const cerrarEnlace = () => {
    setEnlace(null);
    editor?.commands.focus();
  };

  const itemsInsertar: ItemDeInsercion[] = filtrarItems('');
  const elegirInsertar = (item: ItemDeInsercion) => {
    setInsertarAbierto(false);
    if (editor) item.insertar(editor);
  };
  const cerrarInsertar = () => {
    setInsertarAbierto(false);
    editor?.commands.focus();
  };

  const boton = (
    id: string,
    nombre: string,
    icono: NombreIcono,
    orden: (e: Editor) => void,
    extra: ComponentProps<'button'> = {},
    cond = false,
  ) => (
    <Button
      key={id}
      variante="terciaria"
      tamanio="compacto"
      soloIcono
      aria-label={nombre}
      onClick={ejecutar(orden, cond)}
      {...ctl(id)}
      {...bloqueo(cond)}
      {...extra}
    >
      <Icono nombre={icono} />
    </Button>
  );

  const cantidad = seleccion.tipo === 'elementos' ? seleccion.hasta - seleccion.desde : 0;
  // Con un solo elemento seleccionado no hace falta el conteo: se anuncia y el panel lo muestra.
  const enModoElementos = seleccion.tipo === 'elementos' && (seleccion.modo === true || cantidad > 1);
  const deshacerYRehacer: ReactNode[] = [
    boton(
      'deshacer',
      'Deshacer',
      'deshacer',
      (e) =>
        contextoDeAcciones ? deshacerORehacer(e, false, contextoDeAcciones.anunciar) : e.chain().focus().undo().run(),
      {},
      !estado.puedeDeshacer,
    ),
    boton(
      'rehacer',
      'Rehacer',
      'rehacer',
      (e) =>
        contextoDeAcciones ? deshacerORehacer(e, true, contextoDeAcciones.anunciar) : e.chain().focus().redo().run(),
      {},
      !estado.puedeRehacer,
    ),
  ];

  return (
    <>
      <div
        ref={barra}
        role="toolbar"
        aria-label="Formato del texto"
        aria-orientation="horizontal"
        onKeyDown={alTeclear}
        className={cn(
          'sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-md border border-borde bg-fondo p-1 @container',
        )}
      >
        <SelectorDeEstilo editor={editor} ctl={ctl} estilo={estado.estilo} bloqueado={sinEditor} />
        {boton(
          'negrita',
          'Negrita',
          'negrita',
          (e) => e.chain().focus().toggleBold().run(),
          { 'aria-pressed': estado.negrita },
          estado.sinMarcas,
        )}
        {boton(
          'cursiva',
          'Cursiva',
          'cursiva',
          (e) => e.chain().focus().toggleItalic().run(),
          { 'aria-pressed': estado.cursiva },
          estado.sinMarcas,
        )}
        {boton(
          'codigo',
          'Código',
          'codigo',
          (e) => e.chain().focus().toggleMark('code').run(),
          { 'aria-pressed': estado.codigo },
          estado.sinMarcas,
        )}
        {boton(
          'enlace',
          'Enlace',
          'enlace',
          abrirEnlace,
          { 'aria-pressed': undefined, 'aria-expanded': enlace !== null },
          estado.sinMarcas,
        )}
        {boton(
          'vinietas',
          'Lista con viñetas',
          'lista',
          (e) => e.chain().focus().toggleBulletList().run(),
          { 'aria-pressed': estado.viniietas },
          estado.sinListas && !estado.viniietas,
        )}
        {boton(
          'numerada',
          'Lista numerada',
          'lista_numerada',
          (e) => e.chain().focus().toggleOrderedList().run(),
          { 'aria-pressed': estado.numerada },
          estado.sinListas && !estado.numerada,
        )}
        <div className="relative">
          <Button
            variante="terciaria"
            tamanio="compacto"
            aria-haspopup="listbox"
            aria-expanded={insertarAbierto}
            aria-controls={insertarAbierto ? idInsertar : undefined}
            onClick={() => {
              if (sinEditor) return;
              setItemInsertar(0);
              setInsertarAbierto((abierto) => !abierto);
            }}
            {...ctl('insertar')}
            {...bloqueo()}
          >
            <Icono nombre="insertar" />
            Insertar
          </Button>
          {insertarAbierto && (
            <MenuInsertar
              id={idInsertar}
              items={itemsInsertar}
              activo={itemInsertar}
              alActivar={setItemInsertar}
              alElegir={elegirInsertar}
              alCerrar={cerrarInsertar}
              focoPropio
              className="absolute top-full left-0 mt-1"
            />
          )}
        </div>
        {seleccion.tipo === 'elementos' &&
          seleccion.bloques.length === 1 &&
          seleccion.bloques[0]?.tipo !== 'parrafo' &&
          seleccion.bloques[0]?.tipo !== 'separador' &&
          alPropiedades && (
            <Button variante="terciaria" tamanio="compacto" onClick={alPropiedades} {...ctl('propiedades')}>
              <Icono nombre="propiedades" />
              Propiedades
            </Button>
          )}
        <BotonAcciones
          editor={editor}
          contexto={contextoDeAcciones}
          etiqueta={estado.etiquetaAcciones}
          bloqueado={sinEditor || !contextoDeAcciones}
          ctl={ctl('acciones')}
        />
        <MasAcciones corte="md" direccion="abajo" propsBoton={ctl('mas')}>
          {deshacerYRehacer}
        </MasAcciones>
        {enModoElementos && (
          <>
            <span className="px-2 text-sm font-semibold">
              {cantidad === 1 ? '1 elemento seleccionado' : `${cantidad} elementos seleccionados`}
            </span>
            <Button
              variante="secundaria"
              tamanio="compacto"
              onClick={() => {
                if (!editor) return;
                salirDelModo()(editor.state, (tr) => editor.view.dispatch(tr));
                editor.commands.focus();
              }}
              {...ctl('salir')}
            >
              Salir de la selección
            </Button>
          </>
        )}
      </div>
      {enlace && (
        <form
          onSubmit={aplicarEnlace}
          className="flex flex-wrap items-start gap-2"
          onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cerrarEnlace())}
        >
          <label htmlFor={idEnlace} className="sr-only">
            URL del enlace
          </label>
          <input
            id={idEnlace}
            autoFocus
            type="text"
            inputMode="url"
            value={enlace.valor}
            placeholder="https://… o /ruta"
            aria-invalid={enlace.error || undefined}
            aria-describedby={enlace.error ? `${idEnlace}-error` : undefined}
            onChange={(e) => setEnlace({ valor: e.target.value, error: false })}
            className="min-h-(--tactil-min) min-w-0 flex-1 rounded-md border border-borde bg-fondo px-3"
          />
          <Button type="submit" variante="primaria" tamanio="compacto">
            Aplicar
          </Button>
          <Button variante="secundaria" tamanio="compacto" onClick={cerrarEnlace}>
            Cancelar
          </Button>
          {enlace.error && (
            <p id={`${idEnlace}-error`} className="basis-full text-sm text-error">
              Usa una dirección https:// o una ruta del sitio que empiece con /.
            </p>
          )}
        </form>
      )}
    </>
  );
}
