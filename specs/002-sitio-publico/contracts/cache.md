# Contrato: recepción de avisos e invalidación de caché

**Consume**: el aviso firmado de la base ([contrato 001](../../001-modelo-de-contenido/contracts/revalidacion.md)). **Decisiones**: research D1–D4 y D11.

## `POST /api/revalidar` (`apps/web/src/pages/api/revalidar.ts`, `prerender = false`, sin caché)

| Condición | Respuesta |
|---|---|
| Método distinto de `POST` | `405` |
| Falta `X-Blog-Marca-Tiempo` o `X-Blog-Firma`, la firma no coincide (HMAC-SHA256 sobre `marca + "." + cuerpoCrudo`, comparada en tiempo constante) o `abs(ahora - marca) > 300 s` | `401 {"error":"no_autorizado"}`, sin efectos |
| El cuerpo no es JSON o no cumple `esquemaCambioPublico` | `400 {"error":"peticion_invalida"}`, sin efectos |
| Aceptado | `200 {"tags":[…],"rutas":[…]}`, después de `await cache.invalidate(...)` |
| Falla la invalidación del proveedor | `502 {"error":"invalidacion_fallida"}`. La base no reintenta y el `swr` acota la desactualización. |

La firma se verifica **antes** de parsear. El orden es 401 → 400 → 200.

## `esquemaCambioPublico` (`@blog/db`, Zod)

```ts
{
  tipo: 'articulo' | 'categoria' | 'etiqueta' | 'autor',
  id: string /* uuid */,
  slugs: string[] /* 1..50, formato slug */,
  categorias?: string[], etiquetas?: string[],   // solo articulo; se aceptan y no se usan (D1)
  ocurrido_en: string /* ISO */,
}
```

Los campos desconocidos se ignoran (`z.object`, no estricto), así la base puede agregar campos sin romper el sitio.

## `invalidacionesDe(cambio): { tags: string[]; rutas: string[] }` (`@blog/db`, pura)

| `tipo` | `tags` | `rutas` |
|---|---|---|
| `articulo` | `articulos`, `articulo:<id>` | `/blog/<s>` por cada slug |
| `categoria` | `articulos`, `categoria:<id>` | `/blog/categoria/<s>` por cada slug |
| `etiqueta` | `articulos`, `etiqueta:<id>` | `/blog/etiqueta/<s>` por cada slug |
| `autor` | `articulos`, `autor:<id>` | — |

Las dos listas vienen sin repetidos y en un orden estable.

## Tags que declara cada página (`apps/web/src/lib/cache.ts`)

Hay una única fuente con un helper por tipo de página. Ninguna página escribe tags a mano.

| Helper | Tags | `maxAge` / `swr` |
|---|---|---|
| `cacheArticulo(a, relacionados)` | `articulo:<a.id>`, `categoria:<id>`, `etiqueta:<id>`…, `autor:<id>`, `articulo:<r.id>`… | 31536000 / 60 |
| `cacheListado(entidad?)` | `articulos` (+ `categoria:<id>` \| `etiqueta:<id>` \| `autor:<id>`) | 31536000 / 60 |
| `cacheNoEncontrado()` | — (tag de ruta automático) | 3600 / 60 |
| `cacheRedireccion()` | — | 31536000 / 0 |

`tags.ts` (`@blog/db`) exporta las constantes y los constructores (`tagArticulo(id)`, etc.). Los usan tanto `invalidacionesDe` como `apps/web/src/lib/cache.ts`, así que el formato del tag tiene una sola fuente.
