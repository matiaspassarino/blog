// T097 (spec 005, ampliación; research D23 y D31 C12; constitución §VI.3): prueba de contrato del editor. El esquema
// de ProseMirror que arman las extensiones (`getSchema(crearExtensiones(…))`) tiene EXACTAMENTE los nodos, las
// marcas y los atributos de la lista permitida (contracts/documento.md; Fase 10 y, desde T126, Fase 12): el editor no ofrece nada que
// `esquemaDocumento` rechace ni al revés. La alineación, los formatos nuevos y la tabla llegan en las Fases 12 y 13
// (T130 y T145 amplían esta prueba).
//
// Firma (existe hoy): crearExtensiones(devoluciones: DevolucionesDelEditor): AnyExtension[]. Lo que cambia (T109):
//   - nodos propios `imagen`, `galeria`, `cta` y `video` (antes `imagenBloque`…) con sus campos como attrs planos;
//   - `id` en lugar de `bloqueId`, sin `continuacion`;
//   - sin `language` en `codeBlock` (queda `lenguaje`), sin `target`, `rel`, `class` ni `title` en `link` y sin
//     `start` ni `type` en `orderedList` (atributos de la librería que la lista permitida no tiene);
//   - `code` excluye cualquier otra marca.
import { getSchema } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { describe, expect, it, vi } from 'vitest';
import { crearExtensiones, type DevolucionesDelEditor } from './extensiones';

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

const esquema: Schema = getSchema(crearExtensiones(devoluciones));

const ordenados = (valores: Iterable<string>) => [...valores].sort();
const atributosDe = (spec: { attrs?: Record<string, unknown> | null } | undefined) =>
  ordenados(Object.keys(spec?.attrs ?? {}));

// La lista permitida de la Fase 10 (contracts/documento.md): nodo → atributos.
const NODOS: Record<string, string[]> = {
  doc: [],
  text: [],
  hardBreak: [],
  // Fase 12 (T126, RF-024): la alineación solo en párrafos y títulos.
  paragraph: ['id', 'textAlign'],
  heading: ['id', 'level', 'textAlign'],
  bulletList: ['id'],
  orderedList: ['id'],
  listItem: [],
  blockquote: ['autor', 'fuente', 'id'],
  codeBlock: ['id', 'lenguaje'],
  horizontalRule: ['id'],
  // Fase 13 (T135, RF-028, contracts/documento.md): tablas sin colwidth.
  table: ['descripcion', 'id'],
  tableRow: [],
  tableHeader: ['colspan', 'rowspan'],
  tableCell: ['colspan', 'rowspan'],
  imagen: ['id', 'imagen', 'leyenda'],
  galeria: ['columnas', 'id', 'imagenes'],
  cta: ['etiquetaBoton', 'id', 'texto', 'titulo', 'url', 'variante'],
  video: ['id', 'idVideo', 'proveedor', 'titulo'],
};
const MARCAS: Record<string, string[]> = {
  link: ['href'],
  bold: [],
  italic: [],
  code: [],
  // Fase 12 (T126, RF-009): los cinco formatos nuevos, sin atributos (el resaltado, sin `color`).
  underline: [],
  strike: [],
  highlight: [],
  superscript: [],
  subscript: [],
};
const MARCAS_QUE_NO_SON_CODIGO = [
  'bold',
  'italic',
  'link',
  'underline',
  'strike',
  'highlight',
  'superscript',
  'subscript',
];

describe('extensiones: el esquema del editor es la lista permitida (§VI.3)', () => {
  it('tiene exactamente los nodos de la lista permitida', () => {
    expect(ordenados(Object.keys(esquema.nodes))).toEqual(ordenados(Object.keys(NODOS)));
  });

  it('tiene exactamente las marcas de la lista permitida', () => {
    expect(ordenados(Object.keys(esquema.marks))).toEqual(ordenados(Object.keys(MARCAS)));
  });

  it.each(Object.entries(NODOS))('el nodo %s tiene exactamente los atributos %j', (nombre, atributos) => {
    expect(atributosDe(esquema.nodes[nombre]?.spec)).toEqual(ordenados(atributos));
  });

  it.each(Object.entries(MARCAS))('la marca %s tiene exactamente los atributos %j', (nombre, atributos) => {
    expect(atributosDe(esquema.marks[nombre]?.spec)).toEqual(ordenados(atributos));
  });

  it('ningún nodo conserva los atributos del formato anterior (bloqueId, continuacion, bloque)', () => {
    const viejos = Object.values(esquema.nodes).flatMap((tipo) =>
      Object.keys(tipo.spec.attrs ?? {}).filter((atributo) =>
        ['bloqueId', 'continuacion', 'bloque'].includes(atributo),
      ),
    );

    expect(viejos).toEqual([]);
  });

  it('los atributos de la librería que no se guardan están fuera del esquema (language, target, rel, class)', () => {
    expect(Object.keys(esquema.nodes.codeBlock?.spec.attrs ?? {})).not.toContain('language');
    for (const atributo of ['target', 'rel', 'class']) {
      expect(Object.keys(esquema.marks.link?.spec.attrs ?? {}), atributo).not.toContain(atributo);
    }
  });
});

describe('extensiones: reglas de contenido de la lista permitida', () => {
  it('H6-E3: code excluye cualquier otra marca (las otras ocho)', () => {
    const codigo = esquema.marks.code;

    for (const otra of MARCAS_QUE_NO_SON_CODIGO) {
      expect(esquema.marks[otra], `falta la marca ${otra}`).toBeDefined();
      expect(codigo?.excludes(esquema.marks[otra]!), otra).toBe(true);
    }
  });

  it('H6-E3: un texto con código no suma otro formato (ProseMirror descarta la marca nueva)', () => {
    const conCodigo = [esquema.marks.code!.create()];

    for (const otra of MARCAS_QUE_NO_SON_CODIGO) {
      const marca = esquema.marks[otra]?.create(otra === 'link' ? { href: '/x' } : null);
      expect(marca, `falta la marca ${otra}`).toBeDefined();
      expect(
        marca!.addToSet(conCodigo).map((m) => m.type.name),
        otra,
      ).toEqual(['code']);
    }
  });

  it('H6-E2: aplicar subíndice a un superíndice lo reemplaza, y al revés (se excluyen entre sí)', () => {
    const { superscript, subscript } = esquema.marks;

    expect(superscript, 'falta superscript').toBeDefined();
    expect(subscript, 'falta subscript').toBeDefined();
    expect(
      subscript!
        .create()
        .addToSet([superscript!.create()])
        .map((m) => m.type.name),
    ).toEqual(['subscript']);
    expect(
      superscript!
        .create()
        .addToSet([subscript!.create()])
        .map((m) => m.type.name),
    ).toEqual(['superscript']);
  });

  it('H6-E3: negrita, cursiva, subrayado, tachado, resaltado y enlace se combinan entre sí', () => {
    const combinables = ['bold', 'italic', 'link', 'underline', 'strike', 'highlight'];

    for (const una of combinables) {
      for (const otra of combinables.filter((nombre) => nombre !== una)) {
        expect(esquema.marks[una]?.excludes(esquema.marks[otra]!), `${una} con ${otra}`).toBe(false);
      }
    }
  });

  it('el superíndice y el subíndice se combinan con los formatos que no son código', () => {
    for (const indice of ['superscript', 'subscript']) {
      for (const otra of ['bold', 'italic', 'link', 'underline', 'strike', 'highlight']) {
        expect(esquema.marks[indice]?.excludes(esquema.marks[otra]!), `${indice} con ${otra}`).toBe(false);
      }
    }
  });

  it('RF-024: la alineación por defecto (izquierda) no se guarda: el valor por defecto es null', () => {
    for (const nodo of ['paragraph', 'heading']) {
      const atributo = esquema.nodes[nodo]?.spec.attrs?.textAlign as { default?: unknown } | undefined;

      expect(atributo, `${nodo} sin textAlign`).toBeDefined();
      expect(atributo?.default ?? null, nodo).toBeNull();
    }
  });

  it('RF-024: un párrafo alineado del contrato se arma con el esquema del editor y conserva la alineación', () => {
    const nodo = esquema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { id: '00000000-0000-4000-8000-000000000003', level: 2, textAlign: 'center' },
          content: [{ type: 'text', text: 'Centrado', marks: [{ type: 'underline' }] }],
        },
        {
          type: 'paragraph',
          attrs: { id: '00000000-0000-4000-8000-000000000004', textAlign: 'justify' },
          content: [
            { type: 'text', text: 'm' },
            { type: 'text', text: '2', marks: [{ type: 'superscript' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'ojo', marks: [{ type: 'highlight' }] },
          ],
        },
      ],
    });

    expect(nodo.child(0).attrs.textAlign).toBe('center');
    expect(nodo.child(1).attrs.textAlign).toBe('justify');
    expect(
      nodo
        .child(1)
        .child(1)
        .marks.map((marca) => marca.type.name),
    ).toEqual(['superscript']);
  });

  it('bold, italic y link se combinan entre sí', () => {
    const { bold, italic, link } = esquema.marks;

    expect(bold?.excludes(italic!)).toBe(false);
    expect(bold?.excludes(link!)).toBe(false);
    expect(italic?.excludes(link!)).toBe(false);
  });

  it('el codeBlock no admite marcas', () => {
    expect(esquema.nodes.codeBlock?.spec.marks).toBe('');
  });

  it('RF-009: los títulos admiten marcas', () => {
    const marcas = esquema.nodes.heading?.spec.marks;

    expect(marcas === undefined || marcas === '_').toBe(true);
  });

  it('las citas y los ítems de lista tienen un solo párrafo', () => {
    expect(esquema.nodes.blockquote?.spec.content).toBe('paragraph');
    expect(esquema.nodes.listItem?.spec.content).toBe('paragraph');
  });

  it.each(['imagen', 'galeria', 'cta', 'video'])(
    'el elemento especial %s es atómico (se edita en el panel)',
    (nombre) => {
      expect(esquema.nodes[nombre]?.spec.atom).toBe(true);
    },
  );

  it('un documento del contrato se arma con el esquema del editor (attrs planos e id)', () => {
    const documento = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { id: '00000000-0000-4000-8000-000000000001' },
          content: [
            { type: 'text', text: 'Hola', marks: [{ type: 'link', attrs: { href: '/blog' } }, { type: 'bold' }] },
          ],
        },
        {
          type: 'imagen',
          attrs: {
            id: '00000000-0000-4000-8000-000000000002',
            imagen: { ruta: 'articulos/a.webp', ancho: 4, alto: 3, alt: 'Una foto', decorativa: false },
          },
        },
      ],
    };

    const nodo = esquema.nodeFromJSON(documento);

    expect(nodo.child(1).attrs).toMatchObject({ id: '00000000-0000-4000-8000-000000000002' });
    expect(nodo.child(0).attrs).toMatchObject({ id: '00000000-0000-4000-8000-000000000001' });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T126 (spec 005, Fase 12; contracts/atajos.md "Atajos"; research D28 y D31 U11): atajos de los formatos nuevos.
// Se leen las teclas que declara cada extensión (`addKeyboardShortcuts`) de un editor sin montar (sin DOM).
//   - `Mod+U` subraya (botón de la barra).
//   - Superíndice y subíndice: `Ctrl+.` y `Ctrl+,` fuera de macOS; en macOS, ninguno (`Cmd+,` abre la configuración
//     y `Cmd+.` detiene la carga en Safari).
//   - Sin atajo para tachado, resaltado y alineación: se desactivan los que traen `Strike` (`Mod-Shift-s`),
//     `Highlight` (`Mod-Shift-h`) y `TextAlign` (`Mod-Shift-l`, `-e`, `-r` y `-j`).
// FASE ROJA: hoy no hay subrayado ni las extensiones nuevas.
// ---------------------------------------------------------------------------------------------------------------------

const NAVEGADORES = {
  windows: {
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0',
    maxTouchPoints: 0,
  },
  mac: {
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    maxTouchPoints: 0,
  },
};

/** Teclas (en minúsculas) → extensiones que las declaran, con `navigator` del sistema indicado. */
async function atajosEn(sistema: keyof typeof NAVEGADORES) {
  vi.stubGlobal('navigator', NAVEGADORES[sistema]);
  // `isiOS` de la librería mira `'ontouchend' in document` cuando el agente dice Mac: un documento vacío alcanza (el
  // editor no se monta: `element: null`).
  if (sistema === 'mac') vi.stubGlobal('document', { createElement: () => ({}) });
  vi.resetModules();
  try {
    const nucleo = await import('@tiptap/core');
    const { crearExtensiones: crear } = await import('./extensiones');
    const editor = new nucleo.Editor({
      element: null,
      extensions: crear(devoluciones),
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    const atajos = new Map<string, string[]>();
    for (const extension of editor.extensionManager.extensions) {
      const agregar = nucleo.getExtensionField<(() => Record<string, unknown>) | undefined>(
        extension,
        'addKeyboardShortcuts',
        {
          name: extension.name,
          options: extension.options,
          storage: editor.extensionStorage[extension.name as keyof typeof editor.extensionStorage],
          editor,
          type: nucleo.getSchemaTypeByName(extension.name, editor.schema),
        },
      );
      for (const tecla of Object.keys(agregar?.() ?? {})) {
        const clave = tecla.toLowerCase();
        atajos.set(clave, [...(atajos.get(clave) ?? []), extension.name]);
      }
    }
    editor.destroy();
    return atajos;
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
}

describe('extensiones: atajos de los formatos nuevos (contracts/atajos.md)', () => {
  it('H6-E1: Mod+U subraya', async () => {
    const atajos = await atajosEn('windows');

    expect(atajos.has('mod-u'), [...atajos.keys()].join(' ')).toBe(true);
  });

  it('H6-E1: fuera de macOS, Ctrl+. es superíndice y Ctrl+, es subíndice', async () => {
    const atajos = await atajosEn('windows');
    const tiene = (...teclas: string[]) => teclas.some((tecla) => atajos.has(tecla));

    expect(tiene('ctrl-.', 'mod-.'), 'superíndice').toBe(true);
    expect(tiene('ctrl-,', 'mod-,'), 'subíndice').toBe(true);
  });

  it('D31 U11: en macOS el superíndice y el subíndice no tienen atajo (Cmd+, y Cmd+. son del sistema)', async () => {
    const atajos = await atajosEn('mac');

    for (const tecla of ['mod-.', 'mod-,', 'meta-.', 'meta-,', 'cmd-.', 'cmd-,', 'ctrl-.', 'ctrl-,']) {
      expect(atajos.get(tecla), tecla).toBeUndefined();
    }
    // Subrayado sí (Cmd+U no choca).
    expect(atajos.has('mod-u')).toBe(true);
  });

  it.each([
    ['tachado (Strike)', 'mod-shift-s'],
    ['resaltado (Highlight)', 'mod-shift-h'],
    ['alineación a la izquierda (TextAlign)', 'mod-shift-l'],
    ['alineación al centro (TextAlign)', 'mod-shift-e'],
    ['alineación a la derecha (TextAlign)', 'mod-shift-r'],
    ['justificado (TextAlign)', 'mod-shift-j'],
  ])('D28: el atajo por defecto de %s está desactivado (%s)', async (_caso, tecla) => {
    const atajos = await atajosEn('windows');

    expect(atajos.get(tecla), tecla).toBeUndefined();
  });

  it('D28: las extensiones strike, highlight y textAlign no declaran ningún atajo', async () => {
    const atajos = await atajosEn('windows');
    const nombres = new Set(['strike', 'highlight', 'textAlign']);
    const propios = [...atajos.entries()].filter(([, extensiones]) =>
      extensiones.some((nombre) => nombres.has(nombre)),
    );

    // Que las extensiones existan lo prueba el contrato del esquema (marcas y textAlign); acá, que no traigan teclas.
    expect(propios).toEqual([]);
  });

  it('los atajos de antes siguen: Mod+B, Mod+I, Mod+E y Mod+K', async () => {
    const atajos = await atajosEn('windows');

    for (const tecla of ['mod-b', 'mod-i', 'mod-e', 'mod-k']) expect(atajos.has(tecla), tecla).toBe(true);
  });
});
