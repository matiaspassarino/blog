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
//     errores: ErrorElemento[];                 // los errores de ese bloque (ya filtrados; `indice` el de la lista)
//     alCambiar: (cambios: CambiosDeBloque) => void;   // forma funcional de `bloques/tipos`
//     alCerrar?: () => void;                  // solo la variante `hoja`
//   })
//   - Un `aside` con `aria-label="Propiedades del elemento <posicion>, <tipo>"` (tipo = `nombreDeTipo`: imagen, galería,
//     llamada a la acción, video, código, cita, lista, título, párrafo, separador) en ambas variantes. Con un solo
//     elemento especial o de texto, muestra el `EditorDeBloque` de su tipo; los de texto con `soloPropiedades` (sin el
//     campo de texto, que se edita en el lienzo).
//   - Separador (y, hasta la Fase 12, el párrafo): "Este elemento no tiene propiedades. Escribe en el documento."
//   - Con más de un bloque en la selección: "N elementos seleccionados" y ningún campo.
//   - Selección `{ tipo: 'texto' }` (o sin bloques): "Selecciona un elemento para editar sus propiedades".
//   - Variante `hoja`: botón «Cerrar»; la `lateral` no lo tiene.
// Los nombres de los campos se leen de los `<label>` (y los botones) del HTML, tal como los renderizan los editores
// de campos de `bloques/` (etiquetas de hoy: ver EditorImagen, EditorGaleria, EditorCta, EditorVideo…).
//
// T098 (spec 005, ampliación; research D22 y D31 C6): la selección trae los ELEMENTOS del documento
// (`{ tipo: 'elementos', desde, hasta, elementos: Elemento[] }`), los errores son `ErrorElemento[]` y `alCambiar`
// recibe `CambiosDeElemento`. Los editores de campos de hoy no cambian: reciben la forma de siempre gracias al
// adaptador `datosDeElemento`/`elementoDesdeDatos` de '@blog/bloques'. Los elementos se crean con
// `crearElemento(tipo)` (T101) y los tipos son los del documento (`heading`, `blockquote`, `codeBlock`…).
import { crearElemento, type Elemento, type TipoElemento } from '@blog/bloques';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ancestrosEn, etiquetaDe, etiquetasDe } from '../../../pruebas/html-estatico';
import { PropiedadesDelElemento } from './PropiedadesDelElemento';

type Props = Parameters<typeof PropiedadesDelElemento>[0];

const seleccionDe = (...elementos: Elemento[]): Props['seleccion'] => ({
  tipo: 'elementos',
  desde: 0,
  hasta: 1,
  elementos,
});

/** Un elemento nuevo con estos attrs mezclados (o con estos ítems, para una lista). */
const conAttrs = (tipo: TipoElemento, attrs: Record<string, unknown>) => {
  const elemento = crearElemento(tipo);
  return { ...elemento, attrs: { ...elemento.attrs, ...attrs } } as Elemento;
};

const dibujar = (cambios: Partial<Props> & { bloque?: Elemento } = {}) => {
  const { bloque, ...resto } = cambios;
  return renderToStaticMarkup(
    <PropiedadesDelElemento
      variante="lateral"
      seleccion={seleccionDe(bloque ?? crearElemento('imagen'))}
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
    const html = dibujar({ bloque: crearElemento('imagen') });
    expect(textosDeBotones(html).join(' ')).toContain('Elegir imagen');
    expect(etiquetasDeCampos(html)).toContain('Leyenda');
    expect(etiquetasDeCampos(html)).not.toContain('Texto alternativo');
  });

  it('H2-E2: imagen subida: texto alternativo, casilla de decorativa, leyenda y «Quitar imagen»', () => {
    const bloque = conAttrs('imagen', { imagen: conImagen });
    const html = dibujar({ bloque });
    const etiquetas = etiquetasDeCampos(html);
    expect(etiquetas).toContain('Texto alternativo');
    expect(etiquetas.some((e) => e.includes('Imagen decorativa'))).toBe(true);
    expect(etiquetas).toContain('Leyenda');
    expect(textosDeBotones(html).join(' ')).toContain('Quitar imagen');
  });

  it('H2-E3: galería: columnas, «Agregar imagen» y el texto alternativo de cada imagen', () => {
    const bloque = conAttrs('galeria', { imagenes: [conImagen, { ...conImagen, alt: 'Otra' }] });
    const html = dibujar({ bloque });
    const etiquetas = etiquetasDeCampos(html);
    expect(etiquetas).toContain('Columnas');
    expect(etiquetas.filter((e) => e === 'Texto alternativo')).toHaveLength(2);
    expect(textosDeBotones(html).join(' ')).toContain('Agregar imagen');
  });

  it('H2-E3: llamada a la acción: título, texto, texto del botón y URL', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearElemento('cta') }));
    for (const campo of ['Título', 'Texto', 'Texto del botón', 'URL']) expect(etiquetas).toContain(campo);
  });

  it('H2-E3: video: proveedor, ID del video y título del video', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearElemento('video') }));
    for (const campo of ['Proveedor', 'ID del video', 'Título del video']) expect(etiquetas).toContain(campo);
  });

  it('H2-E3: código: solo el lenguaje (el código se escribe en el lienzo)', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearElemento('codeBlock') }));
    expect(etiquetas).toContain('Lenguaje');
    expect(etiquetas).not.toContain('Código');
  });

  it('H2-E3: cita: autor y fuente, sin el campo de texto', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearElemento('blockquote') }));
    expect(etiquetas).toContain('Autor');
    expect(etiquetas.some((e) => e.startsWith('Fuente'))).toBe(true);
    expect(etiquetas).not.toContain('Texto');
  });

  it('H2-E3: lista: solo si es ordenada, sin los campos de ítem', () => {
    const lista = crearElemento('bulletList');
    const bloque = {
      ...lista,
      content: ['uno', 'dos'].map((texto) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }],
      })),
    } as Elemento;
    const etiquetas = etiquetasDeCampos(dibujar({ bloque }));
    expect(etiquetas.some((e) => e.includes('Lista ordenada'))).toBe(true);
    expect(etiquetas.filter((e) => e.startsWith('Ítem'))).toEqual([]);
  });

  it('H2-E3: título: solo el nivel, sin el campo de texto', () => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearElemento('heading') }));
    expect(etiquetas).toContain('Nivel');
    expect(etiquetas).not.toContain('Texto');
  });

  it.each([
    ['imagen', ['Nivel', 'Autor', 'Lenguaje', 'Columnas', 'URL', 'Proveedor']],
    ['video', ['Nivel', 'Autor', 'Lenguaje', 'Leyenda', 'Columnas', 'URL']],
    ['cta', ['Nivel', 'Autor', 'Lenguaje', 'Leyenda', 'Proveedor']],
  ] as [TipoElemento, string[]][])('H2-E3: %s no muestra campos de otros tipos', (tipo, ajenos) => {
    const etiquetas = etiquetasDeCampos(dibujar({ bloque: crearElemento(tipo) }));
    for (const campo of ajenos) expect(etiquetas, campo).not.toContain(campo);
  });

  it('H2-E5: los errores del bloque se muestran con texto y el campo queda inválido y descrito', () => {
    const html = dibujar({
      bloque: conAttrs('imagen', { imagen: { ...conImagen, alt: '' } }),
      errores: [{ indice: 2, id: '00000000-0000-4000-8000-000000000002', campo: 'imagen.alt', mensaje: MENSAJE_ALT }],
    });
    expect(sinEtiquetas(html)).toContain(MENSAJE_ALT);
    const campo = etiquetasDe(html).find((e) => e.nombre === 'input' && e.atributos['aria-invalid'] === 'true');
    expect(campo?.atributos['aria-describedby']).toBeTruthy();
  });

  it('H2-E5: los campos llevan el id de hoy, bloque-<indice>-<campo> (el enfoque del primer error los busca)', () => {
    const html = dibujar({ bloque: crearElemento('cta'), indice: 5 });
    expect(etiquetaDe(html, 'input', (e) => e.atributos.id === 'bloque-5-etiquetaBoton')).toBeDefined();
  });
});

describe('PropiedadesDelElemento: el adaptador entrega a los editores la forma de hoy (D31 C6)', () => {
  it('título: el nivel del elemento (level) llega al editor como nivel', () => {
    const html = dibujar({ bloque: conAttrs('heading', { level: 3 }) });
    const nivel = etiquetaDe(html, 'option', (e) => 'selected' in e.atributos);

    expect(nivel?.atributos.value).toBe('3');
  });

  it('lista numerada: el tipo de nodo llega al editor como «Lista ordenada» marcada', () => {
    const html = dibujar({ bloque: crearElemento('orderedList') });
    const casilla = etiquetaDe(html, 'input', (e) => e.atributos.type === 'checkbox');

    expect(casilla && 'checked' in casilla.atributos).toBe(true);
  });

  it('cita: el autor de attrs.autor aparece en su campo', () => {
    const html = dibujar({ bloque: conAttrs('blockquote', { autor: 'Ellen Lupton' }) });

    expect(etiquetaDe(html, 'input', (e) => e.atributos.value === 'Ellen Lupton')).toBeDefined();
  });

  it('código: el lenguaje de attrs.lenguaje aparece en su campo', () => {
    const html = dibujar({ bloque: conAttrs('codeBlock', { lenguaje: 'ts' }) });

    expect(etiquetaDe(html, 'input', (e) => e.atributos.value === 'ts')).toBeDefined();
  });
});

describe('PropiedadesDelElemento: sin propiedades, varios y sin selección', () => {
  // Desde la Fase 12 (RF-020) el párrafo tiene una propiedad, la alineación: queda solo el separador.
  it.each(['horizontalRule'] as TipoElemento[])(
    'H2-E4: %s muestra el aviso de sin propiedades y ningún campo',
    (tipo) => {
      const html = dibujar({ bloque: crearElemento(tipo) });
      expect(sinEtiquetas(html)).toContain(SIN_PROPIEDADES);
      expect(camposDeFormulario(html)).toHaveLength(0);
    },
  );

  it('H2-E4: un elemento con propiedades no muestra el aviso de sin propiedades', () => {
    expect(sinEtiquetas(dibujar({ bloque: crearElemento('cta') }))).not.toContain(SIN_PROPIEDADES);
  });

  it('H2-E4: con varios elementos muestra "3 elementos seleccionados" y ningún campo', () => {
    const html = dibujar({
      seleccion: seleccionDe(crearElemento('imagen'), crearElemento('cta'), crearElemento('video')),
    });
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
    ['codeBlock', 'código'],
  ] as [TipoElemento, string][])(
    'H2-E7: el nombre usa el tipo en español (%s: %s) y la posición recibida',
    (tipo, nombre) => {
      const aside = etiquetaDe(dibujar({ bloque: crearElemento(tipo), posicion: 8 }), 'aside');
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

// ---------------------------------------------------------------------------------------------------------------------
// T126 (spec 005, Fase 12; RF-020 y RF-024; contracts/componentes.md "PropiedadesDelElemento"): el panel de un párrafo
// y el de un título muestran la alineación; el de una cita, una lista, un código, un separador o un elemento especial
// no la ofrecen (no se guarda para ellos).
//
// Decisión de interfaz (T131): un grupo de opciones con el nombre «Alineación» (un `fieldset` con `legend`, o un
// `role="radiogroup"` con ese nombre) y cuatro `input type="radio"` con las etiquetas «Izquierda», «Centro», «Derecha» y
// «Justificado»; la marcada es la del elemento (sin `textAlign`, «Izquierda»). El párrafo deja de mostrar «Este
// elemento no tiene propiedades»: ahora tiene una. FASE ROJA: el panel no tiene alineación.
// ---------------------------------------------------------------------------------------------------------------------

const ALINEACIONES = ['Izquierda', 'Centro', 'Derecha', 'Justificado'];

type Opcion = { etiqueta: string; marcada: boolean; enGrupo: boolean };

/** Los `input type="radio"` con su etiqueta, si están marcados y si están dentro de un grupo llamado «Alineación». */
function opcionesDeAlineacion(html: string): Opcion[] {
  const textoDeEtiqueta = (inicio: number) => {
    const resto = html.slice(inicio);
    return sinEtiquetas(resto.slice(0, resto.indexOf('</label>'))).trim();
  };
  const grupoLlamadoAlineacion = (inicio: number) =>
    ancestrosEn(html, inicio).some((ancestro) => {
      if (ancestro.atributos.role === 'radiogroup' && ancestro.atributos['aria-label'] === 'Alineación') return true;
      if (ancestro.nombre !== 'fieldset') return false;
      const leyenda = /<legend[^>]*>([\s\S]*?)<\/legend>/.exec(html.slice(ancestro.inicio))?.[1] ?? '';
      return sinEtiquetas(leyenda).trim() === 'Alineación';
    });
  return etiquetasDe(html)
    .filter((e) => e.nombre === 'input' && e.atributos.type === 'radio')
    .map((radio) => {
      const id = radio.atributos.id;
      const porFor = id ? etiquetasDe(html).find((e) => e.nombre === 'label' && e.atributos.for === id) : undefined;
      const envolvente = ancestrosEn(html, radio.inicio)
        .reverse()
        .find((ancestro) => ancestro.nombre === 'label');
      const etiqueta = porFor ?? envolvente;
      return {
        etiqueta: etiqueta ? textoDeEtiqueta(etiqueta.inicio) : '',
        marcada: 'checked' in radio.atributos,
        enGrupo: grupoLlamadoAlineacion(radio.inicio),
      };
    })
    .filter((opcion) => ALINEACIONES.includes(opcion.etiqueta));
}

const alineadoCon = (tipo: 'paragraph' | 'heading', attrs: Record<string, unknown> = {}) => conAttrs(tipo, attrs);

describe('PropiedadesDelElemento: alineación de párrafos y títulos (RF-020, RF-024)', () => {
  it.each(['paragraph', 'heading'] as const)(
    'H6-E4: %s muestra el grupo «Alineación» con sus cuatro opciones',
    (tipo) => {
      const opciones = opcionesDeAlineacion(dibujar({ bloque: alineadoCon(tipo) }));

      expect(opciones.map((opcion) => opcion.etiqueta)).toEqual(ALINEACIONES);
      expect(opciones.every((opcion) => opcion.enGrupo)).toBe(true);
    },
  );

  it('H6-E4: sin textAlign la opción marcada es «Izquierda» (la de siempre)', () => {
    const opciones = opcionesDeAlineacion(dibujar({ bloque: alineadoCon('paragraph') }));

    expect(opciones.filter((opcion) => opcion.marcada).map((opcion) => opcion.etiqueta)).toEqual(['Izquierda']);
  });

  it.each([
    ['center', 'Centro'],
    ['right', 'Derecha'],
    ['justify', 'Justificado'],
  ])('H6-E4: un párrafo con textAlign %j marca «%s»', (textAlign, etiqueta) => {
    const opciones = opcionesDeAlineacion(dibujar({ bloque: alineadoCon('paragraph', { textAlign }) }));

    expect(opciones.filter((opcion) => opcion.marcada).map((opcion) => opcion.etiqueta)).toEqual([etiqueta]);
  });

  it('H6-E4: un título centrado muestra su nivel y la alineación «Centro»', () => {
    const html = dibujar({ bloque: alineadoCon('heading', { level: 3, textAlign: 'center' }) });

    expect(etiquetaDe(html, 'option', (e) => 'selected' in e.atributos)?.atributos.value).toBe('3');
    expect(
      opcionesDeAlineacion(html)
        .filter((opcion) => opcion.marcada)
        .map((opcion) => opcion.etiqueta),
    ).toEqual(['Centro']);
  });

  it('RF-020: el párrafo ya no dice que no tiene propiedades (tiene la alineación)', () => {
    expect(sinEtiquetas(dibujar({ bloque: crearElemento('paragraph') }))).not.toContain(SIN_PROPIEDADES);
  });

  it.each([
    'blockquote',
    'bulletList',
    'orderedList',
    'codeBlock',
    'horizontalRule',
    'imagen',
    'cta',
  ] as TipoElemento[])('RF-024: %s no ofrece alineación', (tipo) => {
    const html = dibujar({ bloque: crearElemento(tipo) });

    expect(opcionesDeAlineacion(html)).toEqual([]);
    expect(sinEtiquetas(html)).not.toContain('Alineación');
  });
});

describe('PropiedadesDelElemento: tabla (RF-028, RF-029, D31 U15)', () => {
  it('H7: tabla vacía muestra el campo «Descripción» y el aviso para lectores de pantalla', () => {
    const html = dibujar({ bloque: crearElemento('table') });

    expect(etiquetasDeCampos(html)).toContain('Descripción');
    expect(sinEtiquetas(html)).toContain('Agrega una descripción para los lectores de pantalla');
  });

  it('H7: tabla con descripción no muestra el aviso', () => {
    const bloque = conAttrs('table', { descripcion: 'Precios de servicios' });
    const html = dibujar({ bloque });

    expect(etiquetasDeCampos(html)).toContain('Descripción');
    expect(sinEtiquetas(html)).not.toContain('Agrega una descripción para los lectores de pantalla');
  });

  it('H7: tabla muestra sección «Estructura de la tabla» y sus botones de acción', () => {
    const html = dibujar({ bloque: crearElemento('table') });

    expect(sinEtiquetas(html)).toContain('Estructura de la tabla');
    const botones = textosDeBotones(html);
    expect(botones).toContain('Fila de encabezado');
    expect(botones).toContain('Insertar fila arriba');
    expect(botones).toContain('Insertar fila abajo');
    expect(botones).toContain('Insertar columna a la izquierda');
    expect(botones).toContain('Insertar columna a la derecha');
    expect(botones).toContain('Quitar fila');
    expect(botones).toContain('Quitar columna');
    expect(botones).toContain('Combinar celdas');
    expect(botones).toContain('Separar celdas');
  });
});
