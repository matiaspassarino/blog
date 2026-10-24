// T134 (spec 005, Fase 13, Historia 7; RF-025, RF-027, RF-028; contracts/documento.md; research D27 y D31 U15):
// renderizado de tablas en el sitio público: región accesible, caption/aria-label, fila de encabezado,
// técnica H43 (headers/id con cuadricula), combinación de celdas y tokens de diseño.
//
// FASE ROJA: este test se escribe antes de crear `packages/bloques/src/render/Tabla.tsx` (T139).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { nodo } from '../pruebas/corpus-documento';
import { Tabla } from './Tabla';

const { texto, celda, encabezado, fila, tabla, parrafoSimple } = nodo;

describe('<Tabla>', () => {
  it('renderiza una región accesible con role="region", tabindex="0", aria-labelledby y max-w-full', () => {
    const t = tabla(
      { descripcion: 'Precios de planes' },
      fila(encabezado(undefined, parrafoSimple(texto('Plan')))),
      fila(celda(undefined, parrafoSimple(texto('Básico')))),
    );
    const html = renderToStaticMarkup(<Tabla elemento={t as never} />);

    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('max-w-full');
    expect(html).toContain('overflow-x-auto');
    expect(html).toMatch(/aria-labelledby="tabla-desc-[^"]+"/);
  });

  it('si tiene descripción, muestra un caption visible con text-texto-suave text-sm', () => {
    const t = tabla(
      { descripcion: 'Precios de planes' },
      fila(encabezado(undefined, parrafoSimple(texto('Plan')))),
      fila(celda(undefined, parrafoSimple(texto('Básico')))),
    );
    const html = renderToStaticMarkup(<Tabla elemento={t as never} />);

    expect(html).toContain('<caption');
    expect(html).toContain('Precios de planes');
    expect(html).toContain('text-texto-suave');
    expect(html).toContain('text-sm');
  });

  it('si no tiene descripción, la región lleva un aria-label indicativo', () => {
    const t = tabla(
      undefined,
      fila(encabezado(undefined, parrafoSimple(texto('Plan')))),
      fila(celda(undefined, parrafoSimple(texto('Básico')))),
    );
    const html = renderToStaticMarkup(<Tabla elemento={t as never} indice={1} />);

    expect(html).toContain('aria-label="Tabla 2"');
  });

  it('los encabezados de columna llevan th scope="col" y un id para asociar headers', () => {
    const t = tabla(
      undefined,
      fila(
        encabezado(undefined, parrafoSimple(texto('Columna A'))),
        encabezado(undefined, parrafoSimple(texto('Columna B'))),
      ),
      fila(
        celda(undefined, parrafoSimple(texto('Dato 1'))),
        celda(undefined, parrafoSimple(texto('Dato 2'))),
      ),
    );
    const html = renderToStaticMarkup(<Tabla elemento={t as never} />);

    expect(html).toContain('<th scope="col"');
    expect(html).toMatch(/id="col-[^"]+-0"/);
    expect(html).toMatch(/id="col-[^"]+-1"/);
    expect(html).toMatch(/headers="col-[^"]+-0"/);
    expect(html).toMatch(/headers="col-[^"]+-1"/);
  });

  it('asocia headers múltiples en celdas de datos con celdas combinadas (técnica H43)', () => {
    const t = tabla(
      undefined,
      fila(
        encabezado({ colspan: 2 }, parrafoSimple(texto('Categoría General'))),
        encabezado(undefined, parrafoSimple(texto('Precio'))),
      ),
      fila(
        celda(undefined, parrafoSimple(texto('Item 1'))),
        celda(undefined, parrafoSimple(texto('Item 2'))),
        celda(undefined, parrafoSimple(texto('$10'))),
      ),
    );
    const html = renderToStaticMarkup(<Tabla elemento={t as never} />);

    expect(html).toMatch(/colspan="2"/i);
    // Las dos primeras celdas de la fila de datos se asocian al encabezado combinado
    expect(html).toMatch(/<td[^>]*headers="col-[^"]+-0"[^>]*><p[^>]*>Item 1<\/p><\/td>/);
    expect(html).toMatch(/<td[^>]*headers="col-[^"]+-0"[^>]*><p[^>]*>Item 2<\/p><\/td>/);
  });

  it('soporta celdas combinadas con rowspan en las filas del cuerpo', () => {
    const t = tabla(
      undefined,
      fila(
        encabezado(undefined, parrafoSimple(texto('A'))),
        encabezado(undefined, parrafoSimple(texto('B'))),
      ),
      fila(
        celda({ rowspan: 2 }, parrafoSimple(texto('Combinado Vertical'))),
        celda(undefined, parrafoSimple(texto('Fila 1'))),
      ),
      fila(
        celda(undefined, parrafoSimple(texto('Fila 2'))),
      ),
    );
    const html = renderToStaticMarkup(<Tabla elemento={t as never} />);

    expect(html).toMatch(/rowspan="2"/i);
    expect(html).toContain('Combinado Vertical');
  });

  it('no inyecta scripts (renderizado sin JavaScript)', () => {
    const t = tabla(
      undefined,
      fila(encabezado(undefined, parrafoSimple(texto('A')))),
      fila(celda(undefined, parrafoSimple(texto('B')))),
    );
    const html = renderToStaticMarkup(<Tabla elemento={t as never} />);
    expect(html).not.toContain('<script');
  });
});
