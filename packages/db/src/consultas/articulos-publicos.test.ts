// T039: consultas públicas de artículos (contracts/db.md, "Consultas públicas"; H2-E1, H2-E2, H2-E4;
// RF-006, RF-026, RSEO-002, RSEO-003). Integración contra Supabase local como visitante (anon).
// Los datos los crea y los borra el admin demo del seed (research D18).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import { clienteAnon, clienteComo, sinSupabase } from '../pruebas/clientes';
import { obtenerArticuloPublicado, resolverRedireccion } from './articulos-publicos';

const sufijo = crypto.randomUUID().slice(0, 8);
const contenido = [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Cuerpo del artículo público.' }];

describe.skipIf(sinSupabase)('consultas públicas de artículos (integración, anon)', () => {
  let admin: ClienteBlog;
  let anon: ClienteBlog;
  let categoria: { id: string; nombre: string; slug: string };
  let etiqueta: { id: string; nombre: string; slug: string };
  let perfilAdmin: { nombre: string; biografia: string | null; avatar: unknown };
  const creados: string[] = [];

  beforeAll(async () => {
    admin = await clienteComo('admin@demo.local', 'demo-admin-2026');
    anon = clienteAnon();

    const { data: usuario } = await admin.auth.getUser();
    const { data: perfil, error: errorPerfil } = await admin
      .from('perfiles')
      .select('nombre, biografia, avatar')
      .eq('id', usuario.user?.id ?? '')
      .single();
    if (errorPerfil) throw new Error(`No se pudo leer el perfil del admin demo: ${errorPerfil.message}`);
    perfilAdmin = perfil;

    const { data, error } = await admin
      .from('categorias')
      .insert({ nombre: `H2 públicos ${sufijo}`, slug: `h2-publicos-${sufijo}` })
      .select('id, nombre, slug')
      .single();
    if (error) throw new Error(`No se pudo crear la categoría de prueba: ${error.message}`);
    categoria = data;

    const { data: etiquetaCreada, error: errorEtiqueta } = await admin
      .from('etiquetas')
      .insert({ nombre: `H2 públicos etiqueta ${sufijo}`, slug: `h2-publicos-etiqueta-${sufijo}` })
      .select('id, nombre, slug')
      .single();
    if (errorEtiqueta) throw new Error(`No se pudo crear la etiqueta de prueba: ${errorEtiqueta.message}`);
    etiqueta = etiquetaCreada;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Borra primero los artículos (la categoría tiene FK restrict).
  afterAll(async () => {
    if (creados.length > 0) await admin.from('articulos').delete().in('id', creados);
    if (categoria) await admin.from('categorias').delete().eq('id', categoria.id);
    if (etiqueta) await admin.from('etiquetas').delete().eq('id', etiqueta.id);
  });

  /** Crea un borrador con categoría y un bloque (requisitos de RF-010) y, si se pide, lo publica. */
  async function crearArticulo(
    nombre: string,
    { publicar = true, ...campos }: { publicar?: boolean; titulo_seo?: string; descripcion_seo?: string } = {},
  ) {
    const { data: borrador, error } = await admin
      .from('articulos')
      .insert({
        titulo: `H2 públicos: ${nombre}`,
        slug: `h2-publicos-${nombre}-${sufijo}`,
        extracto: `Extracto de ${nombre}.`,
        contenido,
        categoria_id: categoria.id,
        ...campos,
      })
      .select('id, slug, version')
      .single();
    if (error) throw new Error(`No se pudo crear el artículo de prueba: ${error.message}`);
    creados.push(borrador.id);
    if (!publicar) return borrador;

    const { data: publicado, error: errorPublicar } = await admin
      .from('articulos')
      .update({ estado: 'publicado', version: borrador.version })
      .eq('id', borrador.id)
      .select('id, slug, version, estado')
      .single();
    if (errorPublicar) throw new Error(`No se pudo publicar el artículo de prueba: ${errorPublicar.message}`);
    if (publicado.estado !== 'publicado') throw new Error('El artículo de prueba no quedó publicado');
    return publicado;
  }

  describe('obtenerArticuloPublicado', () => {
    it('H2-E1/H2-E2: devuelve el artículo con categoría, etiquetas, autor público y SEO de respaldo (RF-006)', async () => {
      const creado = await crearArticulo('completo');
      const { error } = await admin.rpc('asignar_etiquetas', {
        articulo_id: creado.id,
        etiqueta_ids: [etiqueta.id],
        version: creado.version,
      });
      if (error) throw new Error(`No se pudieron asignar las etiquetas: ${error.message}`);

      const articulo = await obtenerArticuloPublicado(anon, creado.slug);

      expect(articulo).toMatchObject({
        id: creado.id,
        slug: creado.slug,
        titulo: 'H2 públicos: completo',
        extracto: 'Extracto de completo.',
        contenido,
        categoria: { nombre: categoria.nombre, slug: categoria.slug },
        etiquetas: [{ nombre: etiqueta.nombre, slug: etiqueta.slug }],
        seo: { titulo: 'H2 públicos: completo', descripcion: 'Extracto de completo.' },
      });
      expect(articulo?.autor).toEqual(perfilAdmin);
      expect(perfilAdmin.nombre).toBe('Ana Admin');
    });

    it('H2-E2: el autor contiene solo nombre, biografía y avatar (nunca correo ni rol)', async () => {
      const creado = await crearArticulo('autor');

      const articulo = await obtenerArticuloPublicado(anon, creado.slug);

      expect(Object.keys(articulo?.autor ?? {}).sort()).toEqual(['avatar', 'biografia', 'nombre']);
      expect(JSON.stringify(articulo)).not.toContain('@demo.local');
    });

    it('RF-006: con titulo_seo y descripcion_seo propios, el SEO los usa', async () => {
      const creado = await crearArticulo('seo-propio', {
        titulo_seo: 'Título SEO propio',
        descripcion_seo: 'Descripción SEO propia.',
      });

      const articulo = await obtenerArticuloPublicado(anon, creado.slug);

      expect(articulo?.seo).toEqual({ titulo: 'Título SEO propio', descripcion: 'Descripción SEO propia.' });
    });

    it('CE-002: devuelve null para un borrador', async () => {
      const borrador = await crearArticulo('borrador', { publicar: false });

      await expect(obtenerArticuloPublicado(anon, borrador.slug)).resolves.toBeNull();
    });

    it('A3-M3: con una sesión del equipo tampoco devuelve borradores (filtro explícito, no solo RLS)', async () => {
      const borrador = await crearArticulo('borrador-equipo', { publicar: false });

      await expect(obtenerArticuloPublicado(admin, borrador.slug)).resolves.toBeNull();
    });

    it('devuelve null para un slug inexistente', async () => {
      await expect(obtenerArticuloPublicado(anon, `h2-publicos-no-existe-${sufijo}`)).resolves.toBeNull();
    });

    it('hace una sola petición a la base (relaciones embebidas, sin N+1)', async () => {
      const creado = await crearArticulo('una-peticion');
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      await obtenerArticuloPublicado(anon, creado.slug);

      expect(espiaFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolverRedireccion', () => {
    it('H2-E4/RSEO-003: el slug anterior de un publicado resuelve al slug actual', async () => {
      const creado = await crearArticulo('slug-viejo');
      const slugNuevo = `h2-publicos-slug-nuevo-${sufijo}`;
      const { error } = await admin
        .from('articulos')
        .update({ slug: slugNuevo, version: creado.version })
        .eq('id', creado.id);
      if (error) throw new Error(`No se pudo cambiar el slug: ${error.message}`);

      await expect(resolverRedireccion(anon, 'articulo', creado.slug)).resolves.toBe(slugNuevo);
      await expect(obtenerArticuloPublicado(anon, creado.slug)).resolves.toBeNull();
    });

    it('devuelve null si no hay redirección', async () => {
      await expect(resolverRedireccion(anon, 'articulo', `h2-publicos-sin-redireccion-${sufijo}`)).resolves.toBeNull();
    });

    it('hace una sola petición a la base', async () => {
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      await resolverRedireccion(anon, 'articulo', `h2-publicos-sin-redireccion-${sufijo}`);

      expect(espiaFetch).toHaveBeenCalledTimes(1);
    });
  });
});
