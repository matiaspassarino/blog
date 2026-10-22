# Validación: 004-jerarquia-visual-panel

**Fecha**: 2026-10-22 · **Commit validado**: `93d5560` (con las correcciones posteriores hasta el commit de cierre de esta validación)

**Resultado global**: APROBADO (con los dos bloqueantes de `consistencia-codigo` ya corregidos y 3 E2E intermitentes que también fallan en `main`; ver "Acciones")

## Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `pnpm lint` | Verde |
| `pnpm typecheck` | Verde |
| `pnpm test` | Verde: `@blog/ui` 159, `@blog/bloques` 360, `@blog/db` 261 y `admin` 493. Los de `@blog/db` y `admin` comparten la base: corren en serie (`--no-file-parallelism`); en paralelo fallan pruebas distintas en cada corrida, como ya se sabía |
| `pnpm calidad` | Verde: jscpd 0,39 %, knip sin hallazgos |
| `pnpm test:db` | Verde: 786 pgTAP (la feature no cambia la base) |
| `pnpm build` | Verde (web y admin) |
| `pnpm exec playwright test --project=admin` | 417 verdes, 2 saltados y 4 intermitentes en la última corrida (ver "Acciones"). `e2e/admin/jerarquia.spec.ts` (CE-001 a CE-003, H1 a H3): 120 de 120 |
| Lighthouse (solo Accesibilidad), `next start` local con el seed y sesión de admin | **100 en las 16 mediciones** (CE-004): `/ingreso`, `/articulos`, el editor y `/equipo`, en 360 y 768 px como móvil y 1024 y 1440 px como escritorio. Lighthouse 13.5.0 |

CE-005 (el sitio no cambia): `packages/ui/src/clases.test.ts` compara el texto exacto de `clasesBoton()`, `clasesBoton(undefined)` y las tres variantes de hoy; `git diff main...HEAD` no toca `apps/web` ni `packages/bloques`. No se midió Lighthouse del sitio porque no cambió ni un byte de su código ni de sus clases.

## arquitecto-db — no aplica

Sin cambios en `supabase/` ni en `packages/db` (`git diff main...HEAD`).

## revisor-ux-ui — APROBADO

Sin bloqueantes. CE-002: todas las filas de la [matriz de acciones](contracts/matriz-acciones.md) coinciden con el código. Tokens exclusivos, una sola primaria por contexto, destructivas separadas y con ícono, 44 px en los dos tamaños, `motion-safe` en el indicador de ocupado, "Más acciones" como *disclosure* correcto.

Menores corregidos en esta validación:
1. "Más acciones" no se cerraba cuando el foco salía por Tab → `useDesplegable` cierra con `focusin` fuera.
2. El diálogo de confirmación no tenía alto máximo (WCAG 1.4.10) → `max-h-dvh` con desplazamiento.
3. Las etiquetas vacías del editor mostraban una caja dentro de otra → un párrafo simple.

Menores y sugerencias sin hacer (no bloquean):
- La fila de estado de la barra (`aria-live`) agrega un `gap` aunque esté vacía.
- El tipo `advertencia` de `AvisoEstado` reutiliza el ícono `prohibido` del error; falta un ícono propio.
- Enter en el campo de fecha del diálogo de programar no confirma (no hay `form`).
- A 360 px la barra fija puede ocupar dos filas de botones más la línea de estado; medirlo y, si pasa de un tercio del alto, mover "Programar" y "Vista previa" al menú.
- La terciaria no tiene borde en reposo: depende del color y del subrayado al pasar el puntero.

## consistencia-codigo — CAMBIOS REQUERIDOS → corregidos

Sin dependencias nuevas, sin cambios en `apps/web`, `packages/bloques`, `packages/db` ni `supabase`; `clasesBoton` sin opciones devuelve lo de hoy; nombres y convenciones correctos.

Bloqueantes (corregidos en esta validación):
1. `Paginacion.tsx` armaba el botón a mano (T040 figuraba hecha sin estarlo) → ahora usa `clasesBoton('secundaria', { tamanio: 'compacto' })` y conserva encima el estilo de `aria-current="page"`.
2. `ComparacionVersiones.tsx` tenía títulos `text-xl` y `text-lg` sueltos → el `h2` usa `TituloSeccion` y el `h3` de columna `text-base font-semibold`. "Panel del blog" (`NavegacionPanel`) queda con `text-lg` porque es una marca, no un título de sección.

Menores corregidos: comentarios de "fase roja" y referencias a `AccionesEstado` al día; desviaciones anotadas en `tasks.md` (T041) y `research.md` (D10).

## Desviaciones respecto del plan

- **Corte de "Más acciones": 42 rem** de barra (`@2xl`) y no 48. A 768 px y a 1024 px con la navegación lateral la barra mide cerca de 44 rem; con 48 el menú aparecía donde RF-019 pide todas las acciones en línea. Los botones de la barra siguen compactos hasta 48 rem. Ver research D10.
- **`ConfirmarAccion` cierra al confirmar** (como antes) y solo espera el resultado con `esperarResultado`, que usa `DialogoProgramar`. Esperar siempre rompía los E2E de eliminar categorías y etiquetas.
- **Terciaria presionada con `bg-marca-suave`** (4,60:1); con `bg-separador` daba 3,96:1.
- **Botón estándar con `py-2`** (con el borde de 1 px, `py-2.5` medía 46 px y no se alineaba con los campos de 44 px).
- **T041 parcial**: se dejaron los `self-start` de los botones únicos.
- **Pruebas ajustadas** (las escribió `escritor-tests` y tenían supuestos que no se cumplían): clics forzados que caían sobre la barra fija, la ayuda que mide superposición dentro de un diálogo abierto, la separación entre secciones medida por columna, `networkidle` antes de vencer la sesión (las precargas de Next la cerraban antes de guardar) y dos expectativas del diálogo de reemplazar y de "No tienes permiso".
- **Barra del editor más compacta a 768 y 1024 px**: en el CI de Linux (tipografía del sistema más ancha) la barra con "Cancelar programación" o "Volver a borrador" se partía en dos líneas. Se redujeron el relleno lateral de la barra (`md:px-4`), el espacio entre botones (`gap-2` hasta 48 rem) y el relleno de los botones compactos (`px-2`); se comprobó con Verdana forzada, más ancha que la del CI, que en los cuatro estados entra en una línea.
- **Cobertura no E2E**: la fila "Definir contraseña" de la matriz no tiene prueba E2E (exige una sesión de recuperación) y los vacíos de categorías y etiquetas se saltan si el seed ya trae elementos; los componentes sí se prueban con render estático.

## Entorno

El panel y los E2E se corrieron contra `next start` (build) con 2 workers. Un proceso de VS Code ocupó `127.0.0.1:56321` durante parte de la sesión y tapó el API de Supabase; se resolvió cerrando y reabriendo VS Code (ver la memoria de la PC).

## Acciones

- [x] Bloqueante 1 (`Paginacion`) corregido.
- [x] Bloqueante 2 (`ComparacionVersiones`) corregido.
- [x] Menores de teclado, alto del diálogo y etiquetas vacías corregidos.
- [ ] **E2E intermitentes, anteriores a esta spec**: "Guardado" no aparece después de crear un artículo nuevo en `articulo-editor.spec.ts` (slug), `casos-borde.spec.ts` (slug final), `medios.spec.ts` (subidas) y `permisos.spec.ts` (T099-F4 y F7). Pasan en `next dev` y fallan a veces con el build de producción. Con `main` (commit `6a64996`) y el mismo build, la repetición de dos de esos tests dio 4 fallos de 12 corridas, es decir, **también falla en `main`**: tras crear el artículo, `history.replaceState` + `revalidatePath` vuelven a montar el editor en la ruta `[id]` y se pierde el mensaje "Guardado" (el artículo sí se guarda). Queda como deuda de una spec aparte; no la introduce la 004.
- [ ] Mejoras menores del revisor de UX (ver arriba), para la spec 005 o una pasada posterior.
