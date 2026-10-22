# Investigación: Jerarquía visual del panel

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Fecha**: 2026-10-21 (revisada el mismo día con los informes de `revisor-ux-ui` y `consistencia-codigo`)

Hallazgos del relevamiento del código que motivan las decisiones:

- `clasesBoton` (`packages/ui/src/clases.ts`) lo usan tres consumidores: el `Button` del panel, `Boton.astro` del sitio y el renderer `Cta.tsx` de `@blog/bloques` (que lo llama con `bloque.variante`, `'primaria' | 'secundaria' | undefined`). Tiene tres variantes y un solo tamaño (`min-h-11 px-5 py-2.5`). `apps/web/src/styles/global.css` hace `@source` de `packages/ui/src`, así que las clases del panel también entran en el CSS del sitio (unos pocos bytes, sin cambio visual).
- **Causa de los "tamaños desparejos"**: la variante `secundaria` tiene `border` de 1 px y la `primaria` no. Con el mismo relleno, la secundaria mide 46 px y la primaria 44 px. Además hay ajustes sueltos (`px-3`, `self-start`, `w-full`, `mt-2`) y `Paginacion.tsx` arma a mano otra versión del botón.
- **Causa de "todo pesa igual"**: el `Button` del panel tiene `variante = 'primaria'` por defecto. 14 `<Button>` no declaran variante y salen como primarios ("Filtrar", "Guardar" del editor, "Ir a los artículos", "Crear", "Enviar invitación", etc.); 5 `<ConfirmarAccion>` dependen de su `'peligro'` por defecto. En el editor compiten "Guardar" (barra fija) y "Publicar" (recuadro "Publicación").
- Títulos: 11 `h1` con `text-titulo-2`; la vista previa usa `text-titulo-1` porque muestra el título del artículo como en el sitio. Las secciones usan `h2` con `text-xl` (5 casos) o `legend` del tamaño del cuerpo (4 casos); los títulos de los diálogos usan `text-xl`.
- Estados: `AvisoEstado` solo tiene `'exito' | 'error'` con texto plano. Hay avisos armados a mano en `DialogoEdicion` (advertencia), `EditorArticulo` (resumen de errores y "Cambios sin guardar"), `AvisoConflicto` (error con botones) y la vista previa. Hay cuatro estados vacíos distintos: la lista, `GestorTaxonomias`, `TablaEquipo` y las etiquetas del editor.
- Pruebas: `apps/admin/vitest.config.ts` corre en `environment: 'node'`, sin DOM ni Testing Library. El `cn` del panel (`tailwind-merge`) toma `text-titulo-*` como un color y lo descarta al combinarlo con `text-texto`.

## D1. Una sola definición del botón, con el aspecto del sitio intacto

- **Decisión**: `clasesBoton(variante = 'primaria', opciones?)` sigue siendo la única definición (§VII.3). Sin `opciones` devuelve **exactamente** las clases de hoy para `primaria`, `secundaria` y `peligro`, también con `clasesBoton()` y `clasesBoton(undefined)` (el camino de `Cta.tsx`). Con `opciones` devuelve la versión del panel (D3).
- **Por qué**: RF-016 y CE-005. Un test fija el texto exacto: si el texto no cambia, el aspecto tampoco.
- **Alternativas descartadas**: corregir la base para todos (viola RF-016); una `clasesBotonPanel` aparte (duplica la primitiva, §VII.3 y §VIII); una captura de pantalla de Playwright del sitio (frágil entre máquinas y redundante con el test de texto exacto; la comprobación visual queda en el quickstart).

## D2. Cuatro niveles; el nivel es obligatorio en el panel

- **Decisión**: se agrega `terciaria` a `VarianteBoton`. En el `Button` del panel y en `ConfirmarAccion` la prop `variante` pasa a ser **obligatoria** (14 + 5 usos a completar; `AlertDialogAction` ya la recibe explícita en sus dos usos). `Button` expone `data-nivel` y `data-tamanio` para las pruebas.
- **Aspecto por estado** (contrastes calculados por `revisor-ux-ui` con los tokens actuales):

| Variante | Reposo | Puntero | Presionado | Activo (`aria-pressed`) |
|---|---|---|---|---|
| `primaria` | `bg-marca` / `text-marca-contraste` (5,18:1) | `bg-marca-hover` | `bg-marca-hover` + desplazamiento de 1 px | — |
| `secundaria` | `bg-fondo`, `border-borde` (3,83:1), `text-texto` | `bg-superficie` | `bg-separador` | — |
| `terciaria` | sin fondo, borde transparente, `text-marca` (≥ 4,6:1 sobre fondo, superficie y marca-suave) | `bg-marca-suave` + subrayado | `bg-marca-suave` (4,60:1; con `bg-separador` daba 3,96:1) | `bg-marca-suave`, `text-marca` |
| `peligro` | `bg-error-suave`, `border-error-borde`, `text-error` (5,66:1) + ícono | `bg-fondo` | `bg-separador` | — |

- **Por qué**: RF-001, RF-004 y RF-010. La terciaria en color de marca con subrayado al pasar el puntero se reconoce como acción (el hover sobre `superficie` daba 1,06:1, invisible) y sigue el lenguaje de los enlaces del panel. El ícono en las destructivas evita que se distingan solo por el tono, que un daltónico apenas percibe.
- **Alternativas descartadas**: una regla de ESLint para exigir el nivel (más código y se puede desactivar); `secundaria` por defecto (sigue permitiendo omitirlo).

## D3. Tamaños: estándar y compacto, los dos con 44 px mínimos

- **Decisión**: una sola regla de altura para los dos tamaños: `min-h-(--tactil-min)` y `text-balance`. `estandar` = `px-5`, texto base. `compacto` = `min-w-(--tactil-min)`, `px-3`, texto `text-sm`. Los dos llevan borde de 1 px (transparente en `primaria` y `terciaria`), así todos miden lo mismo con una línea de texto. `BarraAcciones` usa `items-stretch`: si un texto se parte en dos líneas, los botones de esa línea se estiran a la misma altura. `soloIcono` (cuadrado) se tipa como unión discriminada: solo existe con `tamanio: 'compacto'` y exige `aria-label`.
- **Textos de las filas**: los botones de fila llevan el nombre del elemento como sufijo invisible ("Reenviar invitación<span class=\"sr-only\"> a Ana</span>"), así el texto visible es corto, el nombre accesible no cambia (las pruebas que hoy lo usan siguen andando) y el texto visible está al principio del nombre (WCAG 2.5.3).
- **Por qué**: RF-006 a RF-008, CE-003 y el caso borde de textos largos.
- **Alternativas descartadas**: altura fija (`h-11`), que corta los textos largos de las filas; un compacto de 36 px con área ampliada por pseudo-elemento (no lo mide el `boundingBox` de las pruebas y se superpone en las tablas).

## D4. Componentes de estructura

- **Decisión**: en `apps/admin/src/componentes/estructura/`:
  - `EncabezadoPagina` (`titulo`, `descripcion?`, `acciones?`, `refTitulo?`, `tituloEnfocable?`): `h1` con `text-titulo-2`; las acciones de pantalla a la derecha del título desde 768 px y debajo en pantallas angostas. Se aplica en las 11 pantallas con `h1` (categorías y etiquetas comparten `PaginaTaxonomias`). La vista previa queda afuera: su `h1` es el título del artículo con el aspecto del sitio (RF-011).
  - `BarraAcciones` (`children`, `destructivas?`, `alineacion?`): `flex flex-wrap items-stretch gap-3`; las destructivas al final y separadas (`ms-auto` desde 768 px). `AlertDialogFooter` y el pie de `DialogoEdicion` pasan a ser `BarraAcciones alineacion="fin"`: una sola pieza para los pies de diálogo (§VIII), con "Cancelar" primero en el DOM y la confirmación a la derecha, sin `flex-col-reverse` (el orden visual y el del teclado coinciden; excepción de RF-009).
  - `TituloSeccion` (`como: 'h2' | 'legend'`, `id?`): una sola escala, `text-titulo-3`.
  - `EstadoVacio` (`mensaje`, `accion?`): reemplaza los cuatro estados vacíos. La acción va como `Button asChild variante="secundaria"` con `Link`, así "Quitar filtros" sigue siendo un enlace (lo esperan las pruebas de la lista).
- **Por qué**: RF-009, RF-011, RF-012 y RF-014; un componente por patrón garantiza la misma estructura en todas las pantallas.

## D5. Escala tipográfica y espaciado

- **Decisión**:
  - Títulos: pantalla = `titulo-2`; sección = `titulo-3`; títulos de diálogo = `titulo-3`. **No se agrega** un nivel de subsección: ninguna pantalla lo necesita hoy y a 360 px no se distinguiría del de sección.
  - Secciones del editor y del perfil: "Contenido", "Imagen destacada", "Taxonomías", "Para buscadores" y "Publicación" son secciones (`section` con `h2` y `aria-labelledby`), así aparecen en la navegación por encabezados. Los `fieldset` que agrupan controles (por ejemplo las etiquetas) quedan dentro, con su `legend` como etiqueta del grupo.
  - Espaciado: un token nuevo, `--spacing-panel-seccion: clamp(1.5rem, 1rem + 2vw, 2.5rem)` (`gap-panel-seccion`), entre secciones. Dentro de una sección se usa `gap-4` de la escala de Tailwind, como hoy. `--spacing-bloque` (1,5 rem) no sirve: es el espacio entre bloques del sitio y su valor fijo no alcanza para separar secciones del panel en escritorio.
  - `apps/admin/src/lib/cn.ts` pasa a `extendTailwindMerge` con `theme.text: ['titulo-1', 'titulo-2', 'titulo-3']`; sin eso, `cn` descarta `text-titulo-*` al combinarlo con un color.
- **Por qué**: RF-012 y RF-013 con tokens (§VII.1 y §VII.2).

## D6. Estados con un formato único

- **Decisión**: `AvisoEstado` se amplía: `tipo: 'exito' | 'error' | 'advertencia'`, `children: ReactNode` y una zona opcional de acciones. Se migran a él el aviso de `DialogoEdicion`, el resumen de errores del editor, `AvisoConflicto` y el aviso de la vista previa. Su botón "Cerrar aviso" pasa a `Button` terciaria, compacto y solo ícono. La carga sigue con el `loading.tsx` existente, que pasa a imitar `EncabezadoPagina`; no se crea un componente de esqueleto porque hay un solo `loading.tsx`.
- **Por qué**: RF-014.

## D7. La barra del editor sale de funciones puras

- **Decisión**: en `apps/admin/src/componentes/articulo/acciones-disponibles.ts`, junto a `accionesDisponibles`:
  - `accionPrincipalEditor({ estado, guardado, hayCambiosSinGuardar })` → `'guardar' | 'publicar'`: `'publicar'` solo en un borrador guardado sin cambios pendientes.
  - `guardarHabilitado({ guardado, hayCambiosSinGuardar, ocupado })`: en un artículo nuevo, siempre (muestra qué falta completar, como hoy); en uno guardado, solo con cambios.
  - `distribuirBarraEditor({ estado, rol, guardado, hayCambiosSinGuardar })` → `{ enBarra, enMenu }`: qué acción va en la barra y cuál en "Más acciones" en pantallas angostas, con posiciones fijas (D8).
  - Las etiquetas (`ETIQUETAS`) y los anuncios (`ANUNCIOS`) salen de `AccionesEstado.tsx` y se mudan a este archivo; `ahoraLocal()` se muda a `apps/admin/src/lib/fechas.ts` (junto a `aIsoUtc`), con test.
- **Por qué**: RF-005 y RF-019 se prueban con Vitest sin montar nada (§III.5 y §IX.1).

## D8. Barra fija del editor

- **Decisión**: `AccionesEstado.tsx` **se borra** y se reemplaza por:
  - `InfoPublicacion`: la sección "Publicación" (`section` con su `h2`, research D5), con el estado, la fecha y "Ver en el sitio", sin botones.
  - `BarraEditor`: la barra fija, un `role="group"` con nombre "Acciones del artículo". **Posiciones fijas** (excepción de RF-009): Guardar · Publicar · Programar / Cancelar programación / Volver a borrador · Archivar · Vista previa · (separado) Eliminar. Solo cambia el nivel: la principal según `accionPrincipalEditor`, las demás `secundaria`, "Vista previa" `terciaria` y "Eliminar" `peligro`.
  - El texto de estado ("Cambios sin guardar", "Guardado", "Sin cambios", "Subiendo imagen…") va en su propia línea, encima de los botones. "Cambios sin guardar" y "Guardado" siguen en la región `aria-live`; "Sin cambios" queda fuera de ella para no anunciarse junto con "Guardado". "Guardar" deshabilitado se asocia con su motivo por `aria-describedby`.
  - El error del cambio de estado se muestra con `AvisoEstado` encima de la barra, no dentro, para no agrandarla.
  - La lógica de `ejecutar` y `eliminar` va a `componentes/articulo/cambio-de-estado.ts` (hook `useCambioDeEstado`).
- **Por qué**: aclaraciones 1 y 3, y el menor 4 de `revisor-ux-ui`: si "Guardar" y "Publicar" intercambiaran de lugar con la primera tecla, el botón se movería debajo del puntero.

## D9. "Programar" abre un diálogo con fecha

- **Decisión**: se extiende `ConfirmarAccion` en lugar de crear un tercer andamiaje de AlertDialog (ya hay dos: `ConfirmarAccion` y `ProveedorSalida`):
  - nuevas props: `cuerpo?: ReactNode` (el campo de fecha), `abierto`/`alCambiarAbierto` (controlado) y `onConfirmar` que devuelve `boolean | Promise<boolean>`: con `false`, el diálogo no se cierra;
  - `focoInicial?: RefObject<HTMLElement>` para enfocar el campo en lugar de "Cancelar".
  - `DialogoProgramar` es una composición fina sobre `ConfirmarAccion`: título "Programar la publicación", campo "Fecha y hora de publicación" (`datetime-local`, mínimo = `ahoraLocal()`), "Cancelar" `secundaria` y "Programar" `primaria`. Con una fecha que falta, pasada o rechazada por la base, el diálogo no se cierra, el mensaje aparece junto al campo con `role="alert"` y el foco vuelve al campo.
  - "Programar" no es un disparador directo: si hay cambios sin guardar, muestra el aviso de guardar antes (regla de hoy) y no abre el diálogo.
- **Por qué**: aclaración 2, RF-018 y §VIII.2. No hace falta `@radix-ui/react-dialog`.

## D10. "Más acciones" como disclosure, con una sola renderización

- **Decisión**:
  - La barra se renderiza una sola vez. Las acciones que `distribuirBarraEditor` manda al menú están dentro del panel de `MasAcciones`, que en anchos grandes se muestra en línea (`@2xl:contents`) y en angostos queda oculto detrás del botón; el botón "Más acciones" solo se ve en angostos (`@2xl:hidden`). El corte lo decide una *container query* sobre la barra, no el ancho de la ventana, porque la barra comparte el ancho con la navegación lateral desde 1024 px.
  - En angostos la barra usa `tamanio="compacto"` y "Más acciones" es un botón de solo ícono (`aria-label="Más acciones"`, ícono de puntos suspensivos nuevo), así entra en una línea a 360 px (328 px útiles).
  - `MasAcciones` es un *disclosure* (`aria-expanded`, `aria-controls`): abre hacia arriba, con `max-h` y desplazamiento propio para el zoom al 200 %, y relleno para que el anillo de foco no se corte. Esc y el clic afuera lo cierran; Esc devuelve el foco al botón. Se cierra al navegar.
  - El comportamiento de abrir, cerrar con Esc y devolver el foco se extrae de `NavegacionPanel` a `apps/admin/src/lib/desplegable.ts` (`useDesplegable`), con el cierre al cambiar de ruta que ya tiene y el clic afuera.
  - Si `enMenu` queda vacío (por ejemplo en un artículo nuevo), `MasAcciones` no se renderiza.
- **Por qué**: aclaración 4 y RF-019. Una sola renderización evita botones y diálogos duplicados en el DOM, falsos positivos en las pruebas y clones para jscpd.
- **Alternativas descartadas**: dos barras con `md:hidden` / `hidden md:flex` (duplicaban botones y diálogos); `@radix-ui/react-dropdown-menu` (dependencia nueva y semántica `menu`, que exige navegación con flechas).

- **Ajustes de la implementación (2026-10-22)**: el corte del menú es **42 rem** de barra (`@2xl`) y no 48: a 768 px y a 1024 px con la navegación lateral la barra mide cerca de 44 rem, y con 48 el menú aparecía donde la spec pide todas las acciones en línea (RF-019). Los botones de la barra siguen compactos hasta 48 rem (`@3xl`) para que "Cancelar programación" entre en una línea. `ConfirmarAccion` cierra al confirmar, como antes, y solo espera el resultado con `esperarResultado` (lo usa `DialogoProgramar`, que muestra el error junto al campo sin cerrarse): esperar siempre cambió el momento en que los diálogos existentes dejan inerte la página y rompía los E2E de eliminar.

## D11. Foco y anuncios al cambiar de estado

- **Decisión**: los diálogos de la barra (programar y eliminar) son controlados y se montan fuera del panel de `MasAcciones`, así no se desmontan cuando el menú se cierra. Se usa `onCloseAutoFocus` con `preventDefault()` y foco explícito:
  - si el usuario canceló: al botón que abrió el diálogo, si sigue visible; si no, a "Más acciones";
  - si el cambio salió bien: a la nueva acción principal de la barra, junto con el `anunciar(...)` que ya existe ("El artículo quedó programado", etc.).
  - Lo mismo cuando un cambio de estado sin diálogo ("Publicar", "Archivar") hace desaparecer el botón que lo disparó.
- **Por qué**: WCAG 2.4.3. Hoy el foco cae en `body` cuando el botón usado desaparece, y el plan rehace esa pieza.

## D12. Estados del botón: deshabilitado y ocupado

- **Decisión**:
  - **Deshabilitado**: `aria-disabled` (el botón sigue enfocable y se anuncia), `opacity-60` y `cursor-not-allowed`. El `Button` llama a `preventDefault()` en el clic mientras está deshabilitado u ocupado, así un `type="submit"` no envía el formulario (tampoco con Enter) y un enlace con `asChild` no navega.
  - **Ocupado** (`ocupado`): la etiqueta va en un `span` con `opacity-0` (conserva el ancho y el nombre accesible, y se respeta en alto contraste), un indicador encima con `aria-hidden` y `currentColor`, un `<span role="status" class="sr-only">` con el texto de la acción en curso (por ejemplo "Ingresando…", por prop `textoOcupado`) y el botón queda además `aria-disabled`. Con `prefers-reduced-motion`, el indicador no gira.
  - `ocupado` y `soloIcono` no se pueden combinar con `asChild` (el `Slot` exige un único hijo); el tipo lo impide.
- **Por qué**: RF-010. `aria-busy` en un botón no lo anuncia ningún lector de pantalla y `text-transparent` falla en alto contraste.

## D13. Pruebas sin dependencias nuevas

- **Decisión**: no se agregan jsdom ni Testing Library (§II). En consecuencia:
  - **Vitest** (entorno `node`): `packages/ui/src/clases.test.ts` (texto exacto sin opciones, variantes, estados y tamaños); `acciones-disponibles.test.ts` (`accionPrincipalEditor`, `guardarHabilitado`, `distribuirBarraEditor` en los 4 estados × 2 roles × con y sin cambios, y el artículo nuevo); `lib/fechas.test.ts` (`ahoraLocal`); y tests de render estático (`renderToStaticMarkup`, como en `packages/bloques`) de `Button`, `EncabezadoPagina`, `BarraAcciones`, `TituloSeccion`, `EstadoVacio` y `AvisoEstado`: atributos `data-*` y `aria-*`, orden en el DOM y sufijos `sr-only`.
  - **Playwright** para todo lo interactivo: `e2e/admin/jerarquia.spec.ts` (una principal visible por contexto según la matriz, alturas y alineación, área táctil, una sola línea a 360 px en los 4 estados con rol admin, "Más acciones" con teclado, foco después de cambiar de estado, diálogo de programar, orden de las barras, rol editor sin huecos, textos largos a 360 px y zoom al 200 %). Cuenta solo elementos visibles y, con un diálogo abierto, solo dentro del diálogo. `ANCHOS` y `PANTALLAS` pasan de `accesibilidad.spec.ts` a `e2e/admin/ayudas/pantallas.ts` para no duplicarlos.
  - **Pruebas existentes a adaptar** (CE-006): `e2e/admin/ayudas/estado.ts` (los botones salen del grupo "Publicación" y pasan al grupo "Acciones del artículo"; programar abre un diálogo), `programacion.spec.ts`, `publicacion.spec.ts`, `permisos.spec.ts` (la aserción "Eliminar no existe" tiene que buscar en la barra nueva, o pasaría en falso), `casos-borde.spec.ts`, `accesibilidad.spec.ts`, `lista-articulos.spec.ts` y `articulo-editor.spec.ts`.
  - **Lighthouse** (CE-004) con el procedimiento de T103 de la spec 003.
- **Por qué**: cada criterio de aceptación queda con al menos una prueba (§IX.5) sin abrir el stack.
