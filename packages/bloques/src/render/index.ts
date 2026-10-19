// Renderers de bloques compartidos (specs/002-sitio-publico/contracts/bloques-render.md):
// React puro y síncrono, se renderizan en el servidor sin hidratar. Subpath aparte para que
// quien solo valida (`@blog/bloques`) no arrastre React.
export { Bloques } from './Bloques';
export type { ComponentesBloques, PropsImagen } from './tipos';
