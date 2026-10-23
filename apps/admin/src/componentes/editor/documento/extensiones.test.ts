// T097 (spec 005, ampliación; research D23 y D31 C12; constitución §VI.3): prueba de contrato del editor. El esquema
// de ProseMirror que arman las extensiones (`getSchema(crearExtensiones(…))`) tiene EXACTAMENTE los nodos, las
// marcas y los atributos de la lista permitida de la Fase 10 (contracts/documento.md): el editor no ofrece nada que
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
import { describe, expect, it } from 'vitest';
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
  paragraph: ['id'],
  heading: ['id', 'level'],
  bulletList: ['id'],
  orderedList: ['id'],
  listItem: [],
  blockquote: ['autor', 'fuente', 'id'],
  codeBlock: ['id', 'lenguaje'],
  horizontalRule: ['id'],
  imagen: ['id', 'imagen', 'leyenda'],
  galeria: ['columnas', 'id', 'imagenes'],
  cta: ['etiquetaBoton', 'id', 'texto', 'titulo', 'url', 'variante'],
  video: ['id', 'idVideo', 'proveedor', 'titulo'],
};
const MARCAS: Record<string, string[]> = { link: ['href'], bold: [], italic: [], code: [] };

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
  it('code excluye cualquier otra marca (bold, italic y link)', () => {
    const codigo = esquema.marks.code;

    for (const otra of ['bold', 'italic', 'link']) {
      expect(codigo?.excludes(esquema.marks[otra]!), otra).toBe(true);
    }
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
