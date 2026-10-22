# Contrato: atajos de teclado, roles y anuncios del editor

**Spec**: RF-003, RF-005 a RF-008, RF-010, RF-014, RF-019 | **Pruebas**: `e2e/admin/editor-documento.spec.ts`, `e2e/admin/accesibilidad.spec.ts`

Revisado por `revisor-ux-ui` (2026-10-22): se eliminan los atajos con `Alt+Shift`, `Mod+Shift+D`, `Mod+Shift+Backspace`, `Mod+/` y `Alt+F10` por chocar con el sistema, el navegador o los teclados en español, y toda acción tiene un camino visible (botón o menú) además del atajo. Los atajos que quedan se verifican en la Fase 0 con la tabla de colisiones de [research.md](../research.md#d17-fase-0-prueba-de-concepto-y-criterios-de-salida).

`Mod` es Ctrl en Windows y Linux, y Cmd en Mac.

## Dos modos de selección

Un rango de **texto** que cruza varios párrafos **no** es una selección de elementos: sirve para dar formato y no habilita mover ni quitar. Para actuar sobre elementos hay que entrar al **modo elementos**:

| Cómo se entra | Cómo se sale |
|---|---|
| `Esc` con el cursor en un elemento (queda seleccionado ese elemento); Shift + clic o toque sobre el asa; «Seleccionar» en el menú de acciones | `Esc` otra vez; escribir; hacer clic en un texto |

En modo elementos: `Shift+↑` y `Shift+↓` amplían la selección a elementos contiguos; el conteo ("3 elementos seleccionados") se anuncia **solo al entrar, al salir y al terminar de ampliar**, y se muestra como texto fijo junto a la barra de herramientas con un botón «Salir de la selección».

## Atajos

| Acción | Atajo | Camino visible |
|---|---|---|
| Negrita, cursiva, código en línea | `Mod+B`, `Mod+I`, `Mod+E` | botones de la barra |
| Enlace | `Mod+K` | botón «Enlace»: abre un campo de URL (solo `https://` y rutas internas) |
| Deshacer, rehacer | `Mod+Z`, `Mod+Shift+Z` (y `Mod+Y` en Windows) | botones de la barra |
| Insertar un elemento | `/` en una línea vacía | botón «Insertar» de la barra (siempre visible, nunca dentro de «Más») y botón de cada línea vacía |
| Entrar al modo elementos | `Esc` | «Seleccionar» en el menú de acciones |
| Subir, bajar (modo elementos) | `Alt+↑`, `Alt+↓` | «Subir» y «Bajar» del menú de acciones |
| Duplicar (modo elementos) | `Mod+D` | «Duplicar» del menú de acciones |
| Quitar (modo elementos) | `Supr` o `Retroceso` | «Quitar» del menú de acciones |
| Abrir las propiedades del elemento (modo elementos, un elemento) | `Enter` | botón «Propiedades» de la barra |
| Volver al texto | `Esc` | — |
| Abrir el menú de acciones | botón «Acciones» de la barra | (el asa flotante es solo para ratón y toque) |
| Ayuda de atajos | botón «Atajos» del menú de acciones | diálogo con foco gestionado |

**Orden de `Esc`**: cierra primero el menú abierto, después el campo de enlace, después la selección múltiple y, por último, la hoja de propiedades. `Esc` nunca saca el foco del lienzo.

### Atajos de escritura (reglas de entrada)

| Al escribir al comienzo de una línea vacía | Resultado |
|---|---|
| `## `, `### `, `#### ` | Título 2, 3 o 4 |
| `- `, `* ` | Lista con viñetas |
| `1. ` | Lista numerada |
| `> ` | Cita |
| `---` | Separador |
| tres comillas invertidas | Bloque de código |

Deshacer inmediato deja el texto escrito. En línea: `**x**`, `_x_`, `` `x` `` y `[x](url)` se convierten en la marca real al cerrarlas. Las reglas se prueban con teclado español y latinoamericano, con la autocorrección de Gboard y de iOS y con dictado (Fase 0).

## Una sola ruta para quitar y mover

Todo lo que quite o mueva elementos pasa por **un único camino**, sin importar cómo se inicie (menú, atajo, `Supr`, cortar, escribir sobre una selección, arrastrar, `Mod+A` y borrar): un plugin intercepta las transacciones (`filterTransaction`) y

- bloquea quitar o mover un elemento con **subida en curso** y anuncia por qué;
- exige la confirmación de hoy para quitar una imagen ya guardada;
- anuncia "Elemento quitado. Pulsa Ctrl+Z para deshacer" (con varios: "3 elementos quitados…").

Los nodos no son arrastrables por sí mismos (`draggable=false`): solo el asa arrastra, así un toque largo sobre una imagen en el teléfono no inicia un arrastre.

## Roles y nombres

El lienzo usa el `contenteditable` nativo de ProseMirror con `aria-label`, `aria-multiline="true"` y **sin forzar `role="textbox"`**; la Fase 0 compara con y sin el rol con NVDA y VoiceOver y deja el que mejor anuncie la estructura (títulos, listas, citas).

| Elemento | Rol y nombre |
|---|---|
| Lienzo | `contenteditable` con nombre "Contenido del artículo"; **rol fijo** durante todo el uso |
| Menú «/» e «Insertar» | `role="listbox"` con opciones `role="option"`; desde el lienzo: `aria-haspopup="listbox"`, `aria-controls` y `aria-activedescendant` (sin cambiar el rol ni `aria-expanded`); el conteo ("5 resultados") y la opción activa se anuncian por la región de estado con *debounce*. Desde «Insertar» de la barra, el foco **entra al listbox** y vuelve al lienzo al cerrar. "Sin resultados" como `role="status"` |
| Barra | `role="toolbar"`, nombre "Formato del texto", **un solo tope de tabulación** y flechas izquierda/derecha entre controles; los controles ocultos por «Más» salen del orden de tabulación (`inert`) |
| Campo de enlace | `input` fuera del *roving tabindex*: el foco entra al campo, las flechas editan el texto, `Enter` aplica y `Esc` cierra y devuelve el foco al lienzo; error con `aria-describedby` |
| Elemento especial | la isla no editable lleva el nombre "Imagen, 3 de 8" (tipo y posición); sus botones internos **no** están en el orden de tabulación (`tabindex=-1`): la subida y los campos se alcanzan con `Enter` en modo elementos (abre las propiedades con el foco en el primer campo) |
| Asa flotante | botón visible para ratón y toque con `tabindex=-1` y nombre "Acciones del elemento 3, párrafo"; **no** es el camino de teclado ni de lector de pantalla: lo es el botón «Acciones» de la barra |
| Botón «Acciones» de la barra | `aria-haspopup="menu"` y `aria-expanded`; menú con flechas, `Inicio`, `Fin`, escritura por letra y `Esc` |
| Panel de propiedades | `aside`, nombre "Propiedades del elemento 3, imagen"; pestañas con `role="tablist"`, `tab` y `tabpanel` y flechas |
| Hoja de propiedades (pantallas angostas) | `aside` no modal, botón «Cerrar»; **no roba el foco** al abrirse (salvo con `Enter` en modo elementos o «Propiedades»); se anuncia "Se abrió el panel de propiedades de la imagen 3" |
| Selección múltiple | texto fijo "3 elementos seleccionados" junto a la barra y una marca **no cromática** en cada elemento (borde de 2 px a la izquierda y ícono de verificación; contraste ≥ 3:1 y visible en `forced-colors`) |

## Foco al terminar una acción

| Acción | El foco queda en |
|---|---|
| Insertar párrafo, título, cita, lista | dentro del elemento nuevo |
| Insertar código | dentro del bloque |
| Insertar separador | el párrafo siguiente (se crea si no hay) |
| Insertar imagen o galería | el primer campo del panel / hoja ("Subir imagen") |
| Insertar llamada a la acción o video | el primer campo del panel / hoja |
| Mover | el elemento movido |
| Duplicar | la copia |
| Quitar | el elemento contiguo; si era el último, el párrafo final |
| Convertir | dentro del elemento convertido |
| Cerrar la hoja o el panel con `Esc` | el elemento seleccionado |

## Anuncios (región de estado persistente, `aria-live="polite"`)

Se evita la superposición con el nombre del elemento que el lector anuncia al recibir el foco: los anuncios de insertar, mover y duplicar se emiten con un *debounce* de 400 ms y solo si el foco no cambió a otro elemento. Se usa siempre la palabra **elemento** (o el tipo: «párrafo», «imagen»), nunca «bloque».

| Acción | Mensaje |
|---|---|
| Insertar | "Se insertó una imagen en la posición 3 de 8" |
| Mover (menú, atajo o arrastre) | "Elemento movido a la posición 2 de 8" |
| Duplicar | "Elemento duplicado, posición 4 de 9" |
| Quitar | "Elemento quitado. Pulsa Ctrl+Z para deshacer" (con varios: "3 elementos quitados…") |
| Convertir | "Se convirtió en título 2" |
| Modo elementos | "3 elementos seleccionados" (al entrar, al salir y al terminar de ampliar) |
| Pegado con sobrante | "Se crearon 2 párrafos nuevos por el límite de caracteres" |
| Límite de caracteres | "Quedan 500 caracteres (se cuentan las marcas de formato)" al cruzar el 90 % y "Se alcanzó el máximo de caracteres del párrafo" al 100 %; no se anuncia en cada tecla |
| Deshacer, rehacer | "Se deshizo: mover elemento" / "Se rehízo: mover elemento" |
| Subida en curso | "Subiendo imagen… No se puede mover ni quitar hasta que termine" |
