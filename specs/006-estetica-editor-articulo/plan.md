# Plan de implementación: Estética del editor de artículos y lienzo limpio

**Rama**: `006-estetica-editor-articulo` | **Fecha**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/006-estetica-editor-articulo/spec.md`

## Resumen

El editor de artículos reorganiza sus campos para optimizar el espacio vertical del lienzo de escritura y ofrecer una experiencia de redacción fluida estilo documento (Notion / Medium):

1. **Lienzo principal de escritura**:
   - El **Título** pasa a ser un encabezado integrado directamente en el lienzo (tipografía destacada `text-3xl font-bold font-titulos`, multilínea autoajustable, sin envoltorio de formulario pesado, con foco accesible y atajo `Enter` hacia el editor).
   - Se eliminan de la columna principal el **Slug**, el **Extracto**, la **Imagen destacada** y el rótulo redundante "Contenido". El editor de contenido estructurado Tiptap se ubica inmediatamente debajo del título.
2. **Barra lateral (Pestaña «Artículo»)**:
   - Aloja de forma ordenada los metadatos movidos: **Slug** (con sugerencia automática), **Extracto** e **Imagen destacada**, precediendo a las secciones de **Taxonomías** y **Para buscadores (SEO)**.
3. **Manejo de errores y foco**:
   - Si al guardar hay errores en los metadatos laterales y la pestaña activa es «Elemento», la vista conmuta automáticamente a la pestaña «Artículo» para exponer el campo inválido.

Sin dependencias nuevas ni cambios en el esquema de base de datos.

## Contexto técnico

- **Apps / paquetes afectados**:
  - `apps/admin`: `src/componentes/editor/EditorArticulo.tsx`, componentes auxiliares de entrada si aplica, tests unitarios y pruebas E2E.
- **Base de datos / Migraciones**: Ninguna. La entidad `articulos` y sus contratos de guardado (`actualizarArticulo`, `crearArticulo`) no sufren modificaciones de esquema.
- **Rutas públicas afectadas**: Ninguna (`apps/web` no cambia; los artículos siguen consumiendo los mismos campos).
- **Rutas admin afectadas**: `/articulos/nuevo`, `/articulos/[id]`.

## Verificación constitucional

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado | [x] | Sin dependencias nuevas. Se utilizan React, Tailwind CSS y componentes ya instalados. |
| III. Límites de arquitectura | [x] | Cambios confinados a la capa de UI de `apps/admin`. |
| IV. SEO primero | [x] | Metadatos SEO conservados en la barra lateral con sus validaciones y contratos idénticos. |
| V. Datos | [x] | Sin cambios de base ni migraciones. |
| VI. Documento estructurado | [x] | El editor Tiptap se mantiene idéntico, ganando prioridad y espacio en el lienzo. |
| VII. Design system (tokens, WCAG AA) | [x] | Se respetan tokens de color, tipografía (`font-titulos`), foco accesible (`focus-visible:ring-3`) y áreas táctiles mínimas (44 px). |
| VIII. No duplicación | [x] | Reutilización íntegra de `ImagenEditable`, `CampoFormulario`, `Input`, `Textarea` y `TituloSeccion`. |
| IX. Testing | [x] | Pruebas unitarias de reductor/componentes y tests E2E actualizados. |

## Reutilización

| Necesidad | Existente a reutilizar | Nuevo a crear / adaptar |
|---|---|---|
| Título integrado | `apps/admin/src/componentes/ui/textarea.tsx` / `input.tsx` | Adaptación de área de texto autoajustable con estilos de lienzo (`border-none text-3xl font-titulos font-bold`). |
| Slug y Extracto | `CampoFormulario`, `Input`, `Textarea` | Reubicados en sección "Detalles" dentro de `panel-articulo`. |
| Imagen destacada | `ImagenEditable` | Reubicada en `panel-articulo` de la barra lateral. |
| Cambio de pestaña por error | Estado `pestania` en `EditorArticulo.tsx` | Efecto o lógica al guardar que conmuta a `pestania = 'articulo'` si hay errores de metadatos. |

## Fases de ejecución

- **Fase 1: Preparación y pruebas en rojo**:
  - Verificar pruebas unitarias y E2E que interactúan con el formulario de artículo.
  - Diseñar tests de navegación de foco (`Enter` en título) y auto-activación de pestaña ante error de metadatos.
- **Fase 2: Implementación en `EditorArticulo.tsx`**:
  - Estilizar el Título integrado en el lienzo.
  - Reubicar Slug, Extracto e Imagen destacada en la barra lateral.
  - Implementar auto-conmutación de pestaña ante errores en campos de artículo.
- **Fase 3: Verificación, accesibilidad y calidad**:
  - `pnpm lint`, `pnpm typecheck`, `pnpm calidad`.
  - Pruebas unitarias en `apps/admin`.
  - Pruebas E2E de Playwright (`e2e/admin/editor-documento.spec.ts` y suites relacionadas).
  - Medición de accesibilidad con axe-core y verificación de CE-001 (reducción de espacio vertical).
