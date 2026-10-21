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
//     | { tipo: 'agregar_bloque'; bloque: TipoBloque; posicion?: number }
//     | { tipo: 'mover_bloque'; indice: number; destino: number }
//     | { tipo: 'duplicar_bloque'; indice: number }
//     | { tipo: 'quitar_bloque'; indice: number }
//     | { tipo: 'actualizar_bloque'; indice: number; cambios: Partial<Bloque> }
//     | { tipo: 'guardado'; articulo: DatosArticulo }   (respuesta de `guardarArticulo`: adopta slug y versión definitivos)
//     | { tipo: 'adoptar_vigente'; articulo: DatosArticulo }   ("Reemplazar con la vigente", D13: descarta lo propio)
import { crearBloque, type Contenido } from '@blog/bloques';
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

    it('H2-E6: editar un bloque lo marca como sucio', () => {
      const estado = reductor(estadoInicial(datosBase(), { nuevo: false }), {
        tipo: 'actualizar_bloque',
        indice: 0,
        cambios: { texto: 'Cambiado' },
      });
      expect(estaSucio(estado)).toBe(true);
    });

    it('no muta el estado recibido', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const copia = structuredClone(inicial);
      reductor(inicial, { tipo: 'quitar_bloque', indice: 0 });
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

  describe('bloques', () => {
    it('H2-E2: agregar inserta un bloque del tipo pedido al final o en la posición dada', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const alFinal = reductor(inicial, { tipo: 'agregar_bloque', bloque: 'separador' });
      const alPrincipio = reductor(inicial, { tipo: 'agregar_bloque', bloque: 'cita', posicion: 0 });
      expect(alFinal.datos.contenido.map((b) => b.tipo)).toEqual(['parrafo', 'parrafo', 'parrafo', 'separador']);
      expect(alPrincipio.datos.contenido.map((b) => b.tipo)).toEqual(['cita', 'parrafo', 'parrafo', 'parrafo']);
    });

    it('H2-E2: mover (subir y bajar) cambia el orden y conserva el contenido', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const bajado = reductor(inicial, { tipo: 'mover_bloque', indice: 0, destino: 1 });
      const subido = reductor(bajado, { tipo: 'mover_bloque', indice: 2, destino: 1 });
      expect(textos(bajado.datos.contenido)).toEqual(['Dos', 'Uno', 'Tres']);
      expect(textos(subido.datos.contenido)).toEqual(['Dos', 'Tres', 'Uno']);
    });

    it('H2-E2: duplicar inserta una copia debajo con un id nuevo', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const estado = reductor(inicial, { tipo: 'duplicar_bloque', indice: 1 });
      const ids = estado.datos.contenido.map((b) => b.id);
      expect(textos(estado.datos.contenido)).toEqual(['Uno', 'Dos', 'Dos', 'Tres']);
      expect(new Set(ids).size).toBe(4);
    });

    it('H2-E2: quitar elimina solo ese bloque', () => {
      const estado = reductor(estadoInicial(datosBase(), { nuevo: false }), { tipo: 'quitar_bloque', indice: 1 });
      expect(textos(estado.datos.contenido)).toEqual(['Uno', 'Tres']);
    });

    it('actualizar un bloque conserva su id y su tipo', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const id = inicial.datos.contenido[0]!.id;
      const estado = reductor(inicial, {
        tipo: 'actualizar_bloque',
        indice: 0,
        cambios: { texto: 'Nuevo', id: crypto.randomUUID(), tipo: 'cita' } as never,
      });
      expect(estado.datos.contenido[0]).toMatchObject({ id, tipo: 'parrafo', texto: 'Nuevo' });
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
      const editado = reductor(inicial, { tipo: 'actualizar_bloque', indice: 0, cambios: { texto: 'Mi versión' } });
      expect(textos(editado.datos.contenido)[0]).toBe('Mi versión');
      expect(estaSucio(editado)).toBe(true);
    });

    it('H2-E5: "Reemplazar con la vigente" descarta lo propio y adopta la versión del servidor', () => {
      const inicial = estadoInicial(datosBase(), { nuevo: false });
      const editado = reductor(inicial, { tipo: 'quitar_bloque', indice: 0 });
      const vigente = datosBase({ version: 5, titulo: 'Título del otro', contenido: [parrafo('Del otro')] });

      const estado = reductor(editado, { tipo: 'adoptar_vigente', articulo: vigente });

      expect(estado.datos).toEqual(vigente);
      expect(estaSucio(estado)).toBe(false);
    });
  });
});
