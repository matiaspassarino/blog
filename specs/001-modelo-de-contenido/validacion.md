# Validación: 001-modelo-de-contenido

**Fecha**: 2026-10-18 · **Alcance**: MVP (F1 + F2 + H1, T001–T033)

| Ronda | Commit | Resultado |
|---|---|---|
| 1 | `09f05cc` | ❌ CAMBIOS REQUERIDOS (4 bloqueantes) |
| 2 | `cb91af2` | ✅ **APROBADO** (0 bloqueantes; quedan menores) |
| 3 · H2 | `68a0622` | ❌ **CAMBIOS REQUERIDOS** (1 bloqueante) |
| 4 · H2 | `e835a6a` | ✅ **APROBADO** (0 bloqueantes; quedan menores) |

**Resultado global vigente**: ✅ **APROBADO** (ronda 4, Historia 2). Ver la sección "Ronda 4" al final.

---

# Ronda 1 (`09f05cc`)

## Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `pnpm lint` | ✓ (pero no cubre `packages/*`: ver C-B1) |
| `pnpm typecheck` | ✓ |
| `pnpm test` (unitarios + integración) | ✓ bloques 208 · db 24 |
| `pnpm calidad` (jscpd + knip) | ✓ 0 clones (jscpd no analiza SQL) |
| `pnpm test:db` (pgTAP) | ✓ 8 archivos |
| `pnpm test:e2e` | ✓ |
| `supabase db lint` | ✓ sin hallazgos |
| `pnpm formato:verificar` | ✗ 34 archivos (no está en CI; viene de `main`) |

## arquitecto-db: CAMBIOS REQUERIDOS

### Bloqueantes
- **A-B1. Escalada de privilegios: un editor puede hacerse admin.** `perfiles_update_propio` más `grant update` sobre todas las columnas, sin trigger de protección, permiten `update perfiles set rol='admin' where id = auth.uid()`. El arquitecto lo reprodujo y la validación lo verificó por su cuenta. También se puede cambiar `creado_en`, y un admin puede degradarse y dejar el sitio sin admin (RF-023). Incumple §V.4 y RF-022.
  → Adelantar una versión mínima de `a20_proteger_perfil` (que ningún cliente cambie `rol` ni `activo`; `id` y `creado_en` inmutables) en una migración nueva. H6 la amplía con `create or replace`. Agregar tests en `perfiles_base.test.sql`.

### Menores
- **A-M1.** El `id` de artículos, categorías y etiquetas se puede cambiar por update. Además le cambia el slug (`a10` ve la fila vieja) y dejaría redirecciones huérfanas en H2/H3. → Trigger `a05_id_inmutable`.
- **A-M2.** A `a20_campos_sistema` le faltan campos:
  - En el insert, el cliente fija `actualizado_en` y `programado_para`.
  - En el update, hasta H2 el cliente puede poner `estado = publicado/programado` sin fecha, y esas filas romperían los checks de H2.
  → Forzarlos en el insert y congelar `estado` y `programado_para` hasta H2, o normalizarlos en la migración de H2.
- **A-M3.** El bucket `medios` no tiene `file_size_limit` ni `allowed_mime_types`: se pueden subir SVG o HTML a un bucket público. → Limitar a 5 MB e imágenes jpeg, png, webp, avif y gif, con un test.
- **A-M4.** `medios_select` para anon permite listar todos los objetos, incluidas las imágenes de borradores. → Restringir el listado al equipo (la URL pública sigue funcionando) o documentarlo como riesgo aceptado.
- **A-M5.** En `crear_perfil`, un nombre de más de 80 caracteres hace fallar el alta con un 500 poco claro, y `{"rol": null}` crea un perfil activo. → `left(...,80)` y `->> 'rol' is not null`.

### Observaciones
- Las funciones definer, las ACL, los índices, el bloqueo optimista, los tipos regenerados y la corrección de `imagen_valida`/`contenido_valido` están OK.
- Para robustez, conviene usar `case` en lugar de depender del orden de evaluación de `AND` en las validaciones.

## revisor-ux-ui: no aplica

El diff no toca `apps/` ni `packages/ui`.

## consistencia-codigo: CAMBIOS REQUERIDOS

### Bloqueantes
- **C-B1. El lint no cubre el código nuevo.** `packages/bloques` y `packages/db` no tienen script `lint`, así que `pnpm lint` revisa 0 líneas del diff. `@blog/config` no tiene la config de ESLint ni la de Prettier que menciona §III. → Agregar una config ESLint compartida en `packages/config` y un script `lint` en los dos paquetes.
- **C-B2. Hay un segundo punto de creación de clientes.** `pruebas/clientes.ts` repite `createClient` con las mismas opciones que `crearClientePublico` (§VIII, plan "Reutilización"). → Reutilizar `crearClientePublico`.
- **C-B3. El algoritmo de unicidad de slug está duplicado** entre `asignar_slug` y `previsualizar_slug` (D10, fuente única). → Extraer `privado.slug_disponible(tipo, texto, excluir)` con un `case` estático. De paso elimina el SQL dinámico de `asignar_slug`.

### Menores
- **C-M1.** El bloque `revoke`/`grant` se repite al final de cada migración y crece con cada una. → Que cada migración otorgue solo sus funciones nuevas. Confirmarlo con arquitecto-db.
- **C-M2.** `crearArticulo` no valida `imagen_destacada` con `esquemaImagen`, y guarda el contenido original en vez del parseado (se pierden los valores por defecto, como `columnas = 3`).
- **C-M3.** El plan dice que `TIPOS_BLOQUE` está en `index.ts` (ahora está en `tipos-bloque.ts`). `TipoEntidad` está definido en las consultas de artículos y conviene moverlo a un módulo de tipos. El contrato `db.md` no documenta los exports adicionales.
- **C-M4.** Falta testear desde TS el reintento ante `slug_duplicado`, el camino feliz de `crearArticulo`, `eliminarArticulo` y `previsualizarSlug` sin permiso.
- **C-M5.** `storage.test.sql` menciona `medios_escritura_equipo`, que ya no existe. Un comentario de `equipo-articulos.test.ts` dice "slug sin default".
- **C-M6.** knip ignora entero `pruebas/**` y eso esconde código muerto (`entorno` exportado sin uso, `claveServicio`). → Declararlo como entrada de test.
- **C-M7.** No hay `.prettierrc` y el formato es inconsistente (comillas). → Definirlo en `@blog/config` y sumar `formato:verificar` al CI. Además: el parámetro `project` en `entorno.ts` y el scope de los commits (`001` frente a `db`).

### Sin hallazgos
- Los límites de arquitectura, las dependencias (stack §II, fijadas), los contratos de `@blog/bloques`, la cobertura de los criterios de H1 y la ausencia de `.only`/`.skip`.

## Acciones

**Bloqueantes (antes de seguir con H2):**
- [x] A-B1 Protección mínima de `rol`/`activo`/`id`/`creado_en` en perfiles + tests
- [x] C-B1 ESLint compartido y `lint` en `packages/bloques` y `packages/db`
- [x] C-B2 `pruebas/clientes.ts` reutiliza `crearClientePublico`
- [x] C-B3 `privado.slug_disponible` como fuente única del sufijo de slug

**Menores (en la misma pasada, o como tareas):**
- [ ] A-M1 id inmutable · A-M2 campos del sistema · A-M3/A-M4 bucket `medios` · A-M5 `crear_perfil`
- [ ] C-M1 grants por migración · C-M2 imagen destacada y contenido parseado · C-M3 docs y `TipoEntidad` · C-M4 tests TS · C-M5 comentarios · C-M6 knip · C-M7 Prettier

---

# Ronda 2 (`cb91af2`): ✅ APROBADO

## Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `lint` (ahora incluye `@blog/bloques` y `@blog/db`: 22 archivos, 0 errores) | ✓ |
| `typecheck` · `test` · `calidad` · `build` · `test:db` · `test:e2e` | ✓ |

## arquitecto-db: APROBADO
- **A-B1 cerrado, verificado en vivo.** Un editor o un admin que intenta cambiar su propio `rol` o `activo` recibe `sin_permiso`. Sobre filas ajenas: el update sin permiso afecta 0 filas, el upsert da `permission denied` y el delete da `permission denied`. `id` y `creado_en` son inmutables. El seed y `postgres` siguen funcionando.
- **C-B3 sin regresiones.** `slug_disponible` no es ejecutable por clientes y `excluir` funciona en los updates. Ante una carrera de escrituras, la unicidad la frena el índice y el 23505 se traduce a `slug_duplicado`.
- **H6** puede ampliar `proteger_perfil` con `create or replace`: se conservan el OID y el ACL. `garantizar_admin` es imprescindible.

### Menores nuevos
- **A-M6.** En `slug_disponible`, con `tipo = null` el bucle no termina (lo corta el `statement_timeout` de 8 s). → Validar que no sea null (`tipo_requerido`) o declarar `previsualizar_slug` como `strict`, con test.
- **A-M7.** `proteger_perfil` (invoker) falla para `service_role` (`permission denied for schema privado`). Pasa lo mismo en `articulos`. → `grant usage` + `execute es_cliente` a `service_role`, o documentar que `service_role` no escribe contenido. Con test.
- **A-M8.** Faltan tests de A-B1 para: el admin que cambia su propio `rol`, que `id` es inmutable y que el upsert se rechaza.
- **A-M9.** El comentario de `20261018120100_perfiles.sql` y `plan.md` siguen diciendo que `proteger_perfil` llega en H6.

## consistencia-codigo: APROBADO
- **C-B1, C-B2 y C-B3 resueltos.** ESLint compartido en `@blog/config`, `createClient` en un único lugar y una sola fuente del sufijo de slug. Sin duplicación nueva.

### Menores nuevos
- **C-M8.** `apps/admin` declara `eslint ^9` (sin fijar) y no extiende `@blog/config/eslint`, así que las reglas comunes no aplican ahí.

## Acciones (menores): ✅ resueltas
- [x] A-M1: `privado.impedir_cambio_id` (`a05_id_inmutable`) en artículos, categorías y etiquetas.
- [x] A-M2: el insert del cliente fuerza `programado_para = null` y `actualizado_en = now()`; `estado` queda congelado hasta H2 (anotado en T040).
- [x] A-M3/A-M4: `medios` acepta solo imágenes de hasta 5 MB; el listado es solo del equipo (los archivos se sirven por URL pública).
- [x] A-M5: `crear_perfil` recorta el nombre a 80 caracteres y `{"rol": null}` crea un perfil inactivo.
- [x] A-M6: `slug_disponible` rechaza un `tipo` nulo (`tipo_requerido`).
- [x] A-M7: `service_role` tiene `usage` sobre `privado` y las funciones de los checks y triggers.
- [x] A-M8: tests de un admin que cambia su propio rol, del `id` inmutable y del upsert rechazado.
- [x] A-M9: comentarios y plan alineados (`proteger_perfil` ya existe; H6 la amplía).
- [x] C-M1: cada migración concede solo sus funciones nuevas.
- [x] C-M2: la imagen destacada se valida con `esquemaImagen` y se persisten los valores parseados.
- [x] C-M3: `tipos-dominio.ts` (`TipoEntidad`, `EstadoArticulo`, `RolMiembro`); plan y contrato actualizados.
- [x] C-M4: tests TS del camino feliz, la imagen destacada, `eliminarArticulo`, `previsualizarSlug` sin permiso y el reintento por slug duplicado (unitario).
- [x] C-M5: comentarios corregidos.
- [x] C-M6: knip analiza `pruebas/` (ya no lo ignora); se quitó `claveServicio`.
- [x] C-M7: Prettier compartido en `@blog/config`, código formateado y `formato:verificar` en el CI; `proyecto` en `entorno.ts`.
- [x] C-M8: `apps/admin` fija `eslint 9.39.5` y aplica las reglas comunes.

Verificación final: `formato:verificar`, `lint`, `typecheck`, `test`, `calidad`, `build`, `test:db`, `test:e2e` y `supabase db lint`, todo ✓.

---

# Ronda 3 (`68a0622`, Historia 2 · T034–T044): ❌ CAMBIOS REQUERIDOS

## Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `formato:verificar` · `lint` · `typecheck` · `test` (48 en `@blog/db`) · `calidad` · `test:db` (12 archivos; antes se informó 13 por error) · `test:e2e` | ✓ |
| `supabase db advisors --local` | 1 hallazgo: `security_definer_view` sobre `autores_publicos`. **Riesgo aceptado** (D5, plan "Seguimiento de complejidad") |

## arquitecto-db: CAMBIOS REQUERIDOS

### Bloqueante
- **A3-B1. `privado.registrar_redireccion` no es genérica.** Aplicada a `categorias` da `record "old" has no field "publicado_en"`: PL/pgSQL prepara la expresión completa y el `or` no hace cortocircuito. El arquitecto lo reprodujo y la validación también. T048 depende de esto (§IV.5).
  → Sacar el filtro de la función y ponerlo en el `WHEN` de cada trigger (`old.slug is distinct from new.slug and old.publicado_en is not null` en artículos; solo el cambio de slug en taxonomías). Agregar un test con un trigger sobre `categorias`.

### Menores
- **A3-M1.** `slug_disponible` no tiene en cuenta `redirecciones`: un artículo nuevo puede ocupar el slug anterior de otro y romper una URL indexada (§IV.5). → Considerar ocupado el `slug_anterior` de otra entidad del mismo tipo, con test.
- **A3-M2.** Falta el test de notificación cuando cambia la categoría de un publicado: tienen que viajar la vieja y la nueva, sin repetidos.
- **A3-M3.** `obtenerArticuloPublicado` depende solo de la RLS: con una sesión del equipo devuelve borradores (con `autor: null`). → Filtrar de forma explícita `estado = publicado` y `publicado_en <= now()`.

### Observaciones
- La máquina de estados es correcta para los clientes. El sistema (postgres o `service_role`) puede publicar con fecha futura sin que se notifique: documentar que `service_role` no escribe contenido.
- Las redirecciones no filtran datos y no forman cadenas. La firma HMAC cubre exactamente los bytes que se encolan y el secreto no aparece en la cola ni en los warnings.
- Riesgos aceptados por el contrato: un aviso se puede reenviar dentro de la ventana de 5 minutos, y `pg_net` no reintenta.
- Desde H5, `to_jsonb` en z90 va a serializar `busqueda`. Alternativa: copiar las filas a variables y anular esa columna.
- Si se renombra una categoría, no se revalidan las páginas de sus artículos (tema para la spec web).

## consistencia-codigo: APROBADO

### Menores
- **C3-M1.** Hay que corregir el texto de data-model sobre `es_publico`: el predicado inline es una decisión de no dar `execute` a los clientes, no una imposibilidad.
- **C3-M2.** `notificar_cambio_articulo` y `notificar_borrado_articulo` arman el mismo mensaje y T048 los tiene que tocar a los dos. → Extraer `privado.mensaje_articulo(...)` antes de H3 y usar `slugs_afectados` también en el borrado.
- **C3-M3.** `ArticuloPublico`: `categoria` y `autor` son `| null`, y `ReferenciaTaxonomia` no figura en el contrato. → Documentar en `contracts/db.md` o estrechar los tipos.
- **C3-M4.** Los casts al leer filas se justifican por D8. → Centralizar el mapeo fila → dominio antes de T049 y T059.
- **C3-M5.** En `articulos-publicos.test.ts` hay un comentario desactualizado ("Hasta T040…").
- **C3-M6.** `resolver_redireccion` se tipa como `Returns: string`: comentar el `data ?? null`.

## revisor-ux-ui: APROBADO

Los cambios en `apps/` y `packages/ui` son solo de formato y ESLint, sin regresiones.

### Para la primera spec de UI (no bloquea esta spec)
- **Contraste de tokens:**
  - `acento` (2.52:1) no sirve para texto ni para UI.
  - `exito` (3.59:1) y `error` sobre `superficie` (4.34:1) fallan con texto chico.
  - `marca` sobre `superficie` queda justo, en 4.49:1.
  - `borde` (1.31:1) no sirve para controles.
- **Faltan tokens** de espaciado, breakpoints, anillo de foco y la regla de `prefers-reduced-motion` (§VII.1).
- **Las fuentes** Inter e Inter Tight no se cargan.
- **SEO de la landing:** falta canonical, OG, Twitter y JSON-LD `Organization`, y el viewport no tiene `initial-scale=1`.

## Acciones (ronda 3)
- [x] **A3-B1** `registrar_redireccion` genérica de verdad (filtro en el `WHEN` del trigger) + test con `categorias`
- [x] A3-M1 · A3-M2 · A3-M3
- [x] C3-M1 a C3-M6 (prioridad: C3-M2, antes de T048)

---

# Ronda 4 (`e835a6a`, Historia 2): ✅ APROBADO

## Verificaciones automáticas
`formato:verificar` · `lint` · `typecheck` · `test` (49 en `@blog/db`) · `calidad` · `build` · `test:db` (12 archivos, 381 aserciones) · `test:e2e` · `supabase db lint`: todo ✓.

## arquitecto-db: APROBADO
- **A3-B1 cerrado, verificado en vivo.** Probado con triggers temporales con la forma que pide T048, sobre categorías y etiquetas, como editor. Registra la redirección, `resolver_redireccion` resuelve y no se forman cadenas.
- **A3-M1, A3-M2, A3-M3 y C3-M2 cerrados.** `mensaje_articulo` es invoker, sin `execute` para clientes, y el mensaje es equivalente al anterior.
- Borrar una entidad libera su slug anterior. Solo una redirección huérfana insertada a mano (sin pasar por los triggers) lo bloquea para siempre, y ningún cliente puede crearla.

### Menores
- **A4-M1.** `asignar_slug` recalcula el slug en **cada** update. Si una fila tiene como slug el `slug_anterior` de otra entidad (posible por una carrera de concurrencia), cualquier edición le cambia la URL sin aviso (reproducido: `r4-drift` → `r4-drift-2`; §IV.5). → Recalcular solo en el insert o cuando cambia el slug, con un test.
- **A4-M2.** El paso 5 de T048 pide las etiquetas de **antes y después**, pero `mensaje_articulo` solo ve las actuales. → Reescribir T048: `drop function` + recrearla con un 4.º parámetro `etiqueta_ids_extra uuid[] default '{}'` (si se agrega como sobrecarga, las llamadas de 3 argumentos se vuelven ambiguas). Recrear también las funciones que la llaman.
- Cosmético: T048 nombra `z30_borrar_redirecciones` y en artículos es `z20`.
- `.lte('publicado_en', new Date())` usa el reloj de la app: un desfase de segundos es aceptable (ver también C4-M4).

## consistencia-codigo: APROBADO
- C3-M1 a C3-M6 resueltos. Sin duplicación nueva (jscpd 0 %, knip 0).

### Menores
- **C4-M1.** `aImagen`, `aContenido` y `aAutor` reciben `unknown`, así que el cast queda a ciegas. → Tiparlos con `Json` y el tipo del embebido.
- **C4-M2.** `AutorPublico` y `ReferenciaTaxonomia` viven en `mapeo.ts`. → Moverlos a un módulo de tipos antes de T049.
- **C4-M3.** El cast de `publicado_en` está fuera de `mapeo.ts`. → Unificar el criterio antes de T049.
- **C4-M4.** Comentar el reloj de la app frente a `now()` de la base, o filtrar en TS solo `estado`.

## revisor-ux-ui: sin cambios desde la ronda 3 (APROBADO)

## Acciones (ronda 4, menores)
- [x] A4-M1: `asignar_slug` solo recalcula en el insert o cuando cambia el slug, con un test de regresión en `slugs.test.sql`.
- [x] A4-M2: T048 reescrita (`drop` y recreación de `mensaje_articulo` con `etiqueta_ids_extra`, más las funciones que la llaman). El nombre `z30` en las taxonomías se mantiene porque `z20` queda para `z20_recalcular_articulos` (H5); documentado.
- [x] C4-M1: casts tipados desde `Json` y el tipo del embebido. C4-M2: los tipos públicos se movieron a `consultas/tipos-publicos.ts`. C4-M3: todos los casts quedan en `mapeo.ts` (`aFechaPublicacion`). C4-M4: TS filtra solo `estado` y la fecha la decide la base.
