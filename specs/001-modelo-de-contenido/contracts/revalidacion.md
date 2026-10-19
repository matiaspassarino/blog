# Contrato: notificación de cambios públicos (base de datos → sitio público)

Lo emite la base (D14) y lo consume `apps/web` en `POST /api/revalidar`. El endpoint se implementa en la spec del sitio público; esta spec define y emite el mensaje.

## Petición

```http
POST {url_web_revalidacion}/api/revalidar
Content-Type: application/json
X-Blog-Marca-Tiempo: {segundos desde epoch}
X-Blog-Firma: sha256={hex(HMAC-SHA256(secreto_revalidacion, marca + "." + cuerpo))}
```

**El secreto nunca viaja ni se guarda en la cola de `pg_net`**: Supabase le da a PUBLIC acceso a `net.http_request_queue` y no se puede revocar (research D14). El endpoint:
1. Recalcula la firma sobre los **bytes exactos** del cuerpo recibido y la compara en tiempo constante.
2. Rechaza la petición (401) si la marca de tiempo tiene más de 5 minutos de diferencia con la hora actual (anti-replay).
3. Es idempotente, así que un reenvío dentro de la ventana no tiene efectos adversos.

```json
{
  "tipo": "articulo",          // articulo | categoria | etiqueta | autor
  "id": "5b0c…",
  "slugs": ["como-elegir-tipografia", "elegir-tipografia"],
  "categorias": ["diseno"],
  "etiquetas": ["tipografia", "branding"],
  "ocurrido_en": "2026-10-18T13:00:00Z"
}
```

- `slugs` incluye el slug actual y, si cambió, el anterior.
- `categorias` y `etiquetas` incluyen los valores de antes y de después del cambio (unión sin repetidos). Solo aparecen cuando `tipo = articulo`.

## Cuándo se emite

| Evento | ¿Emite? |
|---|---|
| Un artículo pasa a publicado (manual o cron) | Sí |
| Se edita un artículo publicado (contenido, título, slug, SEO, imagen, categoría, etiquetas) | Sí |
| Un artículo publicado pasa a archivado o a borrador, o se elimina | Sí |
| Cambios en borradores o programados | No |
| Se crea, edita o elimina una categoría o etiqueta | Sí |
| Cambio de `nombre`, `biografia` o `avatar` de un autor con artículos publicados | Sí: **un** mensaje `tipo: 'autor'` con `slugs = [slug del autor]` (spec 002) |
| Updates que solo cambian `busqueda`, `version` o `actualizado_en` | No |

## Qué invalida el sitio (spec 002)

`rutasAfectadas` ya no existe. El sitio usa caché de rutas con tags e `invalidacionesDe(cambio)` de `@blog/db` (ver `specs/002-sitio-publico/contracts/cache.md` y research D1–D3):

- cada página declara los tags de lo que muestra (`articulo:<id>`, `categoria:<id>`, `etiqueta:<id>`, `autor:<id>` y la colección `articulos`);
- el aviso invalida `articulos` más el tag de la entidad, y las rutas de sus slugs (el actual y los anteriores);
- así se resuelve el pendiente de esta spec: al renombrar o borrar una taxonomía, sus artículos se invalidan por su tag, sin ampliar el mensaje.

`SECRETO_REVALIDACION` solo firma el aviso (HMAC); ya no hay `bypassToken` de ISR. El recorrido base → `/api/revalidar` se verificó de punta a punta en local (spec 002, H4): la firma de `pg_net` valida en el sitio y el cuerpo cumple `esquemaCambioPublico`.

## Garantías

- El envío es asíncrono (`pg_net`), está envuelto en un `exception when others` y **nunca** hace fallar la transacción de origen.
- El delete de un artículo se notifica en `before delete`, para incluir las etiquetas antes del cascade.
- Si Vault no tiene la URL o el secreto configurados, no se emite (es lo normal en tests).
- El consumidor debe ser idempotente: recibir dos veces el mismo mensaje no tiene efectos adversos.
