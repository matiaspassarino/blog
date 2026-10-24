// Renderer del documento compartido (specs/002-sitio-publico/contracts/bloques-render.md, spec 005): React puro y
// síncrono, se renderiza en el servidor sin hidratar. Subpath aparte para que quien solo valida (`@blog/bloques`)
// no arrastre React.
export { Documento } from './Documento';
export { Tabla } from './Tabla';
export type { ComponentesDocumento, PropsImagen } from './tipos';
export * from './clases';
export { CLASE_ENLACE } from './enlaces';
