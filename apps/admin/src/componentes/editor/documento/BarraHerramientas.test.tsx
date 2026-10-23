// T038 (spec 005, RF-003, RF-005, RF-019; contracts/componentes.md "BarraHerramientas" y contracts/atajos.md "Roles y
// nombres"): la barra de herramientas con render estático (`renderToStaticMarkup`, entorno `node`; sin jsdom). La
// interacción (flechas, enlace, foco, «Más») se prueba en E2E (editor-documento.spec.ts).
// FASE ROJA: `./BarraHerramientas` no existe. API supuesta:
//   export function BarraHerramientas(props: { editor: Editor | null; deshabilitada: boolean; seleccion: SeleccionDelDocumento })
//   (export con nombre). Con `editor = null` (así se renderiza en el servidor y mientras carga la librería) la barra se
//   dibuja completa, con todos los controles de formato en `aria-disabled="true"` y el selector de estilo en «Párrafo».
//   - `role="toolbar"` con `aria-label="Formato del texto"`.
//   - Un solo control tabulable (`tabindex="0"`); los demás `tabindex="-1"` (incluido el botón «Más acciones»).
//   - Botones (nombre = `aria-label` o su texto): «Negrita», «Cursiva», «Código» y «Lista con viñetas» y «Lista numerada»
//     con `aria-pressed`; «Enlace», «Insertar», «Deshacer», «Rehacer», «Acciones» (`aria-haspopup="menu"`,
//     `aria-expanded="false"`) y el selector de estilo (nombre que empieza con «Estilo de párrafo», texto visible
//     «Párrafo»).
//   - «Insertar» siempre visible: nunca dentro del panel de `MasAcciones`.
//   - Todos los botones son de la primitiva `Button`: `data-nivel="terciaria"` y `data-tamanio="compacto"`.
//   - Con `seleccion = { tipo: 'elementos', ... }` muestra el texto fijo «N elementos seleccionados» y el botón «Salir de
//     la selección»; con `{ tipo: 'texto' }` no.
//
// T126 (spec 005, Fase 12, H6 esc. 1 a 4; RF-003, RF-009, RF-024; contracts/atajos.md "Roles y nombres" y research
// D28 y D31 U5 y U10): la barra con los formatos nuevos. Además del render con `editor = null`, se dibuja con un editor
// SIN MONTAR (`new Editor({ element: null, … })`, sin DOM) y con `useEditorState` simulado para que calcule el estado
// con ese editor (en el servidor la librería entrega siempre `null`). Decisiones de interfaz que fija esta prueba:
//   - «Código» pasa a «Más formato» (D28): la barra muestra «Negrita», «Cursiva», «Subrayado» (con `aria-pressed`) y
//     «Enlace»; «Más formato» (`aria-haspopup="menu"`) agrupa tachado, resaltado, código, superíndice y subíndice
//     como `menuitemcheckbox` (eso, con el menú abierto, lo prueba el E2E).
//   - «Más formato» se llama "Más formato" y, con un formato suyo activo, "Más formato, resaltado activo" (con varios,
//     "Más formato, <a> y <b> activos"), y suma una marca que no depende del color (un elemento más dentro del botón).
//   - «Alineación» es un botón con `aria-haspopup="menu"` y el nombre "Alineación: izquierda" (centro, derecha,
//     justificado, o "varias" si la selección mezcla). Fuera de párrafos y títulos no se oculta: `aria-disabled` y la
//     razón "La alineación es solo para párrafos y títulos" por `aria-describedby`.
//   - Con código en línea activo, «Negrita», «Cursiva», «Subrayado» y «Enlace» llevan `aria-disabled` y la razón "El
//     código no admite otros formatos" por `aria-describedby`; «Más formato» sigue habilitado (adentro está «Código»
//     para quitarlo).
//   - Los títulos admiten formatos (se quita `estado.sinMarcas` de los títulos, D31 U5).
import type { Elemento } from '@blog/bloques';
import { Editor, getSchema, type JSONContent } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type * as ReactDeTiptap from '@tiptap/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ancestrosEn, clasesDeEtiqueta, etiquetasDe } from '../../../pruebas/html-estatico';
import { BarraHerramientas } from './BarraHerramientas';
import { crearExtensiones, type DevolucionesDelEditor } from './extensiones';

// En el servidor `useEditorState` siempre entrega `editor: null` (getServerSnapshot). Para dibujar la barra con un estado
// real, se calcula el selector con el editor que recibe (sin montar). Con `editor = null` es igual que antes.
vi.mock('@tiptap/react', async (original) => ({
  ...(await original<typeof ReactDeTiptap>()),
  useEditorState: <T,>({
    editor,
    selector,
  }: {
    editor: Editor | null;
    selector: (contexto: { editor: Editor | null; transactionNumber: number }) => T;
  }) => selector({ editor, transactionNumber: 0 }),
}));

type Props = Parameters<typeof BarraHerramientas>[0];

const parrafos = (cantidad: number): Elemento[] =>
  Array.from({ length: cantidad }, (_, i) => ({
    type: 'paragraph',
    attrs: { id: `00000000-0000-4000-8000-00000000000${i}` },
    content: [{ type: 'text', text: `P${i}` }],
  }));

const dibujar = (cambios: Partial<Props> = {}) =>
  renderToStaticMarkup(
    <BarraHerramientas editor={null} deshabilitada={false} seleccion={{ tipo: 'texto' }} {...cambios} />,
  );

type Boton = { nombre: string; atributos: Record<string, string>; inicio: number };

/** Los `<button>` del HTML con su nombre accesible (`aria-label` o texto, sin etiquetas) y sus atributos. */
function botonesDe(html: string): Boton[] {
  const aperturas = etiquetasDe(html).filter((e) => e.nombre === 'button');
  return aperturas.map((boton) => {
    const resto = html.slice(boton.inicio + boton.apertura.length);
    const texto = resto
      .slice(0, resto.indexOf('</button>'))
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { nombre: boton.atributos['aria-label'] ?? texto, atributos: boton.atributos, inicio: boton.inicio };
  });
}

const botonLlamado = (html: string, nombre: string | RegExp) =>
  botonesDe(html).find((b) => (typeof nombre === 'string' ? b.nombre === nombre : nombre.test(b.nombre)));

describe('BarraHerramientas: rol y nombre (RF-003)', () => {
  it('es un role="toolbar" con el nombre "Formato del texto"', () => {
    const barra = etiquetasDe(dibujar()).find((e) => e.atributos.role === 'toolbar');

    expect(barra, dibujar()).toBeDefined();
    expect(barra?.atributos['aria-label']).toBe('Formato del texto');
  });

  it('tiene los controles de formato, lista, enlace, inserción, acciones y deshacer o rehacer', () => {
    const html = dibujar();

    for (const nombre of [
      'Negrita',
      'Cursiva',
      'Subrayado',
      'Más formato',
      'Enlace',
      'Lista con viñetas',
      'Lista numerada',
      'Insertar',
      'Acciones',
      'Deshacer',
      'Rehacer',
    ]) {
      expect(botonLlamado(html, nombre), nombre).toBeDefined();
    }
  });

  it('el selector de estilo de párrafo muestra el estilo vigente como texto', () => {
    const selector = botonLlamado(dibujar(), /^Estilo de párrafo/);

    expect(selector, dibujar()).toBeDefined();
    expect(selector?.nombre).toMatch(/Párrafo/);
    expect(selector?.atributos['aria-haspopup']).toBeTruthy();
  });

  it('"Acciones" abre un menú: aria-haspopup="menu" y aria-expanded="false" al empezar', () => {
    const acciones = botonLlamado(dibujar(), 'Acciones');

    expect(acciones?.atributos['aria-haspopup']).toBe('menu');
    expect(acciones?.atributos['aria-expanded']).toBe('false');
  });
});

describe('BarraHerramientas: un solo tope de tabulación (atajos.md "Barra")', () => {
  /** Controles que entran en el orden de tabulación: sin `tabindex="-1"`, sin `disabled` y fuera de un `inert`. */
  function tabulables(html: string) {
    const controles = etiquetasDe(html).filter(
      (e) =>
        ['button', 'input', 'select', 'textarea'].includes(e.nombre) ||
        (e.nombre === 'a' && 'href' in e.atributos) ||
        'tabindex' in e.atributos,
    );
    return controles.filter(
      (e) =>
        e.atributos.tabindex !== '-1' &&
        !('disabled' in e.atributos) &&
        !ancestrosEn(html, e.inicio).some((ancestro) => 'inert' in ancestro.atributos),
    );
  }

  it('exactamente un control tiene tabindex="0" y ninguno más es tabulable', () => {
    const html = dibujar();
    const tabulable = tabulables(html);

    expect(tabulable.map((e) => e.atributos.tabindex)).toEqual(['0']);
    expect(etiquetasDe(html).filter((e) => e.atributos.tabindex === '0')).toHaveLength(1);
  });

  it('con la barra deshabilitada sigue habiendo un solo tope de tabulación', () => {
    expect(tabulables(dibujar({ deshabilitada: true }))).toHaveLength(1);
  });
});

describe('BarraHerramientas: controles de estado (WCAG 1.4.1, RF-003 esc. 3)', () => {
  it.each(['Negrita', 'Cursiva', 'Subrayado', 'Lista con viñetas', 'Lista numerada'])(
    '«%s» expone su estado con aria-pressed (no solo con color)',
    (nombre) => {
      const boton = botonLlamado(dibujar(), nombre);

      expect(boton?.atributos['aria-pressed'], nombre).toBe('false');
    },
  );

  it.each(['Insertar', 'Deshacer', 'Rehacer'])('«%s» es una acción: no lleva aria-pressed', (nombre) => {
    expect(botonLlamado(dibujar(), nombre)?.atributos['aria-pressed'], nombre).toBeUndefined();
  });

  it('sin cursor en el lienzo (editor = null) los controles de formato están en aria-disabled="true"', () => {
    for (const nombre of [
      'Negrita',
      'Cursiva',
      'Subrayado',
      'Más formato',
      'Enlace',
      'Lista con viñetas',
      'Lista numerada',
    ]) {
      expect(botonLlamado(dibujar(), nombre)?.atributos['aria-disabled'], nombre).toBe('true');
    }
    expect(botonLlamado(dibujar(), /^Alineación/)?.atributos['aria-disabled'], 'Alineación').toBe('true');
  });

  it('con la barra deshabilitada todos los controles de formato están en aria-disabled="true"', () => {
    for (const nombre of ['Negrita', 'Cursiva', 'Subrayado', 'Más formato', 'Enlace', 'Insertar']) {
      expect(botonLlamado(dibujar({ deshabilitada: true }), nombre)?.atributos['aria-disabled'], nombre).toBe('true');
    }
  });
});

describe('BarraHerramientas: «Insertar» siempre visible (RF-005)', () => {
  it('«Insertar» no está dentro del panel de «Más acciones»', () => {
    const html = dibujar();
    const mas = botonLlamado(html, 'Más acciones');
    const insertar = botonLlamado(html, 'Insertar');
    const idPanel = mas?.atributos['aria-controls'];

    expect(insertar, html).toBeDefined();
    if (idPanel) {
      const ancestros = ancestrosEn(html, insertar!.inicio);
      expect(ancestros.some((a) => a.atributos.id === idPanel)).toBe(false);
    }
  });

  it('«Insertar» no está oculto: ni hidden, ni inert, ni aria-hidden, ni una clase que lo oculte', () => {
    const html = dibujar();
    const posicion = botonLlamado(html, 'Insertar')?.inicio;
    const insertar = etiquetasDe(html).find((e) => e.inicio === posicion);

    expect(insertar).toBeDefined();
    expect(insertar?.atributos).not.toHaveProperty('hidden');
    expect(insertar?.atributos).not.toHaveProperty('inert');
    expect(insertar?.atributos['aria-hidden']).toBeUndefined();
    expect(clasesDeEtiqueta(insertar).filter((c) => /(^|:)hidden$/.test(c))).toEqual([]);
  });
});

describe('BarraHerramientas: botones de la primitiva (RF-003, spec 004)', () => {
  it('todos son terciaria y compacto', () => {
    const botones = botonesDe(dibujar());

    expect(botones.length).toBeGreaterThanOrEqual(10);
    for (const boton of botones) {
      expect(boton.atributos['data-nivel'], boton.nombre).toBe('terciaria');
      expect(boton.atributos['data-tamanio'], boton.nombre).toBe('compacto');
    }
  });

  it('es sticky top-0', () => {
    const barra = etiquetasDe(dibujar()).find((e) => e.atributos.role === 'toolbar');
    const clases = clasesDeEtiqueta(barra);

    expect(clases).toContain('sticky');
    expect(clases).toContain('top-0');
  });
});

describe('BarraHerramientas: modo elementos (atajos.md "Dos modos de selección")', () => {
  it('muestra "3 elementos seleccionados" y «Salir de la selección»', () => {
    const html = dibujar({ seleccion: { tipo: 'elementos', desde: 0, hasta: 3, elementos: parrafos(3) } });

    expect(html).toContain('3 elementos seleccionados');
    expect(botonLlamado(html, 'Salir de la selección'), html).toBeDefined();
  });

  it('con un texto seleccionado no muestra el conteo ni el botón de salida', () => {
    const html = dibujar();

    expect(html).not.toContain('elementos seleccionados');
    expect(botonLlamado(html, 'Salir de la selección')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T126 (Fase 12): la barra con un editor sin montar.
// ---------------------------------------------------------------------------------------------------------------------

const sinEfecto = () => undefined;
const devoluciones = {
  salioDelModo: sinEfecto,
  cerrarHojaPendiente: () => false,
  proteccion: {},
  anunciar: sinEfecto,
  menuAbierto: () => false,
  alPropiedades: sinEfecto,
  alMenu: sinEfecto,
  alTeclearMenu: () => false,
  alConvertir: sinEfecto,
} as unknown as DevolucionesDelEditor;
const esquemaDelEditor = getSchema(crearExtensiones(devoluciones));

const RAZON_CODIGO = 'El código no admite otros formatos';
const RAZON_ALINEACION = 'La alineación es solo para párrafos y títulos';

let siguienteId = 0;
const id = () => `00000000-0000-4000-8000-${String(++siguienteId).padStart(12, '0')}`;
type Marca = { type: string; attrs?: Record<string, unknown> };
const texto = (contenido: string, ...marcas: Marca[]): JSONContent =>
  marcas.length > 0 ? { type: 'text', text: contenido, marks: marcas } : { type: 'text', text: contenido };
const parrafo = (attrs: Record<string, unknown>, ...contenido: JSONContent[]): JSONContent => ({
  type: 'paragraph',
  attrs: { id: id(), ...attrs },
  content: contenido,
});
const titulo = (attrs: Record<string, unknown>, ...contenido: JSONContent[]): JSONContent => ({
  type: 'heading',
  attrs: { id: id(), level: 2, ...attrs },
  content: contenido,
});
const cita = (...contenido: JSONContent[]): JSONContent => ({
  type: 'blockquote',
  attrs: { id: id() },
  content: [{ type: 'paragraph', content: contenido }],
});
const vinetas = (...contenido: JSONContent[]): JSONContent => ({
  type: 'bulletList',
  attrs: { id: id() },
  content: [{ type: 'listItem', content: [{ type: 'paragraph', content: contenido }] }],
});
const codigo = (contenido: string): JSONContent => ({
  type: 'codeBlock',
  attrs: { id: id() },
  content: [texto(contenido)],
});
const imagen = (): JSONContent => ({
  type: 'imagen',
  attrs: { id: id(), imagen: { ruta: 'articulos/a.webp', ancho: 4, alto: 3, alt: 'Una foto', decorativa: false } },
});

/**
 * Comprueba que el esquema del editor tiene las marcas y los atributos que usa el documento (si no, la librería lo
 * descartaría o intentaría leerlo como HTML): en la fase roja falla con un mensaje claro.
 */
function comprobarEsquema(nodo: JSONContent) {
  if (nodo.type && !esquemaDelEditor.nodes[nodo.type]) {
    throw new Error(`El esquema del editor no tiene el nodo "${nodo.type}"`);
  }
  for (const marca of nodo.marks ?? []) {
    if (!esquemaDelEditor.marks[marca.type]) throw new Error(`El esquema del editor no tiene la marca "${marca.type}"`);
  }
  for (const atributo of Object.keys(nodo.attrs ?? {})) {
    if (!(atributo in (esquemaDelEditor.nodes[nodo.type ?? '']?.spec.attrs ?? {}))) {
      throw new Error(`El esquema del editor no tiene el atributo "${atributo}" en "${nodo.type}"`);
    }
  }
  nodo.content?.forEach(comprobarEsquema);
}

/** Un editor sin montar con estos elementos. */
function editorCon(...elementos: JSONContent[]) {
  const contenido: JSONContent = { type: 'doc', content: elementos };
  comprobarEsquema(contenido);
  return new Editor({ element: null, extensions: crearExtensiones(devoluciones), content: contenido });
}

/** Selecciona el texto indicado (la primera vez que aparece) o, con `cursor`, deja el cursor en su medio. */
function seleccionar(editor: Editor, buscado: string, { cursor = false } = {}) {
  let desde = -1;
  editor.state.doc.descendants((nodo, pos) => {
    if (desde >= 0) return false;
    if (!nodo.isText) return true;
    const indice = (nodo.text ?? '').indexOf(buscado);
    if (indice >= 0) desde = pos + indice;
    return false;
  });
  if (desde < 0) throw new Error(`No está el texto "${buscado}"`);
  const medio = desde + Math.floor(buscado.length / 2);
  const seleccion = cursor
    ? TextSelection.create(editor.state.doc, medio)
    : TextSelection.create(editor.state.doc, desde, desde + buscado.length);
  editor.view.dispatch(editor.state.tr.setSelection(seleccion));
  return editor;
}

/** Selecciona entero el elemento de primer nivel `indice` (un elemento especial: NodeSelection). */
function seleccionarElemento(editor: Editor, indice: number) {
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += editor.state.doc.child(i).nodeSize;
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
  return editor;
}

const dibujarCon = (editor: Editor) => dibujar({ editor });

/** El texto del elemento (o de los elementos) que nombra el `aria-describedby` del botón. */
function descripcionDe(html: string, boton: Boton | undefined) {
  const ids = (boton?.atributos['aria-describedby'] ?? '').split(/\s+/).filter(Boolean);
  return ids
    .map((idDescripcion) => {
      const etiqueta = etiquetasDe(html).find((e) => e.atributos.id === idDescripcion);
      if (!etiqueta) return '';
      const resto = html.slice(etiqueta.inicio + etiqueta.apertura.length);
      const cierre = resto.indexOf(`</${etiqueta.nombre}>`);
      return resto
        .slice(0, cierre < 0 ? undefined : cierre)
        .replace(/<[^>]*>/g, '')
        .trim();
    })
    .join(' ');
}

const FORMATOS_DE_LA_BARRA = ['Negrita', 'Cursiva', 'Subrayado', 'Enlace'];

describe('BarraHerramientas: subrayado, «Más formato» y «Alineación» (H6, RF-003)', () => {
  it('H6-E1: «Subrayado» está en la barra, con aria-pressed', () => {
    const subrayado = botonLlamado(dibujar(), 'Subrayado');

    expect(subrayado, dibujar()).toBeDefined();
    expect(subrayado?.atributos['aria-pressed']).toBe('false');
    expect(subrayado?.atributos['data-nivel']).toBe('terciaria');
  });

  it('D28: «Código» ya no es un botón de la barra: vive en «Más formato»', () => {
    expect(botonLlamado(dibujar(), 'Código')).toBeUndefined();
  });

  it('H6-E1: «Más formato» abre un menú: aria-haspopup="menu" y aria-expanded="false"', () => {
    const mas = botonLlamado(dibujar(), /^Más formato/);

    expect(mas, dibujar()).toBeDefined();
    expect(mas?.nombre).toBe('Más formato');
    expect(mas?.atributos['aria-haspopup']).toBe('menu');
    expect(mas?.atributos['aria-expanded']).toBe('false');
  });

  it('H6-E4: «Alineación» abre un menú y dice la alineación vigente: "Alineación: izquierda"', () => {
    const html = dibujarCon(seleccionar(editorCon(parrafo({}, texto('Un párrafo'))), 'párrafo', { cursor: true }));
    const alineacion = botonLlamado(html, /^Alineación/);

    expect(alineacion, html).toBeDefined();
    expect(alineacion?.nombre).toBe('Alineación: izquierda');
    expect(alineacion?.atributos['aria-haspopup']).toBe('menu');
    expect(alineacion?.atributos['aria-expanded']).toBe('false');
    expect(alineacion?.atributos['aria-disabled']).toBeUndefined();
  });

  it('el subrayado, «Más formato» y «Alineación» son de la primitiva (terciaria y compacto) y no se tabulan', () => {
    const html = dibujar();

    for (const nombre of ['Subrayado', /^Más formato/, /^Alineación/]) {
      const boton = botonLlamado(html, nombre);
      expect(boton?.atributos['data-nivel'], String(nombre)).toBe('terciaria');
      expect(boton?.atributos['data-tamanio'], String(nombre)).toBe('compacto');
      expect(boton?.atributos.tabindex, String(nombre)).toBe('-1');
    }
  });
});

describe('BarraHerramientas: estado con el cursor en el lienzo (H6, editor sin montar)', () => {
  it('control: con un editor y el cursor en un párrafo, «Negrita» está habilitada', () => {
    const html = dibujarCon(seleccionar(editorCon(parrafo({}, texto('Hola mundo'))), 'Hola', { cursor: true }));

    expect(botonLlamado(html, 'Negrita')?.atributos['aria-disabled']).toBeUndefined();
  });

  it('H6-E1: con un texto subrayado, «Subrayado» está activo (aria-pressed="true")', () => {
    const editor = editorCon(parrafo({}, texto('Un '), texto('subrayado', { type: 'underline' })));
    const html = dibujarCon(seleccionar(editor, 'subrayado'));

    expect(botonLlamado(html, 'Subrayado')?.atributos['aria-pressed']).toBe('true');
  });

  it('H6-E1: con un texto resaltado, «Más formato» lo dice en su nombre y suma una marca que no es solo color', () => {
    const htmlSinNada = dibujarCon(seleccionar(editorCon(parrafo({}, texto('Normal'))), 'Normal'));
    const editor = editorCon(parrafo({}, texto('Un '), texto('resaltado', { type: 'highlight' })));
    const html = dibujarCon(seleccionar(editor, 'resaltado'));
    /** Cuántas etiquetas hay dentro del botón (ícono, marca…). */
    const interiores = (fuente: string, boton: Boton | undefined) => {
      if (!boton) return 0;
      const resto = fuente.slice(boton.inicio + 1);
      return etiquetasDe(resto.slice(0, resto.indexOf('</button>'))).length;
    };
    const sinNada = botonLlamado(htmlSinNada, /^Más formato/);
    const conResaltado = botonLlamado(html, /^Más formato/);

    expect(sinNada?.nombre).toBe('Más formato');
    expect(conResaltado?.nombre).toBe('Más formato, resaltado activo');
    expect(interiores(html, conResaltado)).toBeGreaterThan(interiores(htmlSinNada, sinNada));
  });

  it.each([
    ['tachado', { type: 'strike' }],
    ['superíndice', { type: 'superscript' }],
    ['subíndice', { type: 'subscript' }],
    ['código', { type: 'code' }],
  ])('H6-E1: con %s activo, «Más formato» lo nombra', (nombre, marca) => {
    const editor = editorCon(parrafo({}, texto('Un '), texto('formato', marca)));

    expect(botonLlamado(dibujarCon(seleccionar(editor, 'formato')), /^Más formato/)?.nombre).toBe(
      `Más formato, ${nombre} activo`,
    );
  });

  it.each([
    ['center', 'centro'],
    ['right', 'derecha'],
    ['justify', 'justificado'],
  ])('H6-E4: un párrafo con textAlign %j: "Alineación: %s"', (textAlign, nombre) => {
    const editor = editorCon(parrafo({ textAlign }, texto('Alineado')));

    expect(botonLlamado(dibujarCon(seleccionar(editor, 'Alineado', { cursor: true })), /^Alineación/)?.nombre).toBe(
      `Alineación: ${nombre}`,
    );
  });

  it('H6-E4: un título centrado: "Alineación: centro" y habilitada', () => {
    const editor = editorCon(titulo({ textAlign: 'center' }, texto('Centrado')));
    const alineacion = botonLlamado(dibujarCon(seleccionar(editor, 'Centrado', { cursor: true })), /^Alineación/);

    expect(alineacion?.nombre).toBe('Alineación: centro');
    expect(alineacion?.atributos['aria-disabled']).toBeUndefined();
  });

  it('D31 U10: una selección que mezcla alineaciones dice "Alineación: varias"', () => {
    const editor = editorCon(parrafo({}, texto('Izquierda')), parrafo({ textAlign: 'center' }, texto('Centro')));
    const { doc } = editor.state;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(doc, 2, doc.content.size - 2)));

    expect(botonLlamado(dibujarCon(editor), /^Alineación/)?.nombre).toBe('Alineación: varias');
  });

  it.each([
    ['una cita', () => seleccionar(editorCon(cita(texto('Una cita'))), 'cita', { cursor: true })],
    ['una lista', () => seleccionar(editorCon(vinetas(texto('Un ítem'))), 'ítem', { cursor: true })],
    ['un bloque de código', () => seleccionar(editorCon(codigo('const a = 1;')), 'const', { cursor: true })],
    ['un elemento especial', () => seleccionarElemento(editorCon(imagen(), parrafo({}, texto('Después'))), 0)],
  ])('H6-E4 / D31 U10: en %s, «Alineación» se ve pero queda aria-disabled con la razón', (_caso, armar) => {
    const html = dibujarCon(armar());
    const alineacion = botonLlamado(html, /^Alineación/);

    expect(alineacion, html).toBeDefined();
    expect(alineacion?.atributos['aria-disabled']).toBe('true');
    expect(descripcionDe(html, alineacion)).toContain(RAZON_ALINEACION);
  });

  it('H6-E4: en un párrafo, «Alineación» no lleva la razón de no disponible', () => {
    const html = dibujarCon(seleccionar(editorCon(parrafo({}, texto('Texto'))), 'Texto', { cursor: true }));
    const alineacion = botonLlamado(html, /^Alineación/);

    expect(alineacion, html).toBeDefined();
    expect(descripcionDe(html, alineacion)).not.toContain(RAZON_ALINEACION);
  });

  it('H6-E3: con código en línea activo, los demás formatos y «Enlace» quedan aria-disabled con la razón', () => {
    const editor = editorCon(parrafo({}, texto('Usa '), texto('npm install', { type: 'code' })));
    const html = dibujarCon(seleccionar(editor, 'npm install'));

    for (const nombre of FORMATOS_DE_LA_BARRA) {
      const boton = botonLlamado(html, nombre);
      expect(boton, nombre).toBeDefined();
      expect(boton?.atributos['aria-disabled'], nombre).toBe('true');
      expect(descripcionDe(html, boton), nombre).toContain(RAZON_CODIGO);
    }
  });

  it('H6-E3: con código en línea activo, «Más formato» sigue habilitado (adentro está «Código» para quitarlo)', () => {
    const editor = editorCon(parrafo({}, texto('Usa '), texto('npm install', { type: 'code' })));
    const mas = botonLlamado(dibujarCon(seleccionar(editor, 'npm install')), /^Más formato/);

    expect(mas).toBeDefined();
    expect(mas?.atributos['aria-disabled']).toBeUndefined();
  });

  it('H6-E3: sin código, los formatos no llevan la razón del código', () => {
    const html = dibujarCon(seleccionar(editorCon(parrafo({}, texto('Texto normal'))), 'Texto'));

    for (const nombre of FORMATOS_DE_LA_BARRA) {
      const boton = botonLlamado(html, nombre);
      expect(boton, nombre).toBeDefined();
      expect(boton?.atributos['aria-disabled'], nombre).toBeUndefined();
      expect(descripcionDe(html, boton), nombre).not.toContain(RAZON_CODIGO);
    }
  });

  it('RF-009 / D31 U5: en un título los formatos y el enlace están habilitados (sin estado.sinMarcas)', () => {
    const html = dibujarCon(seleccionar(editorCon(titulo({}, texto('Un título'))), 'título', { cursor: true }));

    for (const nombre of [...FORMATOS_DE_LA_BARRA, /^Más formato/]) {
      const boton = botonLlamado(html, nombre);
      expect(boton, String(nombre)).toBeDefined();
      expect(boton?.atributos['aria-disabled'], String(nombre)).toBeUndefined();
    }
  });
});
