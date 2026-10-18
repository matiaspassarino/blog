---
name: validar
description: Gate de validación de una feature antes del PR. Ejecuta en paralelo los agentes arquitecto-db, revisor-ux-ui y consistencia-codigo sobre el diff de la rama actual contra main, y consolida un informe en specs/<rama>/validacion.md. Usar después de /speckit-implement, o cuando el usuario pida "validar", "revisar la feature" o "gate".
---

# /validar — Gate de validación (constitucion.md §XI)

## Pasos

1. **Identificar la feature**
   - `git rev-parse --abbrev-ref HEAD` da la rama `NNN-nombre`. La carpeta es `specs/NNN-nombre/`.
   - Si estás en `main` o la carpeta no existe, detenete y avisá.

2. **Verificaciones automáticas** (ejecutalas antes que los agentes y guardá el resultado):
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm calidad
   pnpm test:db     # requiere supabase local levantado
   pnpm test:e2e    # se puede omitir si se pide una validación rápida
   ```

3. **Determinar el alcance**: `git diff main...HEAD --stat`.
   - Si hay cambios en `supabase/` o `packages/db`, corre `arquitecto-db`.
   - Si hay cambios en `apps/` o `packages/ui`, corre `revisor-ux-ui`.
   - `consistencia-codigo` corre **siempre**.

4. **Lanzar los agentes aplicables EN PARALELO** (un solo mensaje con varias llamadas a Agent), pasando a cada uno la rama, la carpeta de la spec y el resultado de las verificaciones automáticas.

5. **Consolidar** en `specs/NNN-nombre/validacion.md`:
   ```markdown
   # Validación: NNN-nombre
   **Fecha**: AAAA-MM-DD · **Commit**: <sha corto>
   **Resultado global**: APROBADO | CAMBIOS REQUERIDOS

   ## Verificaciones automáticas
   | Comando | Resultado |

   ## arquitecto-db — ...
   ## revisor-ux-ui — ...
   ## consistencia-codigo — ...

   ## Acciones
   - [ ] Bloqueante 1 …
   ```
   El resultado global es **APROBADO** solo si todas las verificaciones pasan y ningún agente reportó bloqueantes.

6. **Responder al usuario** con el resultado global, los bloqueantes (si los hay) y el siguiente paso:
   - Si está APROBADO: `gh pr create`.
   - Si hay CAMBIOS REQUERIDOS: corregir y volver a ejecutar `/validar`.
   No corrijas nada automáticamente salvo que el usuario lo pida.
