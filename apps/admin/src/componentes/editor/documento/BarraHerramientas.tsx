'use client';

// Barra de herramientas del lienzo (contracts/componentes.md y atajos.md): `role="toolbar"` con un solo tope de
// tabulación y flechas entre controles. Los botones son los del panel (`terciaria`, `compacto`); el estado activo
// se ve con `aria-pressed` además del color. Sin editor (servidor o librería cargando) se dibuja completa y
// deshabilitada con `aria-disabled`. Un control no disponible por una regla (código en línea, alineación fuera de
// párrafos y títulos) dice por qué con `aria-describedby` y un aviso visible al enfocarlo, que `Esc` cierra (1.4.13).
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
import {
  ALINEACIONES,
  alineacionDe,
  elementoActivo,
  salirDelModo,
  sincronizarConElDom,
  type Alineacion,
} from './comandos';
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

/** «Más formato» (research D28): las marcas que no tienen botón propio, en este orden. */
const MAS_FORMATO: { marca: string; etiqueta: string; nombre: string; icono: NombreIcono }[] = [
  { marca: 'strike', etiqueta: 'Tachado', nombre: 'tachado', icono: 'tachado' },
  { marca: 'highlight', etiqueta: 'Resaltado', nombre: 'resaltado', icono: 'resaltado' },
  { marca: 'code', etiqueta: 'Código', nombre: 'código', icono: 'codigo' },
  { marca: 'superscript', etiqueta: 'Superíndice', nombre: 'superíndice', icono: 'superindice' },
  { marca: 'subscript', etiqueta: 'Subíndice', nombre: 'subíndice', icono: 'subindice' },
];

const ICONOS_DE_ALINEACION: Record<string, NombreIcono> = {
  center: 'alinear_centro',
  right: 'alinear_derecha',
  justify: 'alinear_justificado',
};

const RAZON_CODIGO = 'El código no admite otros formatos';
const RAZON_ALINEACION = 'La alineación es solo para párrafos y títulos';

/** "Más formato", "Más formato, resaltado activo" o "Más formato, tachado y resaltado activos". */
function nombreDeMasFormato(activos: string[]) {
  if (activos.length === 0) return 'Más formato';
  const lista = activos.length === 1 ? activos[0] : `${activos.slice(0, -1).join(', ')} y ${activos.at(-1)}`;
  return `Más formato, ${lista} ${activos.length === 1 ? 'activo' : 'activos'}`;
}

/** La izquierda quita el atributo: nunca se guarda `"left"`. */
const alinear = (editor: Editor, valor: Alineacion) =>
  valor ? editor.chain().focus().setTextAlign(valor).run() : editor.chain().focus().unsetTextAlign().run();

/** Nombre del botón «Acciones»: dice sobre qué elemento actúa. */
function etiquetaDeAcciones(editor: Editor | null) {
  const activo = editor ? elementoActivo(editor.state) : null;
  return activo ? `Acciones del elemento ${activo.posicion}, ${nombreDeTipo(activo.tipo)}` : 'Acciones';
}

function estadoDe(editor: Editor | null) {
  const activa = (marca: string) => editor?.isActive(marca) ?? false;
  const alineacion = editor ? alineacionDe(editor.state) : { alineable: false, valor: null };
  return {
    negrita: activa('bold'),
    cursiva: activa('italic'),
    subrayado: activa('underline'),
    enlace: activa('link'),
    masFormato: MAS_FORMATO.map(({ marca }) => activa(marca)),
    // El código en línea excluye los demás formatos (contracts/documento.md).
    conCodigo: activa('code'),
    alineable: alineacion.alineable,
    alineacion: alineacion.valor,
    viniietas: activa('bulletList'),
    numerada: activa('orderedList'),
    estilo: estiloVigente(editor),
    // Los títulos admiten formato (RF-009); el bloque de código no.
    sinMarcas: activa('codeBlock'),
    sinListas: activa('heading') || activa('codeBlock') || activa('blockquote'),
    etiquetaAcciones: etiquetaDeAcciones(editor),
    puedeDeshacer: editor?.can().undo() ?? false,
    puedeRehacer: editor?.can().redo() ?? false,
  };
}

type OpcionDeMenu = {
  etiqueta: string;
  marcada: boolean;
  deshabilitada?: boolean;
  icono?: NombreIcono;
  razon?: string;
};

/**
 * Un botón de la barra que abre un menú de opciones marcables (estilo, «Más formato», «Alineación»): el foco entra a
 * la primera opción, elegir una cierra el menú y la aplica, y `Esc` lo cierra devolviendo el foco al botón.
 */
function MenuDeLaBarra({
  editor,
  nombre,
  etiquetaDelMenu,
  rol,
  opciones,
  alElegir,
  bloqueado,
  ctl,
  soloIcono = false,
  children,
}: {
  editor: Editor | null;
  nombre: string;
  /** El nombre del menú abierto, sin el estado ("Alineación", no "Alineación: centro"). */
  etiquetaDelMenu: string;
  rol: 'menuitemradio' | 'menuitemcheckbox';
  opciones: OpcionDeMenu[];
  alElegir: (indice: number) => void;
  bloqueado: boolean;
  ctl: ControlProps;
  soloIcono?: boolean;
  children: ReactNode;
}) {
  const idPanel = useId();
  const refBoton = useRef<HTMLButtonElement>(null);
  const refPanel = useRef<HTMLDivElement>(null);
  const { abierto, cerrar, alternar } = useDesplegable({ refBoton, refPanel });
  const { propsDeContenedor, propsDeItem } = useMenuTeclado({
    items: opciones.map((opcion) => ({ etiqueta: opcion.etiqueta, deshabilitado: opcion.deshabilitada })),
    abierto,
    alCerrar: () => cerrar(true),
    alElegir: (indice) => {
      cerrar();
      // El foco vuelve al lienzo en el acto: el `focus()` de la librería espera un cuadro y la tecla siguiente se
      // perdería (o actuaría sobre la selección vieja).
      editor?.view.focus();
      alElegir(indice);
    },
  });
  const comunes = {
    ref: refBoton,
    variante: 'terciaria',
    'aria-haspopup': 'menu',
    'aria-expanded': abierto,
    'aria-controls': abierto ? idPanel : undefined,
    'aria-disabled': bloqueado || undefined,
    onClick: () => !bloqueado && alternar(),
    ...ctl,
  } as const;
  return (
    <div className="relative">
      {soloIcono ? (
        <Button {...comunes} tamanio="compacto" soloIcono aria-label={nombre}>
          {children}
        </Button>
      ) : (
        <Button {...comunes} tamanio="compacto" aria-label={nombre}>
          {children}
        </Button>
      )}
      {abierto && (
        <div
          id={idPanel}
          aria-label={etiquetaDelMenu}
          className="absolute top-full left-0 z-20 mt-1 flex w-48 flex-col rounded-md border border-borde bg-fondo p-1 shadow-tarjeta"
          {...propsDeContenedor}
          ref={(elemento) => {
            refPanel.current = elemento;
            propsDeContenedor.ref(elemento);
          }}
        >
          {opciones.map((opcion, indice) => (
            <button
              key={opcion.etiqueta}
              type="button"
              className="flex min-h-(--tactil-min) items-center gap-2 rounded-sm px-3 text-left hover:bg-superficie aria-checked:bg-marca-suave aria-disabled:text-texto-suave"
              {...propsDeItem(indice)}
              role={rol}
              aria-checked={opcion.marcada}
              aria-describedby={opcion.deshabilitada ? opcion.razon : undefined}
            >
              {opcion.icono && <Icono nombre={opcion.icono} />}
              <span className="flex-1">{opcion.etiqueta}</span>
              {/* La marca no depende del color: un ícono de verificación. */}
              <Icono nombre="check" className={opcion.marcada ? undefined : 'invisible'} />
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
  onBlur: () => void;
  onPointerDown: (evento: React.PointerEvent) => void;
  'aria-describedby'?: string;
};

export function BarraHerramientas({ editor, deshabilitada, seleccion, alPropiedades, contextoDeAcciones }: Props) {
  const barra = useRef<HTMLDivElement>(null);
  const idInsertar = useId();
  const idEnlace = useId();
  const idRazonCodigo = useId();
  const idRazonAlineacion = useId();
  const [activo, setActivo] = useState('estilo');
  /** El control de la barra con el foco y si se cerró su aviso con `Esc`. */
  const [enfocado, setEnfocado] = useState<{ id: string; cerrado: boolean } | null>(null);
  const [insertarAbierto, setInsertarAbierto] = useState(false);
  const [itemInsertar, setItemInsertar] = useState(0);
  const [enlace, setEnlace] = useState<{ valor: string; error: boolean } | null>(null);
  const estado = useEditorState({ editor, selector: ({ editor: e }) => estadoDe(e) }) ?? estadoDe(null);

  const sinEditor = editor === null || deshabilitada;
  const razonCodigo = !sinEditor && estado.conCodigo ? idRazonCodigo : undefined;
  const razonAlineacion = !sinEditor && !estado.alineable ? idRazonAlineacion : undefined;
  /** El id del texto que explica por qué un control no está disponible (se calcula con el estado de ahora). */
  const razones: Record<string, string | undefined> = {
    negrita: razonCodigo,
    cursiva: razonCodigo,
    subrayado: razonCodigo,
    enlace: razonCodigo,
    alineacion: razonAlineacion,
  };
  // El aviso sigue al estado: si el cursor entra al código después de enfocar el control, igual aparece.
  const aviso = enfocado && !enfocado.cerrado ? razones[enfocado.id] : undefined;
  const ctl = (id: string): ControlProps => {
    const razon = razones[id];
    return {
      'data-barra': id,
      tabIndex: activo === id ? 0 : -1,
      onFocus: () => {
        setActivo(id);
        setEnfocado({ id, cerrado: false });
      },
      onBlur: () => setEnfocado(null),
      // Con el puntero no se pierde el foco del lienzo (ni el teclado virtual).
      onPointerDown: (evento) => evento.preventDefault(),
      ...(razon ? { 'aria-describedby': razon } : {}),
    };
  };
  const bloqueo = (cond = false) => (sinEditor || cond ? { 'aria-disabled': true as const } : {});
  const ejecutar =
    (orden: (e: Editor) => void, cond = false) =>
    () => {
      if (editor && !sinEditor && !cond) orden(editor);
    };

  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === 'Escape' && aviso) {
      // Cierra el aviso sin mover el foco (WCAG 1.4.13).
      evento.preventDefault();
      setEnfocado((actual) => actual && { ...actual, cerrado: true });
      return;
    }
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
    if (!editor || sinEditor || estado.sinMarcas || estado.conCodigo) return;
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
        <MenuDeLaBarra
          editor={editor}
          nombre={`Estilo de párrafo: ${estado.estilo}`}
          etiquetaDelMenu="Estilo de párrafo"
          rol="menuitemradio"
          opciones={ESTILOS.map((e) => ({ etiqueta: e.nombre, marcada: e.nombre === estado.estilo }))}
          alElegir={(indice) => editor && ESTILOS[indice]?.aplicar(editor)}
          bloqueado={sinEditor}
          ctl={ctl('estilo')}
        >
          {estado.estilo}
          <Icono nombre="bajar" />
        </MenuDeLaBarra>
        {(
          [
            ['negrita', 'Negrita', 'bold', estado.negrita],
            ['cursiva', 'Cursiva', 'italic', estado.cursiva],
            ['subrayado', 'Subrayado', 'underline', estado.subrayado],
          ] as const
        ).map(([id, nombre, marca, activa]) =>
          boton(
            id,
            nombre,
            id,
            (e) => e.chain().focus().toggleMark(marca).run(),
            { 'aria-pressed': activa },
            estado.sinMarcas || estado.conCodigo,
          ),
        )}
        {boton(
          'enlace',
          'Enlace',
          'enlace',
          abrirEnlace,
          { 'aria-pressed': undefined, 'aria-expanded': enlace !== null },
          estado.sinMarcas || estado.conCodigo,
        )}
        <MenuDeLaBarra
          editor={editor}
          nombre={nombreDeMasFormato(MAS_FORMATO.filter((_, i) => estado.masFormato[i]).map((f) => f.nombre))}
          etiquetaDelMenu="Más formato"
          rol="menuitemcheckbox"
          opciones={MAS_FORMATO.map((formato, i) => ({
            etiqueta: formato.etiqueta,
            icono: formato.icono,
            marcada: estado.masFormato[i] ?? false,
            // Con código en línea, solo «Código» (para quitarlo).
            deshabilitada: estado.conCodigo && formato.marca !== 'code',
            razon: idRazonCodigo,
          }))}
          alElegir={(indice) => {
            const formato = MAS_FORMATO[indice];
            if (editor && formato) editor.chain().focus().toggleMark(formato.marca).run();
          }}
          bloqueado={sinEditor || estado.sinMarcas}
          ctl={ctl('mas-formato')}
        >
          Más formato
          {estado.masFormato.some(Boolean) && (
            // Marca que no depende del color: algo de «Más formato» está activo.
            <span aria-hidden="true" className="size-2 rounded-full bg-current" />
          )}
          <Icono nombre="bajar" />
        </MenuDeLaBarra>
        <MenuDeLaBarra
          editor={editor}
          nombre={`Alineación: ${
            estado.alineacion === 'varias'
              ? 'varias'
              : (ALINEACIONES.find((opcion) => opcion.valor === estado.alineacion)?.nombre ?? 'izquierda')
          }`}
          etiquetaDelMenu="Alineación"
          rol="menuitemradio"
          opciones={ALINEACIONES.map((opcion) => ({
            etiqueta: opcion.etiqueta,
            icono: opcion.valor ? ICONOS_DE_ALINEACION[opcion.valor] : 'alinear_izquierda',
            marcada: opcion.valor === estado.alineacion,
          }))}
          alElegir={(indice) => editor && alinear(editor, ALINEACIONES[indice]?.valor ?? null)}
          bloqueado={sinEditor || !estado.alineable}
          ctl={ctl('alineacion')}
          soloIcono
        >
          <Icono
            nombre={
              (typeof estado.alineacion === 'string' && ICONOS_DE_ALINEACION[estado.alineacion]) || 'alinear_izquierda'
            }
          />
        </MenuDeLaBarra>
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
          seleccion.elementos.length === 1 &&
          seleccion.elementos[0]?.type !== 'horizontalRule' &&
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
        {(
          [
            [razonCodigo, RAZON_CODIGO],
            [razonAlineacion, RAZON_ALINEACION],
          ] as const
        ).map(
          ([id, texto]) =>
            id && (
              <span
                key={id}
                id={id}
                role="tooltip"
                className={cn(
                  'absolute top-full left-0 z-20 mt-1 rounded-md bg-texto px-3 py-2 text-sm text-fondo shadow-tarjeta',
                  aviso !== id && 'hidden',
                )}
              >
                {texto}
              </span>
            ),
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
