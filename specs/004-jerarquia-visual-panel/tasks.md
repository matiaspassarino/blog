---

description: "Lista de tareas: jerarquía visual del panel"
---

# Tareas: Jerarquía visual del panel

**Entrada**: Documentos de diseño en `/specs/004-jerarquia-visual-panel/`: [plan.md](plan.md), [spec.md](spec.md) (con Aclaraciones y Revisión del plan), [research.md](research.md) (D1–D13), [data-model.md](data-model.md), [contracts/componentes.md](contracts/componentes.md), [contracts/matriz-acciones.md](contracts/matriz-acciones.md) y [quickstart.md](quickstart.md).

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: OBLIGATORIOS (constitucion.md §IX). En cada fase, las tareas de test van primero, las escribe el agente `escritor-tests` y **deben fallar** antes de implementar. Sin dependencias nuevas (research D13): los tests de Vitest de componentes son de render estático (`renderToStaticMarkup`, entorno `node`, como `packages/bloques/src/render/*.test.tsx`); toda la interacción (teclado, foco, diálogos, menús) se prueba con Playwright.

**Organización**: Por historia de usuario de spec.md: H1 (acción principal, P1), H2 (botones parejos, P1) y H3 (pantallas que guían la vista, P2). La fase fundacional deja lista la primitiva del botón y las piezas que usan las tres historias.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Puede ejecutarse en paralelo: toca archivos distintos y no depende de tareas incompletas.
- **[Historia]**: H1, H2 o H3, según spec.md.

## Convenciones de rutas

- Compartido: `packages/ui/src/` (`clases.ts`, `tokens.css`).
- Panel: `apps/admin/src/` (`componentes/`, `componentes/estructura/` nuevo, `componentes/articulo/`, `lib/`, `app/`).
- E2E: `e2e/admin/` (proyecto `admin` de `playwright.config.ts`, `http://localhost:3100`).
- Reglas transversales:
  - **Next 16**: antes de escribir código en `apps/admin`, leer las guías de `apps/admin/node_modules/next/dist/docs/` indicadas en la tarea (`apps/admin/AGENTS.md`).
  - **UI**: solo tokens de `packages/ui/src/tokens.css`, sin hex, px sueltos ni valores arbitrarios (`[...]`) (§VII.2); un `h1` por pantalla; textos en español con tuteo; los textos visibles de las acciones no cambian (RF-017), salvo los sufijos `sr-only` de las filas (research D3), que mantienen el nombre accesible.
  - **Nivel de cada acción**: el de [contracts/matriz-acciones.md](contracts/matriz-acciones.md); ninguna queda principal por omisión (RF-004).
  - **Sitio público**: `clasesBoton` sin opciones no cambia su resultado (RF-016); no se toca `apps/web` ni `packages/bloques`.
  - Antes de crear un archivo, revisar "Reutilización" en [plan.md](plan.md) (§VIII). Archivos que no son componentes en kebab-case (§XII).
  - Memoria: en una PC de 8 GB, correr Playwright contra el build (`pnpm --filter admin build && pnpm --filter admin exec next start -p 3100`) y con `--workers=1` ([quickstart.md](quickstart.md#verificación-automática)).

---

## Fase 1: Preparación

**Propósito**: Ayudas de prueba compartidas, para que las fases siguientes no dupliquen código (§VIII, jscpd también cuenta `e2e/`).

- [X] T001 Crear `e2e/admin/ayudas/pantallas.ts` y mudar ahí `ANCHOS` (360, 768, 1024, 1440) y `PANTALLAS` desde `e2e/admin/accesibilidad.spec.ts`, que pasa a importarlos. Correr `pnpm exec playwright test e2e/admin/accesibilidad.spec.ts --list` para confirmar que no cambió el número de pruebas.
- [X] T002 [P] Crear `e2e/admin/ayudas/jerarquia.ts` con las ayudas que usan los tests de jerarquía (research D13): `accionesPorNivel(contexto)` (cuenta solo elementos `:visible` con `[data-nivel]`; con un `role="alertdialog"` o `dialog` abierto, cuenta solo dentro de él), `alturasDelGrupo(locator)` y `estaAlineado(a, b)` (por `boundingBox`), `areaTactil(locator)` (≥ 44 × 44), `ocupaUnaLinea(locator)` (todos los hijos visibles con el mismo `y`) y `barraDelEditor(page)` (el `group` "Acciones del artículo").

---

## Fase 2: Fundacional (bloqueante)

**Propósito**: La primitiva del botón con niveles, estados y tamaños, los tokens, `cn`, los íconos y las piezas de estructura que usan las tres historias. Ninguna historia puede empezar antes.

### Tests (escribir primero, deben fallar)

- [X] T003 [P] Crear `packages/ui/src/clases.test.ts` (research D1–D3, contrato `clasesBoton`):
  - **Sitio intacto (RF-016, CE-005)**: el texto exacto de hoy para `clasesBoton()`, `clasesBoton(undefined)`, `clasesBoton('primaria')`, `clasesBoton('secundaria')` y `clasesBoton('peligro')` (copiarlo literalmente del `clases.ts` actual antes de modificarlo).
  - Con `opciones`: las cuatro variantes contienen `min-h-(--tactil-min)`, `text-balance` y un borde de 1 px (transparente en `primaria` y `terciaria`); los estados de la tabla de research D2 (puntero, presionado con `active:`, `aria-pressed:` en `terciaria`, `aria-disabled:` y `disabled:`); `compacto` con `min-w-(--tactil-min)`, `px-3` y `text-sm`; `estandar` con `px-5`; `soloIcono` cuadrado.
  - Ninguna clase usa valores arbitrarios (`[`), hex ni `px` sueltos.
  - **Contraste (CE-004)**: para cada variante en reposo, sobre el puntero, presionado y deshabilitado, calcular la relación de contraste entre el color del texto y el del fondo a partir de los valores de `tokens.css` (texto normal ≥ 4,5:1; el deshabilitado queda exento por WCAG, pero debe distinguirse del reposo). Si el test no puede resolver un token, falla con su nombre.
- [X] T004 [P] Crear `apps/admin/src/componentes/ui/button.test.tsx` (render estático, contrato `Button`): `data-nivel` y `data-tamanio` según las props; `tamanio` por defecto `estandar`; con `ocupado`, la etiqueta en un `span` con `opacity-0`, un indicador con `aria-hidden`, un `<span role="status" class="sr-only">` con `textoOcupado` y `aria-disabled="true"`; con `soloIcono`, el `aria-label` presente. Agregar los casos de tipos con `// @ts-expect-error` (sin `variante`, `soloIcono` sin `compacto` o sin `aria-label`, `ocupado` con `asChild`); `pnpm typecheck` los verifica.
- [X] T005 [P] Crear `apps/admin/src/componentes/estructura/estructura.test.tsx` (render estático) para `BarraAcciones`: `flex flex-wrap items-stretch gap-3`; `destructivas` al final del DOM y con `ms-auto` desde 768 px; con `etiqueta`, `role="group"` y `aria-label`; con `alineacion="fin"`, `justify-end` y "Cancelar" antes de la confirmación en el DOM. Este archivo lo amplían T034 y T044.

### Implementación

- [X] T006 `packages/ui/src/clases.ts`: agregar `terciaria` a `VarianteBoton`, los tipos `TamanioBoton` y `OpcionesBoton` (unión discriminada: `soloIcono: true` solo con `tamanio: 'compacto'`) y el segundo parámetro de `clasesBoton`. **Sin `opciones`, el resultado es idéntico al de hoy** (y `variante = 'primaria'` por defecto). Con `opciones`, una base del panel con `min-h-(--tactil-min)`, `text-balance` y borde de 1 px, y los estados de research D2: `primaria` (`bg-marca`, `hover:bg-marca-hover`, `active:bg-marca-hover` y desplazamiento de 1 px), `secundaria` (`bg-fondo border-borde text-texto`, `hover:bg-superficie`, `active:bg-separador`), `terciaria` (`border-transparent text-marca`, `hover:bg-marca-suave hover:underline`, `active:bg-marca-suave`, `aria-pressed:bg-marca-suave`) y `peligro` (`bg-error-suave border-error-borde text-error`, `hover:bg-fondo`, `active:bg-separador`). T003 en verde.
- [X] T007 [P] `packages/ui/src/tokens.css`: agregar `--spacing-panel-seccion: clamp(1.5rem, 1rem + 2vw, 2.5rem);` con un comentario ("separación entre secciones del panel; dentro de una sección se usa `gap-4`"). Si `packages/ui/src/tokens.test.ts` enumera los tokens, sumarlo ahí.
- [X] T008 [P] `apps/admin/src/lib/cn.ts`: pasar de `twMerge` a `extendTailwindMerge` con `extend: { theme: { text: ['titulo-1', 'titulo-2', 'titulo-3'] } }` (research D5). Agregar `apps/admin/src/lib/cn.test.ts` que verifique que `cn('text-titulo-3 font-semibold', 'text-texto')` conserva `text-titulo-3`.
- [X] T009 [P] `apps/admin/src/componentes/Icono.tsx`: agregar los íconos `mas` (tres puntos horizontales) y `papelera`, con el mismo formato de trazado que los existentes (`currentColor`, `aria-hidden` por defecto).
- [X] T010 `apps/admin/src/componentes/ui/button.tsx` (depende de T006): implementar el contrato `Button` de [contracts/componentes.md](contracts/componentes.md#button-appsadminsrccomponentesuibuttontsx--modificado) **conservando por ahora `variante = 'primaria'` por defecto** (se vuelve obligatoria en T030): `tamanio` (por defecto `estandar`), `soloIcono`, `ocupado` + `textoOcupado`, `data-nivel` y `data-tamanio`; con `aria-disabled` u `ocupado`, `preventDefault()` en el clic y sin llamar a `onClick` (un `type="submit"` no envía, tampoco con Enter, y un enlace con `asChild` no navega); el indicador de ocupado sin giro con `prefers-reduced-motion`. Pasar `{ tamanio }` a `clasesBoton`, así todo el panel usa la versión con borde y alto parejos. T004 en verde (salvo los `@ts-expect-error` de `variante`, que pasan en T030).
- [X] T011 [P] Crear `apps/admin/src/componentes/estructura/BarraAcciones.tsx` según el contrato. T005 en verde.
- [X] T012 `apps/admin/src/componentes/ui/alert-dialog.tsx` (depende de T011): `AlertDialogFooter` pasa a renderizar `BarraAcciones alineacion="fin"` (sin `flex-col-reverse`: "Cancelar" primero en el DOM y la confirmación a la derecha, excepción de RF-009); reemplazar `w-[calc(100%-2rem)]` por utilidades sin valores arbitrarios (por ejemplo `inset-x-4 mx-auto max-w-md`).

**Checkpoint**: `pnpm test --filter @blog/ui`, `pnpm --filter admin test` y `pnpm typecheck` en verde; el panel se ve con alturas parejas y el sitio sin cambios.

---

## Fase 3: Historia 1 - Reconocer la acción principal de cada pantalla (Prioridad: P1) 🎯 MVP

**Objetivo**: Cada pantalla y diálogo tiene como máximo una acción principal, con el nivel de la matriz; en el editor, "Guardar" y las acciones de estado se juntan en la barra fija con posiciones fijas, y "Programar" abre un diálogo con fecha.

**Prueba independiente**: recorrer la [matriz de acciones](contracts/matriz-acciones.md) en 1440 px y comprobar una sola principal por contexto, las destructivas con su estilo y la barra del editor en los cinco casos (nuevo y cuatro estados).

### Tests de la Historia 1 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T013 [P] [H1] Ampliar `apps/admin/src/componentes/articulo/acciones-disponibles.test.ts` con las tablas de [data-model.md](data-model.md#acción-principal-del-editor-accionprincipaleditor): `accionPrincipalEditor` (artículo nuevo → `guardar`; borrador guardado sin cambios → `publicar`; con cambios → `guardar`; programado, publicado y archivado → `guardar`), `guardarHabilitado` (nuevo: siempre salvo `ocupado`; guardado: solo con cambios y sin `ocupado`) y `distribuirBarraEditor` (los 4 estados × admin y editor × con y sin cambios, más el artículo nuevo: orden fijo "Guardar · Publicar · (Programar | Cancelar programación | Volver a borrador) · Archivar · Vista previa · Eliminar", qué va en `enBarra` y en `enMenu`, "Eliminar" solo para el admin y al final, `enMenu` vacío en el artículo nuevo).
- [X] T014 [P] [H1] Crear `apps/admin/src/lib/fechas.test.ts` (o ampliar el existente) para `ahoraLocal()`: formato `YYYY-MM-DDTHH:mm` en la hora local, con un reloj fijo (`vi.useFakeTimers`) y dos zonas horarias (`process.env.TZ`).
- [X] T015 [P] [H1] Crear `e2e/admin/jerarquia.spec.ts`, bloque "Acción principal" (CE-001, CE-002; usa `e2e/admin/ayudas/jerarquia.ts` y `pantallas.ts`): por cada fila de la matriz, en 1440 px, exactamente las acciones indicadas por nivel (como máximo una `primaria` visible por contexto y ninguna `peligro` como principal); los diálogos se abren y se cuentan solos. Editor con el admin: artículo nuevo (solo "Guardar", habilitado y principal; sin "Vista previa"), borrador sin cambios ("Publicar" principal, "Guardar" deshabilitado con "Sin cambios" asociado por `aria-describedby`), al escribir ("Guardar" principal **en la misma posición** que antes), programado, publicado y archivado. "Eliminar" separado al final y con ícono; como editor, no existe y la barra no deja hueco.
- [X] T016 [P] [H1] En `e2e/admin/jerarquia.spec.ts`, bloque "Foco al cambiar de estado" (research D11): publicar un borrador desde la barra deja el foco en la nueva acción principal y se anuncia "El artículo se publicó"; cancelar el diálogo de programar devuelve el foco a "Programar"; eliminar (admin) navega a la lista.
- [X] T017 [H1] Adaptar las pruebas existentes (plan.md, "Pruebas existentes a adaptar"; deben fallar contra el código actual): `e2e/admin/ayudas/estado.ts` (los botones de estado y su error se buscan en `barraDelEditor`; `InfoPublicacion` es la sección "Publicación"; programar = clic en "Programar", completar "Fecha y hora de publicación" **dentro del diálogo** "Programar la publicación" y confirmar con su "Programar"); `e2e/admin/programacion.spec.ts` (la nueva secuencia; el `min` del campo se lee con el diálogo abierto; fecha pasada → el diálogo sigue abierto con el mensaje y el foco en el campo; con cambios sin guardar, "Programar" muestra el aviso y no abre el diálogo); `e2e/admin/publicacion.spec.ts` (el campo de fecha y `accionesVisibles` por la ayuda; los errores "Para publicar falta…"); `e2e/admin/permisos.spec.ts` (la ausencia de "Eliminar" para el editor se verifica sobre `barraDelEditor`, comprobando antes que la barra existe y tiene "Guardar", para que no pase en falso); `e2e/admin/casos-borde.spec.ts` y `e2e/admin/articulo-editor.spec.ts` (el aviso "Cambios sin guardar" en la línea de estado de la barra); `e2e/admin/accesibilidad.spec.ts` ("Guardar" en un artículo nuevo sigue habilitado; axe con el diálogo de programar abierto).

### Implementación de la Historia 1

- [X] T018 [P] [H1] `apps/admin/src/lib/fechas.ts`: mudar `ahoraLocal()` desde `componentes/articulo/AccionesEstado.tsx` y exportarla. T014 en verde.
- [X] T019 [H1] `apps/admin/src/componentes/articulo/acciones-disponibles.ts`: agregar `accionPrincipalEditor`, `guardarHabilitado`, `distribuirBarraEditor` y el tipo `AccionBarra` según el contrato; mudar `ETIQUETAS` y `ANUNCIOS` desde `AccionesEstado.tsx`. La entrada lleva `guardado` (el artículo tiene `id`). T013 en verde.
- [X] T020 [H1] Crear `apps/admin/src/componentes/articulo/cambio-de-estado.ts` (hook `useCambioDeEstado`, extraído de `ejecutar` y `eliminar` de `AccionesEstado.tsx`): exige guardar antes si hay cambios (devuelve el aviso de hoy, "Guarda los cambios antes de cambiar el estado."), llama a `cambiarEstadoAccion` y `eliminarArticuloAccion`, anuncia con `ANUNCIOS` y devuelve el estado nuevo para mover el foco. Leer antes `01-app/03-api-reference/04-functions/use-router.md` de las guías de Next.
- [X] T021 [H1] `apps/admin/src/componentes/ConfirmarAccion.tsx`: implementar el contrato (`variante` obligatoria; `cuerpo`, `focoInicial`, modo controlado `abierto`/`alCambiarAbierto`, `onConfirmar` que no cierra con `false`, `alCerrar(motivo)`); usar `onOpenAutoFocus` para `focoInicial` y `onCloseAutoFocus` con `preventDefault()` para que quien lo usa decida el foco (research D11). Completar `variante` en sus 5 usos actuales (`AccionesEstado`, `AvisoConflicto`, `ImagenEditable`, `TablaEquipo` y `GestorTaxonomias`: todos `peligro`).
- [X] T022 [H1] Crear `apps/admin/src/componentes/articulo/DialogoProgramar.tsx` (depende de T018 y T021): composición controlada sobre `ConfirmarAccion` con título "Programar la publicación", `CampoFormulario` + `Input type="datetime-local"` "Fecha y hora de publicación" con `min={ahoraLocal()}` y foco inicial, "Cancelar" `secundaria` y "Programar" `primaria`; sin fecha → "Elige la fecha y hora de publicación."; fecha pasada o rechazo de la base → el mensaje de hoy. En ambos casos no se cierra, el mensaje va con `role="alert"` y `aria-describedby`, y el foco vuelve al campo.
- [X] T023 [P] [H1] Crear `apps/admin/src/componentes/articulo/InfoPublicacion.tsx`: sección "Publicación" (`section` + `h2` con `aria-labelledby`) con el `Badge` del estado, la fecha de publicación o programación (`FechaLocal`) y "Ver en el sitio" para los publicados; sin botones.
- [X] T024 [H1] Crear `apps/admin/src/componentes/articulo/BarraEditor.tsx` (depende de T019–T022): `role="group"` "Acciones del artículo" con `BarraAcciones`; línea de estado arriba ("Cambios sin guardar" y "Guardado" en la región `aria-live`; "Sin cambios" y "Subiendo imagen…" fuera de ella y asociados a "Guardar" por `aria-describedby`); botones en el orden fijo de `distribuirBarraEditor` (en esta historia todos en línea; "Más acciones" llega en T038), con la principal según `accionPrincipalEditor` y el resto `secundaria`, "Vista previa" `terciaria` (`asChild` con `EnlaceConAviso`) y "Eliminar" `peligro` con ícono en `destructivas`; "Programar" abre `DialogoProgramar` (antes, si hay cambios sin guardar, muestra el aviso y no lo abre); los diálogos de programar y eliminar montados fuera de los grupos de botones; el error del cambio de estado en un `AvisoEstado` encima de la barra; foco después de cada acción según research D11 (a la nueva principal, o al disparador al cancelar).
- [X] T025 [H1] `apps/admin/src/componentes/editor/EditorArticulo.tsx` (depende de T023 y T024): reemplazar la barra fija de "Guardar" y el montaje de `AccionesEstado` por `BarraEditor` (en `/articulos/nuevo`, con `guardado = false`) e `InfoPublicacion` (solo con `id`); "Guardar" usa `guardarHabilitado` y `ocupado` con `textoOcupado="Guardando…"`. Borrar `apps/admin/src/componentes/articulo/AccionesEstado.tsx` y su test si existe, y confirmar con `pnpm calidad` que knip no marca exports ni archivos muertos.
- [X] T026 [P] [H1] Niveles del acceso según la matriz: `componentes/acceso/FormularioIngreso.tsx` ("Ingresar" `primaria`; "Mostrar contraseña" `terciaria` compacta con `aria-pressed`), `FormularioRecuperacion.tsx`, `FormularioNuevaContrasena.tsx` y `ConfirmarEnlace.tsx` (su envío `primaria`). Los textos "Ingresando…", "Enviando…", "Guardando…" y "Verificando…" pasan a `ocupado` + `textoOcupado` (la etiqueta visible queda fija).
- [X] T027 [P] [H1] Niveles del resto de las pantallas según la matriz: `app/(panel)/articulos/(lista)/page.tsx` ("Nuevo artículo" `primaria`), `componentes/articulo/FiltrosArticulos.tsx` ("Filtrar" `secundaria`), `app/not-found.tsx` y `app/forbidden.tsx` ("Ir a los artículos" `secundaria`), `app/(panel)/layout.tsx` ("Cerrar sesión" `terciaria`), `componentes/NavegacionPanel.tsx` (menú `terciaria` compacta con ícono y texto), `componentes/taxonomia/FormularioAlta.tsx` (`primaria`), `GestorTaxonomias.tsx` ("Editar" `secundaria`, "Eliminar" `peligro` con ícono), `DialogoEdicion.tsx` ("Guardar cambios" `primaria`, "Cancelar" `secundaria`), `componentes/equipo/FormularioInvitacion.tsx` (`primaria`), `TablaEquipo.tsx` ("Reenviar invitación" y "Reactivar" `secundaria`, "Desactivar" `peligro` con ícono), `componentes/perfil/FormularioPerfil.tsx` ("Guardar perfil" `primaria`), `componentes/salida/ProveedorSalida.tsx` ("Seguir editando" `secundaria`, "Salir sin guardar" `peligro`).
- [X] T028 [P] [H1] Niveles del editor según la matriz: `componentes/editor/SelectorImagen.tsx` ("Elegir imagen"/"Agregar imagen" `secundaria`), `ImagenEditable.tsx` ("Quitar imagen" `peligro` con ícono, también en su confirmación), `AvisoConflicto.tsx` ("Ver la versión vigente" `secundaria`, "Reemplazar con la vigente" `peligro`), `BarraMarcas.tsx` (`terciaria` compacta), `ListaBloques.tsx` y `bloques/EditorLista.tsx` (acciones del bloque y "Quitar ítem" `terciaria` compacta; "Agregar bloque" y "Agregar ítem" `secundaria`; sin cambios de comportamiento: spec 005).
- [X] T029 [H1] Íconos de las destructivas (research D2): `Eliminar`, `Quitar imagen` y `Salir sin guardar` con `papelera`; `Desactivar` con `prohibido`; `Reemplazar` y `Reemplazar con la vigente` con `prohibido`. Todos `aria-hidden`, delante del texto.
- [X] T030 [H1] `apps/admin/src/componentes/ui/button.tsx`: quitar el valor por defecto de `variante` (obligatoria, RF-004). `pnpm typecheck` debe pasar sin ningún `Button` sin nivel; si falla, completar el nivel según la matriz. T004 completo en verde.

**Checkpoint**: T013–T017 en verde; la matriz se cumple en 1440 px; programar, publicar, archivar y eliminar funcionan desde la barra.

---

## Fase 4: Historia 2 - Botones parejos y alineados (Prioridad: P1)

**Objetivo**: Mismas alturas y alineación en todos los grupos, dos tamaños de 44 px, filas compactas, barra del editor en una línea a 360 px con "Más acciones", y estados deshabilitado y ocupado estables.

**Prueba independiente**: en 360, 768, 1024 y 1440 px, medir cada barra o grupo del panel (alturas, alineación, área táctil, una línea en el editor) y usar "Más acciones" solo con el teclado.

### Tests de la Historia 2 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T031 [P] [H2] En `e2e/admin/jerarquia.spec.ts`, bloque "Botones parejos" (CE-003, H2 esc. 1–3 y 6): en los cuatro anchos y en cada pantalla de `PANTALLAS`, todos los botones de un grupo con la misma altura y alineados; cada control con área ≥ 44 × 44; "Filtrar" alineado con los campos de filtro (no con sus etiquetas); las filas de categorías, etiquetas y equipo con `data-tamanio="compacto"`; al guardar en el editor y en el perfil, el botón ocupado conserva el ancho.
- [X] T032 [P] [H2] En `e2e/admin/jerarquia.spec.ts`, bloque "Barra del editor angosta" (RF-019, H2 esc. 4): a 360 px y con el admin, en el artículo nuevo y en los cuatro estados, la barra ocupa una línea (`ocupaUnaLinea`) con lo indicado en [data-model.md](data-model.md#barra-del-editor-distribuirbarraeditor) y el resto dentro de "Más acciones"; el botón tiene `aria-label="Más acciones"`, `aria-expanded` y `aria-controls`; se abre con Enter, se recorre con Tab, Esc lo cierra y devuelve el foco, el clic afuera lo cierra; "Eliminar" al final tras un separador; "Programar" desde el menú abre el diálogo y, al cancelar, el foco vuelve a "Más acciones". A 768 px (sin navegación lateral), a 1024 px (con la navegación lateral) y a 1440 px, todo en línea y sin el botón (RF-019: desde 768 px se ven todas las acciones; si la *container query* de 42 rem no lo cumple en 768 px, ajustar el umbral en T037 y T038).
- [X] T033 [P] [H2] En `e2e/admin/jerarquia.spec.ts`, bloque "Orden y casos borde" (H2 esc. 5, RF-008, RF-009): fuera del editor, a 360 px, las barras se reacomodan sin cortes ni superposiciones y la principal es la primera en el orden de tabulación; destructivas al final; los botones de fila muestran texto corto y mantienen el nombre accesible completo (por ejemplo "Reenviar invitación a …"); con zoom al 200 % (viewport de 720 px a escala 2) los grupos no se salen de la pantalla y el panel de "Más acciones" se puede desplazar.
- [X] T034 [P] [H2] Ampliar `apps/admin/src/componentes/estructura/estructura.test.tsx` para `MasAcciones` (render estático): botón `terciaria`, compacto, solo ícono, con `aria-label`, `aria-expanded="false"` y `aria-controls` que apunta al panel; destructivas después de un separador; sin hijos no renderiza nada.

### Implementación de la Historia 2

- [X] T035 [H2] Crear `apps/admin/src/lib/desplegable.ts` (`useDesplegable`, contrato): extraer de `componentes/NavegacionPanel.tsx` el abrir y cerrar, el cierre con Esc devolviendo el foco y el cierre al cambiar de ruta (`usePathname`); agregar el cierre con clic fuera del botón y del panel. Leer antes `01-app/03-api-reference/04-functions/use-pathname.md`.
- [X] T036 [H2] `apps/admin/src/componentes/NavegacionPanel.tsx` (depende de T035): usar `useDesplegable`, sin cambiar su comportamiento ni sus textos ("Menú" / "Cerrar menú"). Las pruebas de navegación existentes siguen en verde.
- [X] T037 [H2] Crear `apps/admin/src/componentes/estructura/MasAcciones.tsx` (depende de T035): contrato; el botón visible solo por debajo de 42 rem del contenedor (`@2xl:hidden`) y el panel oculto hasta abrirse, con `@2xl:contents` desde ese ancho; abre hacia arriba con `max-h` y desplazamiento propio, relleno para el anillo de foco y separador antes de las destructivas; se cierra al ejecutar una acción; no se renderiza sin hijos. T034 en verde.
- [X] T038 [H2] `apps/admin/src/componentes/articulo/BarraEditor.tsx` (depende de T037): la barra es un contenedor (`@container`); por debajo de 42 rem los botones usan `tamanio="compacto"` y las acciones de `enMenu` van dentro de `MasAcciones` (una sola renderización, research D10); los diálogos siguen montados fuera del panel del menú; al cerrar un diálogo abierto desde el menú, el foco va a "Más acciones" si el disparador quedó oculto. T032 en verde.
- [X] T039 [P] [H2] Filas compactas con sufijo `sr-only` (research D3): `componentes/taxonomia/GestorTaxonomias.tsx` ("Editar" y "Eliminar" + `<span className="sr-only"> {nombre}</span>`) y `componentes/equipo/TablaEquipo.tsx` ("Reenviar invitación", "Desactivar" y "Reactivar" + sufijo con el nombre), todos con `tamanio="compacto"`; el selector de rol con la misma altura que los botones de la fila.
- [X] T040 [P] [H2] `apps/admin/src/componentes/articulo/Paginacion.tsx`: reemplazar las clases armadas a mano por `clasesBoton('secundaria', { tamanio: 'compacto' })` y mantener el estilo de `aria-current="page"` por encima (§VII.3).
- [X] T041 [P] [H2] Ajustes de alineación y ancho: quitar los `self-start`, `px-3`, `w-full` y `mt-2` sueltos de los botones (la alineación la da `BarraAcciones` o el formulario); en `componentes/articulo/FiltrosArticulos.tsx`, alinear "Filtrar" con el borde inferior de los campos (`items-end` en el contenedor); en `app/(panel)/layout.tsx`, "Cerrar sesión" sin `w-full` ni `mt-2`.
- [X] T042 [P] [H2] `apps/admin/src/componentes/taxonomia/DialogoEdicion.tsx`: pie con `BarraAcciones alineacion="fin"` ("Cancelar" primero en el DOM), quitar `w-[calc(100%-2rem)]` (mismas utilidades que T012) y `ocupado` en "Guardar cambios".
- [X] T043 [P] [H2] Estado ocupado en los formularios del panel (RF-010): `FormularioAlta`, `FormularioInvitacion` y `FormularioPerfil` usan `ocupado` + `textoOcupado` en lugar de solo `aria-disabled` mientras envían.

**Checkpoint**: T031–T034 en verde en los cuatro anchos; la barra del editor entra en una línea a 360 px en los cinco casos.

---

## Fase 5: Historia 3 - Pantallas que guían la vista (Prioridad: P2)

**Objetivo**: Mismo encabezado en todas las pantallas, una sola escala de títulos de sección, espaciado que marca la estructura y estados con un formato único.

**Prueba independiente**: comparar las pantallas entre sí: encabezado, títulos de sección, separación entre secciones y estados vacío, carga, error, éxito y advertencia.

### Tests de la Historia 3 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T044 [P] [H3] Ampliar `apps/admin/src/componentes/estructura/estructura.test.tsx`: `EncabezadoPagina` (un `h1` con `text-titulo-2`; `descripcion` con `text-sm text-texto-suave`; acciones en un contenedor que pasa al lado del título desde 768 px; `tituloEnfocable` agrega `tabIndex={-1}`), `TituloSeccion` (`h2` o `legend` con `font-titulos text-titulo-3 font-semibold`) y `EstadoVacio` (mensaje y enlace con `data-nivel="secundaria"`).
- [X] T045 [P] [H3] Crear `apps/admin/src/componentes/AvisoEstado.test.tsx` (render estático): los tres tipos (`exito`, `error` y `advertencia`) con sus tokens (`*-suave`, `*-borde`, texto); `children` con elementos; `acciones` al final; el botón de cerrar es `terciaria`, compacto, solo ícono, con `aria-label="Cerrar aviso"`.
- [X] T046 [P] [H3] En `e2e/admin/jerarquia.spec.ts`, bloque "Estructura" (H3 esc. 1–4): en cada pantalla (menos la vista previa) un `h1` dentro del encabezado; la acción principal en la ubicación de la columna "Ubic." de la matriz; en el editor y el perfil, todos los títulos de sección con el mismo tamaño de fuente y la separación entre secciones mayor que la separación dentro de ellas; el editor tiene un `h2` por sección ("Contenido", "Imagen destacada", "Taxonomías", "Para buscadores" y "Publicación"); la lista sin resultados, categorías sin elementos y la tabla de equipo vacía usan el mismo componente (`data-estado="vacio"`); el texto de apoyo (fechas, ayudas, conteos) con el mismo color y tamaño en todas las pantallas.
- [X] T047 [H3] Adaptar `e2e/admin/lista-articulos.spec.ts` (el vacío con "Quitar filtros" como enlace dentro de `EstadoVacio`) y revisar `e2e/admin/accesibilidad.spec.ts` ("único h1" sigue valiendo, incluida la vista previa).

### Implementación de la Historia 3

- [X] T048 [P] [H3] Crear `apps/admin/src/componentes/estructura/EncabezadoPagina.tsx` y `TituloSeccion.tsx` según el contrato.
- [X] T049 [P] [H3] Crear `apps/admin/src/componentes/estructura/EstadoVacio.tsx` (con `data-estado="vacio"`; la acción como `Button asChild variante="secundaria"` con `Link`).
- [X] T050 [P] [H3] `apps/admin/src/componentes/AvisoEstado.tsx`: `tipo: 'advertencia'`, `children: ReactNode`, `acciones?` y el botón de cerrar con `Button` (`terciaria`, `compacto`, `soloIcono`, ícono `cerrar`). T045 en verde.
- [X] T051 [H3] Aplicar `EncabezadoPagina` (depende de T048) en `app/(publico)/ingreso/page.tsx`, `olvide-contrasena/page.tsx`, `auth/confirmar/page.tsx`, `definir-contrasena/page.tsx`, `app/(panel)/articulos/(lista)/page.tsx` ("Nuevo artículo" en `acciones`), `app/(panel)/equipo/page.tsx`, `app/(panel)/perfil/page.tsx`, `componentes/taxonomia/PaginaTaxonomias.tsx`, `app/not-found.tsx`, `app/forbidden.tsx` y `componentes/editor/EditorArticulo.tsx` (`refTitulo` y `tituloEnfocable`). La vista previa (`app/(panel)/articulos/[id]/vista-previa/page.tsx`) conserva su `h1` con el aspecto del sitio. Ajustar `app/(panel)/articulos/(lista)/loading.tsx` para que imite el encabezado (mismo alto del título y de la acción). Leer antes `01-app/03-api-reference/03-file-conventions/loading.md`.
- [X] T052 [H3] Secciones y títulos (depende de T048): en `componentes/editor/EditorArticulo.tsx`, "Contenido", "Imagen destacada", "Taxonomías" y "Para buscadores" pasan a `section` + `TituloSeccion como="h2"` con `aria-labelledby` (los `fieldset` de controles quedan dentro con su `legend`); `InfoPublicacion` usa `TituloSeccion`; en `componentes/perfil/FormularioPerfil.tsx` y en las pantallas con `h2` (`text-xl`), usar `TituloSeccion`; títulos de diálogo: `AlertDialogTitle` en `ui/alert-dialog.tsx` y el `h2` de `DialogoEdicion.tsx` con la clase de `TituloSeccion`. Ningún `text-xl` ni `text-lg` queda en títulos del panel.
- [X] T053 [H3] Espaciado (depende de T007): en las pantallas con varias secciones (editor, perfil, equipo, categorías y etiquetas, lista), el contenedor de secciones usa `gap-panel-seccion` y cada sección `gap-4` por dentro.
- [X] T054 [P] [H3] `EstadoVacio` en los cuatro vacíos (depende de T049): `app/(panel)/articulos/(lista)/page.tsx` ("Quitar filtros" o "Escribir el primero"), `componentes/taxonomia/GestorTaxonomias.tsx`, `componentes/equipo/TablaEquipo.tsx` y las etiquetas sin elementos de `componentes/editor/EditorArticulo.tsx`.
- [X] T055 [P] [H3] `AvisoEstado` en los avisos sueltos (depende de T050): la advertencia de `componentes/taxonomia/DialogoEdicion.tsx`, el resumen de errores de `componentes/editor/EditorArticulo.tsx` (conserva `role="alert"`), `componentes/editor/AvisoConflicto.tsx` (`tipo="error"` con `acciones`) y el aviso de `app/(panel)/articulos/[id]/vista-previa/page.tsx`.

**Checkpoint**: T044–T047 en verde; todas las pantallas comparten encabezado, escala de títulos, espaciado y estados.

---

## Fase 6: Validación y cierre

- [ ] T056 Ejecutar `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm calidad && pnpm build` (jscpd ≤ 3 %, knip sin hallazgos).
- [ ] T057 Ejecutar todos los E2E (`pnpm exec playwright test --project=admin` y `--project=web`) con `pnpm db:reset` previo, contra el build del admin (CE-006 y regresión del sitio).
- [ ] T058 Lighthouse (solo Accesibilidad) en `/ingreso`, `/articulos`, el editor y `/equipo`, en 360, 768, 1024 y 1440 px, con el procedimiento de T103 de la spec 003 ([quickstart.md](quickstart.md#accesibilidad-y-rendimiento)), y Lighthouse del sitio (`/` y un artículo con CTA) para confirmar que no bajó (CE-004, CE-005). Anotar las mediciones en `specs/004-jerarquia-visual-panel/validacion.md`.
- [ ] T059 Recorrer [quickstart.md](quickstart.md) (A a E) y la comprobación visual del sitio (E); corregir el quickstart si algo cambió.
- [ ] T060 Ejecutar `/validar` (`revisor-ux-ui` y `consistencia-codigo`; `arquitecto-db` no aplica porque no hay cambios de base) y resolver todos los BLOQUEANTES en `specs/004-jerarquia-visual-panel/validacion.md`. CE-002 se cumple con la revisión pantalla por pantalla de `revisor-ux-ui` contra la matriz (aclaración 5).
- [ ] T061 Actualizar `CLAUDE.md` ("Estado actual": spec 004 y lo que sigue, spec 005 del editor estilo documento) y abrir el PR a `main`.

---

## Dependencias y orden de ejecución

### Entre fases

- **Preparación (F1)** → **Fundacional (F2)** → **H1** → **H2** → **H3** → **Validación (F6)**.
- **H1** depende solo de F2. Es el MVP: resuelve "todo pesa igual".
- **H2** depende de H1: `BarraEditor` (T024) recibe "Más acciones" en T038, y las filas ya tienen nivel desde T027.
- **H3** depende de F2 y puede empezar en paralelo con H2, salvo T052 y T054 en `EditorArticulo.tsx`, que van después de T025 y T038.

### Archivos compartidos (hacer en secuencia)

- `apps/admin/src/componentes/ui/button.tsx`: T010 → T030.
- `apps/admin/src/componentes/editor/EditorArticulo.tsx`: T025 → T051 → T052 → T054 → T055.
- `apps/admin/src/componentes/articulo/BarraEditor.tsx`: T024 → T038.
- `apps/admin/src/componentes/estructura/estructura.test.tsx`: T005 → T034 → T044.
- `e2e/admin/jerarquia.spec.ts`: T015 → T016 → T031 → T032 → T033 → T046.
- `apps/admin/src/componentes/taxonomia/GestorTaxonomias.tsx`: T021 → T027 → T039 → T054.
- `apps/admin/src/componentes/equipo/TablaEquipo.tsx`: T021 → T027 → T039 → T054.
- `apps/admin/src/componentes/taxonomia/DialogoEdicion.tsx`: T027 → T042 → T052 → T055.
- `apps/admin/src/componentes/NavegacionPanel.tsx`: T027 → T036.
- `apps/admin/src/componentes/ui/alert-dialog.tsx`: T012 → T052.

### Dentro de cada historia

Tests (rojo) → lógica pura (`acciones-disponibles.ts`, `fechas.ts`) → hooks → componentes → pantallas.

## Ejemplos de ejecución en paralelo

- **Fundacional, tests**: T003, T004 y T005.
- **Fundacional, implementación**: T007, T008, T009 y T011 en paralelo; T006 → T010; T011 → T012.
- **H1, tests**: T013, T014, T015 y T016 en paralelo; T017 aparte (toca varios specs existentes).
- **H1, implementación**: T018 y T023 en paralelo; T019 → T020 → T024; T021 → T022 → T024; después T025. T026, T027 y T028 en paralelo entre sí (archivos distintos); T029 y T030 al final.
- **H2**: T031–T034 en paralelo; T039–T043 en paralelo; T035 → T036 y T035 → T037 → T038.
- **H3**: T044–T046 en paralelo; T048, T049 y T050 en paralelo; después T051, T053, T054 y T055.

## Estrategia

- **MVP primero**: F1 + F2 + H1 ya resuelven el problema principal ("todo pesa igual") y dejan la barra del editor unificada. Se puede validar y mostrar antes de seguir.
- **Incremental**: H2 corrige tamaños y la versión móvil del editor; H3 completa la estructura de las pantallas. Cada una suma sin romper la anterior.
- **Un solo PR** al final de la fase 6, con H1 a H3.

## Notas

- Commit por tarea o grupo lógico (Conventional Commits en español, por ejemplo `feat(admin): barra del editor con acción principal por estado`).
- Verificar que los tests fallen antes de implementar.
- Antes de crear un archivo, revisar "Reutilización" en [plan.md](plan.md) (§VIII).
- La interacción del editor de bloques no se toca: es la spec 005.
