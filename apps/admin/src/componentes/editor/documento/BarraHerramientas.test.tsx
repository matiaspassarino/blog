// T038 (spec 005, RF-003, RF-005, RF-019; contracts/componentes.md "BarraHerramientas" y contracts/atajos.md "Roles y
// nombres"): la barra de herramientas con render estático (`renderToStaticMarkup`, entorno `node`; sin jsdom). La
// interacción (flechas, enlace, foco, «Más») se prueba en E2E (editor-documento.spec.ts).
// FASE ROJA: `./BarraHerramientas` no existe. API supuesta:
//   export function BarraHerramientas(props: { editor: Editor | null; deshabilitada: boolean; seleccion: SeleccionDelDocumento })
//   (export con nombre). Con `editor = null` (así se renderiza en el servidor y mientras carga la librería) la barra se
//   dibuja completa, con todos los controles de formato en `aria-disabled="true"` y el selector de estilo en «Párrafo».
//   - `role="toolbar"` con `aria-label="Formato del texto"`.
//   - Un solo control tabulable (`tabindex="0"`); los demás `tabindex="-1"` (incluido el botón «Más acciones»).
//   - Botones (nombre = `aria-label` o su texto): «Negrita», «Cursiva», «Código» y «Lista con viñetas» y «Lista numerada»
//     con `aria-pressed`; «Enlace», «Insertar», «Deshacer», «Rehacer», «Acciones» (`aria-haspopup="menu"`,
//     `aria-expanded="false"`) y el selector de estilo (nombre que empieza con «Estilo de párrafo», texto visible
//     «Párrafo»).
//   - «Insertar» siempre visible: nunca dentro del panel de `MasAcciones`.
//   - Todos los botones son de la primitiva `Button`: `data-nivel="terciaria"` y `data-tamanio="compacto"`.
//   - Con `seleccion = { tipo: 'elementos', ... }` muestra el texto fijo «N elementos seleccionados» y el botón «Salir de
//     la selección»; con `{ tipo: 'texto' }` no.
import type { Elemento } from '@blog/bloques';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ancestrosEn, clasesDeEtiqueta, etiquetasDe } from '../../../pruebas/html-estatico';
import { BarraHerramientas } from './BarraHerramientas';

type Props = Parameters<typeof BarraHerramientas>[0];

const parrafos = (cantidad: number): Elemento[] =>
  Array.from({ length: cantidad }, (_, i) => ({
    type: 'paragraph',
    attrs: { id: `00000000-0000-4000-8000-00000000000${i}` },
    content: [{ type: 'text', text: `P${i}` }],
  }));

const dibujar = (cambios: Partial<Props> = {}) =>
  renderToStaticMarkup(
    <BarraHerramientas editor={null} deshabilitada={false} seleccion={{ tipo: 'texto' }} {...cambios} />,
  );

type Boton = { nombre: string; atributos: Record<string, string>; inicio: number };

/** Los `<button>` del HTML con su nombre accesible (`aria-label` o texto, sin etiquetas) y sus atributos. */
function botonesDe(html: string): Boton[] {
  const aperturas = etiquetasDe(html).filter((e) => e.nombre === 'button');
  return aperturas.map((boton) => {
    const resto = html.slice(boton.inicio + boton.apertura.length);
    const texto = resto
      .slice(0, resto.indexOf('</button>'))
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { nombre: boton.atributos['aria-label'] ?? texto, atributos: boton.atributos, inicio: boton.inicio };
  });
}

const botonLlamado = (html: string, nombre: string | RegExp) =>
  botonesDe(html).find((b) => (typeof nombre === 'string' ? b.nombre === nombre : nombre.test(b.nombre)));

describe('BarraHerramientas: rol y nombre (RF-003)', () => {
  it('es un role="toolbar" con el nombre "Formato del texto"', () => {
    const barra = etiquetasDe(dibujar()).find((e) => e.atributos.role === 'toolbar');

    expect(barra, dibujar()).toBeDefined();
    expect(barra?.atributos['aria-label']).toBe('Formato del texto');
  });

  it('tiene los controles de formato, lista, enlace, inserción, acciones y deshacer o rehacer', () => {
    const html = dibujar();

    for (const nombre of [
      'Negrita',
      'Cursiva',
      'Código',
      'Enlace',
      'Lista con viñetas',
      'Lista numerada',
      'Insertar',
      'Acciones',
      'Deshacer',
      'Rehacer',
    ]) {
      expect(botonLlamado(html, nombre), nombre).toBeDefined();
    }
  });

  it('el selector de estilo de párrafo muestra el estilo vigente como texto', () => {
    const selector = botonLlamado(dibujar(), /^Estilo de párrafo/);

    expect(selector, dibujar()).toBeDefined();
    expect(selector?.nombre).toMatch(/Párrafo/);
    expect(selector?.atributos['aria-haspopup']).toBeTruthy();
  });

  it('"Acciones" abre un menú: aria-haspopup="menu" y aria-expanded="false" al empezar', () => {
    const acciones = botonLlamado(dibujar(), 'Acciones');

    expect(acciones?.atributos['aria-haspopup']).toBe('menu');
    expect(acciones?.atributos['aria-expanded']).toBe('false');
  });
});

describe('BarraHerramientas: un solo tope de tabulación (atajos.md "Barra")', () => {
  /** Controles que entran en el orden de tabulación: sin `tabindex="-1"`, sin `disabled` y fuera de un `inert`. */
  function tabulables(html: string) {
    const controles = etiquetasDe(html).filter(
      (e) =>
        ['button', 'input', 'select', 'textarea'].includes(e.nombre) ||
        (e.nombre === 'a' && 'href' in e.atributos) ||
        'tabindex' in e.atributos,
    );
    return controles.filter(
      (e) =>
        e.atributos.tabindex !== '-1' &&
        !('disabled' in e.atributos) &&
        !ancestrosEn(html, e.inicio).some((ancestro) => 'inert' in ancestro.atributos),
    );
  }

  it('exactamente un control tiene tabindex="0" y ninguno más es tabulable', () => {
    const html = dibujar();
    const tabulable = tabulables(html);

    expect(tabulable.map((e) => e.atributos.tabindex)).toEqual(['0']);
    expect(etiquetasDe(html).filter((e) => e.atributos.tabindex === '0')).toHaveLength(1);
  });

  it('con la barra deshabilitada sigue habiendo un solo tope de tabulación', () => {
    expect(tabulables(dibujar({ deshabilitada: true }))).toHaveLength(1);
  });
});

describe('BarraHerramientas: controles de estado (WCAG 1.4.1, RF-003 esc. 3)', () => {
  it.each(['Negrita', 'Cursiva', 'Código', 'Lista con viñetas', 'Lista numerada'])(
    '«%s» expone su estado con aria-pressed (no solo con color)',
    (nombre) => {
      const boton = botonLlamado(dibujar(), nombre);

      expect(boton?.atributos['aria-pressed'], nombre).toBe('false');
    },
  );

  it.each(['Insertar', 'Deshacer', 'Rehacer'])('«%s» es una acción: no lleva aria-pressed', (nombre) => {
    expect(botonLlamado(dibujar(), nombre)?.atributos['aria-pressed'], nombre).toBeUndefined();
  });

  it('sin cursor en el lienzo (editor = null) los controles de formato están en aria-disabled="true"', () => {
    for (const nombre of ['Negrita', 'Cursiva', 'Código', 'Enlace', 'Lista con viñetas', 'Lista numerada']) {
      expect(botonLlamado(dibujar(), nombre)?.atributos['aria-disabled'], nombre).toBe('true');
    }
  });

  it('con la barra deshabilitada todos los controles de formato están en aria-disabled="true"', () => {
    for (const nombre of ['Negrita', 'Cursiva', 'Código', 'Enlace', 'Insertar']) {
      expect(botonLlamado(dibujar({ deshabilitada: true }), nombre)?.atributos['aria-disabled'], nombre).toBe('true');
    }
  });
});

describe('BarraHerramientas: «Insertar» siempre visible (RF-005)', () => {
  it('«Insertar» no está dentro del panel de «Más acciones»', () => {
    const html = dibujar();
    const mas = botonLlamado(html, 'Más acciones');
    const insertar = botonLlamado(html, 'Insertar');
    const idPanel = mas?.atributos['aria-controls'];

    expect(insertar, html).toBeDefined();
    if (idPanel) {
      const ancestros = ancestrosEn(html, insertar!.inicio);
      expect(ancestros.some((a) => a.atributos.id === idPanel)).toBe(false);
    }
  });

  it('«Insertar» no está oculto: ni hidden, ni inert, ni aria-hidden, ni una clase que lo oculte', () => {
    const html = dibujar();
    const posicion = botonLlamado(html, 'Insertar')?.inicio;
    const insertar = etiquetasDe(html).find((e) => e.inicio === posicion);

    expect(insertar).toBeDefined();
    expect(insertar?.atributos).not.toHaveProperty('hidden');
    expect(insertar?.atributos).not.toHaveProperty('inert');
    expect(insertar?.atributos['aria-hidden']).toBeUndefined();
    expect(clasesDeEtiqueta(insertar).filter((c) => /(^|:)hidden$/.test(c))).toEqual([]);
  });
});

describe('BarraHerramientas: botones de la primitiva (RF-003, spec 004)', () => {
  it('todos son terciaria y compacto', () => {
    const botones = botonesDe(dibujar());

    expect(botones.length).toBeGreaterThanOrEqual(10);
    for (const boton of botones) {
      expect(boton.atributos['data-nivel'], boton.nombre).toBe('terciaria');
      expect(boton.atributos['data-tamanio'], boton.nombre).toBe('compacto');
    }
  });

  it('es sticky top-0', () => {
    const barra = etiquetasDe(dibujar()).find((e) => e.atributos.role === 'toolbar');
    const clases = clasesDeEtiqueta(barra);

    expect(clases).toContain('sticky');
    expect(clases).toContain('top-0');
  });
});

describe('BarraHerramientas: modo elementos (atajos.md "Dos modos de selección")', () => {
  it('muestra "3 elementos seleccionados" y «Salir de la selección»', () => {
    const html = dibujar({ seleccion: { tipo: 'elementos', desde: 0, hasta: 3, elementos: parrafos(3) } });

    expect(html).toContain('3 elementos seleccionados');
    expect(botonLlamado(html, 'Salir de la selección'), html).toBeDefined();
  });

  it('con un texto seleccionado no muestra el conteo ni el botón de salida', () => {
    const html = dibujar();

    expect(html).not.toContain('elementos seleccionados');
    expect(botonLlamado(html, 'Salir de la selección')).toBeUndefined();
  });
});
