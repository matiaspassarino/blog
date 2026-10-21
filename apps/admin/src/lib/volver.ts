// Destino tras el ingreso (H1-E4): solo rutas internas, para que `?volver=` no sea una redirección abierta.

const PREDETERMINADA = '/articulos';

/** Devuelve `valor` si es una ruta interna segura; si no, la lista de artículos. */
export function rutaInterna(valor: string | null | undefined): string {
  if (!valor || valor.trim() === '') return PREDETERMINADA;
  // Debe empezar con una sola "/" (no "//", ni "/\" que algunos navegadores tratan como "//").
  if (!valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) return PREDETERMINADA;
  // Sin caracteres de control (saltos de línea, nulo): evitan inyectar cabeceras.
  if (/[\u0000-\u001f\u007f]/.test(valor)) return PREDETERMINADA;
  return valor;
}
