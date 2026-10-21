// T048 (spec 003, H2-E1, E3, E5, E8 y D11): Server Actions de artículos, contra Supabase local.
// FASE ROJA: `./articulos` no existe aún. `cambiarEstadoAccion` y `eliminarArticuloAccion` son de H3 (T065).
//
// Firmas supuestas (T054), exportadas desde './articulos' (`'use server'`). Reciben UN OBJETO (no FormData:
// las llama un componente de cliente) y devuelven `ResultadoAccion<T>` de lib/resultado.ts:
//   previsualizarSlugAccion({ texto: string, tipo: TipoEntidad }): ResultadoAccion<string>
//     datos = el slug que normaliza la base (`previsualizarSlug` de @blog/db).
//   crearArticuloAccion({ ...NuevoArticulo, etiquetas: string[] }): Promise<ResultadoAccion<Articulo>>
//     `etiquetas` son ids de etiquetas. contracts/acciones.md dice "devuelve el artículo ... Redirige a
//     /articulos/[id]": los tests aceptan las dos formas (redirect a `/articulos/<id>` o `{ ok: true, datos }`)
//     y, si hay redirect, leen el slug definitivo de la base.
//   guardarArticulo({ id, version, cambios: CambiosArticulo, etiquetas?: string[] }): Promise<ResultadoAccion<Articulo>>
//     `datos` es el artículo actualizado, con `version` nueva y `slug` definitivo. Con `etiquetas` reemplaza el conjunto.
//   Errores: sin sesión -> { ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' };
//     contenido o imagen destacada inválidos -> 'contenido_invalido' con `errores: ErrorBloque[]` (indice -1 = destacada);
//     versión vieja -> 'conflicto_version'.
// La sesión del miembro se abre con la acción `ingresar` de H1 (cookies simuladas, ver ../test/next-simulado).
import { crearBloque } from '@blog/bloques';
import { crearArticulo, previsualizarSlug, type ClienteBlog } from '@blog/db';
import { clienteComo, pngMinimo, registroDePrueba, sesionesDemo, sinSupabase } from '@blog/db/pruebas';
import type {} from '@blog/db/pruebas/entorno'; // declara el contexto `supabase` que provee globalSetup
import { revalidatePath } from 'next/cache';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { almacenCookies, correr, formulario } from '../test/next-simulado';

vi.mock('next/headers', async () => (await import('../test/next-simulado')).moduloHeaders);
vi.mock('next/navigation', async () => (await import('../test/next-simulado')).moduloNavegacion);
vi.mock('next/cache', async () => (await import('../test/next-simulado')).moduloCache);

const entorno = inject('supabase');

const USUARIOS = {
  editor: { correo: 'editor@demo.local', contrasenia: 'demo-editor-2026' },
  editora: { correo: 'editora@demo.local', contrasenia: 'demo-editora-2026' },
} as const;

const sufijo = crypto.randomUUID().slice(0, 8);
const PREFIJO_TITULO = `t048 ${sufijo}`;
const carpetaMedios = `pruebas-t048/${sufijo}`;

const parrafo = (texto: string) => ({ ...crearBloque('parrafo'), texto });
const imagenValida = (ruta: string) => ({ ruta, ancho: 1, alto: 1, alt: 'Imagen de prueba', decorativa: false });
const bloqueImagen = (ruta: string) => ({ ...crearBloque('imagen'), imagen: imagenValida(ruta) });
// Una imagen sin `alt` y sin marca decorativa: el caso típico de H2-E3.
const bloqueImagenSinAlt = () => ({
  ...crearBloque('imagen'),
  imagen: { ruta: 'articulos/2026/10/sin-alt.png', ancho: 1, alto: 1, decorativa: false },
});

describe.skipIf(sinSupabase)('Server Actions de artículos (H2)', () => {
  let editor: ClienteBlog;
  let editora: ClienteBlog;
  let admin: ClienteBlog;
  let idEditor: string;
  let idEditora: string;
  let categoriaId: string;
  const registro = registroDePrueba();
  let contador = 0;

  /** Título único y reconocible: `afterAll` borra todo lo que empiece con el prefijo. */
  const titulo = (etiqueta: string) => `${PREFIJO_TITULO} ${etiqueta} ${(contador += 1)}`;

  beforeAll(async () => {
    if (!entorno) throw new Error('Supabase local no disponible');
    process.env.NEXT_PUBLIC_SUPABASE_URL = entorno.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = entorno.claveAnon;
    process.env.NEXT_PUBLIC_URL_ADMIN = 'http://localhost:3100';
    ({ editor, admin, idEditor } = await sesionesDemo());
    editora = await clienteComo(USUARIOS.editora.correo, USUARIOS.editora.contrasenia);
    idEditora = (await editora.auth.getUser()).data.user!.id;
    const { data, error } = await admin.from('categorias').select('id').limit(1).single();
    if (error) throw new Error(`Sin categorías en el seed: ${error.message}`);
    categoriaId = data.id;
  });

  beforeEach(() => {
    almacenCookies.clear();
    vi.mocked(revalidatePath).mockClear();
  });

  afterAll(async () => {
    await admin.from('articulos').delete().like('titulo', `${PREFIJO_TITULO}%`);
    await registro.limpiar(admin);
    const { data } = await admin.storage.from('medios').list(carpetaMedios);
    if (data?.length) await admin.storage.from('medios').remove(data.map((o) => `${carpetaMedios}/${o.name}`));
  });

  /** Abre la sesión del miembro con la acción de H1; vacía la anterior. */
  async function comoMiembro(usuario: keyof typeof USUARIOS) {
    const { ingresar } = await import('./acceso');
    almacenCookies.clear();
    await correr(() => ingresar(null, formulario({ ...USUARIOS[usuario] })));
  }

  async function leer(id: string) {
    const { data, error } = await admin.from('articulos').select('*').eq('id', id).single();
    if (error) throw new Error(`No se pudo leer el artículo ${id}: ${error.message}`);
    return data;
  }

  /** Crea un artículo directo en la base (no por la acción bajo prueba), de la persona cuyo cliente se pasa. */
  async function sembrar(
    cliente: ClienteBlog,
    campos: { titulo: string; slug?: string; contenido?: object[]; imagen_destacada?: object },
  ) {
    const creado = await crearArticulo(cliente, {
      ...campos,
      categoria_id: categoriaId,
      contenido: (campos.contenido ?? [parrafo('Texto inicial')]) as never,
      imagen_destacada: campos.imagen_destacada as never,
    });
    registro.articulos.push(creado.id);
    return creado;
  }

  /** Id del artículo creado, venga la acción con redirect a `/articulos/<id>` o con el artículo devuelto. */
  function idDeCreado(salida: Awaited<ReturnType<typeof correr<unknown>>>) {
    if ('redirigio' in salida) {
      const id = /^\/articulos\/([0-9a-f-]{36})$/.exec(salida.redirigio)?.[1];
      if (!id) throw new Error(`Redirigió a un destino inesperado: ${salida.redirigio}`);
      return id;
    }
    const resultado = salida.resultado as { ok: boolean; datos?: { id: string } };
    if (!resultado.ok || !resultado.datos) throw new Error(`No se creó el artículo: ${JSON.stringify(resultado)}`);
    return resultado.datos.id;
  }

  async function subirImagen(nombre: string) {
    const ruta = `${carpetaMedios}/${nombre}`;
    const { error } = await editor.storage.from('medios').upload(ruta, pngMinimo(), { contentType: 'image/png' });
    if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`);
    return ruta;
  }

  const existeEnBucket = async (ruta: string) => (await admin.storage.from('medios').download(ruta)).data !== null;

  describe('previsualizarSlugAccion', () => {
    it('H2-E1: devuelve el slug normalizado por la base (sin tildes, en minúsculas y con guiones)', async () => {
      const { previsualizarSlugAccion } = await import('./articulos');
      await comoMiembro('editor');
      const texto = '¿Cómo Empezar?: el Diseño en 2026';

      const resultado = await previsualizarSlugAccion({ texto, tipo: 'articulo' });

      expect(resultado).toEqual({ ok: true, datos: await previsualizarSlug(editor, texto, 'articulo') });
      expect(resultado.ok && resultado.datos).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });

    it('H2-E1: si el slug ya existe, la vista previa trae el mismo resultado que la base (con sufijo)', async () => {
      const { previsualizarSlugAccion } = await import('./articulos');
      const existente = await sembrar(editor, { titulo: titulo('slug repetido') });
      await comoMiembro('editor');

      const resultado = await previsualizarSlugAccion({ texto: existente.titulo, tipo: 'articulo' });

      expect(resultado).toEqual({ ok: true, datos: await previsualizarSlug(editor, existente.titulo, 'articulo') });
      expect(resultado.ok && resultado.datos).not.toBe(existente.slug);
    });

    it('un anónimo recibe no_autenticado', async () => {
      const { previsualizarSlugAccion } = await import('./articulos');

      const resultado = await previsualizarSlugAccion({ texto: 'Hola', tipo: 'articulo' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
    });
  });

  describe('crearArticuloAccion', () => {
    it('H2-E1: crea un borrador a nombre de quien lo crea y deja el slug definitivo en la base', async () => {
      const { crearArticuloAccion } = await import('./articulos');
      await comoMiembro('editor');
      const tituloNuevo = titulo('nuevo');

      const salida = await correr(() => crearArticuloAccion({ titulo: tituloNuevo, etiquetas: [] }));

      const articulo = await leer(idDeCreado(salida));
      expect(articulo).toMatchObject({ titulo: tituloNuevo, estado: 'borrador', autor_id: idEditor });
      expect(articulo.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/articulos');
    });

    it('H2-E1: devuelve el slug definitivo; con un título repetido agrega un sufijo y no pisa al existente', async () => {
      const { crearArticuloAccion } = await import('./articulos');
      await comoMiembro('editor');
      const tituloRepetido = titulo('repetido');

      const primero = await leer(
        idDeCreado(await correr(() => crearArticuloAccion({ titulo: tituloRepetido, etiquetas: [] }))),
      );
      const segundoSalida = await correr(() => crearArticuloAccion({ titulo: tituloRepetido, etiquetas: [] }));
      const segundo = await leer(idDeCreado(segundoSalida));

      expect(segundo.slug).not.toBe(primero.slug);
      expect(segundo.slug.startsWith(primero.slug)).toBe(true);
      if ('resultado' in segundoSalida) {
        expect(segundoSalida.resultado).toMatchObject({ ok: true, datos: { slug: segundo.slug } });
      }
    });

    it('H2-E1: respeta el slug que escribió la persona', async () => {
      const { crearArticuloAccion } = await import('./articulos');
      await comoMiembro('editor');
      const slug = `mi-slug-${sufijo}`;

      const salida = await correr(() => crearArticuloAccion({ titulo: titulo('slug propio'), slug, etiquetas: [] }));

      expect((await leer(idDeCreado(salida))).slug).toBe(slug);
    });

    it('guarda la categoría, el contenido y las etiquetas elegidas', async () => {
      const { crearArticuloAccion } = await import('./articulos');
      await comoMiembro('editor');
      const { data: etiqueta } = await admin
        .from('etiquetas')
        .insert({ nombre: `t048 etiqueta ${sufijo}` })
        .select('id')
        .single();
      registro.etiquetas.push(etiqueta!.id);

      const salida = await correr(() =>
        crearArticuloAccion({
          titulo: titulo('completo'),
          categoria_id: categoriaId,
          contenido: [parrafo('Primer párrafo')],
          etiquetas: [etiqueta!.id],
        }),
      );

      const id = idDeCreado(salida);
      expect((await leer(id)).categoria_id).toBe(categoriaId);
      const { data } = await admin.from('articulos_etiquetas').select('etiqueta_id').eq('articulo_id', id);
      expect(data).toEqual([{ etiqueta_id: etiqueta!.id }]);
    });

    it('H2-E3: con un bloque inválido devuelve contenido_invalido con el bloque y el campo, y no crea nada', async () => {
      const { crearArticuloAccion } = await import('./articulos');
      await comoMiembro('editor');
      const tituloInvalido = titulo('invalido');

      const salida = await correr(() =>
        crearArticuloAccion({
          titulo: tituloInvalido,
          contenido: [parrafo('ok'), bloqueImagenSinAlt()],
          etiquetas: [],
        }),
      );

      expect(salida).toMatchObject({
        resultado: {
          ok: false,
          codigo: 'contenido_invalido',
          errores: [expect.objectContaining({ indice: 1, campo: 'imagen.alt' })],
        },
      });
      const { data } = await admin.from('articulos').select('id').eq('titulo', tituloInvalido);
      expect(data).toEqual([]);
    });

    it('un anónimo recibe no_autenticado y no se crea nada', async () => {
      const { crearArticuloAccion } = await import('./articulos');
      const tituloAnonimo = titulo('anonimo');

      const salida = await correr(() => crearArticuloAccion({ titulo: tituloAnonimo, etiquetas: [] }));

      expect(salida).toMatchObject({ resultado: { ok: false, codigo: 'no_autenticado' } });
      const { data } = await admin.from('articulos').select('id').eq('titulo', tituloAnonimo);
      expect(data).toEqual([]);
    });
  });

  describe('guardarArticulo', () => {
    it('H2-E2: guarda los cambios, conserva el orden de los bloques y devuelve el artículo con la versión nueva', async () => {
      const { guardarArticulo } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('guardar') });
      await comoMiembro('editor');
      const contenido = [parrafo('Uno'), parrafo('Dos'), parrafo('Tres')];

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { titulo: `${articulo.titulo} editado`, contenido: contenido as never },
      });

      expect(resultado).toMatchObject({ ok: true, datos: { id: articulo.id, titulo: `${articulo.titulo} editado` } });
      if (!resultado.ok) return;
      expect(resultado.datos.version).toBeGreaterThan(articulo.version);
      const guardado = await leer(articulo.id);
      expect(guardado.version).toBe(resultado.datos.version);
      expect((guardado.contenido as { texto: string }[]).map((b) => b.texto)).toEqual(['Uno', 'Dos', 'Tres']);
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/articulos');
    });

    it('H2-E1: devuelve el slug definitivo, con sufijo si el escrito ya lo usa otro artículo', async () => {
      const { guardarArticulo } = await import('./articulos');
      const slugOcupado = `ocupado-${sufijo}`;
      await sembrar(editor, { titulo: titulo('dueño del slug'), slug: slugOcupado });
      const articulo = await sembrar(editor, { titulo: titulo('quiere el slug') });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { slug: slugOcupado },
      });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.datos.slug).not.toBe(slugOcupado);
      expect(resultado.datos.slug.startsWith(slugOcupado)).toBe(true);
      expect((await leer(articulo.id)).slug).toBe(resultado.datos.slug);
    });

    it('guarda las etiquetas: la lista que viaja reemplaza al conjunto anterior', async () => {
      const { guardarArticulo } = await import('./articulos');
      const { data: creadas } = await admin
        .from('etiquetas')
        .insert([{ nombre: `t048 a ${sufijo}` }, { nombre: `t048 b ${sufijo}` }])
        .select('id, nombre')
        .order('nombre');
      registro.etiquetas.push(...creadas!.map((e) => e.id));
      const [a, b] = creadas!;
      const articulo = await sembrar(editor, { titulo: titulo('etiquetas') });
      await comoMiembro('editor');

      const primera = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: {},
        etiquetas: [a!.id],
      });
      expect(primera.ok).toBe(true);
      if (!primera.ok) return;
      const segunda = await guardarArticulo({
        id: articulo.id,
        version: primera.datos.version,
        cambios: {},
        etiquetas: [b!.id],
      });

      expect(segunda.ok).toBe(true);
      const { data } = await admin.from('articulos_etiquetas').select('etiqueta_id').eq('articulo_id', articulo.id);
      expect(data).toEqual([{ etiqueta_id: b!.id }]);
    });

    it('H2-E3: con contenido inválido devuelve contenido_invalido con errores por bloque y campo, y no escribe nada', async () => {
      const { guardarArticulo } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('invalido') });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { titulo: 'No debe guardarse', contenido: [parrafo('ok'), bloqueImagenSinAlt()] as never },
      });

      expect(resultado).toMatchObject({
        ok: false,
        codigo: 'contenido_invalido',
        errores: [expect.objectContaining({ indice: 1, campo: 'imagen.alt' })],
      });
      const sinCambios = await leer(articulo.id);
      expect(sinCambios.titulo).toBe(articulo.titulo);
      expect(sinCambios.version).toBe(articulo.version);
      expect(sinCambios.contenido).toEqual(articulo.contenido);
    });

    it('H2-E3: una imagen destacada sin texto alternativo se señala con indice -1', async () => {
      const { guardarArticulo } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('destacada invalida') });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { imagen_destacada: { ruta: 'articulos/2026/10/d.png', ancho: 1, alto: 1, decorativa: false } },
      });

      expect(resultado).toMatchObject({
        ok: false,
        codigo: 'contenido_invalido',
        errores: [expect.objectContaining({ indice: -1, campo: 'imagen_destacada.alt' })],
      });
      expect((await leer(articulo.id)).imagen_destacada).toBeNull();
    });

    it('H2-E5: con una versión vieja devuelve conflicto_version y no escribe', async () => {
      const { guardarArticulo } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('conflicto') });
      await comoMiembro('editor');
      const primero = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { titulo: `${articulo.titulo} primero` },
      });
      expect(primero.ok).toBe(true);

      const segundo = await guardarArticulo({
        id: articulo.id,
        version: articulo.version, // la que tenía abierta la segunda persona
        cambios: { titulo: `${articulo.titulo} segundo` },
      });

      expect(segundo).toMatchObject({ ok: false, codigo: 'conflicto_version' });
      expect((await leer(articulo.id)).titulo).toBe(`${articulo.titulo} primero`);
    });

    it('H2-E8: un editor que edita el artículo de otra persona no cambia el autor', async () => {
      const { guardarArticulo } = await import('./articulos');
      const ajeno = await sembrar(editora, { titulo: titulo('de la editora') });
      expect(ajeno.autor_id).toBe(idEditora);
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: ajeno.id,
        version: ajeno.version,
        cambios: { titulo: `${ajeno.titulo} corregido` },
      });

      expect(resultado).toMatchObject({ ok: true, datos: { autor_id: idEditora } });
      const guardado = await leer(ajeno.id);
      expect(guardado.titulo).toBe(`${ajeno.titulo} corregido`);
      expect(guardado.autor_id).toBe(idEditora);
      expect(guardado.autor_id).not.toBe(idEditor);
    });

    it('un anónimo recibe no_autenticado y no escribe', async () => {
      const { guardarArticulo } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('anonimo') });

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { titulo: 'Intruso' },
      });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
      expect((await leer(articulo.id)).titulo).toBe(articulo.titulo);
    });

    it('un artículo que no existe devuelve no_encontrado', async () => {
      const { guardarArticulo } = await import('./articulos');
      await comoMiembro('editor');

      const resultado = await guardarArticulo({ id: crypto.randomUUID(), version: 1, cambios: { titulo: 'Nada' } });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
    });
  });

  describe('imágenes quitadas del artículo (D11)', () => {
    it('al quitar una imagen que nadie más usa, se borra del bucket', async () => {
      const { guardarArticulo } = await import('./articulos');
      const ruta = await subirImagen('libre.png');
      const articulo = await sembrar(editor, { titulo: titulo('imagen libre'), contenido: [bloqueImagen(ruta)] });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { contenido: [parrafo('Sin imagen')] as never },
      });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(ruta)).toBe(false);
    });

    it('al quitar la imagen destacada que nadie más usa, también se borra', async () => {
      const { guardarArticulo } = await import('./articulos');
      const ruta = await subirImagen('destacada.png');
      const articulo = await sembrar(editor, {
        titulo: titulo('destacada libre'),
        imagen_destacada: imagenValida(ruta),
      });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { imagen_destacada: null },
      });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(ruta)).toBe(false);
    });

    it('si otro artículo todavía usa la imagen, se conserva en el bucket', async () => {
      const { guardarArticulo } = await import('./articulos');
      const ruta = await subirImagen('compartida.png');
      const quien = await sembrar(editor, { titulo: titulo('la quita'), contenido: [bloqueImagen(ruta)] });
      await sembrar(editora, { titulo: titulo('la sigue usando'), contenido: [bloqueImagen(ruta)] });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: quien.id,
        version: quien.version,
        cambios: { contenido: [parrafo('Sin imagen')] as never },
      });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(ruta)).toBe(true);
    });

    it('si la imagen sigue en el artículo, no se borra', async () => {
      const { guardarArticulo } = await import('./articulos');
      const ruta = await subirImagen('sigue.png');
      const articulo = await sembrar(editor, { titulo: titulo('sigue'), contenido: [bloqueImagen(ruta)] });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { contenido: [parrafo('Nuevo texto'), bloqueImagen(ruta)] as never },
      });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(ruta)).toBe(true);
    });

    it('un fallo del borrado no revierte el guardado (la ruta quitada ni siquiera existe en el bucket)', async () => {
      const { guardarArticulo } = await import('./articulos');
      const fantasma = `${carpetaMedios}/nunca-subida.png`;
      const articulo = await sembrar(editor, { titulo: titulo('borrado falla'), contenido: [bloqueImagen(fantasma)] });
      await comoMiembro('editor');
      const registrarError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { contenido: [parrafo('Guardado igual')] as never },
      });

      registrarError.mockRestore();
      expect(resultado.ok).toBe(true);
      const guardado = await leer(articulo.id);
      expect((guardado.contenido as { texto: string }[])[0]?.texto).toBe('Guardado igual');
    });
  });
});
