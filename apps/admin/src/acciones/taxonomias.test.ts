// T080 (spec 003, H5-E1 a E5, RF-018, RF-019, RF-024): Server Actions de categorías y etiquetas, contra Supabase local.
// FASE ROJA: `./taxonomias` no existe aún (T082).
//
// Firmas supuestas, exportadas desde './taxonomias' (`'use server'`). Reciben UN OBJETO y devuelven `ResultadoAccion<T>`:
//   crearTaxonomiaAccion({ tipo: 'categoria' | 'etiqueta', nombre, slug?, descripcion? }): ResultadoAccion<Taxonomia>
//     `datos` es la fila creada (con el `slug` que asigna la base, a10_asignar_slug).
//   actualizarTaxonomiaAccion({ tipo, id, cambios: { nombre?, slug?, descripcion? } }):
//     ResultadoAccion<{ taxonomia: Taxonomia; avisoRedireccion: boolean }>
//     `avisoRedireccion` es true solo si el slug cambió Y la taxonomía tiene artículos PUBLICADOS (RF-019).
//   eliminarTaxonomiaAccion({ tipo, id }): ResultadoAccion<void>
// Errores:
//   - sin sesión -> { ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' }.
//   - nombre repetido (índice único lower(nombre)) -> 'validacion', detalle y mensaje "Ya existe una categoría con ese
//     nombre" / "Ya existe una etiqueta con ese nombre". DISCREPANCIA con la base: `traducirError`
//     (packages/db/src/errores.ts) solo traduce 23505 a 'slug_duplicado' cuando el detalle menciona "(slug)"; el del
//     nombre cae en 'desconocido'. La acción debe mapearlo (o ampliarse `traducirError`).
//   - nombre vacío o de más de 60 caracteres, descripción de más de 300 -> 'validacion' (Zod), sin tocar la base.
//   - categoría con artículos -> 'categoria_en_uso', detalle = cantidad ("2"), mensaje "No se puede eliminar: la usan 2 artículos."
//   - id inexistente -> 'no_encontrado'.
// Un slug repetido NO falla: la base le agrega un sufijo ("-2", `slug_disponible`), así que no hay `slug_duplicado`.
// Cada acción exitosa llama a revalidatePath('/categorias') o revalidatePath('/etiquetas') según el tipo.
// Editor y admin pueden gestionar (permiso 'taxonomia.gestionar').
import type { ClienteBlog } from '@blog/db';
import { crearArticuloDePrueba, registroDePrueba, sesionesDemo, sinSupabase } from '@blog/db/pruebas';
import type {} from '@blog/db/pruebas/entorno'; // declara el contexto `supabase` que provee globalSetup
import { revalidatePath } from 'next/cache';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { almacenCookies, correr, formulario } from '../test/next-simulado';
import { actualizarTaxonomiaAccion, crearTaxonomiaAccion, eliminarTaxonomiaAccion } from './taxonomias';

vi.mock('next/headers', async () => (await import('../test/next-simulado')).moduloHeaders);
vi.mock('next/navigation', async () => (await import('../test/next-simulado')).moduloNavegacion);
vi.mock('next/cache', async () => (await import('../test/next-simulado')).moduloCache);

const entorno = inject('supabase');

const USUARIOS = {
  admin: { correo: 'admin@demo.local', contrasenia: 'demo-admin-2026' },
  editor: { correo: 'editor@demo.local', contrasenia: 'demo-editor-2026' },
} as const;

const sufijo = crypto.randomUUID().slice(0, 8);
const PREFIJO = `t080 ${sufijo}`;

type Tipo = 'categoria' | 'etiqueta';
const TABLA = { categoria: 'categorias', etiqueta: 'etiquetas' } as const;
const RUTA = { categoria: '/categorias', etiqueta: '/etiquetas' } as const;
const ARTICULO = { categoria: 'una categoría', etiqueta: 'una etiqueta' } as const;

describe.skipIf(sinSupabase)('Server Actions de categorías y etiquetas (H5)', () => {
  let admin: ClienteBlog;
  let categoriaBaseId: string;
  const registro = registroDePrueba();
  let contador = 0;

  const nombre = (etiqueta: string) => `${PREFIJO} ${etiqueta} ${(contador += 1)}`;
  const registrar = (tipo: Tipo, id: string) => registro[tipo === 'categoria' ? 'categorias' : 'etiquetas'].push(id);

  beforeAll(async () => {
    if (!entorno) throw new Error('Supabase local no disponible');
    process.env.NEXT_PUBLIC_SUPABASE_URL = entorno.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = entorno.claveAnon;
    process.env.NEXT_PUBLIC_URL_ADMIN = 'http://localhost:3100';
    ({ admin } = await sesionesDemo());
    const { data, error } = await admin.from('categorias').select('id').limit(1).single();
    if (error) throw new Error(`Sin categorías en el seed: ${error.message}`);
    categoriaBaseId = data.id;
  });

  beforeEach(() => {
    almacenCookies.clear();
    vi.mocked(revalidatePath).mockClear();
  });

  afterAll(async () => {
    await admin.from('articulos').delete().like('titulo', `${PREFIJO}%`);
    await registro.limpiar(admin);
    await admin.from('categorias').delete().like('nombre', `${PREFIJO}%`);
    await admin.from('etiquetas').delete().like('nombre', `${PREFIJO}%`);
  });

  async function comoMiembro(usuario: keyof typeof USUARIOS) {
    const { ingresar } = await import('./acceso');
    almacenCookies.clear();
    await correr(() => ingresar(null, formulario({ ...USUARIOS[usuario] })));
  }

  /** Crea una taxonomía directo en la base (no por la acción bajo prueba). */
  async function sembrar(tipo: Tipo, texto: string, descripcion?: string) {
    const { data, error } = await admin
      .from(TABLA[tipo])
      .insert({ nombre: texto, slug: '', descripcion })
      .select('*')
      .single();
    if (error) throw new Error(`No se pudo sembrar la ${tipo}: ${error.message}`);
    registrar(tipo, data.id);
    return data;
  }

  /** Artículo con la taxonomía indicada (como categoría o como etiqueta); publicado o borrador. */
  async function sembrarArticulo(tipo: Tipo, taxonomiaId: string, publicar: boolean) {
    return crearArticuloDePrueba(admin, registro, {
      titulo: `${PREFIJO} articulo ${(contador += 1)}`,
      slug: '',
      contenido: {
        type: 'doc',
        content: [
          { type: 'paragraph', attrs: { id: crypto.randomUUID() }, content: [{ type: 'text', text: 'Texto' }] },
        ],
      },
      categoriaId: tipo === 'categoria' ? taxonomiaId : categoriaBaseId,
      etiquetas: tipo === 'etiqueta' ? [taxonomiaId] : [],
      publicar,
    });
  }

  async function leer(tipo: Tipo, id: string) {
    const { data, error } = await admin.from(TABLA[tipo]).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function redireccion(tipo: Tipo, slugAnterior: string) {
    const { data } = await admin
      .from('redirecciones')
      .select('entidad_id')
      .eq('tipo_entidad', tipo)
      .eq('slug_anterior', slugAnterior)
      .maybeSingle();
    return data;
  }

  describe.each(['categoria', 'etiqueta'] as const)('%s', (tipo) => {
    describe('crear (H5-E1)', () => {
      it('H5-E1: crea con un nombre nuevo y devuelve el slug que asigna la base', async () => {
        await comoMiembro('editor');
        const texto = nombre('Nueva Ñandú');

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: texto, descripcion: 'Una descripción' });

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        registrar(tipo, resultado.datos.id);
        expect(resultado.datos.nombre).toBe(texto);
        expect(resultado.datos.slug).toMatch(/^t080-[a-z0-9]+-nueva-nandu-\d+$/);
        expect(await leer(tipo, resultado.datos.id)).toMatchObject({
          nombre: texto,
          slug: resultado.datos.slug,
          descripcion: 'Una descripción',
        });
        expect(revalidatePath).toHaveBeenCalledWith(RUTA[tipo]);
      });

      it('H5-E1: respeta el slug indicado si está libre y lo normaliza', async () => {
        await comoMiembro('editor');

        const resultado = await crearTaxonomiaAccion({
          tipo,
          nombre: nombre('Con slug'),
          slug: `T080 ${sufijo} Mi Slug ${tipo}`,
        });

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        registrar(tipo, resultado.datos.id);
        expect(resultado.datos.slug).toBe(`t080-${sufijo}-mi-slug-${tipo}`);
      });

      it('H5-E1: un slug repetido no falla, la base agrega un sufijo numérico', async () => {
        await comoMiembro('editor');
        const existente = await sembrar(tipo, nombre('Dueña del slug'));

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: nombre('Otra'), slug: existente.slug });

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        registrar(tipo, resultado.datos.id);
        expect(resultado.datos.slug).toBe(`${existente.slug}-2`);
      });

      it('H5-E1: sin descripción también se crea (admin)', async () => {
        await comoMiembro('admin');

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: nombre('Sin descripción') });

        expect(resultado.ok).toBe(true);
        if (resultado.ok) registrar(tipo, resultado.datos.id);
      });
    });

    describe('nombre repetido (H5-E2)', () => {
      it('H5-E2: un nombre repetido devuelve validacion con "Ya existe … con ese nombre"', async () => {
        await comoMiembro('editor');
        const existente = await sembrar(tipo, nombre('Repetida'));

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: existente.nombre });

        expect(resultado).toMatchObject({
          ok: false,
          codigo: 'validacion',
          detalle: `Ya existe ${ARTICULO[tipo]} con ese nombre`,
          mensaje: `Ya existe ${ARTICULO[tipo]} con ese nombre`,
        });
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it('H5-E2: la comparación del nombre ignora mayúsculas', async () => {
        await comoMiembro('editor');
        const existente = await sembrar(tipo, nombre('Mayúsculas'));

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: existente.nombre.toUpperCase() });

        expect(resultado).toMatchObject({ ok: false, codigo: 'validacion' });
      });

      it('H5-E2: renombrar con el nombre de otra también devuelve validacion y no cambia nada', async () => {
        await comoMiembro('editor');
        const otra = await sembrar(tipo, nombre('Otra existente'));
        const propia = await sembrar(tipo, nombre('Propia'));

        const resultado = await actualizarTaxonomiaAccion({ tipo, id: propia.id, cambios: { nombre: otra.nombre } });

        expect(resultado).toMatchObject({
          ok: false,
          codigo: 'validacion',
          detalle: `Ya existe ${ARTICULO[tipo]} con ese nombre`,
        });
        expect((await leer(tipo, propia.id))?.nombre).toBe(propia.nombre);
      });
    });

    describe('validación de campos (RF-018)', () => {
      it('RF-018: un nombre vacío o de espacios devuelve validacion', async () => {
        await comoMiembro('editor');
        for (const vacio of ['', '   ']) {
          const resultado = await crearTaxonomiaAccion({ tipo, nombre: vacio });
          expect(resultado).toMatchObject({ ok: false, codigo: 'validacion' });
        }
      });

      it('RF-018: un nombre de más de 60 caracteres devuelve validacion', async () => {
        await comoMiembro('editor');

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: 'n'.repeat(61) });

        expect(resultado).toMatchObject({ ok: false, codigo: 'validacion' });
      });

      it('RF-018: una descripción de más de 300 caracteres devuelve validacion', async () => {
        await comoMiembro('editor');

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: nombre('Larga'), descripcion: 'd'.repeat(301) });

        expect(resultado).toMatchObject({ ok: false, codigo: 'validacion' });
      });

      it('RF-018: una descripción de exactamente 300 caracteres es válida', async () => {
        await comoMiembro('editor');

        const resultado = await crearTaxonomiaAccion({ tipo, nombre: nombre('Justa'), descripcion: 'd'.repeat(300) });

        expect(resultado.ok).toBe(true);
        if (resultado.ok) registrar(tipo, resultado.datos.id);
      });

      it('RF-018: actualizar con un nombre vacío o una descripción larga devuelve validacion y no cambia nada', async () => {
        await comoMiembro('editor');
        const fila = await sembrar(tipo, nombre('Intacta'), 'Original');

        const sinNombre = await actualizarTaxonomiaAccion({ tipo, id: fila.id, cambios: { nombre: '  ' } });
        const larga = await actualizarTaxonomiaAccion({ tipo, id: fila.id, cambios: { descripcion: 'd'.repeat(301) } });

        expect(sinNombre).toMatchObject({ ok: false, codigo: 'validacion' });
        expect(larga).toMatchObject({ ok: false, codigo: 'validacion' });
        expect(await leer(tipo, fila.id)).toMatchObject({ nombre: fila.nombre, descripcion: 'Original' });
      });
    });

    describe('actualizar (H5-E3, RF-019)', () => {
      it('H5-E3: renombrar o cambiar la descripción no cambia el slug ni activa el aviso de redirección', async () => {
        await comoMiembro('editor');
        const fila = await sembrar(tipo, nombre('Renombrable'));
        await sembrarArticulo(tipo, fila.id, true);

        const resultado = await actualizarTaxonomiaAccion({
          tipo,
          id: fila.id,
          cambios: { nombre: nombre('Renombrada'), descripcion: 'Nueva descripción' },
        });

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        expect(resultado.datos.avisoRedireccion).toBe(false);
        expect(resultado.datos.taxonomia.slug).toBe(fila.slug);
        expect(await redireccion(tipo, fila.slug)).toBeNull();
        expect(revalidatePath).toHaveBeenCalledWith(RUTA[tipo]);
      });

      it('RF-019: cambiar el slug con artículos publicados devuelve avisoRedireccion = true y registra la redirección', async () => {
        await comoMiembro('editor');
        const fila = await sembrar(tipo, nombre('Con publicados'));
        await sembrarArticulo(tipo, fila.id, true);
        const slugNuevo = `t080-${sufijo}-nuevo-${(contador += 1)}`;

        const resultado = await actualizarTaxonomiaAccion({ tipo, id: fila.id, cambios: { slug: slugNuevo } });

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        expect(resultado.datos.avisoRedireccion).toBe(true);
        expect(resultado.datos.taxonomia.slug).toBe(slugNuevo);
        expect(await redireccion(tipo, fila.slug)).toEqual({ entidad_id: fila.id });
      });

      it('RF-019: con solo borradores no avisa (no hay URL pública que proteger), aunque la base igual registra la redirección', async () => {
        await comoMiembro('editor');
        const fila = await sembrar(tipo, nombre('Con borradores'));
        await sembrarArticulo(tipo, fila.id, false);
        const slugNuevo = `t080-${sufijo}-borr-${(contador += 1)}`;

        const resultado = await actualizarTaxonomiaAccion({ tipo, id: fila.id, cambios: { slug: slugNuevo } });

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        expect(resultado.datos.avisoRedireccion).toBe(false);
        expect(await redireccion(tipo, fila.slug)).toEqual({ entidad_id: fila.id });
      });

      it('RF-019: cambiar el slug de una taxonomía sin artículos no avisa', async () => {
        await comoMiembro('editor');
        const fila = await sembrar(tipo, nombre('Vacía'));

        const resultado = await actualizarTaxonomiaAccion({
          tipo,
          id: fila.id,
          cambios: { slug: `t080-${sufijo}-vacia-${(contador += 1)}` },
        });

        expect(resultado.ok).toBe(true);
        if (resultado.ok) expect(resultado.datos.avisoRedireccion).toBe(false);
      });

      it('RF-019: enviar el mismo slug que ya tiene no cuenta como cambio', async () => {
        await comoMiembro('editor');
        const fila = await sembrar(tipo, nombre('Mismo slug'));
        await sembrarArticulo(tipo, fila.id, true);

        const resultado = await actualizarTaxonomiaAccion({
          tipo,
          id: fila.id,
          cambios: { nombre: nombre('Otro nombre'), slug: fila.slug },
        });

        expect(resultado.ok).toBe(true);
        if (resultado.ok) expect(resultado.datos.avisoRedireccion).toBe(false);
        expect(await redireccion(tipo, fila.slug)).toBeNull();
      });

      it('H5-E3: un id inexistente devuelve no_encontrado', async () => {
        await comoMiembro('editor');

        const resultado = await actualizarTaxonomiaAccion({
          tipo,
          id: crypto.randomUUID(),
          cambios: { nombre: nombre('Fantasma') },
        });

        expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
      });
    });

    describe('eliminar sin artículos (H5-E4)', () => {
      it('H5-E4: elimina una taxonomía sin artículos', async () => {
        await comoMiembro('editor');
        const fila = await sembrar(tipo, nombre('Descartable'));

        const resultado = await eliminarTaxonomiaAccion({ tipo, id: fila.id });

        expect(resultado).toMatchObject({ ok: true });
        expect(await leer(tipo, fila.id)).toBeNull();
        expect(revalidatePath).toHaveBeenCalledWith(RUTA[tipo]);
      });

      it('H5-E4: un id inexistente devuelve no_encontrado', async () => {
        await comoMiembro('editor');

        const resultado = await eliminarTaxonomiaAccion({ tipo, id: crypto.randomUUID() });

        expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
      });
    });
  });

  describe('eliminar una categoría en uso (H5-E4)', () => {
    it('H5-E4: con artículos devuelve categoria_en_uso con la cantidad en el detalle y no la borra', async () => {
      await comoMiembro('editor');
      const fila = await sembrar('categoria', nombre('En uso'));
      await sembrarArticulo('categoria', fila.id, true);
      await sembrarArticulo('categoria', fila.id, false);

      const resultado = await eliminarTaxonomiaAccion({ tipo: 'categoria', id: fila.id });

      expect(resultado).toMatchObject({
        ok: false,
        codigo: 'categoria_en_uso',
        detalle: '2',
        mensaje: 'No se puede eliminar: la usan 2 artículos.',
      });
      expect(await leer('categoria', fila.id)).not.toBeNull();
    });

    it('H5-E4: con un solo artículo el mensaje va en singular', async () => {
      await comoMiembro('editor');
      const fila = await sembrar('categoria', nombre('En uso singular'));
      await sembrarArticulo('categoria', fila.id, false);

      const resultado = await eliminarTaxonomiaAccion({ tipo: 'categoria', id: fila.id });

      expect(resultado).toMatchObject({
        ok: false,
        codigo: 'categoria_en_uso',
        detalle: '1',
        mensaje: 'No se puede eliminar: la usa 1 artículo.',
      });
    });
  });

  describe('eliminar una etiqueta con artículos (H5-E5)', () => {
    it('H5-E5: la quita de los artículos sin afectar nada más', async () => {
      await comoMiembro('editor');
      const etiqueta = await sembrar('etiqueta', nombre('Quitable'));
      const otra = await sembrar('etiqueta', nombre('Se queda'));
      const articulo = await crearArticuloDePrueba(admin, registro, {
        titulo: `${PREFIJO} articulo ${(contador += 1)}`,
        slug: '',
        contenido: {
          type: 'doc',
          content: [
            { type: 'paragraph', attrs: { id: crypto.randomUUID() }, content: [{ type: 'text', text: 'Texto' }] },
          ],
        },
        categoriaId: categoriaBaseId,
        etiquetas: [etiqueta.id, otra.id],
        publicar: true,
      });

      const resultado = await eliminarTaxonomiaAccion({ tipo: 'etiqueta', id: etiqueta.id });

      expect(resultado).toMatchObject({ ok: true });
      expect(await leer('etiqueta', etiqueta.id)).toBeNull();
      const { data: restantes } = await admin
        .from('articulos_etiquetas')
        .select('etiqueta_id')
        .eq('articulo_id', articulo.id);
      expect(restantes).toEqual([{ etiqueta_id: otra.id }]);
      const { data: intacto } = await admin
        .from('articulos')
        .select('estado, categoria_id')
        .eq('id', articulo.id)
        .single();
      expect(intacto).toEqual({ estado: 'publicado', categoria_id: categoriaBaseId });
    });
  });

  describe('permisos (RF-024)', () => {
    it('H5-E1: un anónimo recibe no_autenticado en las tres acciones y no cambia nada', async () => {
      const fila = await sembrar('etiqueta', nombre('Intocable'));

      const crear = await crearTaxonomiaAccion({ tipo: 'etiqueta', nombre: nombre('Anónima') });
      const actualizar = await actualizarTaxonomiaAccion({
        tipo: 'etiqueta',
        id: fila.id,
        cambios: { nombre: nombre('Cambiada') },
      });
      const eliminar = await eliminarTaxonomiaAccion({ tipo: 'etiqueta', id: fila.id });

      for (const resultado of [crear, actualizar, eliminar]) {
        expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
      }
      expect(await leer('etiqueta', fila.id)).toMatchObject({ nombre: fila.nombre });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('RF-024: el editor y el admin pueden crear, actualizar y eliminar', async () => {
      for (const usuario of ['editor', 'admin'] as const) {
        await comoMiembro(usuario);
        const creada = await crearTaxonomiaAccion({ tipo: 'categoria', nombre: nombre(`Por ${usuario}`) });
        expect(creada.ok).toBe(true);
        if (!creada.ok) continue;
        registrar('categoria', creada.datos.id);

        const cambiada = await actualizarTaxonomiaAccion({
          tipo: 'categoria',
          id: creada.datos.id,
          cambios: { descripcion: `Editada por ${usuario}` },
        });
        expect(cambiada.ok).toBe(true);

        const borrada = await eliminarTaxonomiaAccion({ tipo: 'categoria', id: creada.datos.id });
        expect(borrada.ok).toBe(true);
      }
    });
  });
});
