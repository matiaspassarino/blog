# Tareas: Estética del editor de artículos y lienzo limpio

**Entrada**: Documentos de diseño en `/specs/006-estetica-editor-articulo/`
- Spec: [spec.md](spec.md)
- Plan: [plan.md](plan.md)

---

## Fase 1: Pruebas y preparación

- [x] T001 [H1/H2] Crear o adaptar pruebas unitarias en `apps/admin/src/componentes/editor/EditorArticulo.test.tsx` (o archivo de prueba correspondiente) verificando la presencia del título integrado, la reubicación de slug/extracto/imagen destacada en el panel lateral y la conmutación a la pestaña «Artículo» ante errores de validación.

---

## Fase 2: Historia 1 - Escritura fluida en lienzo despejado (Prioridad: P1)

**Objetivo**: Columna principal despejada con título integrado y acceso directo e inmediato al editor de contenido.

- [x] T002 [H1] En `apps/admin/src/componentes/editor/EditorArticulo.tsx`, transformar el campo Título en un encabezado integrado de documento (`text-3xl font-titulos font-bold text-texto placeholder:text-texto-suave/50`), multilínea autoajustable, sin envoltorio de formulario tosco, con anillo de foco accesible (`focus-visible:ring-3`) y comportamiento de `Enter` para saltar al editor.
- [x] T003 [H1] En `apps/admin/src/componentes/editor/EditorArticulo.tsx`, eliminar de la columna principal el rótulo "Contenido", el campo Slug, el campo Extracto y la sección "Imagen destacada", colocando el editor `CargadorDeEditorDocumento` directamente a continuación del título.

---

## Fase 3: Historia 2 - Metadatos centralizados en la barra lateral (Prioridad: P2)

**Objetivo**: Pestaña «Artículo» de la barra lateral como centro único de metadatos, imagen destacada, taxonomías y SEO.

- [x] T004 [H2] En `apps/admin/src/componentes/editor/EditorArticulo.tsx`, incorporar en `panel-articulo` una sección de "Detalles" con los campos Slug (y su sugerencia automática) y Extracto, además de la sección "Imagen destacada" con su componente `ImagenEditable`.
- [x] T005 [H2] En `apps/admin/src/componentes/editor/EditorArticulo.tsx`, implementar la lógica de auto-conmutación: al intentar guardar con errores en campos del artículo (slug, extracto, imagen destacada, taxonomías o SEO), asegurar que si `pestania === 'elemento'`, se active automáticamente la pestaña «Artículo» para enfocar y mostrar el error.

---

## Fase 4: Historia 3 - Adaptabilidad responsive y accesibilidad (Prioridad: P3)

**Objetivo**: Experiencia de redacción limpia en 360, 768, 1024 y 1440 px con accesibilidad WCAG AA.

- [x] T006 [H3] Ajustar los estilos responsive en `EditorArticulo.tsx` para garantizar que en viewports móviles (< 1280 px) el título conserve proporciones fluidas (`text-2xl` a `text-3xl`) y los campos laterales se apilen con áreas táctiles mínimas de 44 px.

---

## Fase 5: Validación, mediciones y cierre

- [x] T007 Ejecutar suite de calidad del monorepo: `pnpm lint`, `pnpm typecheck`, `pnpm calidad` y pruebas unitarias de `apps/admin`.
- [x] T008 Ejecutar y adaptar suites E2E relevantes (`e2e/admin/editor-documento.spec.ts`) para verificar persistencia, atajos y comportamiento de campos reubicados.
- [x] T009 Medir y registrar en `specs/006-estetica-editor-articulo/validacion.md`: reducción del espacio vertical previo al editor (CE-001) y verificación de accesibilidad con axe-core en 360, 768, 1024 y 1440 px (CE-003).
- [x] T010 Actualizar `CLAUDE.md`, commitear, pushear la rama `006-estetica-editor-articulo` y abrir Pull Request hacia `main`.
