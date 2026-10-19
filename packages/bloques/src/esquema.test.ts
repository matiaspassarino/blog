// T021: esquema de bloques (contracts/bloques.md, "Tipos de bloque"; RF-002; constitución §VI).
import { describe, expect, it } from 'vitest';
import { esquemaBloque, esquemaContenido } from './esquema';
import { TIPOS_BLOQUE, type TipoBloque } from './index';

const imagen = (n = 1) => ({ ruta: `galeria/foto-${n}.jpg`, ancho: 800, alto: 600, alt: `Foto ${n}` });
const imagenes = (cantidad: number) => Array.from({ length: cantidad }, (_, i) => imagen(i + 1));
const texto = (largo: number) => 'a'.repeat(largo);

// Un bloque válido mínimo por tipo. El Record obliga a cubrir los 10 tipos de TIPOS_BLOQUE.
const bloquesValidos: Record<TipoBloque, Record<string, unknown>> = {
  parrafo: { tipo: 'parrafo', texto: 'Un párrafo con **negrita** y [un enlace](https://ejemplo.com).' },
  titulo: { tipo: 'titulo', nivel: 2, texto: 'Un subtítulo' },
  imagen: { tipo: 'imagen', imagen: imagen() },
  cita: { tipo: 'cita', texto: 'Menos es más.' },
  lista: { tipo: 'lista', ordenada: false, items: ['Uno', 'Dos'] },
  galeria: { tipo: 'galeria', imagenes: imagenes(2) },
  cta: { tipo: 'cta', titulo: '¿Hablamos?', etiquetaBoton: 'Contactanos', url: '/contacto' },
  separador: { tipo: 'separador' },
  codigo: { tipo: 'codigo', codigo: 'const saludo = "hola";' },
  video: { tipo: 'video', proveedor: 'youtube', idVideo: 'dQw4w9WgXcQ', titulo: 'Video de presentación' },
};

function bloque(tipo: TipoBloque, cambios: Record<string, unknown> = {}) {
  return { id: crypto.randomUUID(), ...bloquesValidos[tipo], ...cambios };
}

function sinCampo(tipo: TipoBloque, campo: string) {
  const copia: Record<string, unknown> = bloque(tipo);
  delete copia[campo];
  return copia;
}

const esValido = (entrada: unknown) => esquemaBloque.safeParse(entrada).success;

describe('esquemaBloque', () => {
  describe('base común: id uuid y tipo', () => {
    it.each(TIPOS_BLOQUE)('acepta un bloque %s válido mínimo', (tipo) => {
      expect(esValido(bloque(tipo))).toBe(true);
    });

    it.each(TIPOS_BLOQUE)('rechaza un bloque %s sin id', (tipo) => {
      expect(esValido(sinCampo(tipo, 'id'))).toBe(false);
    });

    it.each(TIPOS_BLOQUE)('rechaza un bloque %s con un id que no es uuid', (tipo) => {
      expect(esValido(bloque(tipo, { id: 'bloque-1' }))).toBe(false);
    });

    it('rechaza un tipo de bloque inexistente', () => {
      expect(esValido({ id: crypto.randomUUID(), tipo: 'tabla', filas: [] })).toBe(false);
    });

    it('rechaza un bloque sin tipo', () => {
      expect(esValido({ id: crypto.randomUUID(), texto: 'Huérfano' })).toBe(false);
    });

    it.each([null, 'parrafo', 42, []])('rechaza una entrada que no es un objeto: %j', (entrada) => {
      expect(esValido(entrada)).toBe(false);
    });
  });

  describe('parrafo: texto de 1 a 5.000 caracteres', () => {
    it('acepta un texto de 1 y de 5.000 caracteres', () => {
      expect(esValido(bloque('parrafo', { texto: texto(1) }))).toBe(true);
      expect(esValido(bloque('parrafo', { texto: texto(5000) }))).toBe(true);
    });

    it.each([
      ['vacío', { texto: '' }],
      ['de 5.001 caracteres', { texto: texto(5001) }],
      ['que no es un string', { texto: 123 }],
    ])('rechaza un texto %s', (_caso, cambios) => {
      expect(esValido(bloque('parrafo', cambios))).toBe(false);
    });

    it('rechaza un párrafo sin texto', () => {
      expect(esValido(sinCampo('parrafo', 'texto'))).toBe(false);
    });
  });

  describe('titulo: nivel 2, 3 o 4 y texto de 1 a 150', () => {
    it.each([2, 3, 4])('acepta el nivel %i', (nivel) => {
      expect(esValido(bloque('titulo', { nivel }))).toBe(true);
    });

    it.each([1, 5, 6, '2', 2.5])('rechaza el nivel %j', (nivel) => {
      expect(esValido(bloque('titulo', { nivel }))).toBe(false);
    });

    it('acepta un texto de 150 caracteres', () => {
      expect(esValido(bloque('titulo', { texto: texto(150) }))).toBe(true);
    });

    it.each([
      ['vacío', ''],
      ['de 151 caracteres', texto(151)],
    ])('rechaza un texto %s', (_caso, valor) => {
      expect(esValido(bloque('titulo', { texto: valor }))).toBe(false);
    });

    it.each(['nivel', 'texto'])('rechaza un título sin %s', (campo) => {
      expect(esValido(sinCampo('titulo', campo))).toBe(false);
    });
  });

  describe('imagen: imagen obligatoria y leyenda ≤ 300', () => {
    it('acepta una leyenda de 300 caracteres', () => {
      expect(esValido(bloque('imagen', { leyenda: texto(300) }))).toBe(true);
    });

    it('rechaza una leyenda de 301 caracteres', () => {
      expect(esValido(bloque('imagen', { leyenda: texto(301) }))).toBe(false);
    });

    it('rechaza un bloque imagen sin imagen', () => {
      expect(esValido(sinCampo('imagen', 'imagen'))).toBe(false);
    });

    it('rechaza una imagen sin alt y no decorativa (RF-004)', () => {
      const { alt: _sinAlt, ...imagenSinAlt } = imagen();
      expect(esValido(bloque('imagen', { imagen: imagenSinAlt }))).toBe(false);
    });

    it('acepta una imagen decorativa sin alt', () => {
      const { alt: _sinAlt, ...imagenSinAlt } = imagen();
      expect(esValido(bloque('imagen', { imagen: { ...imagenSinAlt, decorativa: true } }))).toBe(true);
    });
  });

  describe('cita: texto ≤ 1.000, autor y fuente https opcionales', () => {
    it('acepta una cita completa con fuente https y texto de 1.000 caracteres', () => {
      expect(
        esValido(
          bloque('cita', { texto: texto(1000), autor: 'Dieter Rams', fuente: 'https://ejemplo.com/entrevista' }),
        ),
      ).toBe(true);
    });

    it('rechaza un texto de 1.001 caracteres', () => {
      expect(esValido(bloque('cita', { texto: texto(1001) }))).toBe(false);
    });

    it('rechaza una cita sin texto', () => {
      expect(esValido(sinCampo('cita', 'texto'))).toBe(false);
    });

    it.each(['http://ejemplo.com/entrevista', 'ftp://ejemplo.com/archivo', 'javascript:alert(1)', 'no es una url'])(
      'rechaza la fuente %j (debe ser una URL https)',
      (fuente) => {
        expect(esValido(bloque('cita', { fuente }))).toBe(false);
      },
    );
  });

  describe('lista: ordenada obligatoria y de 1 a 50 items de 1 a 500', () => {
    it('acepta una lista ordenada con 1 item y otra con 50 items de 500 caracteres', () => {
      expect(esValido(bloque('lista', { ordenada: true, items: ['Único'] }))).toBe(true);
      expect(esValido(bloque('lista', { items: Array.from({ length: 50 }, () => texto(500)) }))).toBe(true);
    });

    it.each([
      ['sin items', { items: [] }],
      ['con 51 items', { items: Array.from({ length: 51 }, () => 'item') }],
      ['con un item vacío', { items: ['Uno', ''] }],
      ['con un item de 501 caracteres', { items: [texto(501)] }],
      ['con ordenada que no es booleano', { ordenada: 'si' }],
    ])('rechaza una lista %s', (_caso, cambios) => {
      expect(esValido(bloque('lista', cambios))).toBe(false);
    });

    it.each(['ordenada', 'items'])('rechaza una lista sin %s', (campo) => {
      expect(esValido(sinCampo('lista', campo))).toBe(false);
    });
  });

  describe('galeria: de 2 a 24 imágenes y columnas 2, 3 o 4 (3 por defecto)', () => {
    it('acepta 2 y 24 imágenes', () => {
      expect(esValido(bloque('galeria', { imagenes: imagenes(2) }))).toBe(true);
      expect(esValido(bloque('galeria', { imagenes: imagenes(24) }))).toBe(true);
    });

    it('usa 3 columnas por defecto', () => {
      const resultado = esquemaBloque.safeParse(bloque('galeria'));
      expect(resultado.success).toBe(true);
      expect(resultado.data).toMatchObject({ tipo: 'galeria', columnas: 3 });
    });

    it.each([2, 3, 4])('acepta %i columnas', (columnas) => {
      expect(esValido(bloque('galeria', { columnas }))).toBe(true);
    });

    it.each([1, 5, '3'])('rechaza columnas = %j', (columnas) => {
      expect(esValido(bloque('galeria', { columnas }))).toBe(false);
    });

    it.each([
      ['con 1 imagen', imagenes(1)],
      ['con 25 imágenes', imagenes(25)],
    ])('rechaza una galería %s', (_caso, valor) => {
      expect(esValido(bloque('galeria', { imagenes: valor }))).toBe(false);
    });

    it('rechaza una galería con una imagen sin alt (RF-004)', () => {
      const { alt: _sinAlt, ...imagenSinAlt } = imagen(2);
      expect(esValido(bloque('galeria', { imagenes: [imagen(1), imagenSinAlt] }))).toBe(false);
    });

    it('rechaza una galería sin imágenes', () => {
      expect(esValido(sinCampo('galeria', 'imagenes'))).toBe(false);
    });
  });

  describe('cta: titulo, etiquetaBoton de 1 a 40 y url interna o https', () => {
    it.each(['/contacto', '/blog/mi-articulo', 'https://ejemplo.com/reservas'])('acepta la url %j', (url) => {
      expect(esValido(bloque('cta', { url }))).toBe(true);
    });

    it.each(['http://ejemplo.com', 'javascript:alert(1)', 'contacto', '//sitio-externo.com', ''])(
      'rechaza la url %j',
      (url) => {
        expect(esValido(bloque('cta', { url }))).toBe(false);
      },
    );

    it('acepta una etiqueta de 40 caracteres, texto y las variantes primaria y secundaria', () => {
      expect(
        esValido(bloque('cta', { etiquetaBoton: texto(40), texto: 'Respondemos en 24 h.', variante: 'primaria' })),
      ).toBe(true);
      expect(esValido(bloque('cta', { variante: 'secundaria' }))).toBe(true);
    });

    it.each([
      ['vacía', ''],
      ['de 41 caracteres', texto(41)],
    ])('rechaza una etiqueta de botón %s', (_caso, etiquetaBoton) => {
      expect(esValido(bloque('cta', { etiquetaBoton }))).toBe(false);
    });

    it('rechaza una variante desconocida', () => {
      expect(esValido(bloque('cta', { variante: 'terciaria' }))).toBe(false);
    });

    it.each(['titulo', 'etiquetaBoton', 'url'])('rechaza un cta sin %s', (campo) => {
      expect(esValido(sinCampo('cta', campo))).toBe(false);
    });
  });

  describe('separador: sin campos propios', () => {
    it('acepta un separador con solo id y tipo', () => {
      expect(esValido({ id: crypto.randomUUID(), tipo: 'separador' })).toBe(true);
    });

    it('rechaza un separador con un id que no es uuid', () => {
      expect(esValido({ id: '123', tipo: 'separador' })).toBe(false);
    });
  });

  describe('codigo: código ≤ 20.000 y lenguaje ^[a-z0-9+#-]{1,20}$', () => {
    it('acepta un código de 20.000 caracteres', () => {
      expect(esValido(bloque('codigo', { codigo: texto(20000) }))).toBe(true);
    });

    it('rechaza un código de 20.001 caracteres', () => {
      expect(esValido(bloque('codigo', { codigo: texto(20001) }))).toBe(false);
    });

    it('rechaza un bloque de código sin codigo', () => {
      expect(esValido(sinCampo('codigo', 'codigo'))).toBe(false);
    });

    it.each(['ts', 'c++', 'c#', 'objective-c', 'html5', texto(20)])('acepta el lenguaje %j', (lenguaje) => {
      expect(esValido(bloque('codigo', { lenguaje }))).toBe(true);
    });

    it.each(['TypeScript', 'shell script', '', texto(21), 'js<script>'])('rechaza el lenguaje %j', (lenguaje) => {
      expect(esValido(bloque('codigo', { lenguaje }))).toBe(false);
    });
  });

  describe('video: proveedor youtube o vimeo, idVideo válido por proveedor y titulo obligatorio', () => {
    it.each([
      ['youtube', 'dQw4w9WgXcQ'],
      ['youtube', 'a_b-C1d2E3f'],
      ['vimeo', '76979871'],
    ])('acepta un video de %s con id %j', (proveedor, idVideo) => {
      expect(esValido(bloque('video', { proveedor, idVideo }))).toBe(true);
    });

    it.each([
      ['youtube', 'abc'],
      ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      ['youtube', 'dQw4w9WgXc!'],
      ['youtube', '76979871'],
      ['vimeo', 'dQw4w9WgXcQ'],
      ['vimeo', 'https://vimeo.com/76979871'],
      ['vimeo', ''],
    ])('rechaza un video de %s con id %j', (proveedor, idVideo) => {
      expect(esValido(bloque('video', { proveedor, idVideo }))).toBe(false);
    });

    it('rechaza un proveedor que no es youtube ni vimeo', () => {
      expect(esValido(bloque('video', { proveedor: 'dailymotion', idVideo: 'x8abc12' }))).toBe(false);
    });

    it.each(['proveedor', 'idVideo', 'titulo'])('rechaza un video sin %s', (campo) => {
      expect(esValido(sinCampo('video', campo))).toBe(false);
    });
  });
});

describe('esquemaContenido', () => {
  it('acepta un contenido vacío (un borrador puede no tener bloques)', () => {
    expect(esquemaContenido.safeParse([]).success).toBe(true);
  });

  it('acepta un contenido con un bloque de cada tipo y conserva el orden', () => {
    const contenido = TIPOS_BLOQUE.map((tipo) => bloque(tipo));
    const resultado = esquemaContenido.safeParse(contenido);
    expect(resultado.success).toBe(true);
    expect(resultado.data?.map((b) => b.id)).toEqual(contenido.map((b) => b.id));
  });

  it('acepta exactamente 200 bloques', () => {
    const contenido = Array.from({ length: 200 }, () => bloque('separador'));
    expect(esquemaContenido.safeParse(contenido).success).toBe(true);
  });

  it('rechaza más de 200 bloques', () => {
    const contenido = Array.from({ length: 201 }, () => bloque('separador'));
    expect(esquemaContenido.safeParse(contenido).success).toBe(false);
  });

  it('rechaza un contenido con un tipo de bloque inexistente entre bloques válidos', () => {
    const contenido = [bloque('parrafo'), { id: crypto.randomUUID(), tipo: 'tabla' }, bloque('separador')];
    expect(esquemaContenido.safeParse(contenido).success).toBe(false);
  });

  it.each([null, {}, 'contenido', 42])('rechaza un contenido que no es un arreglo: %j', (entrada) => {
    expect(esquemaContenido.safeParse(entrada).success).toBe(false);
  });
});
