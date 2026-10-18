---

description: "Plantilla de lista de tareas"
---

# Tareas: [NOMBRE DE LA FEATURE]

**Entrada**: Documentos de diseño en `/specs/[###-nombre-feature]/`

**Prerrequisitos**: plan.md (obligatorio), spec.md (obligatorio), research.md, data-model.md, contracts/

**Tests**: OBLIGATORIOS (constitucion.md §IX). Las tareas de test van ANTES de la implementación y deben fallar primero.

**Organización**: Tareas agrupadas por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: Historia a la que pertenece (H1, H2, H3…)
- Incluir rutas exactas de archivos

## Convenciones de rutas

- Sitio público: `apps/web/src/`
- Panel: `apps/admin/src/`
- Compartido: `packages/{db,bloques,ui,config}/`
- Base de datos: `supabase/migrations/`, `supabase/tests/`
- E2E: `e2e/`

<!--
  IMPORTANTE: Las tareas siguientes son EJEMPLOS. /speckit-tasks DEBE reemplazarlas por tareas
  reales derivadas de spec.md, plan.md, data-model.md y contracts/. No conservar los ejemplos.
-->

## Fase 1: Preparación

**Propósito**: Infraestructura compartida necesaria para esta feature

- [ ] T001 [Tarea de preparación con ruta exacta]

---

## Fase 2: Fundacional (bloqueante)

**Propósito**: Base que DEBE estar lista antes de cualquier historia

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta completar esta fase

- [ ] T002 Migración `supabase/migrations/[timestamp]_[nombre].sql`
- [ ] T003 [P] Tests pgTAP de políticas RLS en `supabase/tests/[nombre].test.sql`
- [ ] T004 Regenerar tipos con `pnpm db:tipos` en `packages/db`

**Checkpoint**: Base lista

---

## Fase 3: Historia 1 - [Título] (Prioridad: P1) 🎯 MVP

**Objetivo**: [Qué entrega esta historia]

**Prueba independiente**: [Cómo verificarla sola]

### Tests de la Historia 1 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T005 [P] [H1] Test unitario de [lógica] en `packages/[pkg]/src/[nombre].test.ts`
- [ ] T006 [P] [H1] Test E2E de [recorrido] en `e2e/[nombre].spec.ts`

### Implementación de la Historia 1

- [ ] T007 [P] [H1] [Tarea] en `[ruta exacta]`
- [ ] T008 [H1] [Tarea] en `[ruta exacta]` (depende de T007)

**Checkpoint**: Historia 1 funcional y testeable de forma independiente

---

[Repetir el bloque de fase por cada historia: Fase 4 → Historia 2, Fase 5 → Historia 3…]

---

## Fase N: Validación y cierre

- [ ] TXXX Ejecutar `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:e2e`
- [ ] TXXX Ejecutar `pnpm calidad` (jscpd + knip)
- [ ] TXXX Ejecutar `/validar` y resolver hallazgos BLOQUEANTES
- [ ] TXXX Actualizar `quickstart.md` si cambió el uso

---

## Dependencias y orden de ejecución

- Preparación → Fundacional → Historias (en orden de prioridad o en paralelo) → Validación
- Dentro de cada historia: tests → datos/esquemas → lógica en packages → UI → integración

## Estrategia

- **MVP primero**: completar la Historia 1, validar y detenerse si corresponde.
- **Incremental**: cada historia suma valor sin romper las anteriores.

## Notas

- Commit por tarea o grupo lógico (Conventional Commits en español).
- Verificar que los tests fallen antes de implementar.
- Antes de crear un archivo, buscar si ya existe algo reutilizable (§VIII).
