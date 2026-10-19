// T074 (spec 002): tags y rutas que se invalidan ante un aviso de cambio público
// (contracts/cache.md, "esquemaCambioPublico" e "invalidacionesDe"; H4-E1, H4-E3, H4-E6, H4-E7).
// Funciones puras: sin base de datos.
import { describe, expect, it } from 'vitest';
import { ErrorDominio } from './errores';
import { esquemaCambioPublico, invalidacionesDe, leerCambioPublico, type CambioPublico } from './invalidaciones';
import { TAG_ARTICULOS, tagArticulo, tagAutor, tagCategoria, tagEtiqueta } from './tags';

const ID = '5b0c0000-0000-4000-8000-000000000001';
const OCURRIDO_EN = '2026-10-19T12:00:00Z';

function cambio(campos: Partial<CambioPublico> = {}): CambioPublico {
  return { tipo: 'articulo', id: ID, slugs: ['b', 'a'], ocurrido_en: OCURRIDO_EN, ...campos };
}

describe('invalidacionesDe', () => {
  it('H4-E1: un artículo invalida la colección, su tag y la ruta de cada slug, en el orden recibido', () => {
    expect(invalidacionesDe(cambio())).toEqual({
      tags: [TAG_ARTICULOS, tagArticulo(ID)],
      rutas: ['/blog/b', '/blog/a'],
    });
  });

  it('H4-E1: los slugs anteriores del artículo también se invalidan (la URL vieja pasa a redirigir)', () => {
    const { rutas } = invalidacionesDe(cambio({ slugs: ['claridad-al-escribir', 'escribir', 'escribir-original'] }));
    expect(rutas).toEqual(['/blog/claridad-al-escribir', '/blog/escribir', '/blog/escribir-original']);
  });

  it('H4-E1: categorias y etiquetas del aviso se aceptan pero no agregan tags ni rutas (los cubre el tag articulos)', () => {
    const conTaxonomias = cambio({ categorias: ['diseno'], etiquetas: ['seo', 'astro'] });
    expect(invalidacionesDe(conTaxonomias)).toEqual(invalidacionesDe(cambio()));
  });

  it('H4-E6: una categoría invalida la colección, su tag (las páginas de artículos que la muestran) y sus rutas', () => {
    expect(invalidacionesDe(cambio({ tipo: 'categoria', slugs: ['marketing-digital', 'marketing'] }))).toEqual({
      tags: [TAG_ARTICULOS, tagCategoria(ID)],
      rutas: ['/blog/categoria/marketing-digital', '/blog/categoria/marketing'],
    });
  });

  it('H4-E6: una etiqueta invalida la colección, su tag y sus rutas', () => {
    expect(invalidacionesDe(cambio({ tipo: 'etiqueta', slugs: ['redes', 'redes-sociales'] }))).toEqual({
      tags: [TAG_ARTICULOS, tagEtiqueta(ID)],
      rutas: ['/blog/etiqueta/redes', '/blog/etiqueta/redes-sociales'],
    });
  });

  it('H4-E7: un autor invalida la colección y su tag (su página y sus artículos), sin rutas', () => {
    expect(invalidacionesDe(cambio({ tipo: 'autor', slugs: ['eva-editora'] }))).toEqual({
      tags: [TAG_ARTICULOS, tagAutor(ID)],
      rutas: [],
    });
  });

  it('no repite rutas aunque el aviso repita slugs, y conserva la primera aparición', () => {
    const resultado = invalidacionesDe(cambio({ slugs: ['b', 'a', 'b', 'a'] }));
    expect(resultado.rutas).toEqual(['/blog/b', '/blog/a']);
    expect(new Set(resultado.tags).size).toBe(resultado.tags.length);
  });

  it('H4-E3: llamarla dos veces con el mismo aviso da el mismo resultado', () => {
    const aviso = cambio({ tipo: 'categoria', slugs: ['diseno', 'diseno-grafico'] });
    expect(invalidacionesDe(aviso)).toEqual(invalidacionesDe(aviso));
  });

  it('no modifica el aviso recibido', () => {
    const aviso = cambio({ slugs: ['b', 'a', 'b'] });
    const copia = structuredClone(aviso);
    invalidacionesDe(aviso);
    expect(aviso).toEqual(copia);
  });
});

describe('leerCambioPublico', () => {
  const avisoValido = {
    tipo: 'articulo',
    id: ID,
    slugs: ['b', 'a'],
    categorias: ['diseno'],
    etiquetas: ['seo'],
    ocurrido_en: OCURRIDO_EN,
  };

  it('acepta un aviso válido', () => {
    expect(leerCambioPublico(avisoValido)).toEqual(avisoValido);
  });

  it('acepta el ocurrido_en con offset y fracciones que genera la base (now()::jsonb)', () => {
    const conOffset = { ...avisoValido, ocurrido_en: '2026-10-19T12:00:00.123456+00:00' };
    expect(leerCambioPublico(conOffset).ocurrido_en).toBe(conOffset.ocurrido_en);
  });

  it('acepta un aviso sin categorias ni etiquetas (taxonomía o autor)', () => {
    const deAutor = { tipo: 'autor', id: ID, slugs: ['eva-editora'], ocurrido_en: OCURRIDO_EN };
    expect(leerCambioPublico(deAutor)).toEqual(deAutor);
  });

  it('ignora los campos desconocidos (la base puede agregar campos sin romper el sitio)', () => {
    const resultado = leerCambioPublico({ ...avisoValido, version: 7, origen: 'cron' });
    expect(resultado).toEqual(avisoValido);
  });

  it('esquemaCambioPublico es no estricto: el mismo aviso con campos extra es válido', () => {
    expect(esquemaCambioPublico.safeParse({ ...avisoValido, extra: true }).success).toBe(true);
  });

  const invalidos: [string, unknown][] = [
    ['falta tipo', { ...avisoValido, tipo: undefined }],
    ['el tipo no es uno de los cuatro', { ...avisoValido, tipo: 'pagina' }],
    ['id no es uuid', { ...avisoValido, id: 'no-es-uuid' }],
    ['slugs está vacío', { ...avisoValido, slugs: [] }],
    ['slugs tiene más de 50 elementos', { ...avisoValido, slugs: Array.from({ length: 51 }, (_, i) => `slug-${i}`) }],
    ['un slug tiene mayúsculas', { ...avisoValido, slugs: ['b', 'Con-Mayusculas'] }],
    ['un slug tiene espacios', { ...avisoValido, slugs: ['con espacios'] }],
    ['un slug tiene una barra', { ...avisoValido, slugs: ['../admin'] }],
    ['un slug está vacío', { ...avisoValido, slugs: [''] }],
    ['falta ocurrido_en', { ...avisoValido, ocurrido_en: undefined }],
    ['ocurrido_en no es ISO', { ...avisoValido, ocurrido_en: 'ayer a la tarde' }],
    ['el aviso no es un objeto', 'texto'],
    ['el aviso es null', null],
  ];

  it.each(invalidos)("lanza ErrorDominio('validacion') si %s", (_, aviso) => {
    let capturado: unknown;
    try {
      leerCambioPublico(aviso);
    } catch (error) {
      capturado = error;
    }
    expect(capturado).toBeInstanceOf(ErrorDominio);
    expect((capturado as ErrorDominio).codigo).toBe('validacion');
  });

  it('acepta exactamente 50 slugs', () => {
    const slugs = Array.from({ length: 50 }, (_, i) => `slug-${i}`);
    expect(leerCambioPublico({ ...avisoValido, slugs }).slugs).toHaveLength(50);
  });
});
