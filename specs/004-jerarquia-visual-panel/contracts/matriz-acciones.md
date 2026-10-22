# Contrato: nivel y ubicación de cada acción por pantalla

**Spec**: RF-002 a RF-005, RF-009, RF-011, RF-015 | **Pruebas**: `e2e/admin/jerarquia.spec.ts` (CE-001, CE-002)

Referencia que verifican las pruebas y la revisión de `revisor-ux-ui`. Cada contexto tiene como máximo una acción `primaria`. Los enlaces de texto ("Olvidé mi contraseña", "Ver en el sitio", "Ir al ingreso") no son botones y no cuentan. Ubicación de la principal: **E** = encabezado, **F** = final del formulario, **B** = barra fija del editor, **D** = pie del diálogo.

| Pantalla o diálogo | Primaria | Ubic. | Secundarias | Terciarias | Peligro |
|---|---|---|---|---|---|
| Ingreso | Ingresar | F | — | Mostrar contraseña (compacto, conmutador) | — |
| Olvidé mi contraseña | Enviar enlace | F | — | — | — |
| Confirmar enlace | Continuar | F | — | — | — |
| Definir contraseña | Guardar contraseña | F | — | — | — |
| Navegación del panel | — | — | — | Menú / Cerrar menú (compacto, ícono y texto) · Cerrar sesión | — |
| Lista de artículos | Nuevo artículo | E | Filtrar · paginación (compacto) | — | — |
| Lista sin resultados | Nuevo artículo | E | Quitar filtros / Escribir el primero (enlace en `EstadoVacio`) | — | — |
| Editor — artículo nuevo | Guardar (habilitado) | B | — | — | — |
| Editor — borrador sin cambios | Publicar | B | Guardar (deshabilitado, "Sin cambios") · Programar | Vista previa · Más acciones (angosto) | Eliminar (admin) |
| Editor — borrador con cambios | Guardar | B | Publicar · Programar | Vista previa · Más acciones | Eliminar (admin) |
| Editor — programado | Guardar | B | Publicar · Cancelar programación | Vista previa · Más acciones | Eliminar (admin) |
| Editor — publicado | Guardar | B | Volver a borrador · Archivar | Vista previa · Más acciones | Eliminar (admin) |
| Editor — archivado | Guardar | B | Volver a borrador | Vista previa · Más acciones | Eliminar (admin) |
| Editor — imagen destacada y de bloque | — | — | Elegir imagen / Agregar imagen | — | Quitar imagen |
| Editor — barra de marcas | — | — | — | Negrita · Cursiva · Código · Enlace (compacto) | — |
| Editor — bloques (provisorio hasta la spec 005) | — | — | Agregar bloque · Agregar ítem | Subir · Bajar · Duplicar · Quitar · Quitar ítem (compacto) | — |
| Editor — aviso de conflicto (`AvisoEstado` error) | — | — | Ver la versión vigente | — | Reemplazar con la vigente |
| Diálogo "¿Reemplazar con la versión vigente?" | — | — | Cancelar | — | Reemplazar |
| Diálogo "Programar la publicación" | Programar | D | Cancelar | — | — |
| Diálogo "¿Eliminar este artículo?" | — | — | Cancelar | — | Eliminar |
| Diálogo "¿Quitar esta imagen?" | — | — | Cancelar | — | Quitar imagen |
| Diálogo "Tienes cambios sin guardar" (al salir) | — | — | Seguir editando | — | Salir sin guardar |
| Categorías / Etiquetas | Crear | F | Editar (fila, compacto) | — | Eliminar (fila, compacto) |
| Diálogo de edición de taxonomía | Guardar cambios | D | Cancelar | — | — |
| Diálogo de eliminar taxonomía | — | — | Cancelar | — | Eliminar |
| Equipo | Enviar invitación | F | Reenviar invitación · Reactivar (fila, compacto) | — | Desactivar (fila, compacto) |
| Diálogo de desactivar miembro | — | — | Cancelar | — | Desactivar |
| Perfil | Guardar perfil | F | Elegir imagen | — | Quitar imagen |
| No encontrado / No tienes permiso | — | — | Ir a los artículos | — | — |
| Vista previa | — | — | — | — | — |

Notas:

- **Filas**: el texto visible es corto y el nombre del elemento va como sufijo `sr-only` ("Editar<span class=\"sr-only\"> Diseño</span>"), así el nombre accesible no cambia (research D3).
- **Rol**: el rol de cada miembro se cambia con un selector, no con un botón; queda alineado con los botones de la fila (RF-008). Si un rol no ve una acción (el editor no ve "Eliminar"), la barra se acomoda sin dejar huecos.
- **Bloques**: su interacción se rediseña en la spec 005; acá solo reciben nivel y tamaño explícitos y su comportamiento no cambia.
- **Vista previa**: no tiene botones; su `h1` es el título del artículo con el aspecto del sitio (excepción de RF-011).
- **Diálogos**: "Cancelar" primero en el DOM y la confirmación a la derecha (excepción de RF-009).
- **Peligro**: todas llevan un ícono además del color (research D2).
