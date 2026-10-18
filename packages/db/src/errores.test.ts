import { describe, expect, it } from 'vitest';
import { ErrorDominio, traducirError, type CodigoError, type ErrorPostgrest } from './errores';

function errorPostgrest(code: string, message: string, details = '', hint = ''): ErrorPostgrest {
  return { code, message, details, hint };
}

// Simula lo que llega desde PostgREST: `raise exception using errcode = 'P0001',
// message = '<codigo>', detail = '<detalle>'` (tasks.md, convenciones).
function errorDeDominio(mensaje: string, detalle = ''): ErrorPostgrest {
  return errorPostgrest('P0001', mensaje, detalle);
}

function traducir(error: ErrorPostgrest): ErrorDominio {
  return traducirError(error);
}

describe('traducirError', () => {
  describe('errores de dominio lanzados por la base (P0001)', () => {
    const casos: Array<[string, CodigoError]> = [
      ['conflicto_version', 'conflicto_version'],
      ['estado_invalido', 'estado_invalido'],
      ['requisitos_publicacion', 'requisitos_publicacion'],
      ['fecha_no_futura', 'fecha_no_futura'],
      ['categoria_en_uso', 'categoria_en_uso'],
      ['ultimo_admin', 'ultimo_admin'],
      ['contenido_invalido', 'contenido_invalido'],
    ];

    it.each(casos)('mapea el P0001 con mensaje %s al código %s', (mensaje, codigoEsperado) => {
      const resultado = traducir(errorDeDominio(mensaje));

      expect(resultado).toBeInstanceOf(ErrorDominio);
      expect(resultado).toBeInstanceOf(Error);
      expect(resultado.codigo).toBe(codigoEsperado);
    });

    it('conserva el detail de requisitos_publicacion (categoria)', () => {
      const resultado = traducir(errorDeDominio('requisitos_publicacion', 'categoria'));

      expect(resultado.codigo).toBe('requisitos_publicacion');
      expect(resultado.detalle).toBe('categoria');
    });

    it('conserva el detail de requisitos_publicacion (contenido)', () => {
      const resultado = traducir(errorDeDominio('requisitos_publicacion', 'contenido'));

      expect(resultado.codigo).toBe('requisitos_publicacion');
      expect(resultado.detalle).toBe('contenido');
    });

    it('conserva el conteo de artículos de categoria_en_uso', () => {
      const resultado = traducir(errorDeDominio('categoria_en_uso', '2'));

      expect(resultado.codigo).toBe('categoria_en_uso');
      expect(resultado.detalle).toBe('2');
    });

    it('mapea el P0001 sin_permiso del trigger de perfil a sin_permiso', () => {
      expect(traducir(errorDeDominio('sin_permiso')).codigo).toBe('sin_permiso');
    });

    it('conserva el error original como causa', () => {
      const original = errorDeDominio('conflicto_version');

      expect(traducir(original).cause).toBe(original);
    });
  });

  describe('permisos', () => {
    it('mapea el 42501 (sin privilegio sobre la tabla) a sin_permiso', () => {
      const resultado = traducir(errorPostgrest('42501', 'permission denied for table perfiles'));

      expect(resultado.codigo).toBe('sin_permiso');
    });

    it('mapea el error de RLS a sin_permiso', () => {
      const resultado = traducir(
        errorPostgrest('42501', 'new row violates row-level security policy for table "categorias"'),
      );

      expect(resultado.codigo).toBe('sin_permiso');
    });
  });

  describe('unicidad', () => {
    it('mapea el 23505 sobre slug a slug_duplicado', () => {
      const resultado = traducir(
        errorPostgrest(
          '23505',
          'duplicate key value violates unique constraint "categorias_slug_key"',
          'Key (slug)=(diseno-web) already exists.',
        ),
      );

      expect(resultado.codigo).toBe('slug_duplicado');
    });

    it('no mapea a slug_duplicado un 23505 sobre otra columna', () => {
      const resultado = traducir(
        errorPostgrest(
          '23505',
          'duplicate key value violates unique constraint "categorias_nombre_lower_idx"',
          'Key (lower(nombre))=(seo) already exists.',
        ),
      );

      expect(resultado).toBeInstanceOf(ErrorDominio);
      expect(resultado.codigo).not.toBe('slug_duplicado');
    });
  });

  describe('no encontrado', () => {
    it('mapea el PGRST116 a no_encontrado', () => {
      const resultado = traducir(
        errorPostgrest(
          'PGRST116',
          'JSON object requested, multiple (or no) rows returned',
          'The result contains 0 rows',
        ),
      );

      expect(resultado.codigo).toBe('no_encontrado');
    });
  });

  describe('otros errores', () => {
    it('devuelve un ErrorDominio genérico que conserva la causa', () => {
      const original = errorPostgrest('XX000', 'error interno inesperado');
      const resultado = traducir(original);

      expect(resultado).toBeInstanceOf(ErrorDominio);
      expect(resultado.cause).toBe(original);
    });

    it('trata como genérico un P0001 con un mensaje desconocido', () => {
      const original = errorDeDominio('mensaje_que_no_existe');
      const resultado = traducir(original);

      expect(resultado).toBeInstanceOf(ErrorDominio);
      expect(resultado.cause).toBe(original);
    });
  });
});
