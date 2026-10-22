# Modelo de datos: Jerarquía visual del panel

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Base de datos

**Sin cambios.** La feature no agrega migraciones, tablas, columnas, índices, políticas RLS, funciones, triggers ni cambios en `seed.sql`. No hace falta regenerar `packages/db/src/tipos.ts` ni consultar al agente `arquitecto-db` (constitución §X: solo cuando la spec toca la base).

## Modelo de presentación

Lo que la feature agrega son conceptos de interfaz. No se guardan en ningún lado; se definen acá para que el plan, los contratos y las pruebas usen los mismos nombres.

### Nivel de acción (`VarianteBoton`)

| Nivel | Uso | Peso visual |
|---|---|---|
| `primaria` | La acción principal del contexto. Como máximo una visible por pantalla o diálogo (RF-002). | Fondo de marca, texto en contraste. |
| `secundaria` | Acciones importantes pero no principales: filtrar, cancelar, editar una fila, vista previa en formularios. | Fondo `fondo`, borde `borde`. |
| `terciaria` | Acciones de apoyo, herramientas y navegación con aspecto de botón: mostrar contraseña, "Más acciones", cerrar sesión, botones de marcas del editor. | Sin fondo ni borde visible; fondo `superficie` al pasar el puntero. |
| `peligro` | Acciones destructivas: eliminar, desactivar, reemplazar con la vigente. Nunca principal (RF-003). | Fondo `error-suave`, borde `error-borde`, texto `error`. |

### Tamaño (`TamanioBoton`)

| Tamaño | Uso | Medidas |
|---|---|---|
| `estandar` | Acciones de una pantalla, un formulario o un diálogo. | Alto 44 px (`--tactil-min`), relleno horizontal 20 px, texto base. |
| `compacto` | Acciones repetidas en filas, tarjetas y barras de herramientas; botones de solo ícono. | Alto 44 px, ancho mínimo 44 px, relleno horizontal 12 px, texto `sm`. Solo ícono: cuadrado. |

Sin `tamanio`, `clasesBoton` devuelve las clases de hoy, que son las que usa el sitio (research D1).

### Acción principal del editor

`accionPrincipalEditor({ estado, hayCambiosSinGuardar })`:

| Estado | Sin cambios sin guardar | Con cambios sin guardar |
|---|---|---|
| `borrador` | `publicar` | `guardar` |
| `programado` | `guardar` (deshabilitado) | `guardar` |
| `publicado` | `guardar` (deshabilitado) | `guardar` |
| `archivado` | `guardar` (deshabilitado) | `guardar` |

Las transiciones que se ofrecen en cada estado no cambian (`accionesDisponibles`, spec 003): borrador → publicar y programar; programado → cancelar programación y publicar; publicado → volver a borrador y archivar; archivado → volver a borrador; y "eliminar" para el admin.

### Barra del editor por debajo de 768 px

| Estado | En la barra | En "Más acciones" |
|---|---|---|
| `borrador` | Publicar · Guardar | Programar · Vista previa · (Eliminar) |
| `programado` | Guardar · Publicar | Cancelar programación · Vista previa · (Eliminar) |
| `publicado` | Guardar · Volver a borrador | Archivar · Vista previa · (Eliminar) |
| `archivado` | Guardar · Volver a borrador | Vista previa · (Eliminar) |

La primera es la principal. La segunda es la secundaria relacionada: "Guardar" o "Publicar", la que no sea principal; si el estado no ofrece "Publicar", la primera transición (RF-019). "Eliminar" solo aparece para el admin, al final y separada.
