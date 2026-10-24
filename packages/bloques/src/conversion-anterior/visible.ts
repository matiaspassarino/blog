// Lo que mostraba el sitio con el formato anterior (research D26 y D31 C2), sin JSX: la verificación de pérdida del
// script compara esto con `visibleDeDocumento` del documento convertido. Lee los bloques con la gramática en línea
// anterior (`analizarEnLinea`), no con la conversión: si la conversión perdiera algo, no se ocultaría a sí misma.
import { anclasDeTitulos, limpiar, visibleDeDocumento, type Visible } from '../elementos';
import { hrefSeguro } from '../render/enlaces';
import { bloqueADocumento } from './conversion';
import { analizarEnLinea, type NodoEnLinea } from './en-linea';
import type { Bloque, Contenido } from './esquema-bloques';
import { partirParrafos } from './parrafos';

const textoDeNodos = (nodos: NodoEnLinea[]): string =>
  nodos.map((nodo) => ('hijos' in nodo ? textoDeNodos(nodo.hijos) : nodo.texto)).join('');

/** Cada enlace del texto es su propio `<a>` (el renderer anterior no unía enlaces seguidos). */
function enlacesDeNodos(nodos: NodoEnLinea[]): Visible['enlaces'] {
  return nodos.flatMap((nodo): Visible['enlaces'] => {
    if (!('hijos' in nodo)) return [];
    const href = nodo.tipo === 'enlace' ? hrefSeguro(nodo.href) : null;
    return href ? [{ href, texto: limpiar(textoDeNodos(nodo.hijos)) }] : enlacesDeNodos(nodo.hijos);
  });
}

/** Un texto con la gramática en línea anterior: su texto visible y sus enlaces. */
function enLinea(texto: string) {
  const nodos = analizarEnLinea(texto);
  return { texto: textoDeNodos(nodos), enlaces: enlacesDeNodos(nodos) };
}

/** Lo que el renderer de bloques mostraba de un contenido (el formato de `pruebas/salida-anterior.json`). */
export function visibleDeBloques(contenido: Contenido): Visible {
  const visible: Visible = { textos: [], anclas: [], imagenes: [], enlaces: [] };
  const titulos = contenido.filter((bloque): bloque is Extract<Bloque, { tipo: 'titulo' }> => bloque.tipo === 'titulo');
  const anclas = anclasDeTitulos(titulos.map(({ id, texto }) => ({ id, texto })));
  for (const bloque of contenido) {
    switch (bloque.tipo) {
      case 'parrafo':
        // Un `<p>` por tramo visible; cada línea se lee por separado y el salto simple es un `<br>`.
        for (const tramo of partirParrafos(bloque.texto).filter((actual) => actual.texto.trim() !== '')) {
          const lineas = tramo.texto.split('\n').map(enLinea);
          visible.textos.push(limpiar(lineas.map((linea) => linea.texto).join(' ')));
          visible.enlaces.push(...lineas.flatMap((linea) => linea.enlaces));
        }
        break;
      case 'titulo': {
        visible.textos.push(limpiar(bloque.texto));
        const ancla = anclas.get(bloque.id);
        if (ancla) visible.anclas.push(ancla);
        break;
      }
      case 'cita': {
        const cita = enLinea(bloque.texto);
        const fuente = hrefSeguro(bloque.fuente);
        const { autor } = bloque;
        const pie =
          autor || fuente ? ` — ${autor ?? ''}${autor && fuente ? ', ' : ''}${fuente ? 'ver la fuente' : ''}` : '';
        visible.enlaces.push(...cita.enlaces);
        if (fuente) visible.enlaces.push({ href: fuente, texto: 'ver la fuente' });
        visible.textos.push(limpiar(cita.texto + pie));
        break;
      }
      case 'lista': {
        const items = bloque.items.map(enLinea);
        visible.textos.push(limpiar(items.map((item) => item.texto).join(' ')));
        visible.enlaces.push(...items.flatMap((item) => item.enlaces));
        break;
      }
      default: {
        // Los elementos sin texto en línea (código, separador, imagen, galería, llamada a la acción y video) se
        // dibujaban con los mismos componentes de hoy, campo por campo.
        const parte = visibleDeDocumento({ type: 'doc', content: bloqueADocumento(bloque) } as never);
        visible.textos.push(...parte.textos);
        visible.imagenes.push(...parte.imagenes);
        visible.enlaces.push(...parte.enlaces);
      }
    }
  }
  return visible;
}
