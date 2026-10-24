# Modelo de datos: Jerarquía visual del panel

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Decisiones**: [research.md](research.md)

## Base de datos

**Sin cambios.** La feature no agrega migraciones, tablas, columnas, índices, políticas RLS, funciones, triggers ni cambios en `seed.sql`. No hace falta regenerar `packages/db/src/tipos.ts` ni consultar a `arquitecto-db` (§X).

## Modelo de presentación

Conceptos de interfaz. No se guardan; se definen acá para que el plan, los contratos y las pruebas usen los mismos nombres.

### Nivel de acción (`VarianteBoton`)

| Nivel | Uso | Aspecto (research D2) |
|---|---|---|
| `primaria` | La acción principal del contexto. Como máximo una visible por pantalla o diálogo (RF-002). | Fondo de marca. |
| `secundaria` | Acciones importantes pero no principales: filtrar, cancelar, editar una fila. | Fondo `fondo`, borde `borde`. |
| `terciaria` | Apoyo, herramientas y navegación con aspecto de botón: vista previa, mostrar contraseña, "Más acciones", cerrar sesión, marcas del editor, acciones de los bloques. | Texto de marca sin fondo; fondo `marca-suave` y subrayado al pasar el puntero. |
| `peligro` | Destructivas: eliminar, quitar una imagen, desactivar, reemplazar con la vigente, salir sin guardar. Nunca principal (RF-003). | Fondo `error-suave`, borde `error-borde`, texto `error` y un ícono. |

Estados de cada nivel: reposo, puntero, foco, presionado, activo (`aria-pressed`, solo en conmutadores), deshabilitado y ocupado (research D2 y D12).

### Tamaño (`TamanioBoton`)

| Tamaño | Uso | Medidas |
|---|---|---|
| `estandar` | Acciones de una pantalla, un formulario o un diálogo. | Alto mínimo 44 px, relleno horizontal 20 px, texto base. |
| `compacto` | Acciones repetidas en filas y barras de herramientas, la barra del editor en anchos angostos y los botones de solo ícono. | Alto y ancho mínimos 44 px, relleno horizontal 12 px, texto `sm`. Solo ícono: cuadrado. |

Sin `opciones`, `clasesBoton` devuelve las clases de hoy, que son las que usa el sitio (research D1).

### Artículo en el editor

| Concepto | Definición |
|---|---|
| `guardado` | El artículo tiene `id` (se guardó al menos una vez). En `/articulos/nuevo` es `false`. |
| `hayCambiosSinGuardar` | Lo que hoy marca el editor como "Cambios sin guardar". |

### Acción principal del editor (`accionPrincipalEditor`)

| Estado | Artículo nuevo | Guardado, sin cambios | Guardado, con cambios |
|---|---|---|---|
| `borrador` | `guardar` (habilitado) | `publicar` | `guardar` |
| `programado` | — | `guardar` (deshabilitado) | `guardar` |
| `publicado` | — | `guardar` (deshabilitado) | `guardar` |
| `archivado` | — | `guardar` (deshabilitado) | `guardar` |

"Guardar" está habilitado en un artículo nuevo (siempre) y en uno guardado solo con cambios (`guardarHabilitado`). Las transiciones de cada estado no cambian (`accionesDisponibles`, spec 003): borrador → publicar y programar; programado → cancelar programación y publicar; publicado → volver a borrador y archivar; archivado → volver a borrador; y "eliminar" para el admin. Un artículo nuevo no tiene transiciones, "Vista previa" ni "Eliminar".

### Barra del editor (`distribuirBarraEditor`)

Orden fijo de las posiciones: **Guardar · Publicar · (Programar | Cancelar programación | Volver a borrador) · Archivar · Vista previa · Eliminar**. Solo aparecen las que el estado y el rol permiten, y solo cambia el nivel.

En el ancho de la barra por debajo de 42 rem (container query, research D10), la barra queda en una línea con estas acciones y el resto va a "Más acciones":

| Situación | En la barra | En "Más acciones" |
|---|---|---|
| Artículo nuevo | Guardar | — (no se muestra) |
| `borrador` | Guardar · Publicar | Programar · Vista previa · (Eliminar) |
| `programado` | Guardar · Publicar | Cancelar programación · Vista previa · (Eliminar) |
| `publicado` | Guardar · Volver a borrador | Archivar · Vista previa · (Eliminar) |
| `archivado` | Guardar · Volver a borrador | Vista previa · (Eliminar) |

Regla: en la barra quedan "Guardar" y la primera transición del orden fijo ("Publicar" si existe). "Eliminar" solo para el admin, al final y separada. Desde 42 rem de ancho de barra se ven todas en línea.
