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
//     contenido o imagen destacada inválidos -> 'contenido_invalido' con `errores: ErrorElemento[]` (indice -1 = destacada);
//     versión vieja -> 'conflicto_version'.
// La sesión del miembro se abre con la acción `ingresar` de H1 (cookies simuladas, ver ../test/next-simulado).
//
// Firmas supuestas de H3 (T065 y T070), también exportadas desde './articulos', con el mismo patrón (un objeto y `ResultadoAccion`):
//   cambiarEstadoAccion({ id, version, destino: EstadoArticulo, programadoPara?: string /* ISO UTC */ }): Promise<ResultadoAccion<Articulo>>
//     `datos` es el artículo actualizado (estado nuevo y `version` nueva). Con destino 'programado' sin `programadoPara`
//     devuelve 'validacion' (Zod) sin tocar la base. Errores de la base: 'requisitos_publicacion' con `detalle` ya
//     traducido a 'sin categoría' | 'sin bloques' (la base dice 'categoria' | 'contenido'), 'fecha_no_futura',
//     'estado_invalido', 'conflicto_version', 'no_encontrado'. Cancelar la programación es destino 'borrador'.
//   eliminarArticuloAccion({ id }): Promise<ResultadoAccion<void>>  (solo admin: 'sin_permiso' para el editor)
//     Lee las rutas de imagen antes de borrar y después las borra del bucket si ningún otro contenido las usa (D11).
//     Ambas llaman a revalidatePath('/articulos') cuando cambian algo.
import { crearElemento } from '@blog/bloques';
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
  admin: { correo: 'admin@demo.local', contrasenia: 'demo-admin-2026' },
  editor: { correo: 'editor@demo.local', contrasenia: 'demo-editor-2026' },
  editora: { correo: 'editora@demo.local', contrasenia: 'demo-editora-2026' },
} as const;

const sufijo = crypto.randomUUID().slice(0, 8);
const PREFIJO_TITULO = `t048 ${sufijo}`;
const carpetaMedios = `pruebas-t048/${sufijo}`;

const parrafo = (texto: string) => ({ ...crearElemento('paragraph'), content: [{ type: 'text', text: texto }] });
const doc = (...elementos: object[]) => ({ type: 'doc', content: elementos });
const imagenValida = (ruta: string) => ({ ruta, ancho: 1, alto: 1, alt: 'Imagen de prueba', decorativa: false });
const bloqueImagen = (ruta: string) => {
  const elemento = crearElemento('imagen');
  return { ...elemento, attrs: { ...elemento.attrs, imagen: imagenValida(ruta) } };
};
// Una imagen sin `alt` y sin marca decorativa: el caso típico de H2-E3.
const bloqueImagenSinAlt = () => {
  const elemento = crearElemento('imagen');
  const imagen = { ruta: 'articulos/2026/10/sin-alt.png', ancho: 1, alto: 1, decorativa: false };
  return { ...elemento, attrs: { ...elemento.attrs, imagen } };
};

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
    campos: { titulo: string; slug?: string; contenido?: object; imagen_destacada?: object },
  ) {
    const creado = await crearArticulo(cliente, {
      ...campos,
      categoria_id: categoriaId,
      contenido: (campos.contenido ?? doc(parrafo('Texto inicial'))) as never,
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
          contenido: doc(parrafo('Primer párrafo')),
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
          contenido: doc(parrafo('ok'), bloqueImagenSinAlt()),
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
      const contenido = doc(parrafo('Uno'), parrafo('Dos'), parrafo('Tres'));

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
      const { content } = guardado.contenido as { content: { content: { text: string }[] }[] };
      expect(content.map((elemento) => elemento.content[0]?.text)).toEqual(['Uno', 'Dos', 'Tres']);
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
        cambios: { titulo: 'No debe guardarse', contenido: doc(parrafo('ok'), bloqueImagenSinAlt()) as never },
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
      const articulo = await sembrar(editor, { titulo: titulo('imagen libre'), contenido: doc(bloqueImagen(ruta)) });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { contenido: doc(parrafo('Sin imagen')) as never },
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
      const quien = await sembrar(editor, { titulo: titulo('la quita'), contenido: doc(bloqueImagen(ruta)) });
      await sembrar(editora, { titulo: titulo('la sigue usando'), contenido: doc(bloqueImagen(ruta)) });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: quien.id,
        version: quien.version,
        cambios: { contenido: doc(parrafo('Sin imagen')) as never },
      });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(ruta)).toBe(true);
    });

    it('si la imagen sigue en el artículo, no se borra', async () => {
      const { guardarArticulo } = await import('./articulos');
      const ruta = await subirImagen('sigue.png');
      const articulo = await sembrar(editor, { titulo: titulo('sigue'), contenido: doc(bloqueImagen(ruta)) });
      await comoMiembro('editor');

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { contenido: doc(parrafo('Nuevo texto'), bloqueImagen(ruta)) as never },
      });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(ruta)).toBe(true);
    });

    it('un fallo del borrado no revierte el guardado (la ruta quitada ni siquiera existe en el bucket)', async () => {
      const { guardarArticulo } = await import('./articulos');
      const fantasma = `${carpetaMedios}/nunca-subida.png`;
      const articulo = await sembrar(editor, { titulo: titulo('borrado falla'), contenido: doc(bloqueImagen(fantasma)) });
      await comoMiembro('editor');
      const registrarError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const resultado = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { contenido: doc(parrafo('Guardado igual')) as never },
      });

      registrarError.mockRestore();
      expect(resultado.ok).toBe(true);
      const guardado = await leer(articulo.id);
      const { content } = guardado.contenido as { content: { content: { text: string }[] }[] };
      expect(content[0]?.content[0]?.text).toBe('Guardado igual');
    });
  });
  describe('leerArticuloVigente (D13)', () => {
    it('H2-E5: devuelve la versión vigente del artículo con sus etiquetas', async () => {
      const { leerArticuloVigente } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('vigente') });
      await comoMiembro('editor');

      const resultado = await leerArticuloVigente({ id: articulo.id });

      expect(resultado).toMatchObject({
        ok: true,
        datos: { id: articulo.id, titulo: articulo.titulo, version: articulo.version, etiquetas: [] },
      });
    });

    it('un artículo que no existe devuelve no_encontrado', async () => {
      const { leerArticuloVigente } = await import('./articulos');
      await comoMiembro('editor');

      const resultado = await leerArticuloVigente({ id: crypto.randomUUID() });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
    });

    it('un anónimo recibe no_autenticado', async () => {
      const { leerArticuloVigente } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('vigente anonimo') });

      const resultado = await leerArticuloVigente({ id: articulo.id });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
    });
  });

  describe('cambiarEstadoAccion (H3)', () => {
    const enUnaHora = () => new Date(Date.now() + 3_600_000).toISOString();

    /** Borrador con título, categoría y un bloque: lo mínimo para publicar. */
    const borradorCompleto = (etiqueta: string) => sembrar(editor, { titulo: titulo(etiqueta) });

    /** Pasa el artículo por la acción y exige que haya salido bien; devuelve el artículo actualizado. */
    async function cambiar(
      articulo: { id: string; version: number },
      destino: 'borrador' | 'programado' | 'publicado' | 'archivado',
      programadoPara?: string,
    ) {
      const { cambiarEstadoAccion } = await import('./articulos');
      const resultado = await cambiarEstadoAccion({
        id: articulo.id,
        version: articulo.version,
        destino,
        programadoPara,
      });
      if (!resultado.ok) throw new Error(`No se pudo pasar a ${destino}: ${JSON.stringify(resultado)}`);
      return resultado.datos;
    }

    it('H3-E1: publica un borrador completo, fija la fecha de publicación y devuelve la versión nueva', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await borradorCompleto('publicar');
      await comoMiembro('editor');

      const resultado = await cambiarEstadoAccion({ id: articulo.id, version: articulo.version, destino: 'publicado' });

      expect(resultado).toMatchObject({ ok: true, datos: { id: articulo.id, estado: 'publicado' } });
      if (!resultado.ok) return;
      expect(resultado.datos.publicado_en).not.toBeNull();
      expect(resultado.datos.version).toBeGreaterThan(articulo.version);
      const guardado = await leer(articulo.id);
      expect(guardado).toMatchObject({ estado: 'publicado', version: resultado.datos.version });
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/articulos');
    });

    it('H3-E2: sin categoría rechaza con requisitos_publicacion y el detalle "sin categoría"', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await crearArticulo(editor, {
        titulo: titulo('sin categoria'),
        contenido: doc(parrafo('Hola')) as never,
      });
      registro.articulos.push(articulo.id);
      await comoMiembro('editor');

      const resultado = await cambiarEstadoAccion({ id: articulo.id, version: articulo.version, destino: 'publicado' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'requisitos_publicacion', detalle: 'sin categoría' });
      expect((await leer(articulo.id)).estado).toBe('borrador');
    });

    it('H3-E2: sin bloques rechaza con requisitos_publicacion y el detalle "sin bloques"', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('sin bloques'), contenido: doc() });
      await comoMiembro('editor');

      const resultado = await cambiarEstadoAccion({ id: articulo.id, version: articulo.version, destino: 'publicado' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'requisitos_publicacion', detalle: 'sin bloques' });
      expect((await leer(articulo.id)).estado).toBe('borrador');
    });

    it('H3-E2: programar también exige los requisitos de publicación', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('programar sin bloques'), contenido: doc() });
      await comoMiembro('editor');

      const resultado = await cambiarEstadoAccion({
        id: articulo.id,
        version: articulo.version,
        destino: 'programado',
        programadoPara: enUnaHora(),
      });

      expect(resultado).toMatchObject({ ok: false, codigo: 'requisitos_publicacion', detalle: 'sin bloques' });
    });

    it('H3-E3: programa con una fecha futura y la deja guardada', async () => {
      const articulo = await borradorCompleto('programar');
      await comoMiembro('editor');
      const fecha = enUnaHora();

      const programado = await cambiar(articulo, 'programado', fecha);

      expect(programado.estado).toBe('programado');
      expect(new Date(programado.programado_para!).getTime()).toBe(new Date(fecha).getTime());
      expect(programado.publicado_en).toBeNull();
      expect((await leer(articulo.id)).estado).toBe('programado');
    });

    it('H3-E3: programar exige programadoPara (validacion) y no toca el artículo', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await borradorCompleto('programar sin fecha');
      await comoMiembro('editor');

      const resultado = await cambiarEstadoAccion({
        id: articulo.id,
        version: articulo.version,
        destino: 'programado',
      });

      expect(resultado).toMatchObject({ ok: false, codigo: 'validacion' });
      expect(await leer(articulo.id)).toMatchObject({ estado: 'borrador', version: articulo.version });
    });

    it('H3-E4: con una fecha pasada devuelve fecha_no_futura y el artículo sigue en borrador', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await borradorCompleto('fecha pasada');
      await comoMiembro('editor');

      const resultado = await cambiarEstadoAccion({
        id: articulo.id,
        version: articulo.version,
        destino: 'programado',
        programadoPara: new Date(Date.now() - 60_000).toISOString(),
      });

      expect(resultado).toMatchObject({ ok: false, codigo: 'fecha_no_futura' });
      expect((await leer(articulo.id)).estado).toBe('borrador');
    });

    it('H3-E5: cancelar la programación es volver a borrador y limpia la fecha', async () => {
      const articulo = await borradorCompleto('cancelar');
      await comoMiembro('editor');
      const programado = await cambiar(articulo, 'programado', enUnaHora());

      const cancelado = await cambiar(programado, 'borrador');

      expect(cancelado).toMatchObject({ estado: 'borrador', programado_para: null });
      expect(await leer(articulo.id)).toMatchObject({ estado: 'borrador', programado_para: null });
    });

    it('H3-E6: archiva un publicado y lo vuelve a borrador', async () => {
      const articulo = await borradorCompleto('archivar');
      await comoMiembro('editor');
      const publicado = await cambiar(articulo, 'publicado');

      const archivado = await cambiar(publicado, 'archivado');
      expect(archivado.estado).toBe('archivado');

      const borrador = await cambiar(archivado, 'borrador');
      expect(borrador.estado).toBe('borrador');
      expect((await leer(articulo.id)).estado).toBe('borrador');
    });

    it('H3-E6: un publicado también vuelve directo a borrador', async () => {
      const articulo = await borradorCompleto('publicado a borrador');
      await comoMiembro('editor');
      const publicado = await cambiar(articulo, 'publicado');

      const borrador = await cambiar(publicado, 'borrador');

      expect(borrador.estado).toBe('borrador');
    });

    it('H3-E7: una transición fuera de la matriz devuelve estado_invalido y no cambia nada', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await borradorCompleto('transicion invalida');
      await comoMiembro('editor');
      const archivado = await cambiar(await cambiar(articulo, 'publicado'), 'archivado');

      const resultado = await cambiarEstadoAccion({
        id: archivado.id,
        version: archivado.version,
        destino: 'publicado',
      });

      expect(resultado).toMatchObject({ ok: false, codigo: 'estado_invalido' });
      expect((await leer(articulo.id)).estado).toBe('archivado');
    });

    it('H3: con una versión vieja devuelve conflicto_version y no cambia el estado', async () => {
      const { cambiarEstadoAccion, guardarArticulo } = await import('./articulos');
      const articulo = await borradorCompleto('conflicto estado');
      await comoMiembro('editor');
      const otraPersonaGuarda = await guardarArticulo({
        id: articulo.id,
        version: articulo.version,
        cambios: { titulo: `${articulo.titulo} editado` },
      });
      expect(otraPersonaGuarda.ok).toBe(true);

      const resultado = await cambiarEstadoAccion({ id: articulo.id, version: articulo.version, destino: 'publicado' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'conflicto_version' });
      expect((await leer(articulo.id)).estado).toBe('borrador');
    });

    it('un artículo que no existe devuelve no_encontrado', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      await comoMiembro('editor');

      const resultado = await cambiarEstadoAccion({ id: crypto.randomUUID(), version: 1, destino: 'publicado' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
    });

    it('un anónimo recibe no_autenticado y no cambia el estado', async () => {
      const { cambiarEstadoAccion } = await import('./articulos');
      const articulo = await borradorCompleto('estado anonimo');

      const resultado = await cambiarEstadoAccion({ id: articulo.id, version: articulo.version, destino: 'publicado' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
      expect((await leer(articulo.id)).estado).toBe('borrador');
    });
  });

  describe('eliminarArticuloAccion (H3)', () => {
    it('H3-E8: un editor recibe sin_permiso y el artículo sigue existiendo', async () => {
      const { eliminarArticuloAccion } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('editor no elimina') });
      await comoMiembro('editor');

      const resultado = await eliminarArticuloAccion({ id: articulo.id });

      expect(resultado).toMatchObject({ ok: false, codigo: 'sin_permiso' });
      expect((await leer(articulo.id)).id).toBe(articulo.id);
    });

    it('H3-E8: el admin elimina el artículo y se avisa a la lista del panel', async () => {
      const { eliminarArticuloAccion } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('admin elimina') });
      await comoMiembro('admin');

      const resultado = await eliminarArticuloAccion({ id: articulo.id });

      expect(resultado).toMatchObject({ ok: true });
      const { data } = await admin.from('articulos').select('id').eq('id', articulo.id);
      expect(data).toEqual([]);
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/articulos');
    });

    it('H3-E8: al eliminar, borra del bucket las imágenes que nadie más usa (contenido y destacada)', async () => {
      const { eliminarArticuloAccion } = await import('./articulos');
      const rutaContenido = await subirImagen('eliminar-contenido.png');
      const rutaDestacada = await subirImagen('eliminar-destacada.png');
      const articulo = await sembrar(editor, {
        titulo: titulo('elimina con imagenes'),
        contenido: doc(bloqueImagen(rutaContenido)),
        imagen_destacada: imagenValida(rutaDestacada),
      });
      await comoMiembro('admin');

      const resultado = await eliminarArticuloAccion({ id: articulo.id });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(rutaContenido)).toBe(false);
      expect(await existeEnBucket(rutaDestacada)).toBe(false);
    });

    it('H3-E8: si otro artículo todavía usa la imagen, se conserva en el bucket', async () => {
      const { eliminarArticuloAccion } = await import('./articulos');
      const ruta = await subirImagen('eliminar-compartida.png');
      const aEliminar = await sembrar(editor, {
        titulo: titulo('elimina y comparte'),
        contenido: doc(bloqueImagen(ruta)),
      });
      await sembrar(editora, { titulo: titulo('sigue usando'), contenido: doc(bloqueImagen(ruta)) });
      await comoMiembro('admin');

      const resultado = await eliminarArticuloAccion({ id: aEliminar.id });

      expect(resultado.ok).toBe(true);
      expect(await existeEnBucket(ruta)).toBe(true);
    });

    it('un artículo que no existe devuelve no_encontrado', async () => {
      const { eliminarArticuloAccion } = await import('./articulos');
      await comoMiembro('admin');

      const resultado = await eliminarArticuloAccion({ id: crypto.randomUUID() });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
    });

    it('un anónimo recibe no_autenticado y el artículo sigue existiendo', async () => {
      const { eliminarArticuloAccion } = await import('./articulos');
      const articulo = await sembrar(editor, { titulo: titulo('eliminar anonimo') });

      const resultado = await eliminarArticuloAccion({ id: articulo.id });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
      expect((await leer(articulo.id)).id).toBe(articulo.id);
    });
  });
});
