# Contrato: componentes de la jerarquía visual

**Spec**: [../spec.md](../spec.md) | **Decisiones**: [../research.md](../research.md) | **Modelo**: [../data-model.md](../data-model.md)

Interfaces que el plan crea o modifica. Describen qué recibe cada pieza y qué garantiza; el código queda para la implementación.

## `clasesBoton` (`@blog/ui/clases`) — modificado

```ts
type VarianteBoton = 'primaria' | 'secundaria' | 'terciaria' | 'peligro';
type TamanioBoton = 'estandar' | 'compacto';

clasesBoton(variante?: VarianteBoton, opciones?: { tamanio: TamanioBoton; soloIcono?: boolean }): string
```

- Sin `opciones`: devuelve **el mismo texto que hoy** para `primaria`, `secundaria` y `peligro` (lo usan `Boton.astro` y `Cta.tsx`; RF-016). Para `terciaria` sin opciones devuelve la versión del sitio con la base actual.
- Con `opciones`: altura fija de `--tactil-min`; borde de 1 px en todas las variantes (transparente donde no se ve), así todas miden lo mismo; relleno y tamaño de texto según `tamanio`; `soloIcono` lo hace cuadrado (requiere `tamanio: 'compacto'`).
- Solo utilidades de Tailwind sobre tokens (§VII.2).

## `Button` (`apps/admin/src/componentes/ui/button.tsx`) — modificado

```ts
type PropsButton = ComponentProps<'button'> & {
  variante: VarianteBoton;        // obligatoria: sin valor por defecto (RF-004)
  tamanio?: TamanioBoton;         // por defecto 'estandar'
  soloIcono?: boolean;            // exige aria-label o texto sr-only (RF-007)
  ocupado?: boolean;              // aria-busy + indicador superpuesto, mismo ancho (RF-010)
  asChild?: boolean;
};
```

- Renderiza `data-nivel={variante}` y `data-tamanio={tamanio}` (los usan las pruebas de CE-001 y CE-003).
- `aria-disabled` deja el botón enfocable; el `onClick` no se ejecuta mientras esté deshabilitado u ocupado.
- `AlertDialogAction` y `ConfirmarAccion` también pasan a exigir `variante`.

## `EncabezadoPagina` — nuevo (`componentes/estructura/EncabezadoPagina.tsx`)

```ts
type Props = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;               // como máximo una acción primaria
  refTitulo?: Ref<HTMLHeadingElement>; // para el h1 enfocable del editor
};
```

- Un solo `h1` por pantalla, con `text-titulo-2`.
- Desde 768 px las acciones van a la derecha del título, alineadas con su primera línea; por debajo, debajo del título y de la descripción.

## `BarraAcciones` — nuevo (`componentes/estructura/BarraAcciones.tsx`)

```ts
type Props = {
  children: ReactNode;      // en orden: primaria, secundarias, terciarias
  destructivas?: ReactNode; // al final, separadas (ms-auto desde 768 px)
  alineacion?: 'inicio' | 'fin'; // por defecto 'inicio'; 'fin' en los diálogos
};
```

- `flex flex-wrap items-center gap-3`: todos los botones del grupo quedan a la misma altura (RF-008, RF-009).

## `TituloSeccion` — nuevo (`componentes/estructura/TituloSeccion.tsx`)

```ts
type Props = { como?: 'h2' | 'h3' | 'legend'; nivel?: 'seccion' | 'subseccion'; children: ReactNode; id?: string };
```

- `seccion` → `text-titulo-3`; `subseccion` → `text-titulo-4`; los dos con `font-titulos font-semibold`.
- Se usa para los `h2` de las pantallas y para los `legend` de los recuadros del editor y del perfil (RF-012).

## `EstadoVacio` — nuevo (`componentes/estructura/EstadoVacio.tsx`)

```ts
type Props = { mensaje: string; accion?: ReactNode }; // la acción va como 'secundaria'
```

## `MasAcciones` — nuevo (`componentes/estructura/MasAcciones.tsx`)

```ts
type Props = { etiqueta?: string; children: ReactNode; destructivas?: ReactNode }; // etiqueta: "Más acciones"
```

- Botón `terciaria` con `aria-expanded` y `aria-controls`; la lista desplegada contiene botones comunes.
- Esc y clic afuera cierran la lista; Esc devuelve el foco al botón. Al ejecutar una acción, la lista se cierra.
- Las destructivas van al final, después de un separador.
- Comparte con `NavegacionPanel` el hook `useDesplegable` (`componentes/estructura/useDesplegable.ts`).

## `DialogoProgramar` — nuevo (`componentes/articulo/DialogoProgramar.tsx`)

```ts
type Props = {
  onProgramar: (programadoParaIso: string) => Promise<{ ok: true } | { ok: false; mensaje: string }>;
  children: ReactNode; // el botón que lo abre
};
```

- Título "Programar la publicación"; campo "Fecha y hora de publicación" (`datetime-local`, mínimo = ahora) con el foco inicial.
- "Cancelar" (`secundaria`) cierra sin cambios. "Programar" (`primaria`) no cierra el diálogo si la fecha falta, está en el pasado o la base la rechaza: muestra el mensaje asociado al campo (`aria-describedby`, `aria-invalid`).

## `accionPrincipalEditor` — nuevo (`componentes/articulo/acciones-disponibles.ts`)

```ts
accionPrincipalEditor(entrada: { estado: EstadoArticulo; hayCambiosSinGuardar: boolean }): 'guardar' | 'publicar'
```

- `'publicar'` solo si `estado === 'borrador'` y no hay cambios sin guardar; `'guardar'` en cualquier otro caso. La tabla completa está en [data-model.md](../data-model.md#acción-principal-del-editor).

## `BarraEditor` e `InfoPublicacion` — reemplazan a `AccionesEstado`

- `BarraEditor` (barra fija): "Guardar", las transiciones de `accionesDisponibles`, "Vista previa" (`terciaria`), "Eliminar" (`peligro`, solo admin, con la confirmación de hoy), el aviso "Cambios sin guardar" / "Sin cambios" y el error del cambio de estado. Por debajo de 768 px usa `MasAcciones` según la tabla de [data-model.md](../data-model.md#barra-del-editor-por-debajo-de-768-px).
- `InfoPublicacion` (recuadro "Publicación"): estado, fecha de publicación o de programación y "Ver en el sitio". Sin botones.
- La lógica de cambiar el estado y eliminar vive en `useCambioDeEstado` (`componentes/articulo/useCambioDeEstado.ts`), que usan la barra y el menú.
