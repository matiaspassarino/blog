/**
 * `id` legible para el ancla de un título ("Cómo empezar: el diseño" → "como-empezar-el-diseno").
 * No es un slug de entidad: esos los genera solo la base (privado.slugificar, research D10 de
 * la 001). Este solo vive en el HTML del artículo.
 */
export function anclaDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
