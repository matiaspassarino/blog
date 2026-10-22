// T004 (spec 004, RF-004, RF-007, RF-010, CE-001, CE-003; research D2, D3, D12): contrato de `Button`, con render
// estático (`renderToStaticMarkup`, entorno `node`, como packages/bloques/src/render). La interacción (clic bloqueado,
// Enter, foco) se prueba con Playwright en e2e/admin/jerarquia.spec.ts.
// Los `@ts-expect-error` de más abajo los verifica `pnpm typecheck`.
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { clasesDeEtiqueta, etiquetaDe, etiquetasDe } from '../../pruebas/html-estatico';
import { Button } from './button';

/** Props del contrato sin tipos estrictos: los tipos se prueban con los `@ts-expect-error` de más abajo. */
type PropsSueltas = Record<string, unknown>;
const render = (props: PropsSueltas, hijos: string = 'Guardar') =>
  renderToStaticMarkup(<Button {...(props as unknown as ComponentProps<typeof Button>)}>{hijos}</Button>);
const boton = (html: string) => etiquetaDe(html, 'button');

describe('data-nivel y data-tamanio (CE-001, CE-003)', () => {
  it.each(['primaria', 'secundaria', 'terciaria', 'peligro'])('CE-001: expone data-nivel="%s"', (variante) => {
    expect(boton(render({ variante }))?.atributos['data-nivel']).toBe(variante);
  });

  it('CE-003: el tamaño por defecto es "estandar"', () => {
    expect(boton(render({ variante: 'primaria' }))?.atributos['data-tamanio']).toBe('estandar');
  });

  it('CE-003: tamanio="compacto" se expone en data-tamanio', () => {
    expect(boton(render({ variante: 'secundaria', tamanio: 'compacto' }))?.atributos['data-tamanio']).toBe('compacto');
  });

  it('el botón usa las clases de clasesBoton con el tamaño pedido (compacto: px-3 y texto sm)', () => {
    const clases = clasesDeEtiqueta(boton(render({ variante: 'terciaria', tamanio: 'compacto' })));

    expect(clases).toEqual(expect.arrayContaining(['min-h-(--tactil-min)', 'min-w-(--tactil-min)', 'px-3', 'text-sm']));
  });

  it('el tamaño estándar usa px-5 y un alto mínimo de 44 px (todo el panel con la versión con borde)', () => {
    const clases = clasesDeEtiqueta(boton(render({ variante: 'primaria' })));

    expect(clases).toEqual(expect.arrayContaining(['px-5', 'min-h-(--tactil-min)', 'border']));
  });

  it('es type="button" por defecto, para no enviar un formulario sin querer', () => {
    expect(boton(render({ variante: 'secundaria' }))?.atributos.type).toBe('button');
  });

  it('con asChild, el elemento hijo recibe data-nivel y data-tamanio (un enlace cuenta como acción)', () => {
    const html = renderToStaticMarkup(
      <Button variante="primaria" asChild>
        <a href="https://ejemplo.test/nuevo">Nuevo artículo</a>
      </Button>,
    );
    const enlace = etiquetaDe(html, 'a');

    expect(enlace?.atributos['data-nivel']).toBe('primaria');
    expect(enlace?.atributos['data-tamanio']).toBe('estandar');
    expect(enlace?.atributos.href).toBe('https://ejemplo.test/nuevo');
  });
});

describe('Estado ocupado (RF-010, H2 esc. 6; research D12)', () => {
  const ocupado = () => render({ variante: 'primaria', ocupado: true, textoOcupado: 'Guardando…' });

  it('la etiqueta va en un span con opacity-0: conserva el ancho y el nombre accesible', () => {
    const html = ocupado();
    const etiqueta = etiquetasDe(html).find((e) => e.nombre === 'span' && clasesDeEtiqueta(e).includes('opacity-0'));

    expect(etiqueta, html).toBeDefined();
    expect(html).toMatch(/<span[^>]*class="[^"]*opacity-0[^"]*"[^>]*>Guardar<\/span>/);
  });

  it('muestra un indicador con aria-hidden encima de la etiqueta', () => {
    const html = ocupado();
    const indicador = etiquetasDe(html).find((e) => e.atributos['aria-hidden'] === 'true' && e.nombre !== 'svg');
    const conSvg = etiquetasDe(html).find((e) => e.nombre === 'svg' && e.atributos['aria-hidden'] === 'true');

    expect(indicador ?? conSvg, html).toBeDefined();
  });

  it('anuncia el texto de la acción en curso con <span role="status" class="sr-only">', () => {
    const html = ocupado();

    expect(html).toMatch(/<span[^>]*role="status"[^>]*>Guardando…<\/span>/);
    const estado = etiquetasDe(html).find((e) => e.atributos.role === 'status');
    expect(clasesDeEtiqueta(estado)).toContain('sr-only');
  });

  it('el botón queda aria-disabled="true"', () => {
    expect(boton(ocupado())?.atributos['aria-disabled']).toBe('true');
  });

  it('el indicador no gira con prefers-reduced-motion (clase motion-safe o motion-reduce)', () => {
    expect(ocupado()).toMatch(/motion-safe:animate-|motion-reduce:animate-none/);
  });

  it('sin ocupado no hay indicador ni role="status"', () => {
    const html = render({ variante: 'primaria' });

    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('opacity-0');
  });

  it('un botón deshabilitado por aria-disabled conserva su etiqueta visible (no la oculta)', () => {
    const html = render({ variante: 'primaria', 'aria-disabled': true });

    expect(html).toContain('>Guardar</button>');
    expect(boton(html)?.atributos['aria-disabled']).toBe('true');
  });
});

describe('Solo ícono (RF-007)', () => {
  it('lleva aria-label, es compacto y expone sus datos', () => {
    const html = render(
      { variante: 'terciaria', tamanio: 'compacto', soloIcono: true, 'aria-label': 'Más acciones' },
      '',
    );
    const elemento = boton(html);

    expect(elemento?.atributos['aria-label']).toBe('Más acciones');
    expect(elemento?.atributos['data-nivel']).toBe('terciaria');
    expect(elemento?.atributos['data-tamanio']).toBe('compacto');
    expect(clasesDeEtiqueta(elemento)).toContain('min-w-(--tactil-min)');
  });

  it('es un cuadrado: no usa el relleno horizontal del compacto con texto', () => {
    const conIcono = clasesDeEtiqueta(
      boton(render({ variante: 'terciaria', tamanio: 'compacto', soloIcono: true, 'aria-label': 'Cerrar' }, '')),
    );
    const conTexto = clasesDeEtiqueta(boton(render({ variante: 'terciaria', tamanio: 'compacto' })));

    expect(conIcono).not.toEqual(conTexto);
  });
});

describe('Tipos del contrato (RF-004; los verifica `pnpm typecheck`)', () => {
  it('RF-004: el nivel es obligatorio, soloIcono exige compacto y aria-label, y ocupado exige textoOcupado y no admite asChild', () => {
    // Nunca se ejecuta: solo compila. Cada `@ts-expect-error` falla si el contrato deja de impedir el uso.
    const usosInvalidos = () => ({
      // @ts-expect-error falta `variante` (obligatoria desde T030)
      sinNivel: <Button>Sin nivel</Button>,
      // @ts-expect-error soloIcono exige tamanio="compacto"
      iconoSinCompacto: <Button variante="terciaria" soloIcono aria-label="Cerrar" />,
      // @ts-expect-error soloIcono exige aria-label
      iconoSinNombre: <Button variante="terciaria" tamanio="compacto" soloIcono />,
      ocupadoSinTexto: (
        // @ts-expect-error ocupado exige textoOcupado
        <Button variante="primaria" ocupado>
          Guardar
        </Button>
      ),
      ocupadoConAsChild: (
        // @ts-expect-error ocupado no se combina con asChild
        <Button variante="primaria" ocupado textoOcupado="Guardando…" asChild>
          <span>Ir</span>
        </Button>
      ),
      // @ts-expect-error el nivel debe ser uno de los cuatro
      nivelInventado: <Button variante="grande">Guardar</Button>,
    });

    expect(usosInvalidos).toBeTypeOf('function');
  });
});
