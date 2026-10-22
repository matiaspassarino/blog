// T020 (spec 003): destino seguro tras el ingreso (H1-E4, redirección abierta).
// Firma supuesta (T033), exportada desde './volver':
//   rutaInterna(valor: string | null | undefined): string
//     devuelve `valor` si es una ruta interna (empieza con "/", no con "//" ni "/\") y, si no, "/articulos".
import { describe, expect, it } from 'vitest';
import { rutaInterna } from './volver';

const PREDETERMINADA = '/articulos';

describe('rutaInterna: rutas aceptadas', () => {
  it.each(['/articulos', '/articulos/abc?x=1', '/categorias', '/articulos?estado=borrador&pagina=2', '/equipo#nuevo'])(
    'H1-E4: acepta %s',
    (valor) => {
      expect(rutaInterna(valor)).toBe(valor);
    },
  );
});

describe('rutaInterna: rutas rechazadas', () => {
  it.each([
    ['//evil.com', 'una URL sin esquema'],
    ['///evil.com', 'tres barras'],
    ['https://evil.com', 'una URL absoluta https'],
    ['http://evil.com/articulos', 'una URL absoluta http'],
    ['javascript:alert(1)', 'un esquema javascript'],
    ['data:text/html,hola', 'un esquema data'],
    ['', 'una cadena vacía'],
    ['   ', 'solo espacios'],
    ['articulos', 'una ruta relativa sin barra inicial'],
    ['\\evil', 'una barra invertida inicial'],
    ['\\\\evil', 'dos barras invertidas iniciales'],
    ['/\\evil.com', 'barra seguida de barra invertida'],
    ['/articulos\nSet-Cookie: x=1', 'un salto de línea'],
    ['/articulos\r\nLocation: https://evil.com', 'un retorno de carro y salto de línea'],
    ['/articulos\u0000', 'un carácter nulo'],
  ])('H1-E4: rechaza %j (%s) y devuelve /articulos', (valor) => {
    expect(rutaInterna(valor)).toBe(PREDETERMINADA);
  });

  it('H1-E4: sin valor (null o undefined) devuelve /articulos', () => {
    expect(rutaInterna(null)).toBe(PREDETERMINADA);
    expect(rutaInterna(undefined)).toBe(PREDETERMINADA);
  });
});
