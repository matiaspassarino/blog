// Archivos de imagen mínimos armados byte a byte para los tests (spec 003, D9/D10): no hay binarios en
// el repo. Solo traen las cabeceras que lee `detectarImagen`; no son imágenes que un navegador pueda
// dibujar. No importa `vitest`, así que también lo usan los E2E de Playwright. Solo para tests.

import { crc32, deflateSync } from 'node:zlib';

const texto = (valor: string) => Array.from(valor, (c) => c.charCodeAt(0));
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u24le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u32le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const bytes = (...partes: number[][]) => new Uint8Array(partes.flat());

export function pngMinimo(ancho = 1, alto = 1): Uint8Array {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    u32be(13),
    texto('IHDR'),
    u32be(ancho),
    u32be(alto),
    [8, 2, 0, 0, 0],
    [0, 0, 0, 0], // CRC (no se verifica)
    u32be(0),
    texto('IEND'),
    [0xae, 0x42, 0x60, 0x82],
  );
}

export function jpegMinimo(ancho = 1, alto = 1): Uint8Array {
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe0],
    u16be(16),
    texto('JFIF'),
    [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, 0xc0],
    u16be(17),
    [8],
    u16be(alto),
    u16be(ancho),
    [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
    [0xff, 0xd9],
  );
}

export function webpMinimo(ancho = 1, alto = 1): Uint8Array {
  const carga = [0x10, 0, 0, 0, ...u24le(ancho - 1), ...u24le(alto - 1)];
  const cuerpo = [...texto('WEBP'), ...texto('VP8X'), ...u32le(carga.length), ...carga];
  return bytes(texto('RIFF'), u32le(cuerpo.length), cuerpo);
}

const caja = (tipo: string, ...contenido: number[][]) => {
  const cuerpo = contenido.flat();
  return [...u32be(8 + cuerpo.length), ...texto(tipo), ...cuerpo];
};

export function avifMinimo(ancho = 1, alto = 1): Uint8Array {
  const ftyp = caja('ftyp', texto('avif'), u32be(0), texto('avif'), texto('mif1'));
  const ispe = caja('ispe', [0, 0, 0, 0], u32be(ancho), u32be(alto));
  const meta = caja('meta', [0, 0, 0, 0], caja('iprp', caja('ipco', ispe)));
  return bytes(ftyp, meta);
}

/** GIF89a de 1x1: formato que el panel rechaza aunque sea una imagen válida (clarificación 2026-10-21). */
export function gifMinimo(): Uint8Array {
  return bytes(texto('GIF89a'), [1, 0, 1, 0, 0, 0, 0], [0x3b]);
}

export function svgMinimo(): Uint8Array {
  return new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
}

/** Un archivo de texto, para probar que se rechaza aunque se llame `.jpg`. */
export function textoPlanoComoArchivo(): Uint8Array {
  return new TextEncoder().encode('Esto no es una imagen, solo texto con extensión de imagen.');
}

/**
 * PNG completo y decodificable (un solo color), para que el navegador pueda dibujar la miniatura.
 * A diferencia de `pngMinimo`, trae datos de imagen y CRC válidos.
 */
export function pngDecodificable(ancho = 4, alto = 3): Uint8Array {
  const trozo = (tipo: string, datos: number[]) => {
    const cuerpo = [...texto(tipo), ...datos];
    return [...u32be(datos.length), ...cuerpo, ...u32be(crc32(Uint8Array.from(cuerpo)))];
  };
  const fila = [0, ...Array.from({ length: ancho * 3 }, (_, i) => (i % 3 === 0 ? 200 : 80))];
  const crudo = Uint8Array.from(Array.from({ length: alto }, () => fila).flat());
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    trozo('IHDR', [...u32be(ancho), ...u32be(alto), 8, 2, 0, 0, 0]),
    trozo('IDAT', [...deflateSync(crudo)]),
    trozo('IEND', []),
  );
}
