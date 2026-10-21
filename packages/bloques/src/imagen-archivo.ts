// Tipo y dimensiones reales de un archivo de imagen, leídos de sus bytes (spec 003, research D10).
// El panel no se fía del tipo que declara el navegador ni de la extensión del nombre (RF-007): solo
// se aceptan JPEG, PNG, WebP y AVIF. Función pura y sin dependencias; un archivo truncado o de otro
// formato (GIF, SVG, ejecutables, texto) devuelve `null`.

export type TipoImagenArchivo = 'jpeg' | 'png' | 'webp' | 'avif';
export type ImagenDetectada = { tipo: TipoImagenArchivo; ancho: number; alto: number };

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, i: number) =>
  (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
const u32le = (b: Uint8Array, i: number) =>
  ((b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16) | ((b[i + 3] ?? 0) << 24)) >>> 0;

/** Los cuatro caracteres ASCII que empiezan en `i` (cadena vacía si no alcanzan los bytes). */
function texto4(b: Uint8Array, i: number) {
  if (i + 4 > b.length) return '';
  return String.fromCharCode(b[i] ?? 0, b[i + 1] ?? 0, b[i + 2] ?? 0, b[i + 3] ?? 0);
}

function conTamano(tipo: TipoImagenArchivo, ancho: number, alto: number): ImagenDetectada | null {
  return ancho > 0 && alto > 0 ? { tipo, ancho, alto } : null;
}

// Marcadores SOF (inicio de cuadro) de JPEG: llevan precisión, alto y ancho.
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(b: Uint8Array): ImagenDetectada | null {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marcador = b[i + 1] ?? 0;
    if (marcador === 0xff) {
      i += 1; // relleno
      continue;
    }
    if (SOF.has(marcador)) {
      if (i + 9 > b.length) return null;
      return conTamano('jpeg', u16be(b, i + 7), u16be(b, i + 5));
    }
    if (marcador === 0xd9 || marcador === 0xda) return null; // fin de imagen o de datos antes de un SOF
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) {
      i += 2; // marcadores sin longitud
      continue;
    }
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function png(b: Uint8Array): ImagenDetectada | null {
  if (b.length < 24 || texto4(b, 12) !== 'IHDR') return null;
  return conTamano('png', u32be(b, 16), u32be(b, 20));
}

function webp(b: Uint8Array): ImagenDetectada | null {
  const cuadro = texto4(b, 12);
  if (cuadro === 'VP8 ') {
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return conTamano('webp', u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  if (cuadro === 'VP8L') {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return conTamano('webp', (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (cuadro === 'VP8X') {
    if (b.length < 30) return null;
    return conTamano('webp', u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return null;
}

/** AVIF: contenedor ISO con marca `avif`/`avis`; las dimensiones salen de la caja `ispe` (la mayor). */
function avif(b: Uint8Array): ImagenDetectada | null {
  const tamanoFtyp = u32be(b, 0);
  if (texto4(b, 4) !== 'ftyp' || tamanoFtyp < 16 || tamanoFtyp > b.length) return null;
  const marcas = [texto4(b, 8)];
  for (let i = 16; i + 4 <= tamanoFtyp; i += 4) marcas.push(texto4(b, i));
  if (!marcas.some((marca) => marca === 'avif' || marca === 'avis')) return null;

  let mejor: ImagenDetectada | null = null;
  for (let i = tamanoFtyp; i + 20 <= b.length; i += 1) {
    if (texto4(b, i + 4) !== 'ispe' || u32be(b, i) !== 20) continue;
    const candidata = conTamano('avif', u32be(b, i + 12), u32be(b, i + 16));
    if (candidata && (!mejor || candidata.ancho * candidata.alto > mejor.ancho * mejor.alto)) mejor = candidata;
  }
  return mejor;
}

export function detectarImagen(bytes: Uint8Array): ImagenDetectada | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes);
  if (bytes.length >= 8 && bytes[0] === 0x89 && texto4(bytes, 1) === 'PNG\r' && bytes[5] === 0x0a) return png(bytes);
  if (texto4(bytes, 0) === 'RIFF' && texto4(bytes, 8) === 'WEBP') return webp(bytes);
  if (texto4(bytes, 4) === 'ftyp') return avif(bytes);
  return null;
}
