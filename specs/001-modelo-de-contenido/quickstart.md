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
| `busqueda.test.sql` | conjunto de prueba ≥ 95 % en el top 3, pesos, solo publicados (RF-018 a RF-020, CE-004) |
| `notificaciones.test.sql` | qué eventos encolan una petición en `net.http_request_queue` (RF-013) |
| `storage.test.sql` | bucket `medios` |
| `seed.test.sql` | volumen y cobertura de los datos de demo (RF-028) |

## 3. Pruebas de paquetes

```bash
pnpm test
```

**Esperado**:
- `@blog/bloques`: los casos válidos e inválidos de cada tipo de bloque (CE-006), con errores que indican `indice` y `campo`.
- `@blog/db`: `rutasAfectadas`, `traducirError` y, contra Supabase local, las consultas públicas y el invariante `TIPOS_BLOQUE = privado.tipos_bloque()`.

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
