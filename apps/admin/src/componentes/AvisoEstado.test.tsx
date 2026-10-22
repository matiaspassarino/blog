// T045 (spec 004, RF-010, RF-014; research D6): `AvisoEstado` con un formato único para éxito, error y advertencia, con
// render estático (`renderToStaticMarkup`, entorno `node`). El cierre del aviso (clic) se prueba con Playwright.
// FASE ROJA: hoy no existe `advertencia`, `children` solo admite texto y no hay zona de acciones; el botón de cerrar
// es un `<button>` suelto, sin `data-nivel`.
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { clasesDeEtiqueta, etiquetaDe, etiquetasDe } from '../pruebas/html-estatico';
import { AvisoEstado } from './AvisoEstado';

type Props = ComponentProps<typeof AvisoEstado>;
/** Props sin tipos estrictos: los tipos nuevos (`advertencia`, `children` con elementos) no existen todavía. */
const render = (props: Record<string, unknown>, hijos: unknown = 'Mensaje') =>
  renderToStaticMarkup(<AvisoEstado {...(props as unknown as Props)}>{hijos as never}</AvisoEstado>);
const contenedor = (html: string) => etiquetasDe(html)[0];

describe('Tipos de aviso con sus tokens (RF-014)', () => {
  it.each([
    ['exito', ['bg-exito-suave', 'border-exito-borde', 'text-exito']],
    ['error', ['bg-error-suave', 'border-error-borde', 'text-error']],
    ['advertencia', ['bg-advertencia-suave', 'border-advertencia-borde', 'text-advertencia']],
  ] as const)('RF-014: %s usa sus tokens de fondo suave, borde y texto', (tipo, clasesEsperadas) => {
    const clases = clasesDeEtiqueta(contenedor(render({ tipo })));

    expect(clases).toEqual(expect.arrayContaining([...clasesEsperadas]));
  });

  it('RF-014: los tres tipos comparten la misma estructura (borde, radio y relleno)', () => {
    const estructura = (tipo: string) =>
      clasesDeEtiqueta(contenedor(render({ tipo })))
        .filter((c) => /^(flex|items-|gap-|rounded|border$|p-\d)/.test(c))
        .sort();

    expect(estructura('error')).toEqual(estructura('exito'));
    expect(estructura('advertencia')).toEqual(estructura('exito'));
  });

  it('el error se anuncia como alert y el éxito como status', () => {
    expect(contenedor(render({ tipo: 'error' }))?.atributos.role).toBe('alert');
    expect(contenedor(render({ tipo: 'exito' }))?.atributos.role).toBe('status');
  });

  it('la advertencia también tiene un role de anuncio (status o alert)', () => {
    expect(contenedor(render({ tipo: 'advertencia' }))?.atributos.role).toMatch(/^(status|alert)$/);
  });
});

describe('Contenido y acciones (RF-014)', () => {
  it('children admite elementos, no solo texto', () => {
    const html = render(
      { tipo: 'error' },
      <>
        Revisa el <strong>bloque 1</strong>
      </>,
    );

    expect(html).toContain('<strong>bloque 1</strong>');
    expect(html).toContain('Revisa el');
  });

  it('el texto sigue mostrándose', () => {
    expect(render({ tipo: 'exito' }, 'Guardado')).toContain('Guardado');
  });

  it('acciones se muestra al final, después del mensaje', () => {
    const html = render(
      { tipo: 'error', acciones: <button>Ver la versión vigente</button> },
      'Alguien guardó cambios más nuevos',
    );

    expect(html).toContain('Ver la versión vigente');
    expect(html.indexOf('Ver la versión vigente')).toBeGreaterThan(html.indexOf('Alguien guardó cambios más nuevos'));
  });

  it('sin acciones no hay botones extra (solo el de cerrar)', () => {
    const botones = etiquetasDe(render({ tipo: 'exito' })).filter((e) => e.nombre === 'button');

    expect(botones).toHaveLength(1);
  });
});

describe('Botón de cerrar (RF-010, D6)', () => {
  const cerrar = (html: string) => etiquetaDe(html, 'button', (e) => e.atributos['aria-label'] === 'Cerrar aviso');

  it('es un Button terciaria, compacto, solo ícono, con aria-label="Cerrar aviso"', () => {
    const boton = cerrar(render({ tipo: 'exito' }));

    expect(boton).toBeDefined();
    expect(boton?.atributos['data-nivel']).toBe('terciaria');
    expect(boton?.atributos['data-tamanio']).toBe('compacto');
  });

  it('con cerrable={false} no se muestra', () => {
    expect(cerrar(render({ tipo: 'error', cerrable: false }))).toBeUndefined();
  });

  it('el ícono del botón es decorativo (aria-hidden)', () => {
    const html = render({ tipo: 'exito' });
    const boton = cerrar(html)!;
    const interior = html.slice(boton.inicio, html.indexOf('</button>', boton.inicio));

    expect(interior).toContain('aria-hidden="true"');
  });
});
