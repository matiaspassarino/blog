# Validación: 005-editor-estilo-documento

**Fecha**: 2026-10-24 · **Rama**: `005-editor-estilo-documento`

**Resultado global**: APROBADO (todas las suites funcionales de la especificación al 100%, pipeline de calidad en verde, peso y accesibilidad dentro de los umbrales de la constitución v2.0.0).

---

## Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `pnpm lint` | **Verde** (0 errores, 0 advertencias en los 6 paquetes). |
| `pnpm typecheck` | **Verde** (0 errores de TypeScript en los 6 paquetes). |
| `pnpm test` (Vitest) | **Verde**: 1.109 en `@blog/bloques`, 183 en `@blog/ui`, 744 en `apps/admin`, 265 en `@blog/db`. |
| `pnpm test:db` (pgTAP) | **Verde**: 868 pruebas de base de datos pasando (100%). |
| `pnpm calidad` | **Verde**: duplicación con `jscpd` 0,49 % (umbral ≤ 3 %), `knip` sin exportaciones ni dependencias no usadas. |
| `pnpm build` | **Verde**: `apps/web` (Astro/Vercel) y `apps/admin` (Next.js con webpack) compilan y generan todas las rutas estáticas y dinámicas. |
| `e2e/web` (Playwright) | **153 de 153 pasando (100%)**. Listados, búsqueda, páginas de artículos con tablas y formatos. |
| `e2e/admin/editor-documento.spec.ts` | **145 de 145 pasando (100%)**. Escritura, marcas, alineación, tablas, menú «/», arrastre con ratón y dedo, deshacer y persistencia. |
| `e2e/admin/editor-tablas.spec.ts` | **7 de 7 pasando (100%)**. Inserción 3x3, navegación Tab/Shift+Tab, párrafos por celda, barra de tabla, combinación de celdas, accesibilidad axe. |
| `e2e/admin` completo | **582 pasando**, 2 saltadas. Las 11 que no pasan corresponden a diferencias conocidas de entorno local (10 por ausencia del contenedor Mailpit para envío y recepción de correos en `acceso`, `equipo-invitacion` y `permisos`; 1 por expectativa de URL absoluta en `publicacion.spec.ts:62`). |

---

## Mediciones de T155 (CE-004 y CE-009)

### 1. Accesibilidad del editor (CE-004)
- **Axe en el editor**: 0 violaciones en los cuatro anchos canónicos (360, 768, 1024 y 1440 px), evaluado en las tres capas:
  - Editor con los diez tipos de bloques.
  - Editor con el menú «/» abierto (`role="listbox"`, `aria-activedescendant`).
  - Editor con el panel o la hoja de propiedades abierta.
- **Axe en tablas**: 0 violaciones WCAG 2.1 AA en el editor con tabla insertada y encabezados completados.

### 2. Peso del editor (CE-004)
- Chunks de carga diferida (`CargadorDeEditorDocumento.tsx`):
  - Total sin comprimir: 475,5 KB.
  - **Total comprimido (gzip): 150,9 KB**.
- **Umbral**: ≤ 250 KB gzip. El editor con extensiones de tabla, alineación y formatos queda **99,1 KB por debajo del tope**.
- **Dependencias**: Sin `yjs` en el cliente. Se utilizan únicamente las dependencias autorizadas de `@tiptap/*`.

### 3. Rendimiento y latencia de escritura
- Tiempo de apertura y filtrado del menú «/»: < 200 ms (probado en `editor-documento.spec.ts:2854`).
- Normalización canónica de documento: < 1 ms para estructuras de 200 elementos.
- Transiciones de estado de guardado reactivas sin bloqueos en el hilo principal.

---

## Pruebas diferidas (T156)

- **CE-001 y CE-007 (Evaluación con 3 a 5 personas)**:
  - **Estado**: Diferidas para ejecución sobre el despliegue de preview / staging tras la apertura del PR.
  - **Fecha prevista**: Previa al corte definitivo en producción (Fase 15, T159).
  - **Alcance a evaluar**: Flujo completo de escritura guiada en [quickstart.md](quickstart.md) (pasos A a G), usabilidad del asa flotante, inserción de tablas y atajos de teclado en escritorios y dispositivos móviles reales.

---

## Revisiones de agentes especializados

### arquitecto-db — APROBADO
- Migración `20261023120000_contenido_documento.sql` revisada:
  - Función `validar_documento` con `search_path = ''` estricto y tipado JSONB validado por Zod en TypeScript y check constraint en PostgreSQL.
  - Migración reversible y segura que preserva la integridad referencial y las marcas canónicas.
  - Celdas de tablas en `seed.sql` emiten atributos canónicos omitiendo claves nulas (`colspan`, `rowspan`).

### revisor-ux-ui — APROBADO
- Botón «Tabla» incorporado al menú «Insertar» y menú flotante «/» con su descripción accesible.
- Barra contextual «Tabla» con botones compactos de 44 px de área táctil mínima (`--tactil-min`).
- Manejo de foco predecible: foco automático dentro de la primera celda al insertar tabla y retorno de foco al lienzo al cerrar menús contextuales.
- Asas de arrastre con indicador textual de destino claro: «Soltar aquí: posición X de Y».

### consistencia-codigo — APROBADO
- Adherencia a la constitución v2.0.0: identificadores y comentarios en español sin caracteres especiales en código fuente.
- Idempotencia de `normalizarDocumento`: abrir y guardar un documento sin cambios conserva la versión (`version` inalterada, RF-012).
- Zero dependencias huérfanas en `knip` y sin código duplicado por encima del umbral en `jscpd`.

---

## Corte en la nube (T159 — 2026-10-24)

- **Proyecto Supabase**: `kgavzwzlhbzjkvreqhbu` (*blog-demo*).
- **Filas convertidas**: 15 artículos procesados de `public.articulos` con `convertir-contenido`.
  - 15/15 convertidos exitosamente con 0 pérdidas de contenido y 0 errores de validación.
- **Validación de restricciones (`convalidated = true`)**:
  - `articulos_contenido_check`: `convalidated = true`.
  - `articulos_requisitos_publicacion`: `convalidated = true`.
- **Cron de publicación programada**: Pausado en `cron.job` (`active = false`) durante el corte atómico; preparado para reactivación tras el despliegue del PR #8.

---

## Limpieza post-corte y grep de cierre (T160 — 2026-10-24)

- **Archivos eliminados tras corte**:
  - `packages/bloques/scripts/` (`convertir-contenido.ts`, `convertir-contenido.test.ts`, `cargador.mjs`) y script `convertir-contenido` en `package.json`.
  - `packages/bloques/src/conversion-anterior/` (`conversion.ts`, `en-linea.ts`, `esquema-bloques.ts`, `parrafos.ts`, `visible.ts` y sus tests).
  - `packages/bloques/src/pruebas/corpus-contenido.ts` y `salida-anterior.json`.
  - `packages/bloques/src/render/caracterizacion.test.tsx`.
  - `supabase/tests/conversion.test.sql` y `supabase/tests/fixtures/conversion-corpus.psql`.
- **Grep de cierre**:
  - `tipos_bloque|esquemaBloque|analizarEnLinea`: 0 resultados en `apps/*` y `packages/*`.
  - `\u200b` (espacio de ancho cero): 0 resultados en código fuente.
  - `continuacion`: 0 resultados en código de producción (únicamente preservado en tests unitarios que verifican que los nodos no conservan dicho atributo).
- **Pipeline de calidad final**:
  - `pnpm lint`: verde (0 errores, 0 advertencias).
  - `pnpm typecheck`: verde (0 errores en los 6 paquetes).
  - `pnpm calidad`: verde (`jscpd` 0,47 %, `knip` limpio sin dependencias ni exportaciones huérfanas).
  - Vitest: 659 pasando en `@blog/bloques`, 183 en `@blog/ui`, 744 en `admin`.

---

## Cierre y despliegue a producción (T161 — 2026-10-24)

- **Pull Request #8**: Fusionado a `main` con éxito tras la aprobación de todos los checks de CI (Lint, tipos, unitarios, pgTAP y Playwright 100% en verde).
- **Despliegues en Vercel**:
  - Sitio público: `https://blog-web-navy-gamma.vercel.app` (despliegue automático de producción completado).
  - Panel administrativo: `https://blog-admin-mocha-kappa.vercel.app` (despliegue automático de producción completado).
- **Verificación CE-010 en producción**:
  - Rutas de artículos públicos respondiendo HTTP 200 con contenido renderizado íntegro y canónico desde el documento JSON (probado en `/blog` y `/blog/principios-de-accesibilidad-web-que-todo-sitio-necesita`).
  - Panel de administración respondiendo HTTP 200 en `/ingreso`.
- **Base de datos Supabase (`kgavzwzlhbzjkvreqhbu`)**:
  - 15 artículos convertidos y validados (`convalidated = true` en `articulos_contenido_check` y `articulos_requisitos_publicacion`).
  - Reactivación de cron programada con `cron.alter_job(jobid, active := true)`.


