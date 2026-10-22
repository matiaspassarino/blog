# Contrato: nivel de cada acción por pantalla

**Spec**: RF-002 a RF-005, RF-015 | **Pruebas**: `e2e/admin/jerarquia.spec.ts` (CE-001, CE-002)

Es la referencia que verifican las pruebas y la revisión de `revisor-ux-ui`. Cada contexto tiene como máximo una acción `primaria`. Los enlaces de texto (por ejemplo "Olvidé mi contraseña" o "Ver en el sitio") no son botones y no cuentan.

| Pantalla o diálogo | Primaria | Secundarias | Terciarias | Peligro | Tamaño de las filas |
|---|---|---|---|---|---|
| Ingreso | Ingresar | — | Mostrar contraseña (compacto) | — | — |
| Olvidé mi contraseña | Enviar enlace | — | — | — | — |
| Confirmar enlace | Continuar | — | — | — | — |
| Definir contraseña | Guardar contraseña | — | — | — | — |
| Navegación del panel | — | — | Menú (solo ícono, compacto) · Cerrar sesión | — | — |
| Lista de artículos | Nuevo artículo (encabezado) | Filtrar | — | — | — |
| Lista sin resultados | Nuevo artículo (encabezado) | Quitar filtros / Escribir el primero (en `EstadoVacio`) | — | — | — |
| Editor — borrador sin cambios | Publicar | Guardar (deshabilitado) · Programar | Vista previa · Más acciones (< 768 px) | Eliminar (admin) | — |
| Editor — borrador con cambios | Guardar | Publicar · Programar | Vista previa · Más acciones | Eliminar (admin) | — |
| Editor — programado | Guardar | Publicar · Cancelar programación | Vista previa · Más acciones | Eliminar (admin) | — |
| Editor — publicado | Guardar | Volver a borrador · Archivar | Vista previa · Más acciones | Eliminar (admin) | — |
| Editor — archivado | Guardar | Volver a borrador | Vista previa · Más acciones | Eliminar (admin) | — |
| Editor — imagen destacada y de bloque | — | Elegir imagen | Quitar imagen | — | — |
| Editor — barra de marcas | — | — | Negrita · Cursiva · Código · Enlace (compacto) | — | compacto |
| Editor — aviso de conflicto | — | Ver la versión vigente | — | Reemplazar con la vigente | — |
| Diálogo "¿Reemplazar con la versión vigente?" | — | Cancelar | — | Reemplazar | — |
| Diálogo "Programar la publicación" | Programar | Cancelar | — | — | — |
| Diálogo "¿Eliminar este artículo?" | — | Cancelar | — | Eliminar | — |
| Categorías / Etiquetas | Crear (formulario de alta) | Editar (fila) | — | Eliminar (fila) | compacto |
| Diálogo de edición de taxonomía | Guardar cambios | Cancelar | — | — | — |
| Diálogo de eliminar taxonomía | — | Cancelar | — | Eliminar | — |
| Equipo | Enviar invitación | Reenviar invitación · Reactivar (fila) | — | Desactivar (fila) | compacto |
| Diálogo de desactivar miembro | — | Cancelar | — | Desactivar | — |
| Perfil | Guardar perfil | Elegir imagen | Quitar imagen | — | — |
| No encontrado / No tienes permiso | — | Ir a los artículos | — | — | — |

Notas:

- El editor de bloques (agregar, subir, bajar, duplicar y quitar bloques, e ítems de lista) se rediseña en la spec 005. En esta spec solo recibe un nivel explícito y el tamaño `compacto`: las acciones de cada bloque (subir, bajar, duplicar y quitar) como `terciaria`, "Agregar bloque" y "Agregar ítem" como `secundaria`, y "Quitar ítem" como `terciaria`. Su comportamiento no cambia.
- El rol de cada miembro se cambia con un selector, no con un botón; queda alineado con los botones de la fila (RF-008).
- La vista previa no tiene botones: solo la navegación del panel.
- Si un rol no ve una acción (por ejemplo el editor no ve "Eliminar"), la barra se acomoda sin dejar huecos.
