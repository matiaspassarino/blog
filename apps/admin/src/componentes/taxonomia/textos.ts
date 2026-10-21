// Textos y rutas de las dos pantallas de taxonomías: una sola implementación con la prop `tipo`.
export type Tipo = 'categoria' | 'etiqueta';

export const TEXTOS = {
  categoria: {
    titulo: 'Categorías',
    formulario: 'Nueva categoría',
    crear: 'Crear categoría',
    singular: 'categoría',
    vacio: 'Todavía no hay categorías.',
  },
  etiqueta: {
    titulo: 'Etiquetas',
    formulario: 'Nueva etiqueta',
    crear: 'Crear etiqueta',
    singular: 'etiqueta',
    vacio: 'Todavía no hay etiquetas.',
  },
} as const satisfies Record<Tipo, object>;

/** "1 artículo" / "2 artículos". */
export const cuentaDeArticulos = (n: number) => `${n} ${n === 1 ? 'artículo' : 'artículos'}`;
