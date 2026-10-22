// T061 (spec 003, H2-E1, E2, E5, E6, D12/D13): lógica pura del estado del editor. FASE ROJA: `./reductor` no existe.
// Propuesta de firma para T061 (el componente `EditorArticulo` lo usa con `useReducer`); si el diseño cambia,
// se ajusta el test, pero la lógica tiene que seguir siendo pura y estar fuera del componente:
//
//   type DatosArticulo = {
//     version: number; titulo: string; slug: string; extracto: string | null; titulo_seo: string | null;
//     descripcion_seo: string | null; imagen_destacada: Imagen | null; categoria_id: string | null;
//     contenido: Contenido; etiquetas: string[]; // ids
//   };
//   type EstadoEditor = { datos: DatosArticulo; guardado: DatosArticulo; slugManual: boolean };
//   estadoInicial(datos: DatosArticulo, opciones: { nuevo: boolean }): EstadoEditor
//     `slugManual` empieza en `!nuevo`: en un artículo existente, cambiar el título no cambia su dirección.
//   estaSucio(estado): boolean          comparación estructural de `datos` contra `guardado`.
//   reductor(estado, accion: AccionEditor): EstadoEditor   no muta el estado recibido.
//   AccionEditor =
//     | { tipo: 'campo'; campo: 'titulo' | 'slug' | 'extracto' | 'titulo_seo' | 'descripcion_seo' | 'imagen_destacada' | 'categoria_id' | 'etiquetas'; valor: unknown }
//         (escribir el campo `slug` a mano activa `slugManual`)
//     | { tipo: 'sugerir_slug'; slug: string }          (resultado de `previsualizarSlugAccion`; solo si !slugManual)
//     | { tipo: 'guardado'; articulo: DatosArticulo }   (respuesta de `guardarArticulo`: adopta slug y versión definitivos)
//     | { tipo: 'adoptar_vigente'; articulo: DatosArticulo }   ("Reemplazar con la vigente", D13: descarta lo propio)
import { crearBloque, type Contenido } from '@blog/bloques';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estaSucio, estadoInicial, reductor, type DatosArticulo } from './reductor';

const parrafo = (texto: string) => ({ ...crearBloque('parrafo'), texto });

function datosBase(extra: Partial<DatosArticulo> = {}): DatosArticulo {
  return {
    version: 3,
    titulo: 'Título original',
    slug: 'titulo-original',
    extracto: null,
    titulo_seo: null,
    descripcion_seo: null,
    imagen_destacada: null,
    categoria_id: null,
    contenido: [parrafo('Uno'), parrafo('Dos'), parrafo('Tres')],
    etiquetas: [],
    ...extra,
  };
}

const textos = (contenido: Contenido) => contenido.map((b) => ('texto' in b ? b.texto : b.tipo));

describe('estado del editor (H2)', () => {
  describe('cambios sin guardar', () => {
    it('H2-E6: un artículo recién abierto no está sucio', () => {
      expect(estaSucio(estadoInicial(datosBase(), { nuevo: false }))).toBe(false);
    });

    it('H2-E6: cambiar un campo lo marca como sucio', () => {
      const estado = reductor(estadoInicial(datosBase(), { nuevo: false }), {
        tipo: 'campo',
        campo: 'extracto',
        valor: 'Un extracto',
      });
      expect(estaSucio(estado)).toBe(true);
    });

    it('H2-E6: volver al valor original lo deja limpio otra vez', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const cambiado = reductor(inicial, { tipo: 'campo', campo: 'titulo', valor: 'Otro' });
      const revertido = reductor(cambiado, { tipo: 'campo', campo: 'titulo', valor: 'Título original' });
      expect(estaSucio(revertido)).toBe(false);
    });

    it('no muta el estado recibido', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const copia = structuredClone(inicial);
      reductor(inicial, { tipo: 'contenido', valor: [parrafo('Otro')] });
      reductor(inicial, { tipo: 'campo', campo: 'titulo', valor: 'Otro' });
      expect(inicial).toEqual(copia);
    });
  });

  describe('slug sugerido', () => {
    it('H2-E1: en un artículo nuevo acepta la sugerencia de la base', () => {
      const inicial = estadoInicial(datosBase({ titulo: '', slug: '' }), { nuevo: true });
      const estado = reductor(inicial, { tipo: 'sugerir_slug', slug: 'mi-titulo' });
      expect(estado.datos.slug).toBe('mi-titulo');
    });

    it('H2-E1: si la persona escribió el slug, una sugerencia posterior no lo pisa', () => {
      let estado = estadoInicial(datosBase({ titulo: '', slug: '' }), { nuevo: true });
      estado = reductor(estado, { tipo: 'campo', campo: 'slug', valor: 'mi-direccion' });
      estado = reductor(estado, { tipo: 'sugerir_slug', slug: 'otro-titulo' });
      expect(estado.datos.slug).toBe('mi-direccion');
      expect(estado.slugManual).toBe(true);
    });

    it('en un artículo existente la sugerencia no cambia su dirección', () => {
      const estado = reductor(estadoInicial(datosBase(), { nuevo: false }), { tipo: 'sugerir_slug', slug: 'otra' });
      expect(estado.datos.slug).toBe('titulo-original');
    });
  });

  describe('después de guardar y ante conflictos', () => {
    it('H2-E1: tras guardar adopta el slug definitivo y la versión nueva, y queda limpio', () => {
      const inicial = estadoInicial(datosBase({ slug: 'repetido' }), { nuevo: false });
      const editado = reductor(inicial, { tipo: 'campo', campo: 'titulo', valor: 'Nuevo título' });
      expect(estaSucio(editado)).toBe(true);

      const guardado = reductor(editado, {
        tipo: 'guardado',
        articulo: { ...editado.datos, slug: 'repetido-2', version: 4 },
      });

      expect(guardado.datos).toMatchObject({ slug: 'repetido-2', version: 4, titulo: 'Nuevo título' });
      expect(estaSucio(guardado)).toBe(false);
    });

    it('H2-E5: un conflicto no despacha nada: lo escrito sigue en `datos` y el editor sigue sucio', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const editado = reductor(inicial, {
        tipo: 'contenido',
        valor: [parrafo('Mi versión'), parrafo('Dos'), parrafo('Tres')],
      });
      expect(textos(editado.datos.contenido)[0]).toBe('Mi versión');
      expect(estaSucio(editado)).toBe(true);
    });

    it('H2-E5: "Reemplazar con la vigente" descarta lo propio y adopta la versión del servidor', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const editado = reductor(inicial, { tipo: 'contenido', valor: [parrafo('Dos')] });
      const vigente = datosBase({ version: 5, titulo: 'Título del otro', contenido: [parrafo('Del otro')] });

      const estado = reductor(editado, { tipo: 'adoptar_vigente', articulo: vigente });

      expect(estado.datos).toEqual(vigente);
      expect(estaSucio(estado)).toBe(false);
    });
  });
});

// T020 (spec 005, RF-012; data-model "Estado del editor"; research D6): el editor convierte el documento y despacha
// la lista de bloques completa con la acción `contenido`. FASE ROJA: el reductor todavía no la conoce.
// `CambiosDeBloque` se mueve de `reductor.ts` a `bloques/tipos.ts` (el reductor deja de saber de bloques sueltos).
describe('acción "contenido" del reductor (spec 005)', () => {
  const accionContenido = (valor: Contenido) => ({ tipo: 'contenido', valor }) as const;

  it('RF-012: reemplaza datos.contenido por el valor recibido', () => {
    const inicial = estadoInicial(datosBase(), { nuevo: false });
    const nuevo = [parrafo('Solo uno'), parrafo('Y otro')];

    const estado = reductor(inicial, accionContenido(nuevo));

    expect(estado.datos.contenido).toEqual(nuevo);
  });

  it('RF-012: deja el estado sucio respecto de lo guardado', () => {
    const inicial = estadoInicial(datosBase(), { nuevo: false });

    const estado = reductor(inicial, accionContenido([parrafo('Cambiado')]));

    expect(estaSucio(estado)).toBe(true);
  });

  it('RF-012: no toca lo guardado ni el resto de los datos', () => {
    const inicial = estadoInicial(datosBase({ etiquetas: ['e1'] }), { nuevo: false });

    const estado = reductor(inicial, accionContenido([]));

    expect(estado.guardado).toEqual(inicial.guardado);
    expect(estado.datos).toMatchObject({
      titulo: 'Título original',
      slug: 'titulo-original',
      version: 3,
      etiquetas: ['e1'],
    });
    expect(estado.slugManual).toBe(inicial.slugManual);
  });

  it('RF-012: abrir y no tocar no ensucia: despachar el mismo contenido deja el estado limpio', () => {
    const inicial = estadoInicial(datosBase(), { nuevo: false });

    const estado = reductor(inicial, accionContenido(structuredClone(inicial.datos.contenido)));

    expect(estaSucio(estado)).toBe(false);
  });

  it('RF-012: aceptar un contenido vacío es válido (documento vacío)', () => {
    const inicial = estadoInicial(datosBase(), { nuevo: false });

    expect(reductor(inicial, accionContenido([])).datos.contenido).toEqual([]);
  });

  it('no muta el estado recibido', () => {
    const inicial = estadoInicial(datosBase(), { nuevo: false });
    const copia = structuredClone(inicial);

    reductor(inicial, accionContenido([parrafo('Otro')]));

    expect(inicial).toEqual(copia);
  });

  it('D6: `guardado` sigue igual: adopta slug y versión definitivos sin tocar el contenido propio ya guardado', () => {
    const inicial = estadoInicial(datosBase(), { nuevo: false });
    const editado = reductor(inicial, accionContenido([parrafo('Editado')]));

    const estado = reductor(editado, { tipo: 'guardado', articulo: { ...editado.datos, version: 4 } });

    expect(estado.datos.version).toBe(4);
    expect(estado.guardado).toEqual(estado.datos);
    expect(estaSucio(estado)).toBe(false);
  });

  it('D13: `adoptar_vigente` sigue igual: descarta lo propio y adopta la versión del servidor', () => {
    const inicial = estadoInicial(datosBase(), { nuevo: false });
    const editado = reductor(inicial, accionContenido([parrafo('Mi versión')]));
    const vigente = datosBase({ version: 7, contenido: [parrafo('Del otro')] });

    const estado = reductor(editado, { tipo: 'adoptar_vigente', articulo: vigente });

    expect(estado.datos).toEqual(vigente);
    expect(estaSucio(estado)).toBe(false);
  });
});

describe('CambiosDeBloque vive en bloques/tipos.ts (spec 005, plan: "Cambios de un bloque sumables")', () => {
  const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

  it('bloques/tipos.ts exporta el tipo CambiosDeBloque', () => {
    expect(leer('./bloques/tipos.ts')).toMatch(/export type CambiosDeBloque/);
  });

  it('reductor.ts ya no define CambiosDeBloque (lo importaría de bloques/tipos.ts si lo necesitara)', () => {
    expect(leer('./reductor.ts')).not.toMatch(/export type CambiosDeBloque/);
  });

  it('EditorDeBloque.tsx lo importa de bloques/tipos.ts, no del reductor', () => {
    const fuente = leer('./bloques/EditorDeBloque.tsx');
    const importaDelReductor = /import[^;]*CambiosDeBloque[^;]*from\s+['"]\.\.\/reductor['"]/.test(fuente);

    expect(importaDelReductor).toBe(false);
  });
});
