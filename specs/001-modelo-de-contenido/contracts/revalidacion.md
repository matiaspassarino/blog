# Contrato: notificación de cambios públicos (base de datos → sitio público)

Lo emite la base (D14) y lo consume `apps/web` en `POST /api/revalidar`. El endpoint se implementa en la spec del sitio público; esta spec define y emite el mensaje.

## Petición

```http
POST {url_web_revalidacion}/api/revalidar
Authorization: Bearer {secreto_revalidacion}
Content-Type: application/json
```

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
| Cambio de `nombre`, `biografia` o `avatar` de un autor con artículos publicados | Sí: **un** mensaje `tipo: 'autor'` con los slugs de hasta 50 de sus artículos publicados |
| Updates que solo cambian `busqueda`, `version` o `actualizado_en` | No |

## Rutas que calcula `rutasAfectadas` (`@blog/db`)

- **Artículo**: `/blog/{slug}` por cada slug, `/blog`, `/blog/pagina/*` (las primeras 5 páginas), `/blog/categoria/{c}`, `/blog/etiqueta/{e}`, `/`, `/sitemap.xml`, `/rss.xml`.
- **Autor**: `/blog/{slug}` por cada slug y `/blog`.
- **Categoría o etiqueta**: `/blog/{categoria|etiqueta}/{slug}` por cada slug, `/blog`, `/sitemap.xml`.

## Garantías

- El envío es asíncrono (`pg_net`), está envuelto en un `exception when others` y **nunca** hace fallar la transacción de origen.
- El delete de un artículo se notifica en `before delete`, para incluir las etiquetas antes del cascade.
- Si Vault no tiene la URL o el secreto configurados, no se emite (es lo normal en tests).
- El consumidor debe ser idempotente: recibir dos veces el mismo mensaje no tiene efectos adversos.
