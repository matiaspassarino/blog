# Guía de validación: Jerarquía visual del panel

**Rama**: `004-jerarquia-visual-panel` | Contratos: [componentes](contracts/componentes.md) · [matriz de acciones](contracts/matriz-acciones.md) | Modelo: [data-model.md](data-model.md)

Guía para comprobar de punta a punta que la feature funciona. No contiene código de implementación.

## Requisitos previos

Los mismos de la spec 003 ([quickstart](../003-panel-admin/quickstart.md#requisitos-previos)): Node 24, pnpm 12, Docker en marcha, Supabase CLI 2.121 y los `.env.local` de `apps/admin` y `apps/web`. La feature no tiene migraciones.

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
| `pnpm lint && pnpm typecheck` | `variante` obligatoria en el `Button` del panel (RF-004) |
| `pnpm test` | `clasesBoton` sin opciones igual que hoy (RF-016, CE-005), variantes y tamaños, `accionPrincipalEditor`, componentes de estructura, `MasAcciones` y `DialogoProgramar` |
| `pnpm exec playwright test --project=admin --workers=2` | `e2e/admin/jerarquia.spec.ts` (CE-001 a CE-003), axe en las pantallas y diálogos nuevos, y todos los flujos de la spec 003 (CE-006) |
| `pnpm exec playwright test --project=web` | regresión del sitio público |
| `pnpm calidad && pnpm build` | jscpd ≤ 3 %, knip y compilación |

En una PC con 8 GB de RAM conviene usar el build del admin (`pnpm --filter admin build && pnpm --filter admin exec next start -p 3100`) en lugar de `next dev`, y correr Playwright con `--workers=1`.

## Recorrido manual

### A. Acción principal (Historia 1)
1. Recorrer cada fila de la [matriz de acciones](contracts/matriz-acciones.md) y comprobar que la acción principal es la indicada y es la única con fondo de marca en ese contexto.
2. Editor de un borrador recién guardado: "Publicar" es la principal y "Guardar" está deshabilitado con "Sin cambios". Escribir algo: "Guardar" pasa a principal y aparece "Cambios sin guardar". Guardar: vuelve "Publicar".
3. Editor de un artículo publicado: "Guardar" es la principal (deshabilitado sin cambios); "Volver a borrador" y "Archivar" son secundarias.
4. Como admin, "Eliminar" queda al final de la barra, separado, con el estilo destructivo. Como editor no aparece y la barra no deja un hueco.

### B. Botones parejos (Historia 2)
1. En 360, 768, 1024 y 1440 px, revisar las barras de la lista, el editor, categorías, equipo y los diálogos: misma altura, alineados, sin cortes.
2. En la lista, "Filtrar" queda alineado con los campos de filtro, no con sus etiquetas.
3. En categorías y equipo, los botones de las filas son compactos y miden al menos 44 × 44 px.
4. En 360 px, la barra del editor de un borrador muestra "Publicar", "Guardar" y "Más acciones" en una línea. "Más acciones" abre la lista con "Programar", "Vista previa" y, para el admin, "Eliminar" al final. Esc la cierra y el foco vuelve al botón.
5. Al guardar, el botón muestra el indicador de ocupado y no cambia de ancho.

### C. Programar (aclaración 2)
1. En un borrador guardado, "Programar" abre el diálogo con el foco en "Fecha y hora de publicación".
2. Confirmar sin fecha o con una fecha pasada: el diálogo no se cierra y muestra el mensaje junto al campo.
3. Con una fecha válida: el diálogo se cierra, el artículo queda "programado" y el recuadro "Publicación" muestra la fecha.

### D. Pantallas que guían la vista (Historia 3)
1. Todas las pantallas tienen el mismo encabezado: título, descripción cuando corresponde y la acción principal a la derecha desde 768 px.
2. En el editor y en el perfil, los títulos de las secciones tienen el mismo tamaño y la separación entre secciones es mayor que dentro de ellas.
3. Lista sin resultados, categorías sin elementos y una carga en curso se ven con el mismo formato.

### E. Sitio público sin cambios (CE-005)
Abrir http://localhost:4321 y un artículo con bloque CTA: los botones se ven igual que en `main` (la prueba de unidad de `clasesBoton` lo garantiza; esta es la comprobación visual).

## Accesibilidad y rendimiento

- Lighthouse (solo Accesibilidad, ≥ 95) en `/ingreso`, `/articulos`, el editor y `/equipo`, en 360 y 768 px como móvil y en 1024 y 1440 px como escritorio (CE-004). Es el mismo procedimiento de T103 de la spec 003: iniciar sesión con Playwright, pasar la cookie a Lighthouse con `--extra-headers` y medir sobre `next start`.
- Recorrer la barra del editor, "Más acciones" y el diálogo de programar solo con el teclado.
- Contraste AA de las cuatro variantes en reposo, al pasar el puntero, con foco y deshabilitadas (la deshabilitada está exenta de WCAG 1.4.3, pero debe seguir legible).
