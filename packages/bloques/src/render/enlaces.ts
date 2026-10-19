// Destinos de enlace permitidos en los bloques (spec 002, RF-003): rutas internas, http(s) y
// mailto. Cualquier otro valor se muestra como texto, aunque una validación anterior lo
// hubiera dejado pasar.

/** El destino limpio si es seguro, o null. `//host` no cuenta como interno. */
export function hrefSeguro(url: string | undefined | null): string | null {
  const limpio = url?.trim();
  if (!limpio) return null;
  if (/^\/(?!\/)/.test(limpio) || /^https?:\/\//i.test(limpio) || /^mailto:/i.test(limpio)) return limpio;
  return null;
}

/** Externo: se abre en otra pestaña con rel="noopener noreferrer" (H1-E6). */
export const esExterno = (href: string) => /^https?:\/\//i.test(href);

/** Atributos de un enlace según su destino. */
export const atributosEnlace = (href: string) =>
  esExterno(href) ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href };

/** Enlaces dentro del texto: subrayados para no depender solo del color (WCAG 1.4.1). */
export const CLASE_ENLACE = 'underline decoration-marca underline-offset-4 hover:decoration-2';
