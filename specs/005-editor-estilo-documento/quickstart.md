# Guía de validación: Editor de notas estilo documento

**Rama**: `005-editor-estilo-documento` | Contratos: [documento](contracts/documento.md) · [componentes](contracts/componentes.md) · [atajos](contracts/atajos.md) | Modelo: [data-model.md](data-model.md)

Guía para comprobar de punta a punta que la feature funciona. No contiene código de implementación.

## Requisitos previos

Los mismos de la spec 004 ([quickstart](../004-jerarquia-visual-panel/quickstart.md#requisitos-previos)): Node 24, pnpm 12, Docker en marcha, Supabase CLI 2.121 y los `.env.local` de `apps/admin` y `apps/web`. La feature tiene **una migración** (`20261023120000_contenido_documento.sql`) y suma extensiones de Tiptap (`pnpm install`).

## Puesta en marcha

```bash
pnpm install
pnpm db:start && pnpm db:reset      # migración + seed ya en el formato nuevo
pnpm db:tipos                       # después de la migración; commitear packages/db/src/tipos.ts
pnpm dev                            # web :4321 y admin :3100
```

Usuarios de demo: `admin@demo.local` / `demo-admin-2026`, `editora@demo.local` / `demo-editora-2026`.

**Una base local con datos propios** (no la del seed): exportar los artículos y convertirlos con el script, igual que en la nube (ver "Corte en la nube", pasos 2 y 4), aplicando la migración y el SQL de la conversión en una sola ejecución de `psql -1` contra `127.0.0.1:56322`.

## Verificación automática

| Comando | Qué cubre |
|---|---|
| `pnpm lint && pnpm typecheck` | tipos del documento, del renderer y del editor |
| `pnpm test` | lista permitida, normalización, cuadrícula de tablas, conversión y su verificación, caracterización del sitio, renderer, contrato de las extensiones, comandos, pegado y filtro del menú (Vitest de `apps/admin` y `@blog/db` en serie) |
| `pnpm test:db` | forma mínima del documento, requisito de publicación, búsqueda con tablas, conversión sin avisos ni cambio de versión, privilegios |
| `pnpm exec playwright test --project=admin --workers=1` | `editor-documento.spec.ts`, `editor-tablas.spec.ts` y los flujos de las specs 003 y 004 adaptados (CE-005) |
| `pnpm exec playwright test --project=web` | el sitio con formatos, alineación y tablas, y la regresión del resto |
| `pnpm calidad && pnpm build` | jscpd ≤ 3 %, knip y compilación |

En una PC con 8 GB de RAM conviene usar el *build* del admin (`pnpm --filter admin build && pnpm --filter admin exec next start -p 3100`) y `--workers=1`.

## Recorrido manual

### A. Escribir como en un documento (Historia 1)
1. Abrir un artículo nuevo: hay un párrafo vacío y la barra arriba; no hay «Agregar bloque».
2. Escribir un título con la barra (Título 2), dos párrafos, una palabra en negrita (barra y `Mod+B`), una lista y una cita. El formato se ve aplicado y tiene la tipografía del sitio.
3. En una línea vacía escribir `/tit` y elegir con las flechas y Enter; Esc cierra el menú sin cambios.
4. Retroceso en un párrafo vacío lo quita y el cursor pasa al anterior; Enter en un ítem vacío sale de la lista.

### B. Elementos especiales y panel (Historia 2)
1. «Insertar» (y `/`) ofrece imagen, galería, llamada a la acción, video, código, separador y tabla.
2. Insertar una imagen, subir un archivo y completar el texto alternativo **en el panel**; el lienzo muestra la imagen como en el sitio.
3. Con 1280 px o más el panel es la pestaña «Elemento» (con «Publicación» siempre visible); por debajo, una hoja inferior que se abre con «Propiedades» o con `Enter` en modo elementos y se cierra con «Cerrar» y `Esc`.
4. Dejar la imagen sin texto alternativo y guardar: el elemento muestra el error con texto, se selecciona y el panel enfoca el campo.

### C. Mover, duplicar, quitar y seleccionar varios (Historia 3)
1. Arrastrar el asa de un elemento (ratón); con el dedo, usar «Acciones» o el modo elementos.
2. Con el teclado: `Esc` entra al modo elementos; `Alt+↑/↓`, `Mod+D` y `Supr` dan el mismo resultado que el menú «Acciones».
3. Seleccionar tres elementos con `Shift+↓` y moverlos, duplicarlos o quitarlos juntos; un solo Deshacer los devuelve.

### D. Atajos, pegado y deshacer (Historia 4)
1. `## Mi título` al comienzo de una línea se convierte en título; Deshacer lo deja como texto.
2. Pegar texto de un documento con colores, tipografías, subrayado y una alineación al centro: quedan el subrayado y la alineación, no los colores ni las tipografías.
3. Pegar una tabla de una hoja de cálculo (4 × 3): se crea una tabla. Pegar una de 12 columnas: se pega como texto y se avisa.
4. `Mod+Z` revierte texto, formato, tablas y acciones sobre elementos en orden.

### E. Nada se pierde (Historia 5)
1. Después de `pnpm db:reset`, abrir y guardar sin tocar cada artículo del seed: no sube la versión.
2. Correr las pruebas de la conversión (`pnpm --filter @blog/bloques test`): el corpus y el seed anterior se convierten sin pérdida y la caracterización del sitio coincide.
3. Cambios sin guardar, conflicto con otra pestaña, subida en curso y publicación de un artículo sin contenido (o con una tabla vacía) se comportan como en la spec 003.
4. En 360 px la barra se reacomoda con «Más», los controles miden al menos 44 × 44 px y «Insertar» se alcanza sin escribir `/`.

### F. Más formato y alineación (Historia 6)
1. Subrayar (`Mod+U`), tachar y resaltar («Más formato»), y escribir «m2» con el 2 en superíndice (`Mod+.`).
2. Con código en línea activo, los demás formatos aparecen no disponibles con la razón.
3. Centrar un título y justificar un párrafo con el menú «Alineación»; en una lista o una cita el menú no se ofrece.
4. Guardar, abrir la vista previa y el sitio: se ve igual; el subrayado no parece un enlace (color del texto, sin efecto al pasar el puntero).

### G. Tablas (Historia 7)
0. Al entrar a una tabla se anuncia "Tabla. Esc para salir" y la barra «Tabla» lo muestra; `Esc` → `Shift+Tab` llega a la barra «Tabla» con la última celda recordada.
1. Insertar una tabla (3 × 3 con encabezado); Tab avanza de celda y en la última agrega una fila; Enter en una celda crea un párrafo dentro de ella.
2. Seleccionar dos celdas contiguas (ratón o `Shift+→`) y combinarlas; separarlas; intentar combinar una celda del encabezado con una del cuerpo: no se permite y se explica.
3. Agregar y quitar filas y columnas desde la barra contextual y desde el panel; llegar a 10 columnas: se avisa del máximo.
4. A 360 px: solo se escribe en las celdas y se ve el texto que explica por qué; «Quitar tabla» sigue disponible. A 768 px con el dedo, «Combinar con la celda de la derecha» y «… de abajo» funcionan sin seleccionar.
4b. Con el cursor en una celda, estilo de párrafo, listas, alineación e «Insertar» aparecen no disponibles con la razón.
5. En el sitio, a 360 px, la tabla se desplaza dentro de su recuadro (se alcanza con Tab), sin desplazamiento horizontal de la página; un lector de pantalla anuncia la descripción y los encabezados.
6. Buscar una palabra que solo está en una celda: el artículo aparece en los resultados (`buscar_articulos`).

## Accesibilidad y rendimiento

- Lighthouse (solo Accesibilidad, ≥ 95) en el editor en 360, 768, 1024 y 1440 px (CE-004), con el procedimiento de la spec 003 (T103).
- Lighthouse del sitio en móvil sobre el artículo del seed con tablas y formatos (SEO ≥ 95, Rendimiento ≥ 90, Accesibilidad ≥ 95; CE-009).
- NVDA si es posible: barra, menú `/`, «Más formato», alineación, una tabla (entrar, moverse entre celdas, combinar con teclado y salir con `Esc`).
- Rendimiento: menú `/` e «Insertar» en menos de 200 ms con 50 elementos (CE-006); escritura con 200 elementos; peso del editor con las tablas frente al tope de 250 KB gzip. Anotar todo en `validacion.md`.

## Corte en la nube

Al cerrar la spec (RF-030), con `/validar` aprobado y el CI en verde. Antes de cada SQL, verificar que la URL del proyecto tenga `kgavzwzlhbzjkvreqhbu` (en la organización está también "Indy sur").

1. **Aviso**: avisar a quienes usan el panel de producción que durante unos minutos no se puede guardar.
2. **Exportar y convertir**: en el SQL Editor (o con el MCP), `select json_agg(json_build_object('id', id, 'version', version, 'contenido', contenido)) from public.articulos;`, guardar el resultado como JSON y correr `pnpm --filter @blog/bloques convertir-contenido --entrada articulos-nube.json --salida conversion-nube.sql`. Si informa un artículo que no pasa la verificación, corregirlo (en producción, con el panel viejo) y volver a exportar. Los dos archivos **no** se commitean.
3. **Programados**: comprobar que ninguno vence en la próxima hora (`select … where estado = 'programado' and programado_para < now() + interval '1 hour'`) y pausar el job: `select cron.alter_job(jobid, active := false) from cron.job where jobname = 'publicar-programados';`. Comprobar `select tableowner from pg_tables where schemaname = 'public' and tablename = 'articulos';` (debe dar `postgres`).
4. **Migración y conversión juntas**: pegar en **una sola ejecución** del SQL Editor el contenido de `20261023120000_contenido_documento.sql` seguido del de `conversion-nube.sql` (el editor corre todo en una transacción). Si falla, no cambió nada: revisar el mensaje y volver al paso 2. Después, `select conname, convalidated from pg_constraint where conrelid = 'public.articulos'::regclass;` (los dos checks en `true`). Desde este momento el panel viejo no puede guardar contenido.
5. **Limpieza**: pushear el último commit, que elimina el script, `conversion-anterior/`, `corpus-contenido.ts`, la caracterización, `conversion.test.sql` y sus *fixtures*, y correr el grep de cierre (`tipos_bloque|esquemaBloque|analizarEnLinea|continuacion|\u200b`, sin resultados).
6. **Merge**: mergear el PR; Vercel despliega el sitio y el panel. Reactivar el job (`active := true`).
7. **Comprobación** (CE-010): abrir los artículos publicados de producción y comparar con lo que se veía antes (texto, encabezados, imágenes y enlaces); abrir uno en el panel y guardarlo sin tocar (no sube la versión); revisar los advisors de Supabase y anotar en `validacion.md` la fecha, la cantidad de filas convertidas y el resultado de `convalidated`; en `CLAUDE.md`, sumar la migración a la lista de las aplicadas sin registro en el historial (o registrarla con `supabase migration repair`).

## Prueba con personas

CE-001 y CE-007: con 3 a 5 personas que escriben habitualmente en procesadores de texto, pedir una nota con un título, formato, una lista, una tabla y una imagen, sin explicar qué es un «bloque». Registrar tiempo y dudas en `validacion.md`.
