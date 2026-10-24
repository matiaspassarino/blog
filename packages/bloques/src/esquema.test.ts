// T090 (spec 005, ampliación): esquemaDocumento, la lista permitida del documento guardado
// (contracts/documento.md; RF-022, research D22 y D24; constitución §VI.2). Fase 10: once tipos de primer nivel y
// las marcas link, bold, italic y code (la tabla llega en T138 y los formatos nuevos en la Fase 12).
//
// Firma propuesta (T099), exportada desde './esquema':
//   esquemaDocumento: z.ZodType<Documento>   // objetos `strict`, recursivo con Zod 4
//   type Documento = { type: 'doc'; content: Elemento[] }   (0 a 200 elementos, `attrs.id` uuid único)
//   y los esquemas de campos de hoy (texto, urlHttps, nivelTitulo, lenguaje, camposImagen, camposGaleria,
//   camposCta, camposVideo, camposCita), reutilizados con sus mensajes.
//
// T123 (spec 005, Fase 12, H6 esc. 1 a 4; RF-009 y RF-024; contracts/documento.md "Inline" y "Elementos"): al final
// del archivo, las marcas `underline`, `strike`, `highlight` (sin `color`), `superscript` y `subscript` en párrafos,
// títulos, citas e ítems; `code` excluye todas; `superscript` y `subscript` se excluyen entre sí; `textAlign` solo
// `"center"`, `"right"` o `"justify"` y solo en `paragraph` y `heading` (la izquierda es la ausencia; `"left"` lo
// quita la normalización y el esquema lo rechaza); sin `textAlign` en citas, ítems ni elementos especiales (las celdas
// llegan con la tabla, T133). FASE ROJA: el esquema de hoy solo tiene link, bold, italic y code, y no tiene textAlign.
import { describe, expect, it } from 'vitest';
import { esquemaDocumento } from './esquema';
import { alineado, CORPUS_DOCUMENTOS, imagenDePrueba, marca, nodo, type NodoPrueba } from './pruebas/corpus-documento';

const {
  doc,
  texto,
  salto,
  parrafo,
  titulo,
  item,
  vinetas,
  numerada,
  cita,
  codigo,
  separador,
  celda,
  encabezado,
  fila,
  tabla,
  parrafoSimple,
} = nodo;

const MENSAJE_SIN_ALT = 'La imagen necesita un texto alternativo o marcarse como decorativa';
const letras = (largo: number) => 'a'.repeat(largo);
const imagenes = (cantidad: number) =>
  Array.from({ length: cantidad }, (_, i) => imagenDePrueba(`foto-${i + 1}`, `Foto ${i + 1}`));

const resultado = (documento: unknown) => esquemaDocumento.safeParse(documento);
const esValido = (documento: unknown) => resultado(documento).success;
/** Un documento con un solo elemento. */
const conElemento = (elemento: NodoPrueba) => doc(elemento);
const mensajes = (documento: unknown) => resultado(documento).error?.issues.map((problema) => problema.message) ?? [];

/** Copia profunda con un cambio en los `attrs` del elemento. */
const conAttrs = (elemento: NodoPrueba, attrs: Record<string, unknown>): NodoPrueba => ({
  ...structuredClone(elemento),
  attrs: { ...elemento.attrs, ...attrs },
});
const sinAttr = (elemento: NodoPrueba, nombre: string): NodoPrueba => {
  const copia = structuredClone(elemento);
  delete copia.attrs?.[nombre];
  return copia;
};

// Un elemento válido mínimo por tipo: los once de la Fase 10.
const elementosValidos = {
  paragraph: () => parrafo(texto('Un párrafo con '), texto('negrita', marca.negrita), texto('.')),
  heading: () => titulo(2, texto('Un subtítulo')),
  bulletList: () => vinetas(item(texto('Uno')), item(texto('Dos'))),
  orderedList: () => numerada(item(texto('Primero'))),
  blockquote: () => cita({}, texto('Menos es más.')),
  codeBlock: () => codigo('const saludo = "hola";'),
  horizontalRule: () => separador(),
  imagen: () => nodo.imagen(imagenDePrueba('una', 'Una foto')),
  galeria: () => nodo.galeria(3, ...imagenes(2)),
  cta: () => nodo.cta({ titulo: '¿Hablamos?', etiquetaBoton: 'Contáctanos', url: '/contacto' }),
  video: () => nodo.video('youtube', 'dQw4w9WgXcQ', 'Video de presentación'),
} satisfies Record<string, () => NodoPrueba>;
const TIPOS = Object.keys(elementosValidos) as (keyof typeof elementosValidos)[];

describe('esquemaDocumento', () => {
  describe('documento: { type: "doc", content } con 0 a 200 elementos', () => {
    it('acepta el documento vacío (un borrador puede no tener contenido)', () => {
      expect(esValido(doc())).toBe(true);
    });

    it('acepta un documento con un elemento de cada tipo y conserva el orden', () => {
      const documento = doc(...TIPOS.map((tipo) => elementosValidos[tipo]()));
      const salida = resultado(documento);

      expect(salida.success).toBe(true);
      expect(salida.data?.content.map((elemento) => elemento.attrs.id)).toEqual(
        documento.content?.map((elemento) => elemento.attrs?.id),
      );
    });

    it('acepta exactamente 200 elementos', () => {
      expect(esValido(doc(...Array.from({ length: 200 }, () => separador())))).toBe(true);
    });

    it('rechaza 201 elementos con un mensaje que menciona el límite', () => {
      const documento = doc(...Array.from({ length: 201 }, () => separador()));
      expect(esValido(documento)).toBe(false);
      expect(mensajes(documento).some((mensaje) => mensaje.includes('200'))).toBe(true);
    });

    it('rechaza el formato anterior: una lista de bloques', () => {
      expect(esValido([{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Hola' }])).toBe(false);
      expect(esValido([])).toBe(false);
    });

    it('rechaza un bloque del formato anterior dentro de un documento', () => {
      expect(esValido({ type: 'doc', content: [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Hola' }] })).toBe(
        false,
      );
    });

    it.each([
      ['un type distinto de doc', { type: 'documento', content: [] }],
      ['sin content', { type: 'doc' }],
      ['content que no es un arreglo', { type: 'doc', content: {} }],
      ['una clave de más', { type: 'doc', content: [], version: 2 }],
      ['HTML en lugar de nodos', { type: 'doc', content: '<p>Hola</p>' }],
      ['null', null],
      ['un string', '<p>Hola</p>'],
    ])('rechaza %s', (_caso, entrada) => {
      expect(esValido(entrada)).toBe(false);
    });
  });

  describe('elementos de primer nivel: attrs.id uuid único y objetos estrictos', () => {
    it.each(TIPOS)('acepta un %s válido mínimo', (tipo) => {
      expect(esValido(conElemento(elementosValidos[tipo]()))).toBe(true);
    });

    it.each(TIPOS)('rechaza un %s sin attrs.id', (tipo) => {
      expect(esValido(conElemento(sinAttr(elementosValidos[tipo](), 'id')))).toBe(false);
    });

    it.each(TIPOS)('rechaza un %s con un id que no es uuid', (tipo) => {
      expect(esValido(conElemento(conAttrs(elementosValidos[tipo](), { id: 'elemento-1' })))).toBe(false);
    });

    it.each(TIPOS)('rechaza un %s con un atributo de más', (tipo) => {
      expect(esValido(conElemento(conAttrs(elementosValidos[tipo](), { color: 'red' })))).toBe(false);
    });

    it.each(TIPOS)('rechaza un %s con una clave de más en el nodo', (tipo) => {
      const conClaveDeMas = { ...elementosValidos[tipo](), estilo: 'font-size: 40px' };
      expect(esValido(conElemento(conClaveDeMas))).toBe(false);
    });

    it('rechaza dos elementos con el mismo id', () => {
      const primero = parrafo(texto('Uno'));
      const segundo = { ...separador(), attrs: { id: primero.attrs?.id } };
      expect(esValido(doc(primero, segundo))).toBe(false);
    });

    it.each(['tabla', 'parrafo', 'image', 'iframe', 'html', 'script', 'details', 'taskList'])(
      'rechaza el tipo desconocido %j',
      (type) => {
        expect(esValido(doc({ type, attrs: { id: crypto.randomUUID() } }))).toBe(false);
      },
    );

    it('rechaza un nodo text suelto en el primer nivel', () => {
      expect(esValido(doc(texto('Texto suelto')))).toBe(false);
    });

    it('rechaza un elemento que no es un objeto', () => {
      expect(esValido({ type: 'doc', content: ['Hola', null] })).toBe(false);
    });
  });

  describe('texto y marcas', () => {
    it.each([
      ['link interno', [marca.enlace('/blog')]],
      ['link https', [marca.enlace('https://ejemplo.com/guia')]],
      ['link http', [marca.enlace('http://ejemplo.com')]],
      ['link mailto', [marca.enlace('mailto:hola@ejemplo.com')]],
      ['bold', [marca.negrita]],
      ['italic', [marca.cursiva]],
      ['code', [marca.codigo]],
      ['link, bold e italic juntos', [marca.enlace('/x'), marca.negrita, marca.cursiva]],
    ])('acepta la marca %s', (_caso, marcas) => {
      expect(esValido(doc(parrafo(texto('Con formato', ...marcas))))).toBe(true);
    });

    it.each(['javascript:alert(1)', '//malo.com', 'data:text/html,<b>x</b>', 'ftp://ejemplo.com', ''])(
      'rechaza un link con href %j (hrefSeguro)',
      (href) => {
        expect(esValido(doc(parrafo(texto('Clic', marca.enlace(href)))))).toBe(false);
      },
    );

    it.each([
      ['target', { href: '/x', target: '_blank' }],
      ['rel', { href: '/x', rel: 'nofollow' }],
      ['class', { href: '/x', class: 'boton' }],
    ])('rechaza un link con %s (se pone al dibujar, no se guarda)', (_caso, attrs) => {
      expect(esValido(doc(parrafo(texto('Clic', { type: 'link', attrs }))))).toBe(false);
    });

    it('rechaza un link sin href', () => {
      expect(esValido(doc(parrafo(texto('Clic', { type: 'link' }))))).toBe(false);
    });

    it.each(['textStyle', 'color', 'fontFamily', 'fontSize', 'negrita', 'span'])(
      'rechaza la marca desconocida %j',
      (type) => {
        expect(esValido(doc(parrafo(texto('Con formato', { type }))))).toBe(false);
      },
    );

    it('rechaza una marca bold con atributos', () => {
      expect(esValido(doc(parrafo(texto('Fuerte', { type: 'bold', attrs: { color: 'red' } }))))).toBe(false);
    });

    it.each([
      ['bold', marca.negrita],
      ['italic', marca.cursiva],
      ['link', marca.enlace('/x')],
    ])('code excluye cualquier otra marca: rechaza code con %s', (_caso, otra) => {
      expect(esValido(doc(parrafo(texto('npm install', marca.codigo, otra))))).toBe(false);
    });

    it('rechaza un texto vacío', () => {
      expect(esValido(doc(parrafo(texto('Hola '), { type: 'text', text: '' })))).toBe(false);
    });

    it('rechaza un nodo text sin text o con text que no es un string', () => {
      expect(esValido(doc(parrafo({ type: 'text' })))).toBe(false);
      expect(esValido(doc(parrafo({ type: 'text', text: 42 } as unknown as NodoPrueba)))).toBe(false);
    });

    it('rechaza un nodo text con una clave de más', () => {
      expect(esValido(doc(parrafo({ type: 'text', text: 'Hola', attrs: { id: 'x' } })))).toBe(false);
    });

    it('acepta HTML escrito como texto (se muestra escapado)', () => {
      expect(esValido(doc(parrafo(texto('<script>alert(1)</script>'))))).toBe(true);
    });
  });

  describe('paragraph: 1 a 5000 caracteres de texto (sin contar marcas), con hardBreak', () => {
    it('acepta 1 y 5000 caracteres', () => {
      expect(esValido(doc(parrafo(texto(letras(1)))))).toBe(true);
      expect(esValido(doc(parrafo(texto(letras(5000)))))).toBe(true);
    });

    it('cuenta el texto de todos los nodos sin contar las marcas: 5000 repartidos con formato es válido', () => {
      const repartido = parrafo(
        texto(letras(2000)),
        texto(letras(1000), marca.negrita),
        texto(letras(1000), marca.enlace('https://ejemplo.com/una-ruta-larga')),
        texto(letras(1000), marca.codigo),
      );
      expect(esValido(doc(repartido))).toBe(true);
    });

    it('rechaza 5001 caracteres, aunque estén repartidos', () => {
      expect(esValido(doc(parrafo(texto(letras(5001)))))).toBe(false);
      expect(esValido(doc(parrafo(texto(letras(3000)), texto(letras(2001), marca.negrita))))).toBe(false);
    });

    it('acepta un hardBreak entre textos', () => {
      expect(esValido(doc(parrafo(texto('Línea uno'), salto(), texto('línea dos'))))).toBe(true);
    });

    it('rechaza un párrafo de primer nivel sin texto (vacío o solo con hardBreak)', () => {
      expect(esValido(doc(parrafo()))).toBe(false);
      expect(esValido(doc(parrafo(salto())))).toBe(false);
    });

    it('rechaza un hardBreak con atributos', () => {
      expect(esValido(doc(parrafo(texto('Uno'), { type: 'hardBreak', attrs: { id: 'x' } })))).toBe(false);
    });

    it('rechaza un elemento de bloque dentro de un párrafo', () => {
      expect(esValido(doc(parrafo(texto('Uno'), separador())))).toBe(false);
    });
  });

  describe('heading: level 2, 3 o 4 y 1 a 150 caracteres, sin hardBreak', () => {
    it.each([2, 3, 4])('acepta el level %i', (level) => {
      expect(esValido(doc(conAttrs(titulo(2, texto('Título')), { level })))).toBe(true);
    });

    it.each([1, 5, 6, '2', 2.5, null])('rechaza el level %j con el mensaje de hoy', (level) => {
      const documento = doc(conAttrs(titulo(2, texto('Título')), { level }));
      expect(esValido(documento)).toBe(false);
      expect(mensajes(documento)).toContain('El nivel debe ser 2, 3 o 4');
    });

    it('rechaza un título sin level', () => {
      expect(esValido(doc(sinAttr(titulo(2, texto('Título')), 'level')))).toBe(false);
    });

    it('acepta 150 caracteres y formato en línea (RF-009: los títulos admiten formatos)', () => {
      expect(esValido(doc(titulo(2, texto(letras(150)))))).toBe(true);
      expect(esValido(doc(titulo(3, texto('Un título '), texto('con negrita', marca.negrita))))).toBe(true);
    });

    it('rechaza 151 caracteres y un título vacío', () => {
      expect(esValido(doc(titulo(2, texto(letras(151)))))).toBe(false);
      expect(esValido(doc(titulo(2)))).toBe(false);
    });

    it('rechaza un hardBreak en un título', () => {
      expect(esValido(doc(titulo(2, texto('Uno'), salto(), texto('Dos'))))).toBe(false);
    });
  });

  describe('bulletList y orderedList: 1 a 50 listItem con un paragraph de 1 a 500, sin anidar', () => {
    it.each([
      ['bulletList', vinetas],
      ['orderedList', numerada],
    ])('%s: acepta 1 ítem y 50 ítems de 500 caracteres', (_caso, lista) => {
      expect(esValido(doc(lista(item(texto('Único')))))).toBe(true);
      expect(esValido(doc(lista(...Array.from({ length: 50 }, () => item(texto(letras(500)))))))).toBe(true);
    });

    it('acepta marcas dentro de un ítem', () => {
      expect(esValido(doc(vinetas(item(texto('Elegí '), texto('dos', marca.negrita), texto(' familias.')))))).toBe(
        true,
      );
    });

    it.each([
      ['sin ítems', { ...vinetas(), content: [] }],
      ['sin content', { type: 'bulletList', attrs: { id: crypto.randomUUID() } }],
      ['con 51 ítems', vinetas(...Array.from({ length: 51 }, () => item(texto('ítem'))))],
      ['con un ítem de 501 caracteres', vinetas(item(texto(letras(501))))],
      ['con un ítem vacío', vinetas(item(texto('Uno')), item())],
      [
        'con un ítem de dos párrafos',
        vinetas({
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [texto('Uno')] },
            { type: 'paragraph', content: [texto('Dos')] },
          ],
        }),
      ],
      [
        'con una lista anidada',
        vinetas({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [texto('Uno')] }, numerada(item(texto('Anidado')))],
        }),
      ],
      ['con un párrafo suelto en lugar de un listItem', { ...vinetas(), content: [parrafo(texto('Uno'))] }],
      ['con un listItem con atributos', vinetas({ ...item(texto('Uno')), attrs: { checked: true } })],
    ])('rechaza una lista %s', (_caso, lista) => {
      expect(esValido(doc(lista))).toBe(false);
    });
  });

  describe('blockquote: un paragraph de 1 a 1000, autor 1 a 120 y fuente https opcionales', () => {
    it('acepta una cita completa de 1000 caracteres', () => {
      const completa = cita({ autor: 'Dieter Rams', fuente: 'https://ejemplo.com/entrevista' }, texto(letras(1000)));
      expect(esValido(doc(completa))).toBe(true);
    });

    it('acepta un autor de 120 caracteres', () => {
      expect(esValido(doc(cita({ autor: letras(120) }, texto('Cita'))))).toBe(true);
    });

    it.each([
      ['de 1001 caracteres', cita({}, texto(letras(1001)))],
      ['vacía', cita({})],
      [
        'con dos párrafos',
        {
          ...cita({}, texto('Uno')),
          content: [
            { type: 'paragraph', content: [texto('Uno')] },
            { type: 'paragraph', content: [texto('Dos')] },
          ],
        },
      ],
      ['con un autor vacío', cita({ autor: '' }, texto('Cita'))],
      ['con un autor de 121 caracteres', cita({ autor: letras(121) }, texto('Cita'))],
    ])('rechaza una cita %s', (_caso, elemento) => {
      expect(esValido(doc(elemento))).toBe(false);
    });

    it.each(['http://ejemplo.com/entrevista', 'ftp://ejemplo.com/archivo', 'javascript:alert(1)', 'no es una url'])(
      'rechaza la fuente %j con el mensaje de hoy',
      (fuente) => {
        const documento = doc(cita({ fuente }, texto('Cita')));
        expect(esValido(documento)).toBe(false);
        expect(mensajes(documento)).toContain('La fuente debe ser una URL https');
      },
    );
  });

  describe('codeBlock: 0 o 1 text sin marcas, 0 a 20 000 caracteres y lenguaje ^[a-z0-9+#-]{1,20}$', () => {
    it('acepta un bloque de código vacío (sin content) y uno de 20 000 caracteres', () => {
      expect(esValido(doc(codigo('')))).toBe(true);
      expect(esValido(doc(codigo(letras(20000))))).toBe(true);
    });

    it('conserva los marcadores del formato anterior y los saltos como texto literal', () => {
      expect(esValido(doc(codigo('const a = **1**;\nconsole.log(`a`);', 'ts')))).toBe(true);
    });

    it('rechaza 20 001 caracteres', () => {
      expect(esValido(doc(codigo(letras(20001))))).toBe(false);
    });

    it('rechaza un texto con marcas, dos textos o un hardBreak', () => {
      const conMarca = { ...codigo(''), content: [texto('const a', marca.negrita)] };
      const dosTextos = { ...codigo(''), content: [texto('const a'), texto(' = 1')] };
      const conSalto = { ...codigo(''), content: [texto('a'), salto()] };
      expect(esValido(doc(conMarca))).toBe(false);
      expect(esValido(doc(dosTextos))).toBe(false);
      expect(esValido(doc(conSalto))).toBe(false);
    });

    it.each(['ts', 'c++', 'c#', 'objective-c', 'html5', letras(20)])('acepta el lenguaje %j', (lenguaje) => {
      expect(esValido(doc(codigo('x', lenguaje)))).toBe(true);
    });

    it.each(['TypeScript', 'shell script', '', letras(21), 'js<script>'])(
      'rechaza el lenguaje %j con el mensaje de hoy',
      (lenguaje) => {
        const documento = doc(conAttrs(codigo('x'), { lenguaje }));
        expect(esValido(documento)).toBe(false);
        expect(mensajes(documento)).toContain('El lenguaje no es válido');
      },
    );

    it('rechaza el atributo language de la librería (queda solo lenguaje)', () => {
      expect(esValido(doc(conAttrs(codigo('x'), { language: 'ts' })))).toBe(false);
    });
  });

  describe('horizontalRule: sin campos propios', () => {
    it('rechaza un separador con content', () => {
      expect(esValido(doc({ ...separador(), content: [texto('Hola')] }))).toBe(false);
    });
  });

  describe('imagen: los campos y mensajes del bloque imagen de hoy', () => {
    it('acepta una leyenda de 300 caracteres y una imagen decorativa sin alt', () => {
      expect(esValido(doc(nodo.imagen(imagenDePrueba('a', 'Alt'), letras(300))))).toBe(true);
      expect(esValido(doc(nodo.imagen(imagenDePrueba('decorativa'))))).toBe(true);
    });

    it('rechaza una leyenda de 301 caracteres', () => {
      expect(esValido(doc(nodo.imagen(imagenDePrueba('a', 'Alt'), letras(301))))).toBe(false);
    });

    it('rechaza un elemento imagen sin imagen', () => {
      expect(esValido(doc(sinAttr(nodo.imagen(imagenDePrueba('a', 'Alt')), 'imagen')))).toBe(false);
    });

    it('rechaza una imagen sin alt que no es decorativa, con el mensaje de hoy (RF-004)', () => {
      const { alt: _sinAlt, ...sinAlt } = imagenDePrueba('a', 'Alt');
      const documento = doc(nodo.imagen(sinAlt));
      expect(esValido(documento)).toBe(false);
      expect(mensajes(documento)).toContain(MENSAJE_SIN_ALT);
    });

    it('rechaza content en un elemento imagen', () => {
      expect(esValido(doc({ ...nodo.imagen(imagenDePrueba('a', 'Alt')), content: [texto('Pie')] }))).toBe(false);
    });
  });

  describe('galeria: 2 a 24 imágenes y columnas 2, 3 o 4', () => {
    it('acepta 2 y 24 imágenes', () => {
      expect(esValido(doc(nodo.galeria(3, ...imagenes(2))))).toBe(true);
      expect(esValido(doc(nodo.galeria(3, ...imagenes(24))))).toBe(true);
    });

    it.each([2, 3, 4] as const)('acepta %i columnas', (columnas) => {
      expect(esValido(doc(nodo.galeria(columnas, ...imagenes(2))))).toBe(true);
    });

    it.each([1, 5, '3'])('rechaza columnas = %j con el mensaje de hoy', (columnas) => {
      const documento = doc(conAttrs(nodo.galeria(3, ...imagenes(2)), { columnas }));
      expect(esValido(documento)).toBe(false);
      expect(mensajes(documento)).toContain('Las columnas deben ser 2, 3 o 4');
    });

    it.each([
      [1, 'La galería necesita al menos 2 imágenes'],
      [25, 'La galería admite hasta 24 imágenes'],
    ])('rechaza una galería con %i imágenes con el mensaje de hoy', (cantidad, mensaje) => {
      const documento = doc(nodo.galeria(3, ...imagenes(cantidad)));
      expect(esValido(documento)).toBe(false);
      expect(mensajes(documento)).toContain(mensaje);
    });

    it('rechaza una galería con una imagen sin alt (RF-004)', () => {
      const { alt: _sinAlt, ...sinAlt } = imagenDePrueba('b', 'Alt');
      expect(esValido(doc(nodo.galeria(3, imagenDePrueba('a', 'Alt'), sinAlt)))).toBe(false);
    });
  });

  describe('cta: los campos y mensajes de la llamada a la acción de hoy', () => {
    const cta = (cambios: Record<string, unknown> = {}) =>
      conAttrs(nodo.cta({ titulo: '¿Hablamos?', etiquetaBoton: 'Contáctanos', url: '/contacto' }), cambios);

    it.each(['/contacto', '/blog/mi-articulo', 'https://ejemplo.com/reservas'])('acepta la url %j', (url) => {
      expect(esValido(doc(cta({ url })))).toBe(true);
    });

    it.each(['http://ejemplo.com', 'javascript:alert(1)', 'contacto', '//sitio-externo.com', ''])(
      'rechaza la url %j con el mensaje de hoy',
      (url) => {
        const documento = doc(cta({ url }));
        expect(esValido(documento)).toBe(false);
        expect(mensajes(documento)).toContain('La URL debe ser interna (/…) o https');
      },
    );

    it('acepta texto, una etiqueta de 40 caracteres y las variantes primaria y secundaria', () => {
      expect(
        esValido(doc(cta({ etiquetaBoton: letras(40), texto: 'Respondemos en 24 h.', variante: 'primaria' }))),
      ).toBe(true);
      expect(esValido(doc(cta({ variante: 'secundaria' })))).toBe(true);
    });

    it.each([
      ['una etiqueta vacía', { etiquetaBoton: '' }],
      ['una etiqueta de 41 caracteres', { etiquetaBoton: letras(41) }],
      ['una variante desconocida', { variante: 'terciaria' }],
    ])('rechaza %s', (_caso, cambios) => {
      expect(esValido(doc(cta(cambios)))).toBe(false);
    });

    it.each(['titulo', 'etiquetaBoton', 'url'])('rechaza una llamada a la acción sin %s', (campo) => {
      expect(esValido(doc(sinAttr(cta(), campo)))).toBe(false);
    });
  });

  describe('video: proveedor youtube o vimeo, idVideo válido por proveedor y titulo', () => {
    it.each([
      ['youtube', 'dQw4w9WgXcQ'],
      ['youtube', 'a_b-C1d2E3f'],
      ['vimeo', '76979871'],
    ] as const)('acepta un video de %s con id %j', (proveedor, idVideo) => {
      expect(esValido(doc(nodo.video(proveedor, idVideo, 'Un video')))).toBe(true);
    });

    it.each([
      ['youtube', 'abc', 'El id de YouTube no es válido'],
      ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'El id de YouTube no es válido'],
      ['vimeo', 'dQw4w9WgXcQ', 'El id de Vimeo no es válido'],
      ['vimeo', 'https://vimeo.com/76979871', 'El id de Vimeo no es válido'],
    ] as const)('rechaza un video de %s con id %j con el mensaje de hoy', (proveedor, idVideo, mensaje) => {
      const documento = doc(nodo.video(proveedor, idVideo, 'Un video'));
      expect(esValido(documento)).toBe(false);
      expect(mensajes(documento)).toContain(mensaje);
    });

    it('rechaza un proveedor que no es youtube ni vimeo', () => {
      expect(esValido(doc(conAttrs(nodo.video('youtube', 'dQw4w9WgXcQ', 'V'), { proveedor: 'dailymotion' })))).toBe(
        false,
      );
    });

    it.each(['proveedor', 'idVideo', 'titulo'])('rechaza un video sin %s', (campo) => {
      expect(esValido(doc(sinAttr(nodo.video('youtube', 'dQw4w9WgXcQ', 'Un video'), campo)))).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T123 (Fase 12, Historia 6): más formato y alineación.
// ---------------------------------------------------------------------------------------------------------------------

const MARCAS_NUEVAS = [
  ['underline', marca.subrayado],
  ['strike', marca.tachado],
  ['highlight', marca.resaltado],
  ['superscript', marca.superindice],
  ['subscript', marca.subindice],
] as const;

/** Las ocho marcas que no son `code`. */
const MARCAS_NO_CODIGO = [
  ['link', marca.enlace('/blog')],
  ['bold', marca.negrita],
  ['italic', marca.cursiva],
  ...MARCAS_NUEVAS,
] as const;

/** Un texto con estas marcas dentro de cada elemento que admite formato en línea. */
const dondeHayFormato = {
  'un párrafo': (...marcas: NonNullable<NodoPrueba['marks']>) => parrafo(texto('Con formato', ...marcas)),
  'un título': (...marcas: NonNullable<NodoPrueba['marks']>) => titulo(2, texto('Con formato', ...marcas)),
  'una cita': (...marcas: NonNullable<NodoPrueba['marks']>) => cita({}, texto('Con formato', ...marcas)),
  'un ítem de lista': (...marcas: NonNullable<NodoPrueba['marks']>) => vinetas(item(texto('Con formato', ...marcas))),
};
const LUGARES = Object.entries(dondeHayFormato);

describe('esquemaDocumento: más formato (H6, RF-009)', () => {
  describe('las cinco marcas nuevas', () => {
    it.each(
      MARCAS_NUEVAS.flatMap(([nombre, m]) => LUGARES.map(([lugar, armar]) => [nombre, lugar, armar, m] as const)),
    )('H6-E1: acepta %s en %s', (_nombre, _lugar, armar, m) => {
      expect(esValido(doc(armar(m)))).toBe(true);
    });

    it('H6-E3: negrita, cursiva, subrayado, tachado y resaltado se combinan entre sí y con un enlace', () => {
      const combinado = texto(
        'Todo junto',
        marca.enlace('https://ejemplo.com/guia'),
        marca.negrita,
        marca.cursiva,
        marca.subrayado,
        marca.tachado,
        marca.resaltado,
      );

      expect(esValido(doc(parrafo(combinado)))).toBe(true);
      expect(esValido(doc(titulo(3, combinado)))).toBe(true);
    });

    it.each([
      ['superscript', marca.superindice],
      ['subscript', marca.subindice],
    ])('%s se combina con negrita, cursiva, subrayado, tachado, resaltado y enlace', (_nombre, m) => {
      expect(
        esValido(
          doc(
            parrafo(
              texto(
                '2',
                marca.enlace('/notas'),
                marca.negrita,
                marca.cursiva,
                marca.subrayado,
                marca.tachado,
                marca.resaltado,
                m,
              ),
            ),
          ),
        ),
      ).toBe(true);
    });

    it('H6-PI: «m2» con el 2 en superíndice y «H2O» con el 2 en subíndice', () => {
      const documento = doc(
        parrafo(texto('m'), texto('2', marca.superindice), texto(' y H'), texto('2', marca.subindice), texto('O')),
      );

      expect(esValido(documento)).toBe(true);
    });

    it.each([
      ['un color', { color: '#ffeb3b' }],
      ['un color null', { color: null }],
      ['cualquier atributo', { clase: 'amarillo' }],
    ])('RF-009: el resaltado no lleva %s (un solo color, el del sitio)', (_caso, attrs) => {
      expect(esValido(doc(parrafo(texto('Resaltado', { type: 'highlight', attrs }))))).toBe(false);
    });

    it.each(MARCAS_NUEVAS)('rechaza %s con atributos', (nombre) => {
      expect(esValido(doc(parrafo(texto('Con formato', { type: nombre, attrs: { estilo: 'x' } }))))).toBe(false);
    });

    it.each(['textStyle', 'color', 'fontFamily', 'fontSize', 'mark', 'u', 's', 'sup', 'sub', 'strikethrough'])(
      'RF-009: sigue rechazando la marca %j (colores, tipografías, tamaños y nombres que no son los del contrato)',
      (type) => {
        expect(esValido(doc(parrafo(texto('Con formato', { type }))))).toBe(false);
      },
    );
  });

  describe('exclusiones', () => {
    it.each(MARCAS_NO_CODIGO)('H6-E3: code excluye cualquier otra marca: rechaza code con %s', (_nombre, otra) => {
      expect(esValido(doc(parrafo(texto('npm install', otra, marca.codigo))))).toBe(false);
      expect(esValido(doc(parrafo(texto('npm install', marca.codigo, otra))))).toBe(false);
    });

    it('H6-E3: code excluye otras marcas también en títulos, citas e ítems', () => {
      for (const [lugar, armar] of LUGARES) {
        expect(esValido(doc(armar(marca.codigo, marca.subrayado))), lugar).toBe(false);
      }
    });

    it('H6-E3: code solo es válido', () => {
      for (const [lugar, armar] of LUGARES) {
        expect(esValido(doc(armar(marca.codigo))), lugar).toBe(true);
      }
    });

    it('H6-E2: superscript y subscript se excluyen entre sí (en cualquier orden)', () => {
      expect(esValido(doc(parrafo(texto('2', marca.superindice, marca.subindice))))).toBe(false);
      expect(esValido(doc(parrafo(texto('2', marca.subindice, marca.superindice))))).toBe(false);
    });

    it('H6-E2: superscript y subscript seguidos en textos distintos son válidos', () => {
      expect(esValido(doc(parrafo(texto('x'), texto('2', marca.superindice), texto('i', marca.subindice))))).toBe(true);
    });
  });
});

describe('esquemaDocumento: alineación de párrafos y títulos (H6-E4, RF-024)', () => {
  it.each(['center', 'right', 'justify'])('acepta textAlign %j en un párrafo', (textAlign) => {
    expect(esValido(doc(alineado(parrafo(texto('Alineado')), textAlign)))).toBe(true);
  });

  it.each(['center', 'right', 'justify'])('acepta textAlign %j en un título', (textAlign) => {
    expect(esValido(doc(alineado(titulo(2, texto('Alineado')), textAlign)))).toBe(true);
  });

  it('un título alineado conserva el nivel y admite formato', () => {
    const elemento = alineado(titulo(4, texto('Un '), texto('título', marca.subrayado)), 'center');
    const salida = resultado(doc(elemento));

    expect(salida.success).toBe(true);
    expect(salida.data?.content[0]?.attrs).toMatchObject({ level: 4, textAlign: 'center' });
  });

  it.each(['left', 'start', 'end', 'centro', 'derecha', 'justificado', '', 'CENTER', 'center; color: red'])(
    'rechaza textAlign %j (la izquierda es la ausencia del atributo; nunca se guarda "left")',
    (textAlign) => {
      expect(esValido(doc(alineado(parrafo(texto('Alineado')), textAlign)))).toBe(false);
      expect(esValido(doc(alineado(titulo(2, texto('Alineado')), textAlign)))).toBe(false);
    },
  );

  it.each([null, 1, true])('rechaza textAlign %j (no es un texto de la lista)', (textAlign) => {
    expect(esValido(doc(conAttrs(parrafo(texto('Alineado')), { textAlign })))).toBe(false);
  });

  it('una cita no admite textAlign (ni en sus attrs ni en su párrafo)', () => {
    const enAttrs = conAttrs(cita({}, texto('Cita')), { textAlign: 'center' });
    const enElParrafo: NodoPrueba = {
      ...cita({}, texto('Cita')),
      content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [texto('Cita')] }],
    };

    expect(esValido(doc(enAttrs))).toBe(false);
    expect(esValido(doc(enElParrafo))).toBe(false);
  });

  it('un ítem de lista no admite textAlign (ni la lista, ni el ítem, ni su párrafo)', () => {
    const enLaLista = conAttrs(vinetas(item(texto('Uno'))), { textAlign: 'center' });
    const enElItem = vinetas({ ...item(texto('Uno')), attrs: { textAlign: 'center' } });
    const enElParrafo = numerada({
      type: 'listItem',
      content: [{ type: 'paragraph', attrs: { textAlign: 'right' }, content: [texto('Uno')] }],
    });

    expect(esValido(doc(enLaLista))).toBe(false);
    expect(esValido(doc(enElItem))).toBe(false);
    expect(esValido(doc(enElParrafo))).toBe(false);
  });

  it.each([
    ['codeBlock', () => codigo('const a = 1;')],
    ['horizontalRule', () => separador()],
    ['imagen', () => nodo.imagen(imagenDePrueba('a', 'Alt'))],
    ['galeria', () => nodo.galeria(2, imagenDePrueba('a', 'A'), imagenDePrueba('b', 'B'))],
    ['cta', () => nodo.cta({ titulo: 'Hola', etiquetaBoton: 'Ir', url: '/contacto' })],
    ['video', () => nodo.video('youtube', 'dQw4w9WgXcQ', 'Un video')],
  ])('RF-024: %s no admite textAlign', (_tipo, armar) => {
    expect(esValido(doc(conAttrs(armar(), { textAlign: 'center' })))).toBe(false);
  });
});

describe('Fase 13 (Historia 7): nodo table en esquemaDocumento (T133)', () => {
  const tablaValida3x3 = () =>
    tabla(
      undefined,
      fila(
        encabezado(undefined, parrafoSimple(texto('Col 1'))),
        encabezado(undefined, parrafoSimple(texto('Col 2'))),
        encabezado(undefined, parrafoSimple(texto('Col 3'))),
      ),
      fila(
        celda(undefined, parrafoSimple(texto('Dato 1'))),
        celda(undefined, parrafoSimple(texto('Dato 2'))),
        celda(undefined, parrafoSimple(texto('Dato 3'))),
      ),
      fila(
        celda(undefined, parrafoSimple(texto('Dato 4'))),
        celda(undefined, parrafoSimple(texto('Dato 5'))),
        celda(undefined, parrafoSimple(texto('Dato 6'))),
      ),
    );

  it('acepta una tabla válida 3x3 con encabezados', () => {
    expect(esValido(doc(tablaValida3x3()))).toBe(true);
  });

  it('acepta una tabla con descripción válida (1 a 150 caracteres)', () => {
    const t = tabla(
      { descripcion: 'Precios de suscripción por mes' },
      fila(encabezado(undefined, parrafoSimple(texto('Plan')))),
      fila(celda(undefined, parrafoSimple(texto('Básico')))),
    );
    expect(esValido(doc(t))).toBe(true);
  });

  it('rechaza descripción vacía o de más de 150 caracteres', () => {
    const vacia = tabla({ descripcion: '' }, fila(celda(undefined, parrafoSimple(texto('A')))));
    const muyLarga = tabla({ descripcion: letras(151) }, fila(celda(undefined, parrafoSimple(texto('A')))));
    expect(esValido(doc(vacia))).toBe(false);
    expect(esValido(doc(muyLarga))).toBe(false);
  });

  it('rechaza atributos desconocidos en table (estricto)', () => {
    const conExtra = {
      ...tablaValida3x3(),
      attrs: { ...tablaValida3x3().attrs, estilo: 'bordes' },
    };
    expect(esValido(doc(conExtra))).toBe(false);
  });

  it('rechaza una tabla sin filas o con más de 50 filas', () => {
    const sinFilas = tabla(undefined);
    expect(esValido(doc(sinFilas))).toBe(false);

    const con51Filas = tabla(
      undefined,
      ...Array.from({ length: 51 }, () => fila(celda(undefined, parrafoSimple(texto('A'))))),
    );
    expect(esValido(doc(con51Filas))).toBe(false);
  });

  it('las celdas no admiten textAlign en sus párrafos', () => {
    const conAlineacion = tabla(
      undefined,
      fila(celda(undefined, { type: 'paragraph', attrs: { textAlign: 'center' }, content: [texto('Centrado')] })),
    );
    expect(esValido(doc(conAlineacion))).toBe(false);
  });

  it('las celdas admiten múltiples párrafos y celdas vacías', () => {
    const multilineayVacia = tabla(
      undefined,
      fila(
        celda(undefined, parrafoSimple(texto('Párrafo 1')), parrafoSimple(texto('Párrafo 2'))),
        celda(undefined, parrafoSimple()), // celda vacía
      ),
    );
    expect(esValido(doc(multilineayVacia))).toBe(true);
  });

  it('rechaza celdas con más de 1000 caracteres sumando todos sus párrafos', () => {
    const texto500 = letras(500);
    const texto501 = letras(501);
    const exceso = tabla(
      undefined,
      fila(celda(undefined, parrafoSimple(texto(texto500)), parrafoSimple(texto(texto501)))),
    );
    expect(esValido(doc(exceso))).toBe(false);
  });

  it('colspan y rowspan deben ser >= 2 cuando están presentes (1 se quita al normalizar)', () => {
    const conUno = tabla(undefined, fila(celda({ colspan: 1 }, parrafoSimple(texto('A')))));
    expect(esValido(doc(conUno))).toBe(false);

    const conCero = tabla(undefined, fila(celda({ colspan: 0 }, parrafoSimple(texto('A')))));
    expect(esValido(doc(conCero))).toBe(false);
  });

  it('rechaza colwidth en celdas (el sitio y el editor no lo guardan)', () => {
    const conColwidth = {
      ...tablaValida3x3(),
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colwidth: [100, 200] },
              content: [parrafoSimple(texto('A'))],
            },
          ],
        },
      ],
    };
    expect(esValido(doc(conColwidth))).toBe(false);
  });

  it('tableHeader solo puede estar en la primera fila', () => {
    const headerEnSegundaFila = tabla(
      undefined,
      fila(celda(undefined, parrafoSimple(texto('A')))),
      fila(encabezado(undefined, parrafoSimple(texto('B')))),
    );
    expect(esValido(doc(headerEnSegundaFila))).toBe(false);
  });

  it('tableHeader no puede tener rowspan >= 2 (no puede combinar encabezado con cuerpo)', () => {
    const headerConRowspan = tabla(
      undefined,
      fila(encabezado({ rowspan: 2 }, parrafoSimple(texto('A'))), encabezado(undefined, parrafoSimple(texto('B')))),
      fila(celda(undefined, parrafoSimple(texto('C')))),
    );
    expect(esValido(doc(headerConRowspan))).toBe(false);
  });

  it('rechaza cuadrículas irregulares (filas con distinto número de columnas)', () => {
    const irregular = tabla(
      undefined,
      fila(celda(undefined, parrafoSimple(texto('A'))), celda(undefined, parrafoSimple(texto('B')))),
      fila(celda(undefined, parrafoSimple(texto('C')))), // solo 1 columna
    );
    expect(esValido(doc(irregular))).toBe(false);
  });

  it('la tabla cuenta como un elemento dentro del límite de 200', () => {
    const elementos200 = Array.from({ length: 199 }, () => parrafo(texto('P')));
    const con200 = doc(...elementos200, tablaValida3x3());
    expect(esValido(con200)).toBe(true);

    const elementos201 = Array.from({ length: 200 }, () => parrafo(texto('P')));
    const con201 = doc(...elementos201, tablaValida3x3());
    expect(esValido(con201)).toBe(false);
  });
});

describe('esquemaDocumento: el corpus de documentos canónicos es válido', () => {
  it.each(CORPUS_DOCUMENTOS.map(({ nombre, documento }) => [nombre, documento] as const))(
    'el documento "%s" pasa el esquema',
    (_nombre, documento) => {
      expect(mensajes(documento)).toEqual([]);
    },
  );
});
