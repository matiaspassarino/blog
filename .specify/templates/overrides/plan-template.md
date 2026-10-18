# Plan de implementación: [FEATURE]

**Rama**: `[###-nombre-feature]` | **Fecha**: [FECHA] | **Spec**: [enlace]

**Entrada**: Especificación en `/specs/[###-nombre-feature]/spec.md`

**Nota**: Esta plantilla la completa `/speckit-plan`. Redactar en español.

## Resumen

[Requisito principal + enfoque técnico elegido]

## Contexto técnico

<!-- El stack está cerrado (constitucion.md §II). Indicar solo lo que esta feature usa o agrega. -->

**Apps / paquetes afectados**: [apps/web, apps/admin, packages/db, packages/bloques, packages/ui, supabase/]

**Dependencias nuevas**: [Ninguna | nombre@versión + justificación (requiere aprobación de consistencia-codigo)]

**Almacenamiento**: [tablas / buckets de Supabase afectados o N/A]

**Rutas públicas afectadas**: [rutas de apps/web y estrategia: estático | ISR | SSR (justificar)]

**Rutas admin afectadas**: [rutas de apps/admin]

**Revalidación**: [qué rutas se invalidan al publicar/editar]

**Metas de rendimiento**: [Lighthouse/CWV si aplica]

## Verificación constitucional

*GATE: debe pasar antes de la Fase 0 y volver a verificarse después del diseño (Fase 1).*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado (sin deps no aprobadas) | [ ] | |
| III. Límites de arquitectura (sin imports entre apps, datos vía packages/db) | [ ] | |
| IV. SEO primero (pre-render, JS mínimo, metadatos) | [ ] | |
| V. Datos (migraciones, RLS + pgTAP, nomenclatura en español) | [ ] | |
| VI. Bloques (esquema único en packages/bloques) | [ ] | |
| VII. Design system (solo tokens, WCAG AA) | [ ] | |
| VIII. No duplicación (sección Reutilización completa) | [ ] | |
| IX. Testing (cada criterio de aceptación → test) | [ ] | |

## Reutilización *(obligatorio — constitucion.md §VIII)*

<!-- Buscar en el repo ANTES de completar. Listar rutas reales. -->

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| [p. ej. tarjeta de artículo] | [packages/ui/... o "ninguno"] | [ruta] | [por qué no sirve lo existente] |

## Impacto en base de datos *(si aplica — revisar con agente arquitecto-db)*

- **Migraciones**: [nombre de archivo(s) en supabase/migrations/]
- **Tablas/columnas**: [nuevas o modificadas]
- **Índices**: [nuevos]
- **Políticas RLS**: [política → test pgTAP correspondiente]
- **Funciones / triggers / cron**: [lista]
- **Seed**: [cambios en seed.sql]

## Impacto en UI y tokens *(si aplica — revisar con agente revisor-ux-ui)*

- **Componentes nuevos/modificados**: [lista y ubicación]
- **Tokens nuevos**: [nombre → valor, o "ninguno"]
- **Estados**: [vacío, carga, error, éxito]
- **Accesibilidad**: [foco, teclado, aria, contraste]

## Plan de pruebas

| Criterio de aceptación (spec) | Tipo | Archivo de test |
|---|---|---|
| [Historia 1 / escenario 1] | Vitest / Playwright / pgTAP | [ruta] |

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/[###-feature]/
├── plan.md          # Este archivo
├── research.md      # Fase 0
├── data-model.md    # Fase 1
├── quickstart.md    # Fase 1
├── contracts/       # Fase 1 (Server Actions, endpoints, esquemas Zod)
├── tasks.md         # Fase 2 (/speckit-tasks)
└── validacion.md    # Informe de /validar
```

### Código fuente (afectado por esta feature)

```text
apps/
├── web/src/            # [páginas/componentes Astro afectados]
└── admin/src/          # [rutas/componentes Next afectados]
packages/
├── db/                 # [consultas/tipos]
├── bloques/            # [esquema/renderers]
└── ui/                 # [tokens/primitivas]
supabase/
├── migrations/
└── tests/
```

**Decisión de estructura**: [Rutas reales elegidas]

## Seguimiento de complejidad

> Completar SOLO si la verificación constitucional tiene excepciones justificadas.

| Excepción | Por qué es necesaria | Alternativa simple descartada porque |
|---|---|---|
