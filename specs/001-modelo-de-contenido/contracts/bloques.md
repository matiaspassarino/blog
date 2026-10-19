# Contrato: `@blog/bloques`

Es la fuente única del esquema de contenido (constitución §VI). La importan `apps/admin` (editor y validación en el servidor), `apps/web` (render) y `packages/db` (tipos).

## Exportaciones

```ts
export const TIPOS_BLOQUE: readonly ['parrafo','titulo','imagen','cita','lista','galeria','cta','separador','codigo','video'];
export type TipoBloque = (typeof TIPOS_BLOQUE)[number];

export const esquemaImagen: ZodType<Imagen>;
export const esquemaBloque: ZodDiscriminatedUnion<'tipo', ...>;
export const esquemaContenido: ZodArray<typeof esquemaBloque>;   // máx. 200 bloques

export type Imagen = z.infer<typeof esquemaImagen>;
export type Bloque = z.infer<typeof esquemaBloque>;
export type BloqueDe<T extends TipoBloque> = Extract<Bloque, { tipo: T }>;
export type Contenido = Bloque[];

export type ErrorBloque = { indice: number; campo: string; mensaje: string };
export function validarContenido(entrada: unknown):
  | { ok: true; contenido: Contenido }
  | { ok: false; errores: ErrorBloque[] };

export function textoPlano(contenido: Contenido): string;          // para extractos y lectura estimada
export function crearBloque<T extends TipoBloque>(tipo: T): BloqueDe<T>; // valores por defecto para el editor
```

## Base común

Todo bloque tiene `{ id: string (uuid), tipo: TipoBloque }`. El `id` da estabilidad al reordenar en el editor.

## Tipos de bloque

| `tipo` | Campos (✱ obligatorio) | Reglas |
|---|---|---|
| `parrafo` | `texto`✱ | 1–5.000 caracteres, Markdown inline (D9) |
| `titulo` | `nivel`✱ (2, 3 o 4), `texto`✱ | texto de 1–150 caracteres |
| `imagen` | `imagen`✱ (Imagen), `leyenda` | leyenda ≤ 300 |
| `cita` | `texto`✱, `autor`, `fuente` | texto ≤ 1.000; `fuente` es una URL `https` |
| `lista` | `ordenada`✱ (bool), `items`✱ | 1–50 items de 1–500 caracteres, Markdown inline |
| `galeria` | `imagenes`✱ (Imagen[]), `columnas` (2, 3 o 4; por defecto 3) | 2–24 imágenes |
| `cta` | `titulo`✱, `texto`, `etiquetaBoton`✱, `url`✱, `variante` (`primaria` o `secundaria`) | etiqueta de 1–40; `url` interna (`/…`) o `https` |
| `separador` | — | — |
| `codigo` | `codigo`✱, `lenguaje` | código ≤ 20.000; `lenguaje` coincide con `^[a-z0-9+#-]{1,20}$` |
| `video` | `proveedor`✱ (`youtube` o `vimeo`), `idVideo`✱, `titulo`✱ | `idVideo` validado por proveedor; `titulo` para accesibilidad |

**Imagen**: `{ ruta✱, ancho✱ (int > 0), alto✱ (int > 0), alt, decorativa (bool, por defecto false) }`. `alt` es obligatorio (1–200) salvo que `decorativa = true`.

## Errores

`validarContenido` nunca lanza. Devuelve todos los errores, con `indice` (posición del bloque, base 0) y `campo` como ruta con puntos (`imagen.alt`, `items.3`). Los mensajes están en español y son accionables: "La imagen necesita un texto alternativo o marcarse como decorativa".

## Invariante con la base

`TIPOS_BLOQUE` debe ser igual a `privado.tipos_bloque()`. Lo verifica un test de integración en `packages/db`.

## Supuestos de interpretación (fijados por los tests de H1)

- `cta.url`: es interna si empieza con `/` **pero no** con `//`. Las demás tienen que ser `https://`.
- `video.idVideo`: YouTube `^[A-Za-z0-9_-]{11}$`; Vimeo solo dígitos. Se valida según el `proveedor`.
- `textoPlano`: quita las marcas inline y las URLs de los enlaces, conserva el texto del código inline (sin los backticks) y omite los bloques `codigo`.
- `crearBloque('titulo')` devuelve `nivel: 2` por defecto.
- Los mensajes de error son propios y están en español. No se usan los mensajes por defecto de Zod en inglés.

