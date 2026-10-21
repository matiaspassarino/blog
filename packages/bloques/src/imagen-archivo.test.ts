// T014 (spec 003): detección de imágenes por firma (RF-007, D10). Los fixtures son arreglos de bytes
// armados en el test: no hay binarios en el repo.
// Firma supuesta (T030): `detectarImagen(bytes: Uint8Array)` devuelve `{ tipo, ancho, alto } | null`,
// exportada desde './imagen-archivo'. La extensión del nombre no interviene: solo se ven los bytes.
import { describe, expect, it } from 'vitest';
import { detectarImagen } from './imagen-archivo';

const texto = (valor: string) => Array.from(valor, (c) => c.charCodeAt(0));
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u24le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u32le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const bytes = (...partes: number[][]) => new Uint8Array(partes.flat());

function png(ancho: number, alto: number) {
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

function jpeg(ancho: number, alto: number) {
  return bytes(
    [0xff, 0xd8],
    // APP0 (JFIF): el detector debe saltar los segmentos hasta encontrar el SOF
    [0xff, 0xe0],
    u16be(16),
    texto('JFIF'),
    [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    // SOF0: longitud 17, precisión 8, alto, ancho, 3 componentes
    [0xff, 0xc0],
    u16be(17),
    [8],
    u16be(alto),
    u16be(ancho),
    [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
    [0xff, 0xd9],
  );
}

function riff(...fragmentos: number[][]) {
  const cuerpo = [...texto('WEBP'), ...fragmentos.flat()];
  return bytes(texto('RIFF'), u32le(cuerpo.length), cuerpo);
}

function webpConPerdida(ancho: number, alto: number) {
  const carga = [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, ...u16le(ancho), ...u16le(alto), 0, 0];
  return riff(texto('VP8 '), u32le(carga.length), carga);
}

function webpSinPerdida(ancho: number, alto: number) {
  const empaquetado = ((ancho - 1) | ((alto - 1) << 14)) >>> 0; // sin alfa, versión 0
  const carga = [0x2f, ...u32le(empaquetado), 0, 0, 0, 0];
  return riff(texto('VP8L'), u32le(carga.length), carga);
}

function webpExtendido(ancho: number, alto: number) {
  const carga = [0x10, 0, 0, 0, ...u24le(ancho - 1), ...u24le(alto - 1)];
  return riff(texto('VP8X'), u32le(carga.length), carga);
}

const caja = (tipo: string, ...contenido: number[][]) => {
  const cuerpo = contenido.flat();
  return [...u32be(8 + cuerpo.length), ...texto(tipo), ...cuerpo];
};

function avif(ancho: number, alto: number) {
  const ftyp = caja('ftyp', texto('avif'), u32be(0), texto('avif'), texto('mif1'));
  const ispe = caja('ispe', [0, 0, 0, 0], u32be(ancho), u32be(alto));
  const meta = caja('meta', [0, 0, 0, 0], caja('iprp', caja('ipco', ispe)));
  return bytes(ftyp, meta);
}

describe('detectarImagen: formatos válidos', () => {
  it('RF-007: reconoce un JPEG y lee su ancho y alto (saltando segmentos previos al SOF)', () => {
    expect(detectarImagen(jpeg(1920, 1080))).toEqual({ tipo: 'jpeg', ancho: 1920, alto: 1080 });
  });

  it('RF-007: reconoce un PNG y lee su ancho y alto', () => {
    expect(detectarImagen(png(1200, 630))).toEqual({ tipo: 'png', ancho: 1200, alto: 630 });
  });

  it('RF-007: reconoce un WebP con cuadro VP8 (con pérdida)', () => {
    expect(detectarImagen(webpConPerdida(1200, 630))).toEqual({ tipo: 'webp', ancho: 1200, alto: 630 });
  });

  it('RF-007: reconoce un WebP con cuadro VP8L (sin pérdida)', () => {
    expect(detectarImagen(webpSinPerdida(640, 480))).toEqual({ tipo: 'webp', ancho: 640, alto: 480 });
  });

  it('RF-007: reconoce un WebP con cuadro VP8X (extendido)', () => {
    expect(detectarImagen(webpExtendido(4000, 3000))).toEqual({ tipo: 'webp', ancho: 4000, alto: 3000 });
  });

  it('RF-007: reconoce un AVIF (caja ftyp + ispe) y lee su ancho y alto', () => {
    expect(detectarImagen(avif(1600, 900))).toEqual({ tipo: 'avif', ancho: 1600, alto: 900 });
  });

  it('RF-007: la extensión del nombre no cuenta: un PNG que se llame .jpg se reconoce como PNG', () => {
    // La función solo recibe los bytes: el nombre "foto.jpg" no puede influir.
    expect(detectarImagen(png(10, 20))?.tipo).toBe('png');
  });
});

describe('detectarImagen: archivos rechazados', () => {
  it('RF-007: rechaza un GIF', () => {
    const gif = bytes(texto('GIF89a'), u16le(100), u16le(50), [0, 0, 0], [0x3b]);

    expect(detectarImagen(gif)).toBeNull();
  });

  it('RF-007: rechaza un SVG', () => {
    const svg = bytes(texto('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'));

    expect(detectarImagen(svg)).toBeNull();
  });

  it('RF-007: rechaza un ejecutable (.exe) renombrado a .jpg', () => {
    const exe = bytes(texto('MZ'), new Array<number>(62).fill(0), [0x50, 0x45, 0, 0]);

    expect(detectarImagen(exe)).toBeNull();
  });

  it('RF-007: rechaza un texto renombrado a .jpg', () => {
    expect(detectarImagen(bytes(texto('Esto no es una imagen, solo texto plano.')))).toBeNull();
  });

  it('RF-007: rechaza un archivo vacío', () => {
    expect(detectarImagen(new Uint8Array(0))).toBeNull();
  });

  it('RF-007: rechaza un archivo de un solo byte', () => {
    expect(detectarImagen(new Uint8Array([0xff]))).toBeNull();
  });

  it.each([
    ['un JPEG truncado antes del SOF', () => jpeg(800, 600).slice(0, 12)],
    ['un JPEG que solo tiene la firma', () => bytes([0xff, 0xd8])],
    ['un PNG truncado dentro del IHDR', () => png(800, 600).slice(0, 20)],
    ['un PNG que solo tiene la firma', () => png(800, 600).slice(0, 8)],
    ['un WebP truncado en el encabezado', () => webpConPerdida(800, 600).slice(0, 14)],
    ['un WebP VP8X truncado', () => webpExtendido(800, 600).slice(0, 24)],
    ['un AVIF truncado antes de ispe', () => avif(800, 600).slice(0, 40)],
    ['un AVIF que solo tiene ftyp', () => avif(800, 600).slice(0, 28)],
  ])('RF-007: rechaza %s sin lanzar', (_nombre, fabricar) => {
    expect(detectarImagen(fabricar())).toBeNull();
  });

  it('RF-007: no confunde un contenedor ISO que no es AVIF (por ejemplo MP4)', () => {
    const mp4 = bytes(caja('ftyp', texto('isom'), u32be(0), texto('isom'), texto('mp41')));

    expect(detectarImagen(mp4)).toBeNull();
  });
});
