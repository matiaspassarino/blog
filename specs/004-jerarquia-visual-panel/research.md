# Investigación: Jerarquía visual del panel

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Fecha**: 2026-10-21

Hallazgos del relevamiento del código (2026-10-21) que motivan las decisiones:

- `clasesBoton` (`packages/ui/src/clases.ts`) lo usan tres consumidores: el `Button` del panel, `Boton.astro` del sitio y el renderer `Cta.tsx` de `@blog/bloques`. Tiene tres variantes y un solo tamaño (`min-h-11 px-5 py-2.5`).
- **Causa de los "tamaños desparejos"**: la variante `secundaria` tiene `border` de 1 px y la `primaria` no. Con el mismo relleno, la secundaria mide 46 px y la primaria 44 px, así que en una misma barra quedan desparejas. Además hay ajustes sueltos (`px-3`, `self-start`, `w-full`, `mt-2`) que cambian el ancho según la pantalla.
- **Causa de "todo pesa igual"**: el `Button` del panel tiene `variante = 'primaria'` por defecto. 23 botones no declaran variante y salen como primarios: "Filtrar", "Guardar" del editor, "Ir a los artículos", "Crear", "Enviar invitación", etc. En el editor compiten "Guardar" (barra fija) y "Publicar" (recuadro "Publicación").
- Títulos: 11 `h1` con `text-titulo-2` y uno con `text-titulo-1` (ingreso). Las secciones usan `h2` con `text-xl` (5 casos) o `legend` con `font-semibold` del tamaño del cuerpo (4 casos), así que dos secciones del mismo nivel se ven distintas. El espaciado es `gap-6` en casi todas las pantallas, sin distinguir entre secciones y dentro de ellas.

## D1. Una sola definición del botón, con el aspecto del sitio intacto

- **Decisión**: `clasesBoton(variante, opciones?)` sigue siendo la única definición (constitución §VII.3). Sin `opciones` devuelve **exactamente** las clases de hoy (las usan `Boton.astro` y `Cta.tsx`). Con `opciones.tamanio` (`'estandar' | 'compacto'`) devuelve la versión del panel: altura fija, borde en todas las variantes (transparente en la primaria y la terciaria) y relleno horizontal según el tamaño.
- **Por qué**: RF-016 y CE-005 piden que el sitio no cambie. Un test de unidad fija el texto exacto de `clasesBoton('primaria')` y `clasesBoton('secundaria')`: si el texto no cambia, el aspecto tampoco.
- **Alternativas descartadas**: (a) corregir la base para todos: arregla también los 2 px del sitio, pero viola RF-016; (b) una función `clasesBotonPanel` aparte: duplica la primitiva y viola §VII.3 y §VIII.

## D2. Cuatro niveles; el nivel es obligatorio en el panel

- **Decisión**: se agrega la variante `terciaria` a `VarianteBoton` (sin fondo, sin borde visible y texto del color del texto, con fondo `superficie` al pasar el puntero). Las cuatro quedan: `primaria`, `secundaria`, `terciaria` y `peligro`. En el `Button` del panel la prop `variante` pasa a ser **obligatoria** (sin valor por defecto), igual que en `AlertDialogAction` y `ConfirmarAccion`.
- **Por qué**: RF-004 pide que ninguna acción quede como principal por omisión. Con la prop obligatoria, `pnpm typecheck` falla si falta, sin depender de una revisión manual. `Button` además expone `data-nivel` y `data-tamanio` para que las pruebas cuenten las acciones por nivel (CE-001).
- **Alternativas descartadas**: una regla de ESLint (más código y se puede desactivar); dejar `secundaria` por defecto (sigue permitiendo omitir el nivel).

## D3. Tamaños: estándar y compacto, los dos de 44 px

- **Decisión**: `estandar` = altura `--tactil-min` (44 px), `px-5`, texto base. `compacto` = misma altura y ancho mínimo de 44 px, `px-3`, texto `text-sm`. Los botones de solo ícono usan `compacto` más el modificador cuadrado (`aspect-square px-0`). La altura es fija (`h-*`), no mínima, para que todos los botones de un grupo midan lo mismo; los textos largos se parten en dos líneas solo en el estándar, con `h-auto` y el mismo `min-h`.
- **Por qué**: RF-006 a RF-008 y CE-003. El compacto se distingue por el ancho y el tamaño del texto, no por la altura, así cumple el área táctil (§VII.4) sin trucos de pseudo-elementos.
- **Alternativas descartadas**: un compacto de 36 px con área táctil ampliada por `::before`: es más difícil de probar (el área no la mide el `boundingBox`) y se superpone con los vecinos en las tablas.

## D4. Componentes de estructura: encabezado, barra de acciones y títulos de sección

- **Decisión**: tres componentes nuevos en `apps/admin/src/componentes/estructura/`:
  - `EncabezadoPagina` (`titulo`, `descripcion?`, `acciones?`): `h1` con `text-titulo-2`, descripción con el tratamiento de texto de apoyo y las acciones a la derecha del título desde 768 px, o debajo del título en pantallas más angostas. Reemplaza los 12 `h1` sueltos (el `h1` enfocable del editor recibe `ref` y `tabIndex`).
  - `BarraAcciones` (`children`, `destructivas?`): `flex flex-wrap items-center gap-3`; las destructivas van al final, separadas con `ms-auto` desde 768 px.
  - `TituloSeccion` (`como: 'h2' | 'legend'`, `nivel: 'seccion' | 'subseccion'`): una sola escala para los `h2` y los `legend` de los recuadros.
- **Por qué**: RF-009, RF-011 y RF-012. Con un componente por patrón se aplica igual en todas las pantallas y la revisión de consistencia lo puede verificar.
- **Alternativas descartadas**: clases utilitarias compartidas (`CLASES_TITULO_SECCION`): no garantizan la estructura (el orden de título, descripción y acciones) ni el nivel del encabezado.

## D5. Escala tipográfica y espaciado como tokens

- **Decisión**: se usan los tokens de título que ya existen (`titulo-2` para la pantalla y `titulo-3` para la sección) y se agrega `--text-titulo-4: 1.125rem` para la subsección. Para el espaciado se agregan `--spacing-panel-seccion: 2.5rem` (entre secciones) y `--spacing-panel-grupo: 1rem` (dentro de una sección), con su uso como `gap-panel-seccion` y `gap-panel-grupo`. El texto de apoyo sigue con `text-sm text-texto-suave` (contraste 4,5:1 ya verificado en la spec 003).
- **Por qué**: RF-012 y RF-013 con tokens (§VII.1 y §VII.2). Los títulos del sitio no se tocan: los tokens nuevos solo los usa el panel.
- **Alternativas descartadas**: usar `text-xl` y `text-lg` de Tailwind (no son tokens del proyecto y ya están desparejos).

## D6. Estados con un formato único

- **Decisión**: se reutilizan `AvisoEstado` (error, éxito y advertencia) y el esqueleto de `loading.tsx`. Se crea `EstadoVacio` (`mensaje`, `accion?`) para la lista de artículos, las categorías, las etiquetas y la tabla de equipo, con la acción como `secundaria`. El esqueleto de carga se mueve a un componente `EsqueletoPantalla` que imita el `EncabezadoPagina`, así no salta el diseño al terminar de cargar.
- **Por qué**: RF-014. Hoy el vacío de la lista es un `div` armado a mano y las taxonomías tienen el suyo.

## D7. Acción principal del editor: una función pura

- **Decisión**: `accionPrincipalEditor({ estado, hayCambiosSinGuardar })` en `apps/admin/src/componentes/articulo/acciones-disponibles.ts` devuelve `'guardar' | 'publicar'`: `'publicar'` solo para un borrador sin cambios pendientes, `'guardar'` en cualquier otro caso (RF-005, aclaración 3). La barra pinta esa acción como `primaria` y las demás como `secundaria`; "Eliminar" va como `peligro`.
- **Por qué**: es lógica de dominio de la interfaz y se prueba con Vitest sin montar el editor (constitución §III.5 y §IX.1). Vive junto a `accionesDisponibles`, que ya decide qué transiciones se ofrecen.

## D8. La barra fija del editor junta "Guardar" y las acciones de estado

- **Decisión**: `AccionesEstado` se divide en dos: `InfoPublicacion` (el recuadro "Publicación", que queda solo con el estado, la fecha y "Ver en el sitio") y `BarraEditor` (la barra fija: "Guardar", las transiciones de `accionesDisponibles`, el aviso "Cambios sin guardar" y el error de cambio de estado). La lógica de `ejecutar` y `eliminar` pasa a un hook `useCambioDeEstado` dentro de la misma carpeta, para no duplicarla entre la barra y el menú.
- **Por qué**: aclaración 1 (opción B). El orden en la barra es: principal, la otra de "Guardar" o "Publicar", el resto de las transiciones, "Vista previa" (terciaria) y, al final y separada, "Eliminar".

## D9. "Programar" abre un diálogo con fecha

- **Decisión**: `DialogoProgramar` reutiliza las primitivas de `ui/alert-dialog.tsx` (Radix AlertDialog, ya instalado), con el campo "Fecha y hora de publicación" (`datetime-local`, mínimo = ahora) y los botones "Cancelar" (`secundaria`) y "Programar" (`primaria`). El foco inicial va al campo (`onOpenAutoFocus`). Si la fecha falta o está en el pasado, la confirmación hace `preventDefault`, el diálogo no se cierra y muestra el mismo mensaje de hoy ("Elige la fecha y hora de publicación." o el error de la base) asociado al campo.
- **Por qué**: aclaración 2. Un diálogo de confirmación que pide un dato encaja con `alertdialog`, y no hace falta agregar `@radix-ui/react-dialog`.
- **Alternativas descartadas**: `@radix-ui/react-dialog` (una dependencia nueva para lo mismo); el `<dialog>` nativo que usa `DialogoEdicion` (sirve, pero tendría un foco y un cierre distintos a los de las confirmaciones del editor).

## D10. "Más acciones" como disclosure, sin dependencias

- **Decisión**: por debajo de 768 px, la barra del editor muestra la acción principal, la secundaria relacionada y un botón "Más acciones" (`terciaria`, con `aria-expanded` y `aria-controls`) que despliega una lista de botones. Esc la cierra y devuelve el foco al botón, un clic afuera también la cierra, y "Eliminar" va al final después de un separador. Desde 768 px los mismos botones se ven en línea. La versión angosta y la ancha se resuelven con clases responsive (`md:hidden` y `hidden md:flex`), así que no hay que detectar el ancho con JavaScript ni hay diferencias de hidratación. El cierre con Esc y la devolución del foco salen de un hook `useDesplegable`, extraído de `NavegacionPanel` (que hoy ya lo hace para el menú del panel), al que se le suma el cierre con clic afuera.
- **Por qué**: aclaración 4 y RF-019. El patrón *disclosure* de WAI-ARIA alcanza para una lista corta de acciones y no exige navegación con flechas; un `role="menu"` sí la exigiría.
- **Alternativas descartadas**: `@radix-ui/react-dropdown-menu` (otra dependencia, y la semántica `menu` exige más comportamiento); el atributo `popover` nativo (no devuelve el foco solo y todavía tiene diferencias entre navegadores).

## D11. Estados del botón: deshabilitado y ocupado

- **Decisión**: el panel sigue usando `aria-disabled` (el botón queda enfocable y se anuncia) y se mantiene `opacity-60` con `cursor-not-allowed`, pero sin cambiar de color hacia el rojo ni el borde de error. "Guardar" deshabilitado se acompaña del texto "Sin cambios" en la barra, en el lugar de "Cambios sin guardar". El estado ocupado (`aria-busy`) superpone un indicador de giro (respeta `prefers-reduced-motion`: sin giro, solo los tres puntos) y vuelve transparente el texto, así el botón conserva el ancho.
- **Por qué**: RF-010 y el caso borde de la acción principal deshabilitada. Los textos "Ingresando…" o "Guardando…" de los formularios de acceso cambian el ancho del botón; con el indicador superpuesto se conserva y el texto accesible sigue siendo el de la acción.

## D12. Pruebas

- **Decisión**:
  - **Vitest**: `packages/ui/src/clases.test.ts` (el texto exacto sin opciones, las cuatro variantes y los dos tamaños, y que no haya valores fuera de tokens); `acciones-disponibles.test.ts` (la tabla completa de `accionPrincipalEditor`); tests de componente para `EncabezadoPagina`, `BarraAcciones`, `MasAcciones` y `DialogoProgramar`.
  - **Playwright**: `e2e/admin/jerarquia.spec.ts`, que recorre cada pantalla y diálogo y cuenta `[data-nivel="primaria"]` visibles por contexto (CE-001 y CE-002), y mide alturas y alineación de los grupos y el área táctil en 360, 768, 1024 y 1440 px (CE-003). Las pruebas de programación y publicación siguen pasando con la ayuda `e2e/admin/ayudas/estado.ts` actualizada para abrir el diálogo y usar "Más acciones" en móvil (CE-006). `e2e/admin/accesibilidad.spec.ts` (axe) cubre las pantallas y diálogos nuevos.
  - **Lighthouse** (CE-004): el mismo recorrido de T103 de la spec 003 (16 mediciones), documentado en `quickstart.md`.
- **Por qué**: cada criterio de aceptación queda con al menos una prueba (§IX.5).
