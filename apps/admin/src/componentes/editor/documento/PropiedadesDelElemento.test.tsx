// T048 (spec 005, H2 esc. 2, 3, 6 y 7; contracts/componentes.md "PanelPropiedades y HojaPropiedades" y
// contracts/atajos.md "Roles y nombres"): el panel de propiedades con render estático (`renderToStaticMarkup`, entorno
// `node`; sin jsdom). La interacción (foco, pestañas, `Esc`, hoja que no roba el foco) se prueba en E2E.
// FASE ROJA: `./PropiedadesDelElemento` no existe. API supuesta (export con nombre; un solo componente para las dos
// variantes, T052):
//   PropiedadesDelElemento(props: {
//     variante: 'lateral' | 'hoja';
//     seleccion: SeleccionDelDocumento;       // `{ tipo: 'elementos', desde, hasta, bloques }` o `{ tipo: 'texto' }`
//     posicion: number;                       // posición del elemento seleccionado en el documento (desde 1)
//     indice: number;                         // índice del bloque en la lista convertida (ids de campo `bloque-<indice>-<campo>`)
//     errores: ErrorBloque[];                 // los errores de ese bloque (ya filtrados; `indice` el de la lista)
//     alCambiar: (cambios: CambiosDeBloque) => void;   // forma funcional de `bloques/tipos`
//     alCerrar?: () => void;                  // solo la variante `hoja`
//   })
//   - Un `aside` con `aria-label="Propiedades del elemento <posicion>, <tipo>"` (tipo = `nombreDeTipo`: imagen, galería,
//     llamada a la acción, video, código, cita, lista, título, párrafo, separador) en ambas variantes. Con un solo
//     elemento especial o de texto, muestra el `EditorDeBloque` de su tipo; los de texto con `soloPropiedades` (sin el
//     campo de texto, que se edita en el lienzo).
//   - Párrafo y separador: "Este elemento no tiene propiedades. Escribe en el documento."
//   - Con más de un bloque en la selección: "N elementos seleccionados" y ningún campo.
//   - Selección `{ tipo: 'texto' }` (o sin bloques): "Selecciona un elemento para editar sus propiedades".
//   - Variante `hoja`: botón «Cerrar»; la `lateral` no lo tiene.
// Los nombres de los campos se leen de los `<label>` (y los botones) del HTML, tal como los renderizan los editores
// de campos de `bloques/` (etiquetas de hoy: ver EditorImagen, EditorGaleria, EditorCta, EditorVideo…).
import { crearBloque, type Bloque, type TipoBloque } from '@blog/bloques';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { etiquetaDe, etiquetasDe } from '../../../pruebas/html-estatico';
import { PropiedadesDelElemento } from './PropiedadesDelElemento';

type Props = Parameters<typeof PropiedadesDelElemento>[0];

const seleccionDe = (...bloques: Bloque[]): Props['seleccion'] => ({ tipo: 'elementos', desde: 0, hasta: 1, bloques });

const dibujar = (cambios: Partial<Props> & { bloque?: Bloque } = {}) => {
  const { bloque, ...resto } = cambios;
  return renderToStaticMarkup(
    <PropiedadesDelElemento
      variante="lateral"
      seleccion={seleccionDe(bloque ?? crearBloque('imagen'))}
      posicion={3}
      indice={2}
      errores={[]}
      alCambiar={() => undefined}
      {...resto}
    />,
  );
};

const sinEtiquetas = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

/** Textos de los `<label>` del HTML (sin etiquetas internas). */
const etiquetasDeCampos = (html: string) =>
  [...html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map((m) => sinEtiquetas(m[1] ?? '').trim());

/** Textos de los `<button>` del HTML. */
const textosDeBotones = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => sinEtiquetas(m[1] ?? '').trim());

const camposDeFormulario = (html: string) =>
  etiquetasDe(html).filter((e) => ['input', 'select', 'textarea'].includes(e.nombre));

const conImagen = { ruta: 'articulos/foto.png', ancho: 4, alto: 3, alt: 'Una foto', decorativa: false };
const SIN_PROPIEDADES = 'Este elemento no tiene propiedades. Escribe en el documento.';
const MENSAJE_ALT = 'Escribe el texto alternativo o marca la imagen como decorativa';

describe('PropiedadesDelElemento: cada tipo muestra solo sus propiedades (H2-E2, H2-E3)', () => {
  it('H2-E2: imagen vacía: el selector «Elegir imagen» y la leyenda; sin texto alternativo todavía', () => {
    const html = dibujar({ bloque: crearBloque('imagen') });
    expect(textosDeBotones(html).join(' ')).toContain('Elegir imagen');
    expect(etiquetasDeCampos(html)).toContain('Leyenda');
    expect(etiquetasDeCampos(html)).not.toContain('Texto alternativo');
  });

  it('H2-E2: imagen subida: texto alternativo, casilla de decorativa, leyenda y «Quitar imagen»', () => {
    const bloque = { ...crearBloque('imagen'), imagen: conImagen } as Bloque;
    const html = dibujar({ bloque });
    const etiquetas = etiquetasDeCampos(html);
    expect(etiquetas).toContain('Texto alternativo');
    expect(etiquetas.some((e) => e.includes('Imagen decorativa'))).toBe(true);
    expect(etiquetas).toContain('Leyenda');
    expect(textosDeBotones(html).join(' ')).toContain('Quitar imagen');
  });

  it('H2-E3: galería: columnas, «Agregar imagen» y el texto alternativo de cada imagen', () => {
    const bloque = { ...crearBloque('galeria'), imagenes: [conImagen, { ...conImagen, alt: 'Otra' }] } as Bloque;
    const html = dibujar({ bloque });
    const etiquetas = etiquetasDeCampos(html);
    expect(etiquetas).toContain('Columnas');
    expect(etiquetas.filter((e) => e === 'Texto alternativo')).toHaveLength(2);
    expect(textosDeBotones(html).join(' ')).toContain('Agregar imagen');
  });

  it('H2-E3: llamada a la acción: título, texto, texto del botón y URL', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearBloque('cta') }));
    for (const campo of ['Título', 'Texto', 'Texto del botón', 'URL']) expect(etiquetas).toContain(campo);
  });

  it('H2-E3: video: proveedor, ID del video y título del video', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearBloque('video') }));
    for (const campo of ['Proveedor', 'ID del video', 'Título del video']) expect(etiquetas).toContain(campo);
  });

  it('H2-E3: código: solo el lenguaje (el código se escribe en el lienzo)', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearBloque('codigo') }));
    expect(etiquetas).toContain('Lenguaje');
    expect(etiquetas).not.toContain('Código');
  });

  it('H2-E3: cita: autor y fuente, sin el campo de texto', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearBloque('cita') }));
    expect(etiquetas).toContain('Autor');
    expect(etiquetas.some((e) => e.startsWith('Fuente'))).toBe(true);
    expect(etiquetas).not.toContain('Texto');
  });

  it('H2-E3: lista: solo si es ordenada, sin los campos de ítem', () => {
    const bloque = { ...crearBloque('lista'), items: ['uno', 'dos'] } as Bloque;
    const etiquetas = etiquetasDeCampos(dibujar({ bloque }));
    expect(etiquetas.some((e) => e.includes('Lista ordenada'))).toBe(true);
    expect(etiquetas.filter((e) => e.startsWith('Ítem'))).toEqual([]);
  });

  it('H2-E3: título: solo el nivel, sin el campo de texto', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearBloque('titulo') }));
    expect(etiquetas).toContain('Nivel');
    expect(etiquetas).not.toContain('Texto');
  });

  it.each([
    ['imagen', ['Nivel', 'Autor', 'Lenguaje', 'Columnas', 'URL', 'Proveedor']],
    ['video', ['Nivel', 'Autor', 'Lenguaje', 'Leyenda', 'Columnas', 'URL']],
    ['cta', ['Nivel', 'Autor', 'Lenguaje', 'Leyenda', 'Proveedor']],
  ] as [TipoBloque, string[]][])('H2-E3: %s no muestra campos de otros tipos', (tipo, ajenos) => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearBloque(tipo) }));
    for (const campo of ajenos) expect(etiquetas, campo).not.toContain(campo);
  });

  it('H2-E5: los errores del bloque se muestran con texto y el campo queda inválido y descrito', () => {
    const html = dibujar({
      bloque: { ...crearBloque('imagen'), imagen: { ...conImagen, alt: '' } } as Bloque,
      errores: [{ indice: 2, campo: 'imagen.alt', mensaje: MENSAJE_ALT }],
    });
    expect(sinEtiquetas(html)).toContain(MENSAJE_ALT);
    const campo = etiquetasDe(html).find((e) => e.nombre === 'input' && e.atributos['aria-invalid'] === 'true');
    expect(campo?.atributos['aria-describedby']).toBeTruthy();
  });

  it('H2-E5: los campos llevan el id de hoy, bloque-<indice>-<campo> (el enfoque del primer error los busca)', () => {
    const html = dibujar({ bloque: crearBloque('cta'), indice: 5 });
    expect(etiquetaDe(html, 'input', (e) => e.atributos.id === 'bloque-5-etiquetaBoton')).toBeDefined();
  });
});

describe('PropiedadesDelElemento: sin propiedades, varios y sin selección', () => {
  it.each(['parrafo', 'separador'] as TipoBloque[])(
    'H2-E4: %s muestra el aviso de sin propiedades y ningún campo',
    (tipo) => {
      const html = dibujar({ bloque: crearBloque(tipo) });
      expect(sinEtiquetas(html)).toContain(SIN_PROPIEDADES);
      expect(camposDeFormulario(html)).toHaveLength(0);
    },
  );

  it('H2-E4: un elemento con propiedades no muestra el aviso de sin propiedades', () => {
    expect(sinEtiquetas(dibujar({ bloque: crearBloque('cta') }))).not.toContain(SIN_PROPIEDADES);
  });

  it('H2-E4: con varios elementos muestra "3 elementos seleccionados" y ningún campo', () => {
    const html = dibujar({ seleccion: seleccionDe(crearBloque('imagen'), crearBloque('cta'), crearBloque('video')) });
    expect(sinEtiquetas(html)).toContain('3 elementos seleccionados');
    expect(camposDeFormulario(html)).toHaveLength(0);
  });

  it('H2-E4: sin elementos seleccionados invita a seleccionar uno', () => {
    const html = dibujar({ seleccion: { tipo: 'texto' } });
    expect(sinEtiquetas(html)).toContain('Selecciona un elemento para editar sus propiedades');
  });
});

describe('PropiedadesDelElemento: nombre y variantes (H2-E6, H2-E7)', () => {
  it('H2-E7: es un aside con el nombre "Propiedades del elemento 3, imagen"', () => {
    const aside = etiquetaDe(dibujar({ variante: 'hoja' }), 'aside');
    expect(aside?.atributos['aria-label']).toBe('Propiedades del elemento 3, imagen');
  });

  it.each([
    ['cta', 'llamada a la acción'],
    ['galeria', 'galería'],
    ['codigo', 'código'],
  ] as [TipoBloque, string][])(
    'H2-E7: el nombre usa el tipo en español (%s: %s) y la posición recibida',
    (tipo, nombre) => {
      const aside = etiquetaDe(dibujar({ bloque: crearBloque(tipo), posicion: 8 }), 'aside');
      expect(aside?.atributos['aria-label']).toBe(`Propiedades del elemento 8, ${nombre}`);
    },
  );

  it('H2-E6: la variante hoja tiene el botón «Cerrar»', () => {
    expect(textosDeBotones(dibujar({ variante: 'hoja', alCerrar: () => undefined }))).toContain('Cerrar');
  });

  it('H2-E6: la variante lateral no tiene el botón «Cerrar»', () => {
    expect(textosDeBotones(dibujar({ variante: 'lateral' }))).not.toContain('Cerrar');
  });

  it('H2-E6: la hoja no es modal (sin role="dialog" ni aria-modal)', () => {
    const html = dibujar({ variante: 'hoja' });
    const modal = etiquetasDe(html).some((e) => e.atributos.role === 'dialog' || e.atributos['aria-modal'] === 'true');
    expect(modal).toBe(false);
  });
});
