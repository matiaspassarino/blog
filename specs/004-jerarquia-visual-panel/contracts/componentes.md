# Contrato: componentes de la jerarquía visual

**Spec**: [../spec.md](../spec.md) | **Decisiones**: [../research.md](../research.md) | **Modelo**: [../data-model.md](../data-model.md)

Interfaces que el plan crea o modifica: qué recibe cada pieza y qué garantiza. El código queda para la implementación.

## `clasesBoton` (`@blog/ui/clases`) — modificado

```ts
type VarianteBoton = 'primaria' | 'secundaria' | 'terciaria' | 'peligro';
type TamanioBoton = 'estandar' | 'compacto';
type OpcionesBoton = { tamanio: 'compacto'; soloIcono: true } | { tamanio: TamanioBoton; soloIcono?: false };

clasesBoton(variante?: VarianteBoton /* = 'primaria' */, opciones?: OpcionesBoton): string
```

- Sin `opciones`: **el mismo texto que hoy** para `primaria`, `secundaria`, `peligro`, `clasesBoton()` y `clasesBoton(undefined)` (RF-016).
- Con `opciones`: `min-h-(--tactil-min)`, `text-balance`, borde de 1 px en todas las variantes, estados de research D2 y medidas de [data-model.md](../data-model.md#tamaño-tamaniobotón).
- Solo utilidades de Tailwind sobre tokens (§VII.2).

## `Button` (`apps/admin/src/componentes/ui/button.tsx`) — modificado

```ts
type PropsButton = ComponentProps<'button'> & {
  variante: VarianteBoton;     // obligatoria (RF-004)
  tamanio?: TamanioBoton;      // por defecto 'estandar'
  asChild?: boolean;
} & (
  | { soloIcono: true; tamanio: 'compacto'; 'aria-label': string; asChild?: false }
  | { soloIcono?: false }
) & (
  | { ocupado: true; textoOcupado: string; asChild?: false }
  | { ocupado?: false }
);
```

- Renderiza `data-nivel` y `data-tamanio` (pruebas de CE-001 y CE-003).
- Con `aria-disabled` u `ocupado`, el clic hace `preventDefault()` y no llama a `onClick`: un `type="submit"` no envía y un enlace con `asChild` no navega.
- `ocupado`: etiqueta con `opacity-0` (mismo ancho y nombre), indicador `aria-hidden` en `currentColor`, `<span role="status" class="sr-only">{textoOcupado}</span>` y `aria-disabled`.

## `ConfirmarAccion` (`componentes/ConfirmarAccion.tsx`) — modificado

```ts
type Props = {
  titulo: string;
  descripcion: string;
  etiquetaConfirmar: string;
  variante: 'primaria' | 'peligro';                      // obligatoria (RF-004)
  onConfirmar: () => boolean | void | Promise<boolean | void>; // false = no cerrar
  cuerpo?: ReactNode;                                     // contenido extra (campo de fecha)
  focoInicial?: RefObject<HTMLElement | null>;            // por defecto, "Cancelar"
  abierto?: boolean; alCambiarAbierto?: (abierto: boolean) => void; // modo controlado
  alCerrar?: (motivo: 'confirmado' | 'cancelado') => void; // para mover el foco (research D11)
  children?: ReactNode;                                   // disparador; opcional en modo controlado
};
```

- El pie es `BarraAcciones alineacion="fin"`: "Cancelar" primero en el DOM, la confirmación a la derecha.

## `DialogoProgramar` — nuevo (`componentes/articulo/DialogoProgramar.tsx`)

Composición sobre `ConfirmarAccion` (controlado): título "Programar la publicación", campo "Fecha y hora de publicación" (`datetime-local`, `min` = `ahoraLocal()`) con el foco inicial, "Cancelar" `secundaria` y "Programar" `primaria`.

```ts
type Props = {
  abierto: boolean; alCambiarAbierto: (abierto: boolean) => void;
  onProgramar: (programadoParaIso: string) => Promise<{ ok: true } | { ok: false; mensaje: string }>;
  alCerrar: (motivo: 'confirmado' | 'cancelado') => void;
};
```

- Sin fecha, con fecha pasada o con rechazo de la base: no se cierra, el mensaje aparece junto al campo con `role="alert"` y `aria-describedby`, y el foco vuelve al campo.

## `EncabezadoPagina` — nuevo (`componentes/estructura/EncabezadoPagina.tsx`)

```ts
type Props = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;                 // acciones de pantalla (navegar o crear)
  refTitulo?: Ref<HTMLHeadingElement>;  // el h1 enfocable del editor
  tituloEnfocable?: boolean;            // agrega tabIndex={-1}
};
```

- Un `h1` con `text-titulo-2`. Las acciones van a la derecha desde 768 px y debajo en anchos menores. No se usa en la vista previa.

## `BarraAcciones` — nuevo (`componentes/estructura/BarraAcciones.tsx`)

```ts
type Props = { children: ReactNode; destructivas?: ReactNode; alineacion?: 'inicio' | 'fin'; etiqueta?: string };
```

- `flex flex-wrap items-stretch gap-3`; las destructivas al final, separadas (`ms-auto` desde 768 px). Con `etiqueta`, es un `role="group"` con ese nombre.
- Reemplaza a `AlertDialogFooter` y al pie de `DialogoEdicion`.

## `TituloSeccion` — nuevo (`componentes/estructura/TituloSeccion.tsx`)

```ts
type Props = { como?: 'h2' | 'legend'; id?: string; children: ReactNode };
```

- `font-titulos text-titulo-3 font-semibold`. También para los títulos de los diálogos (`AlertDialogTitle` y `DialogoEdicion`).

## `EstadoVacio` — nuevo (`componentes/estructura/EstadoVacio.tsx`)

```ts
type Props = { mensaje: string; accion?: { texto: string; href: string } };
```

- La acción es un enlace con aspecto `secundaria` (`Button asChild` con `Link`). Reemplaza a los vacíos de la lista, `GestorTaxonomias`, `TablaEquipo` y las etiquetas del editor.

## `AvisoEstado` — modificado (`componentes/AvisoEstado.tsx`)

```ts
type Props = { tipo: 'exito' | 'error' | 'advertencia'; children: ReactNode; acciones?: ReactNode; cerrable?: boolean };
```

- "Cerrar aviso" pasa a `Button variante="terciaria" tamanio="compacto" soloIcono`.

## `MasAcciones` — nuevo (`componentes/estructura/MasAcciones.tsx`)

```ts
type Props = { children: ReactNode; destructivas?: ReactNode };
```

- Botón `terciaria`, compacto, solo ícono, `aria-label="Más acciones"`, `aria-expanded`, `aria-controls`; visible solo por debajo de 42 rem de ancho de la barra (`@2xl:hidden`).
- Panel: oculto hasta abrirse por debajo de 42 rem; desde ahí, `@2xl:contents` (las acciones en línea). Abre hacia arriba, `max-h` con desplazamiento, relleno para el anillo de foco; destructivas al final tras un separador.
- Esc y clic afuera cierran; Esc devuelve el foco al botón; se cierra al navegar y al ejecutar una acción. No se renderiza si no tiene hijos.

## `useDesplegable` — extraído (`apps/admin/src/lib/desplegable.ts`)

```ts
useDesplegable(opciones: { refBoton: RefObject<HTMLElement | null>; refPanel: RefObject<HTMLElement | null> }):
  { abierto: boolean; abrir(): void; cerrar(devolverFoco?: boolean): void; alternar(): void }
```

- Esc cierra y devuelve el foco al botón; el clic fuera del botón y del panel cierra; un cambio de ruta cierra (lo que hoy hace `NavegacionPanel` con `rutaAbierta === ruta`). Lo usan `NavegacionPanel` y `MasAcciones`.

## Funciones puras del editor (`componentes/articulo/acciones-disponibles.ts`)

```ts
type Entrada = { estado: EstadoArticulo; rol: RolMiembro | null; guardado: boolean; hayCambiosSinGuardar: boolean };
accionPrincipalEditor(e: Omit<Entrada, 'rol'>): 'guardar' | 'publicar';
guardarHabilitado(e: { guardado: boolean; hayCambiosSinGuardar: boolean; ocupado: boolean }): boolean;
distribuirBarraEditor(e: Entrada): { enBarra: AccionBarra[]; enMenu: AccionBarra[] };
// AccionBarra = 'guardar' | AccionEstado | 'vista_previa'
```

- Tablas completas en [data-model.md](../data-model.md#acción-principal-del-editor-accionprincipaleditor). También se mudan acá `ETIQUETAS` y `ANUNCIOS`; `ahoraLocal()` va a `apps/admin/src/lib/fechas.ts`.

## `useCambioDeEstado` — extraído (`componentes/articulo/cambio-de-estado.ts`)

- La lógica de `ejecutar` y `eliminar` de `AccionesEstado.tsx`: guardar antes si hay cambios, llamar a la acción, anunciar el resultado y devolver el estado nuevo para mover el foco (research D11).

## `BarraEditor` e `InfoPublicacion` — reemplazan a `AccionesEstado` (que se borra)

- `BarraEditor`: `role="group"` "Acciones del artículo". Línea de estado arriba ("Cambios sin guardar" / "Guardado" en `aria-live`; "Sin cambios" y "Subiendo imagen…" fuera de la región y asociados a "Guardar" deshabilitado por `aria-describedby`); el error del cambio de estado en un `AvisoEstado` encima de la barra; los botones según `distribuirBarraEditor`, con `tamanio="compacto"` por debajo de 42 rem; los diálogos de programar y eliminar montados fuera de `MasAcciones`.
- `InfoPublicacion`: sección "Publicación" (`section` con `h2`) con estado, fecha y "Ver en el sitio". Sin botones.
