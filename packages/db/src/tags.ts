// Formato de los tags de caché del sitio público (specs/002-sitio-publico/contracts/cache.md).
// Fuente única: los usan invalidacionesDe (lo que se invalida) y apps/web (lo que declara
// cada página).

/** Colección: cualquier cambio de un artículo, una taxonomía o un autor la invalida. */
export const TAG_ARTICULOS = 'articulos';

export const tagArticulo = (id: string) => `articulo:${id}`;
export const tagCategoria = (id: string) => `categoria:${id}`;
export const tagEtiqueta = (id: string) => `etiqueta:${id}`;
export const tagAutor = (id: string) => `autor:${id}`;
