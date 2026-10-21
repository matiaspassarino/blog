# Quickstart: validar el modelo de contenido

Guía para comprobar de punta a punta que la feature 001 funciona. Los detalles están en [data-model.md](data-model.md) y en [contracts/](contracts/).

## Prerrequisitos

- Docker en marcha, Supabase CLI 2.121, Node 24 y pnpm 12.
- `pnpm install` ejecutado.

## 1. Levantar y resetear la base

```bash
pnpm db:start          # API :56321 · DB :56322 · Studio :56323
pnpm db:reset          # aplica las migraciones y carga seed.sql
pnpm db:tipos          # regenera packages/db/src/tipos.ts
```

**Esperado**: el reset termina sin errores y `git diff packages/db/src/tipos.ts` solo muestra cambios si cambió el esquema.

## 2. Pruebas de base de datos (permisos, estados, slugs, búsqueda)

```bash
pnpm test:db
```

**Esperado**: todos los archivos de `supabase/tests/` en `ok`. Cubren:

| Archivo | Verifica |
|---|---|
| `privilegios.test.sql` | privilegios exactos por rol; `net.http_*` revocado |
| `perfiles_base.test.sql` · `equipo.test.sql` | alta por trigger, protección de rol y activo, último admin, editor desactivado |
| `slugs.test.sql` · `redirecciones.test.sql` | normalización, sufijos, redirecciones sin cadenas ni fugas (RF-005, RF-012) |
| `articulos_borrador.test.sql` · `articulos_publicacion.test.sql` | campos del sistema, versión, matriz de estados, requisitos (RF-008 a RF-010) |
| `autores_publicos.test.sql` | datos públicos de autores; vista no escribible |
| `taxonomias.test.sql` | categoría en uso, borrado de etiqueta, `asignar_etiquetas` (RF-014 a RF-016) |
| `programacion.test.sql` | cron y `publicado_en = programado_para` (RF-011, CE-003) |
| `busqueda.test.sql` | conjunto de prueba de CE-004 (mínimo 84,6 % en el top 3: desviación aceptada, ver `validacion.md`), pesos, solo publicados, recálculos (RF-018 a RF-020) |
| `actualizado_en.test.sql` | los recálculos y la carga inicial de `busqueda` no mueven `version` ni `actualizado_en` |
| `notificaciones.test.sql` | qué eventos encolan una petición en `net.http_request_queue`, incluida la publicación por el cron (RF-013) |
| `validaciones.test.sql` | checks de contenido e imágenes |
| `storage.test.sql` | bucket `medios` |
| `seed.test.sql` | volumen y cobertura de los datos de demo (RF-028) |
| `autores_slug.test.sql` · `sitemap.test.sql` | slug de autor y `entradas_sitemap` (spec 002) |

## 3. Pruebas de paquetes

```bash
pnpm test
```

**Esperado**:
- `@blog/bloques`: los casos válidos e inválidos de cada tipo de bloque (CE-006), con errores que indican `indice` y `campo`.
- `@blog/db`: `rutasAfectadas`, `traducirError` y, contra Supabase local, las consultas públicas, la búsqueda, las operaciones del equipo (artículos, taxonomías y perfiles) y el invariante `TIPOS_BLOQUE = privado.tipos_bloque()` (leído con `supabase db query --local`).

## 4. Comprobación manual rápida (opcional)

Con la clave anon (`supabase status`):

```bash
# Solo publicados: no deben aparecer borradores ni programados
curl -s "http://127.0.0.1:56321/rest/v1/articulos?select=slug,estado" -H "apikey: $ANON" | jq 'map(.estado) | unique'
# → ["publicado"]

# Búsqueda sin tildes
curl -s -X POST "http://127.0.0.1:56321/rest/v1/rpc/buscar_articulos" \
  -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"consulta":"diseno"}' | jq '.[0].titulo'

# perfiles no es accesible para anon
curl -s "http://127.0.0.1:56321/rest/v1/perfiles?select=*" -H "apikey: $ANON"
# → error de permiso
```

## 5. Programación en vivo (CE-003)

En Studio (:56323) o con psql, como `editor@demo.local`, programá un borrador para dentro de 2 minutos. Esperá y consultá como anon: el artículo tiene que aparecer como publicado a más tardar 60 segundos después de la hora programada.

Sin abrir Studio, como `postgres` (no exige la fecha futura del cliente, pero el job es el mismo):

```bash
supabase db query --local "update public.articulos set estado = 'programado', programado_para = now() + interval '70 seconds' where slug = 'checklist-de-lanzamiento-de-un-sitio'"
```

## 6. Notificación a la web en local (opcional)

Con `pnpm dev:web` en marcha, publicá un artículo y revisá `select status_code, error_msg from net._http_response order by id desc limit 1;`. Debe responder el endpoint de `apps/web` (hasta que exista, un 404 confirma que llega). La URL en Vault usa el gateway de Docker `172.17.0.1`, así que Astro tiene que escuchar en todas las interfaces (`pnpm --filter web dev --host`).

## 7. Calidad

```bash
pnpm lint && pnpm typecheck && pnpm calidad
```

## Usuarios de demo

| Email | Contraseña | Rol |
|---|---|---|
| `admin@demo.local` | `demo-admin-2026` | admin |
| `editora@demo.local` | `demo-editora-2026` | editor |
| `editor@demo.local` | `demo-editor-2026` | editor |

> Son credenciales solo para el entorno local y de demo. En producción, `seed.sql` no se ejecuta.
