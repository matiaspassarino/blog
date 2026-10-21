# Contrato: Server Actions del panel

**Decisiones**: research D2, D5, D6, D9, D11, D13, D16. **Código**: `apps/admin/src/acciones/*.ts` (un archivo por área). Todas son `'use server'`.

**Nombres**: una acción lleva el sufijo `Accion` cuando su nombre coincide con una función de `@blog/db` que importa (`crearArticuloAccion`, `cambiarEstadoAccion`, `eliminarArticuloAccion`, `previsualizarSlugAccion`, `crearTaxonomiaAccion`, `actualizarTaxonomiaAccion`, `eliminarTaxonomiaAccion`, `cambiarRolAccion`, `cambiarActivoAccion`); las demás (`ingresar`, `cerrarSesion`, `guardarArticulo`, `invitarMiembro`, `guardarPerfil`…) no lo necesitan.

## Reglas comunes

Toda acción, en este orden:

1. `obtenerMiembro()` → si no hay sesión válida y activa devuelve `no_autenticado` con `motivo: 'sin_sesion' | 'desactivada'`; la interfaz navega a `/ingreso` o, con `desactivada`, a `/salir?motivo=desactivada`, que cierra la sesión (las cookies solo se escriben en Route Handlers y Server Functions, no al renderizar).
2. `puede(rol, accion)` (matriz de `@blog/db`, D16) → si no, `sin_permiso`.
3. Valida la entrada con Zod. Si falla: `contenido_invalido` (artículos) o `validacion` (resto), con `errores`.
4. Llama a `@blog/db` con el cliente de la sesión (`crearClienteServidor`). Nunca escribe SQL, no llama a Storage ni a Auth Admin directamente (usa `crearSubidaFirmada`, `descargarMedio`, `borrarMedios`, `obtenerPerfilPropio`, etc. de `@blog/db`) y no usa `service_role`, salvo las de **Equipo** marcadas (que usan `invitarMiembroPorCorreo` y `reenviarInvitacionPorCorreo` de `@blog/db/servidor`).
5. Captura `ErrorDominio` y devuelve `ResultadoAccion`. Los errores de control de flujo de Next (`redirect`, `notFound`, `forbidden`, `unauthorized`) se relanzan, no se convierten en resultado. Un error inesperado se registra en el servidor y devuelve `desconocido` con un mensaje genérico (sin detalles técnicos).
6. Si la operación cambia datos que la pantalla muestra, llama a `revalidatePath` de la ruta del panel afectada (la caché del sitio público no es asunto del admin: D19).

```ts
type ResultadoAccion<T = void> =
  | { ok: true; datos: T }
  | { ok: false; codigo: CodigoError | 'no_autenticado' | 'imagen_invalida'; mensaje: string; errores?: ErrorBloque[]; detalle?: string };
```

`mensaje` está siempre en español, sin jerga (`mensajeDeError`, RF-023). `errores` solo con `contenido_invalido`: `{ indice, campo, mensaje }`, con `indice = -1` para la imagen destacada (formato de la 001).

## Acceso (`acciones/acceso.ts`)

| Acción | Entrada | Efecto | Errores propios |
|---|---|---|---|
| `ingresar` | `{ correo, contrasenia, volver? }` | `signInWithPassword`; si el perfil está inactivo cierra la sesión y devuelve `cuenta_desactivada`; ok → redirige a `volver` (solo rutas internas que empiecen con `/` y no con `//`) o a `/articulos` | `credenciales_invalidas` (mismo mensaje para correo o contraseña mal), `cuenta_desactivada` |
| `cerrarSesion` | — | `signOut` + borra `blog_actividad` + redirige a `/ingreso` | — |
| `pedirRecuperacion` | `{ correo }` | `resetPasswordForEmail(correo, { redirectTo: <admin>/auth/confirmar })`; **siempre** responde `ok` con el mismo mensaje exista o no el correo | — |
| `confirmarEnlace` | `{ tokenHash, tipo: 'invite' \| 'recovery' }` | `verifyOtp`; ok → redirige a `/definir-contrasena` | `enlace_invalido` (usado o vencido) |
| `definirContrasena` | `{ contrasenia, repetir }` | `updateUser({ password })` (requiere la sesión abierta por `confirmarEnlace`); ok → redirige a `/articulos` | `contrasenia_corta` (RF-028: mín. 8; la configuración local de Auth hoy exige 6, se sube a 8 en local y en la nube), `no_coinciden` |

Ninguna de estas exige `puede`: son las acciones anónimas de la tabla de permisos. `ingresar` y `pedirRecuperacion` limitan intentos con el límite de Auth (`[auth.rate_limit]`); la interfaz muestra el mensaje genérico de espera.

## Artículos (`acciones/articulos.ts`)

| Acción | Entrada | Llama a | Notas |
|---|---|---|---|
| `crearArticuloAccion` | `NuevoArticulo` + `etiquetas: string[]` | `crearArticulo`, `asignarEtiquetas` | Devuelve el artículo (con el slug definitivo, RF-008). Redirige a `/articulos/[id]`. |
| `guardarArticulo` | `{ id, version, cambios: CambiosArticulo, etiquetas?: string[] }` | `actualizarArticulo`, `asignarEtiquetas`; luego borra imágenes sin uso (D11) | Si el slug final difiere del escrito, el mensaje de éxito lo muestra. `conflicto_version` → ver D13. |
| `previsualizarSlugAccion` | `{ texto, tipo }` | `previsualizarSlug` | Para el slug sugerido mientras se escribe (se usa con retardo de 300 ms). |
| `cambiarEstadoAccion` | `{ id, version, destino, programadoPara?: string ISO }` | `cambiarEstado` | `programadoPara` obligatorio con `programado`. `requisitos_publicacion`: el detalle dice qué falta (sin categoría / sin bloques). |
| `eliminarArticuloAccion` | `{ id }` | `eliminarArticulo` | Solo admin. Antes de borrar lee las rutas de imagen del artículo; después las borra si no están en uso. |

`etiquetas` viaja como lista completa; `asignarEtiquetas` reemplaza el conjunto (contrato de la 001).

Después de `guardarArticulo` o un cambio de estado la acción devuelve el artículo actualizado (con su nueva `version`) para que el formulario se resincronice sin recargar.

## Lista de artículos (lectura, sin acción)

`apps/admin/src/consultas/articulos.ts` → `listarArticulosPanel(c, filtros)`: llama a `public.listar_articulos_panel` y devuelve `Pagina<FilaArticuloPanel>`. Filtros validados con Zod:

```ts
{ estado?: EstadoArticulo; categoria?: uuid; autor?: uuid; q?: string /* ≤ 100 */; pagina?: int /* ≥ 1, default 1 */ }
```
Tamaño de página: 20 (RF-016). Un valor inválido en la dirección se ignora (no rompe la pantalla).

## Medios (`acciones/medios.ts`)

| Acción | Entrada | Efecto | Errores |
|---|---|---|---|
| `firmarSubidaMedio` | `{ nombre: string; bytes: number }` | Si `bytes > 5 242 880` → `imagen_invalida`. Devuelve `{ ruta, token, urlFirmada }` de `createSignedUploadUrl` | `imagen_invalida` ("supera los 5 MB"), `sin_permiso` |
| `registrarMedio` | `{ ruta }` | Descarga el objeto con la sesión, `detectarImagen(bytes)` (D10); si es `null` → borra el objeto y devuelve `imagen_invalida` ("solo JPEG, PNG, WebP o AVIF"); si no → `{ ruta, ancho, alto }` | `imagen_invalida`, `no_encontrado` |

El navegador sube con `uploadToSignedUrl(ruta, token, archivo)`. Hasta que el formulario se guarda, la imagen no pertenece a ningún contenido (D11, límite conocido).

## Taxonomías (`acciones/taxonomias.ts`)

| Acción | Entrada | Llama a | Notas |
|---|---|---|---|
| `crearTaxonomiaAccion` | `{ tipo: 'categoria' \| 'etiqueta', nombre, slug?, descripcion? }` | `crearTaxonomia` | Nombre duplicado → `validacion` "Ya existe una categoría con ese nombre". |
| `actualizarTaxonomiaAccion` | `{ tipo, id, cambios }` | `actualizarTaxonomia` | Si cambia el slug y la taxonomía tiene artículos publicados, el resultado trae `datos.avisoRedireccion = true` para el aviso de RF-019. El **aviso previo** a guardar usa el conteo de la lista. |
| `eliminarTaxonomiaAccion` | `{ tipo, id }` | `eliminarTaxonomia` | `categoria_en_uso` con el conteo en `detalle`: "La usan N artículos". |

Lista: `apps/admin/src/consultas/taxonomias.ts` → `select=*,articulos(count)` para categorías y `select=*,articulos_etiquetas(count)` para etiquetas.

## Equipo (`acciones/equipo.ts`) — solo admin

| Acción | Entrada | Llama a | Notas |
|---|---|---|---|
| `invitarMiembro` | `{ nombre, correo, rol }` | `invitarMiembroPorCorreo` de `@blog/db/servidor` (**service_role**: `inviteUserByEmail` + `updateUserById(app_metadata.rol)`, D6) | Correo ya existente → `validacion` "Ese correo ya pertenece al equipo". Si el paso 2 falla el miembro queda en "invitado" sin rol efectivo y se informa para reintentar. |
| `reenviarInvitacion` | `{ id }` | `reenviarInvitacionPorCorreo` de `@blog/db/servidor` (**service_role**, D6) | Solo si `acceso = 'invitado'`; si no, `validacion` "Esa persona ya definió su contraseña". |
| `cambiarRolAccion` | `{ id, rol }` | `cambiarRol` | `ultimo_admin` → mensaje de RF-021. |
| `cambiarActivoAccion` | `{ id, activo }` | `cambiarActivo` | Pide confirmación al desactivar (RF-024). `ultimo_admin` ídem. |

Lista: `listar_equipo()` vía `@blog/db` (`listarEquipo(c)`). El filtro por autor de la lista de artículos usa `listarAutores(c)` (`{ id, nombre }`), que sí puede leer un editor. Para las dos acciones con `service_role` el cliente se crea con `crearClienteAdmin` **dentro** de la acción, tras `obtenerMiembro()` y `puede('equipo.gestionar')`; la clave nunca sale al navegador ni a `apps/web` (§III.4).

## Perfil propio (`acciones/perfil.ts`)

| Acción | Entrada | Llama a | Notas |
|---|---|---|---|
| `guardarPerfil` | `{ nombre, biografia?, avatar?: Imagen \| null }` | `actualizarPerfilPropio` | No acepta `rol` ni `activo` (el esquema Zod los descarta; la base los rechaza igual). Si cambia o quita el avatar, aplica D11. |

## Códigos y mensajes

`mensajeDeError(codigo, detalle?)` (`apps/admin/src/lib/mensajes.ts`):

| Código | Mensaje |
|---|---|
| `no_autenticado` | Tu sesión terminó. Ingresa de nuevo para seguir. |
| `sin_permiso` | No tienes permiso para hacer esto. |
| `conflicto_version` | Alguien guardó cambios más nuevos en este artículo. |
| `estado_invalido` | Esa acción no está disponible para el estado actual del artículo. |
| `requisitos_publicacion` | Para publicar falta: *{detalle}*. |
| `fecha_no_futura` | Elige una fecha y hora que todavía no hayan pasado. |
| `categoria_en_uso` | No se puede eliminar: la usan *{detalle}* artículos. |
| `ultimo_admin` | Siempre tiene que quedar al menos un administrador activo. |
| `contenido_invalido` | Revisa los campos marcados. |
| `slug_duplicado` | Esa dirección ya está en uso. |
| `no_encontrado` | Ya no existe. Puede que lo hayan eliminado. |
| `imagen_invalida` | *{detalle}* |
| `credenciales_invalidas` | El correo o la contraseña no son correctos. |
| `cuenta_desactivada` | Tu cuenta está desactivada. Habla con un administrador. |
| `desconocido` | Algo salió mal. Prueba de nuevo en unos minutos. |

El panel usa el mismo tuteo neutro que el sitio público (spec 002). Un test recorre `CodigoError` completo y falla si falta un mensaje.
