# Guía de validación: Editor de notas estilo documento

**Rama**: `005-editor-estilo-documento` | Contratos: [componentes](contracts/componentes.md) · [documento](contracts/documento.md) · [atajos](contracts/atajos.md) | Modelo: [data-model.md](data-model.md)

Guía para comprobar de punta a punta que la feature funciona. No contiene código de implementación.

## Requisitos previos

Los mismos de la spec 004 ([quickstart](../004-jerarquia-visual-panel/quickstart.md#requisitos-previos)): Node 24, pnpm 12, Docker en marcha, Supabase CLI 2.121 y los `.env.local` de `apps/admin` y `apps/web`. La feature no tiene migraciones. Se suma la dependencia Tiptap (`pnpm install`).

## Puesta en marcha

```bash
pnpm install
pnpm db:start && pnpm db:reset
pnpm dev                            # web :4321 y admin :3100
```

Usuarios de demo: `admin@demo.local` / `demo-admin-2026`, `editora@demo.local` / `demo-editora-2026`.

## Verificación automática

| Comando | Qué cubre |
|---|---|
| `pnpm lint && pnpm typecheck` | tipos del análisis en línea, la conversión y los componentes |
| `pnpm test` | análisis en línea y su ida y vuelta, salida idéntica del sitio, conversión de los diez tipos y del seed, comandos sobre el rango, reglas de entrada, pegado y filtro del menú |
| `pnpm exec playwright test --project=admin --workers=1` | `e2e/admin/editor-documento.spec.ts` y los flujos de la spec 003 y 004 adaptados (CE-005) |
| `pnpm exec playwright test --project=web` | regresión del sitio público (R1) |
| `pnpm calidad && pnpm build` | jscpd ≤ 3 %, knip (sin código muerto del editor anterior) y compilación |

En una PC con 8 GB de RAM conviene usar el *build* del admin (`pnpm --filter admin build && pnpm --filter admin exec next start -p 3100`) y `--workers=1`.

## Recorrido manual

### A. Escribir como en un documento (Historia 1)
1. Abrir un artículo nuevo: hay un párrafo vacío y la barra arriba; no hay «Agregar bloque».
2. Escribir un título con la barra (Título 2), dos párrafos, una palabra en negrita (barra y `Mod+B`), una lista y una cita. El formato se ve aplicado y tiene la tipografía del sitio.
3. En una línea vacía escribir `/tit` y elegir con las flechas y Enter; Esc cierra el menú sin cambios.
4. Retroceso en un párrafo vacío lo quita y el cursor pasa al anterior; Enter en un ítem vacío sale de la lista.

### B. Elementos especiales y panel (Historia 2)
1. «Insertar» (y `/`) ofrece imagen, galería, llamada a la acción, video, código y separador.
2. Insertar una imagen, subir un archivo y completar el texto alternativo **en el panel**; el lienzo muestra la imagen como en el sitio.
3. Con 1280 px o más el panel es la pestaña «Elemento» (con «Publicación» siempre visible); por debajo de 1280 px (por ejemplo 1024, 768 y 360 px) es una hoja inferior que se abre con «Propiedades» o con `Enter` en modo elementos, se cierra con «Cerrar» y `Esc` y no tapa el elemento.
4. Dejar la imagen sin texto alternativo y guardar: el elemento muestra el error con texto, se selecciona y el panel enfoca el campo.

### C. Mover, duplicar, quitar y seleccionar varios (Historia 3)
1. Arrastrar el asa de un elemento a otro lugar (ratón) y, en un teléfono o con emulación táctil, con el dedo; el desplazamiento de la página no inicia un arrastre.
2. Con el teclado: `Esc` entra al modo elementos y `Alt+↑/↓`, `Mod+D` y `Supr` dan el mismo resultado que el menú del botón «Acciones» de la barra; el movimiento se anuncia.
3. En modo elementos, ampliar la selección a tres elementos con `Shift+↓` y moverlos, duplicarlos o quitarlos juntos; un solo Deshacer los devuelve. «Convertir» no se ofrece. Un rango de texto que cruza párrafos no habilita mover ni quitar.

### D. Atajos, pegado y deshacer (Historia 4)
1. Escribir `## Mi título` al comienzo de una línea: se convierte en título; Deshacer lo deja como texto.
2. Pegar texto de un documento con colores y tipografías: solo quedan las cuatro marcas. Pegar un párrafo de más de 5000 caracteres: el sobrante pasa a párrafos nuevos y se anuncia.
3. `Mod+Z` revierte texto y acciones sobre elementos en el orden en que ocurrieron; después de «Reemplazar con la vigente» el historial está vacío.

### E. Nada se pierde (Historia 5)
1. Abrir y guardar sin tocar cada artículo del seed y uno con los diez tipos: el contenido guardado es idéntico y no sube la versión.
2. Abrir un artículo con un texto con `*`, `_`, `[` y comillas invertidas propios y guardarlo sin editar: se conservan.
3. Cambios sin guardar, conflicto con otra pestaña, subida en curso y publicación de un artículo sin bloques se comportan como en la spec 003.
4. En 360 px la barra se reacomoda con «Más», los controles miden al menos 44 × 44 px y «Insertar» se alcanza sin escribir `/`.

### F. Sitio público sin cambios (R1)
Abrir http://localhost:4321 y un artículo con negrita, cursiva, código y enlaces: se ve igual que en `main` (la prueba de caracterización del analizador lo garantiza; esta es la comprobación visual).

## Accesibilidad y rendimiento

- Lighthouse (solo Accesibilidad, ≥ 95) en el editor, en 360 y 768 px como móvil y en 1024 y 1440 px como escritorio (CE-004), con el procedimiento de la spec 003 (T103): sesión con Playwright, cookie por `--extra-headers` y medición sobre `next start`.
- NVDA: recorrer la barra, abrir el menú `/`, insertar un elemento, moverlo con el teclado y llegar al panel con el botón «Propiedades» o con `Enter` en modo elementos; todo se anuncia con el nombre y la posición de [atajos.md](contracts/atajos.md).
- Rendimiento: con un artículo de 50 elementos, el menú `/` y «Insertar» aparecen en menos de 200 ms (CE-006). Medir también el peso del editor y anotarlo en `validacion.md`.

## Prueba con personas

CE-001 y CE-007: con 3 a 5 personas que escriben habitualmente en procesadores de texto, pedir una nota con un título, formato, una lista y una imagen, sin explicar qué es un «bloque». Registrar tiempo y dudas en `validacion.md`.
