# Validación: 001-modelo-de-contenido

**Fecha**: 2026-10-18 · **Commit**: `09f05cc` · **Alcance**: MVP (F1 + F2 + H1, T001–T033)
**Resultado global**: ❌ **CAMBIOS REQUERIDOS** (4 bloqueantes)

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
- [ ] A-B1 Protección mínima de `rol`/`activo`/`id`/`creado_en` en perfiles + tests
- [ ] C-B1 ESLint compartido y `lint` en `packages/bloques` y `packages/db`
- [ ] C-B2 `pruebas/clientes.ts` reutiliza `crearClientePublico`
- [ ] C-B3 `privado.slug_disponible` como fuente única del sufijo de slug

**Menores (en la misma pasada, o como tareas):**
- [ ] A-M1 id inmutable · A-M2 campos del sistema · A-M3/A-M4 bucket `medios` · A-M5 `crear_perfil`
- [ ] C-M1 grants por migración · C-M2 imagen destacada y contenido parseado · C-M3 docs y `TipoEntidad` · C-M4 tests TS · C-M5 comentarios · C-M6 knip · C-M7 Prettier
