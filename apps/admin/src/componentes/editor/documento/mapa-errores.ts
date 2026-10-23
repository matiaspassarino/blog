// Los errores de validación traen el `id` de su elemento (`ErrorElemento.id`, contracts/documento.md "Errores"): el
// editor los marca por `id`, no por posición (research D6).
import type { Documento, ErrorElemento } from '@blog/bloques';

/** Errores agrupados por el `id` del elemento; ignora los del documento o la imagen destacada y los obsoletos. */
export function erroresPorId(documento: Documento, errores: ErrorElemento[]): Map<string, ErrorElemento[]> {
  const ids = new Set(documento.content.map((elemento) => elemento.attrs.id));
  const mapa = new Map<string, ErrorElemento[]>();
  for (const error of errores) {
    if (error.indice >= 0 && ids.has(error.id)) mapa.set(error.id, [...(mapa.get(error.id) ?? []), error]);
  }
  return mapa;
}

/** El error del elemento que aparece antes en el documento; de un mismo elemento, el primero recibido. */
export function primerErrorDelDocumento(
  documento: Documento,
  errores: ErrorElemento[],
): { id: string; error: ErrorElemento } | null {
  const porId = erroresPorId(documento, errores);
  const elemento = documento.content.find((actual) => porId.has(actual.attrs.id));
  const error = elemento ? porId.get(elemento.attrs.id)?.[0] : undefined;
  return elemento && error ? { id: elemento.attrs.id, error } : null;
}
