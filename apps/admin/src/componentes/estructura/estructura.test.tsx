// T005, T034 y T044 (spec 004, RF-008, RF-009, RF-011, RF-012, RF-014, RF-019; contracts/componentes.md): componentes
// de estructura del panel, con render estático (`renderToStaticMarkup`, entorno `node`; research D13). La interacción
// de "Más acciones" (Enter, Tab, Esc, clic afuera, foco) se prueba con Playwright.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ancestrosEn, clasesDeEtiqueta, etiquetaDe, etiquetasDe } from '../../pruebas/html-estatico';
import { BarraAcciones } from './BarraAcciones';
import { EncabezadoPagina } from './EncabezadoPagina';
import { EstadoVacio } from './EstadoVacio';
import { MasAcciones } from './MasAcciones';
import { TituloSeccion } from './TituloSeccion';

/** El primer elemento (el contenedor) de un fragmento de HTML. */
const raiz = (html: string) => etiquetasDe(html)[0];

describe('BarraAcciones (T005; RF-008, RF-009)', () => {
  it('RF-008: el contenedor es flex flex-wrap items-stretch gap-3', () => {
    const html = renderToStaticMarkup(
      <BarraAcciones>
        <button>Guardar</button>
      </BarraAcciones>,
    );

    expect(clasesDeEtiqueta(raiz(html))).toEqual(
      expect.arrayContaining(['flex', 'flex-wrap', 'items-stretch', 'gap-3']),
    );
  });

  it('RF-009: las destructivas van al final del DOM y con ms-auto desde 768 px', () => {
    const html = renderToStaticMarkup(
      <BarraAcciones destructivas={<button>Eliminar</button>}>
        <button>Guardar</button>
        <button>Publicar</button>
      </BarraAcciones>,
    );

    expect(html.indexOf('Eliminar')).toBeGreaterThan(html.indexOf('Publicar'));
    expect(html.indexOf('Publicar')).toBeGreaterThan(html.indexOf('Guardar'));
    const ancestros = ancestrosEn(html, html.indexOf('<button>Eliminar'));
    const conMargen = ancestros.filter((e) => clasesDeEtiqueta(e).includes('md:ms-auto'));
    expect(conMargen, 'las destructivas deben quedar dentro de un elemento con md:ms-auto').toHaveLength(1);
  });

  it('RF-009: las acciones comunes no llevan ms-auto', () => {
    const html = renderToStaticMarkup(
      <BarraAcciones destructivas={<button>Eliminar</button>}>
        <button>Guardar</button>
      </BarraAcciones>,
    );

    const ancestros = ancestrosEn(html, html.indexOf('<button>Guardar'));
    expect(ancestros.some((e) => clasesDeEtiqueta(e).includes('md:ms-auto'))).toBe(false);
  });

  it('con etiqueta es un role="group" con ese nombre', () => {
    const html = renderToStaticMarkup(
      <BarraAcciones etiqueta="Acciones del artículo">
        <button>Guardar</button>
      </BarraAcciones>,
    );

    expect(raiz(html)?.atributos.role).toBe('group');
    expect(raiz(html)?.atributos['aria-label']).toBe('Acciones del artículo');
  });

  it('sin etiqueta no es un grupo', () => {
    const html = renderToStaticMarkup(
      <BarraAcciones>
        <button>Guardar</button>
      </BarraAcciones>,
    );

    expect(raiz(html)?.atributos.role).toBeUndefined();
    expect(raiz(html)?.atributos['aria-label']).toBeUndefined();
  });

  it('alineacion="fin" alinea a la derecha (justify-end) y "Cancelar" va antes de la confirmación en el DOM', () => {
    const html = renderToStaticMarkup(
      <BarraAcciones alineacion="fin">
        <button>Cancelar</button>
        <button>Eliminar</button>
      </BarraAcciones>,
    );

    expect(clasesDeEtiqueta(raiz(html))).toContain('justify-end');
    expect(html.indexOf('Cancelar')).toBeLessThan(html.indexOf('Eliminar'));
    expect(html, 'sin flex-col-reverse: el orden visual y el del teclado coinciden').not.toContain('flex-col-reverse');
  });

  it('por defecto (alineacion "inicio") no alinea a la derecha', () => {
    const html = renderToStaticMarkup(
      <BarraAcciones>
        <button>Guardar</button>
      </BarraAcciones>,
    );

    expect(clasesDeEtiqueta(raiz(html))).not.toContain('justify-end');
  });
});

describe('MasAcciones (T034; RF-019, research D10)', () => {
  const menu = () =>
    renderToStaticMarkup(
      <MasAcciones destructivas={<button>Eliminar</button>}>
        <button>Programar</button>
        <button>Vista previa</button>
      </MasAcciones>,
    );

  it('el botón es terciaria, compacto y solo ícono, con aria-label "Más acciones"', () => {
    const boton = etiquetaDe(menu(), 'button', (e) => e.atributos['aria-label'] === 'Más acciones');

    expect(boton, menu()).toBeDefined();
    expect(boton?.atributos['data-nivel']).toBe('terciaria');
    expect(boton?.atributos['data-tamanio']).toBe('compacto');
  });

  it('el botón se ve solo en anchos angostos de la barra (@2xl:hidden)', () => {
    const boton = etiquetaDe(menu(), 'button', (e) => e.atributos['aria-label'] === 'Más acciones');

    expect(clasesDeEtiqueta(boton)).toContain('@2xl:hidden');
  });

  it('empieza cerrado: aria-expanded="false" y aria-controls apunta al panel', () => {
    const html = menu();
    const boton = etiquetaDe(html, 'button', (e) => e.atributos['aria-label'] === 'Más acciones');
    const idPanel = boton?.atributos['aria-controls'];

    expect(boton?.atributos['aria-expanded']).toBe('false');
    expect(idPanel).toBeTruthy();
    expect(
      etiquetasDe(html).some((e) => e.atributos.id === idPanel),
      'debe existir el panel controlado',
    ).toBe(true);
  });

  it('el panel, en anchos amplios, muestra las acciones en línea (@2xl:contents)', () => {
    const html = menu();
    const idPanel = etiquetaDe(html, 'button', (e) => e.atributos['aria-label'] === 'Más acciones')?.atributos[
      'aria-controls'
    ];
    const panel = etiquetasDe(html).find((e) => e.atributos.id === idPanel);

    expect(clasesDeEtiqueta(panel)).toContain('@2xl:contents');
  });

  it('las acciones comunes y las destructivas están dentro del panel, las destructivas al final', () => {
    const html = menu();
    const idPanel = etiquetaDe(html, 'button', (e) => e.atributos['aria-label'] === 'Más acciones')?.atributos[
      'aria-controls'
    ];
    const panel = etiquetasDe(html).find((e) => e.atributos.id === idPanel)!;

    for (const accion of ['Programar', 'Vista previa', 'Eliminar']) {
      const dentro = ancestrosEn(html, html.indexOf(`<button>${accion}`)).some((e) => e.inicio === panel.inicio);
      expect(dentro, `${accion} debe estar dentro del panel`).toBe(true);
    }
    expect(html.indexOf('Eliminar')).toBeGreaterThan(html.indexOf('Vista previa'));
  });

  it('las destructivas van después de un separador', () => {
    const html = menu();
    const separador = etiquetasDe(html).find((e) => e.nombre === 'hr' || e.atributos.role === 'separator');

    expect(separador, html).toBeDefined();
    expect(separador!.inicio).toBeGreaterThan(html.indexOf('Vista previa'));
    expect(separador!.inicio).toBeLessThan(html.indexOf('<button>Eliminar'));
  });

  it('sin destructivas no hay separador', () => {
    const html = renderToStaticMarkup(
      <MasAcciones>
        <button>Vista previa</button>
      </MasAcciones>,
    );

    expect(etiquetasDe(html).some((e) => e.nombre === 'hr' || e.atributos.role === 'separator')).toBe(false);
  });

  it('sin hijos no renderiza nada (por ejemplo, en un artículo nuevo)', () => {
    expect(renderToStaticMarkup(<MasAcciones>{null}</MasAcciones>)).toBe('');
    expect(renderToStaticMarkup(<MasAcciones>{false}</MasAcciones>)).toBe('');
  });
});

describe('EncabezadoPagina (T044; RF-011, RF-012)', () => {
  it('RF-011: tiene un único h1 con text-titulo-2 y el título', () => {
    const html = renderToStaticMarkup(<EncabezadoPagina titulo="Equipo" />);
    const h1 = etiquetasDe(html).filter((e) => e.nombre === 'h1');

    expect(h1).toHaveLength(1);
    expect(clasesDeEtiqueta(h1[0])).toContain('text-titulo-2');
    expect(html).toMatch(/<h1[^>]*>Equipo<\/h1>/);
  });

  it('RF-012: la descripción usa el texto de apoyo (text-sm text-texto-suave)', () => {
    const html = renderToStaticMarkup(<EncabezadoPagina titulo="Equipo" descripcion="Quién puede entrar al panel" />);
    const descripcion = etiquetasDe(html).find(
      (e) => html.slice(e.inicio).includes('Quién puede entrar') && e.nombre === 'p',
    );

    expect(descripcion, html).toBeDefined();
    expect(clasesDeEtiqueta(descripcion)).toEqual(expect.arrayContaining(['text-sm', 'text-texto-suave']));
  });

  it('sin descripción no hay párrafo', () => {
    const html = renderToStaticMarkup(<EncabezadoPagina titulo="Equipo" />);

    expect(etiquetasDe(html).some((e) => e.nombre === 'p')).toBe(false);
  });

  it('RF-011: las acciones van en un contenedor que pasa al lado del título desde 768 px', () => {
    const html = renderToStaticMarkup(
      <EncabezadoPagina titulo="Artículos" acciones={<a href="https://ejemplo.test/nuevo">Nuevo artículo</a>} />,
    );
    const ancestros = ancestrosEn(html, html.indexOf('<a href="https://ejemplo.test/nuevo"'));

    expect(html.indexOf('Nuevo artículo')).toBeGreaterThan(html.indexOf('</h1>'));
    expect(
      ancestros.some((e) => clasesDeEtiqueta(e).some((c) => c.startsWith('md:'))),
      `ningún ancestro de las acciones tiene clases md: (${ancestros.map((e) => e.apertura).join(' ')})`,
    ).toBe(true);
  });

  it('sin acciones solo hay título', () => {
    const html = renderToStaticMarkup(<EncabezadoPagina titulo="Perfil" />);

    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<button');
  });

  it('tituloEnfocable agrega tabIndex={-1} al h1 (el foco del editor tras reemplazar)', () => {
    const enfocable = renderToStaticMarkup(<EncabezadoPagina titulo="Editar" tituloEnfocable />);
    const comun = renderToStaticMarkup(<EncabezadoPagina titulo="Editar" />);

    expect(etiquetaDe(enfocable, 'h1')?.atributos.tabindex).toBe('-1');
    expect(etiquetaDe(comun, 'h1')?.atributos.tabindex).toBeUndefined();
  });
});

describe('TituloSeccion (T044; RF-012)', () => {
  it('por defecto es un h2 con font-titulos text-titulo-3 font-semibold', () => {
    const html = renderToStaticMarkup(<TituloSeccion>Contenido</TituloSeccion>);
    const titulo = raiz(html);

    expect(titulo?.nombre).toBe('h2');
    expect(clasesDeEtiqueta(titulo)).toEqual(
      expect.arrayContaining(['font-titulos', 'text-titulo-3', 'font-semibold']),
    );
    expect(html).toContain('>Contenido<');
  });

  it('como="legend" renderiza un legend con la misma escala', () => {
    const titulo = raiz(renderToStaticMarkup(<TituloSeccion como="legend">Etiquetas</TituloSeccion>));

    expect(titulo?.nombre).toBe('legend');
    expect(clasesDeEtiqueta(titulo)).toEqual(
      expect.arrayContaining(['font-titulos', 'text-titulo-3', 'font-semibold']),
    );
  });

  it('pasa el id (para aria-labelledby de la sección)', () => {
    expect(
      raiz(renderToStaticMarkup(<TituloSeccion id="titulo-contenido">Contenido</TituloSeccion>))?.atributos.id,
    ).toBe('titulo-contenido');
  });
});

describe('EstadoVacio (T044; RF-014)', () => {
  it('marca el vacío con data-estado="vacio" y muestra el mensaje', () => {
    const html = renderToStaticMarkup(<EstadoVacio mensaje="No hay artículos" />);

    expect(raiz(html)?.atributos['data-estado']).toBe('vacio');
    expect(html).toContain('No hay artículos');
  });

  it('la acción es un enlace con aspecto secundaria (data-nivel="secundaria")', () => {
    const html = renderToStaticMarkup(
      <EstadoVacio mensaje="No hay artículos" accion={{ texto: 'Quitar filtros', href: '/articulos' }} />,
    );
    const enlace = etiquetaDe(html, 'a');

    expect(enlace?.atributos.href).toBe('/articulos');
    expect(enlace?.atributos['data-nivel']).toBe('secundaria');
    expect(html).toMatch(/<a[^>]*>Quitar filtros<\/a>/);
  });

  it('sin acción no hay enlace', () => {
    expect(renderToStaticMarkup(<EstadoVacio mensaje="Aún no hay etiquetas" />)).not.toContain('<a ');
  });
});
