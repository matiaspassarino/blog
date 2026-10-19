# Contrato: renderers de bloques (`@blog/bloques/render`)

**Decisión**: research D5. Son componentes React **puros y síncronos**: no tienen hooks ni efectos. Se renderizan en el servidor sin hidratar.

## API

```ts
// packages/bloques/src/render/index.ts → export desde '@blog/bloques/render'
export type PropsImagen = { imagen: Imagen; sizes: string; prioridad?: boolean };
export type ComponentesBloques = { Imagen: (p: PropsImagen) => ReactNode };
export function Bloques(props: { contenido: Contenido; componentes: ComponentesBloques }): ReactNode;
```

- Se publica como subpath `./render` en `package.json`. Así el esquema (`.`) no arrastra React para quien solo valida.
- La implementación por defecto de `Imagen` en `apps/web` es `ImagenWeb`. Recibe el mapa de variantes precalculado (research D7) por un *closure*: `crearImagenWeb(variantes)`.

## Salida HTML por tipo

| Tipo | HTML | Reglas |
|---|---|---|
| `parrafo` | `<p>` | Texto plano escapado. Los saltos de línea dobles separan párrafos y los simples se convierten en `<br>`. |
| `titulo` | `<h2>`, `<h3>` o `<h4>` según `nivel` | con `id` = slug del texto, para enlazar anclas |
| `imagen` | `<figure>` + `Imagen` + `<figcaption>` si hay leyenda | Si es decorativa, `alt=""` y sin leyenda accesible. |
| `cita` | `<figure><blockquote cite?>…</blockquote><figcaption>— autor, <a fuente></figcaption></figure>` | — |
| `lista` | `<ol>` o `<ul>` | — |
| `galeria` | `<ul role="list">` en grilla de `columnas` (2, 3 o 4) desde 768 px, y de 1 o 2 columnas en móvil | Cada imagen es un `<li>`. |
| `cta` | `<aside>` con título, texto y `<a class=boton>` | `url` interna: `<a href>`. Externa (`http:` o `https:`): `rel="noopener noreferrer"` y `target="_blank"`, con un aviso para lectores de pantalla ("se abre en otra pestaña"). |
| `separador` | `<hr>` | — |
| `codigo` | `<figure><pre tabindex="0"><code data-lenguaje>…</code></pre><figcaption>lenguaje</figcaption></figure>` | Texto escapado, sin resaltado (D5). `tabindex` permite desplazarse con el teclado. |
| `video` | `<figure><iframe title srcdoc loading="lazy" allow…>` + enlace "Ver en …" | research D6 |
| desconocido | nada (`null`) + `console.warn` | La página no se rompe. |

## Garantías (con tests en `packages/bloques/src/render/*.test.tsx`, `renderToStaticMarkup`)

- Ningún texto produce etiquetas: si un párrafo contiene `<script>`, la salida tiene `&lt;script&gt;`. Una regla de ESLint del paquete prohíbe `dangerouslySetInnerHTML`.
- Solo se emiten `href` con estos esquemas (RF-003): `/` interno, `http:`, `https:` y `mailto:`. Cualquier otro valor, aunque lo hubiera dejado pasar una validación anterior, se renderiza como texto, no como enlace.
- El orden de salida es el del arreglo.
- Las clases son utilidades de Tailwind sobre tokens. No hay colores ni medidas literales (constitución §VII.2).
