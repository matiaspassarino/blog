# Contrato: contenido de la landing (`apps/web/src/contenido/`)

**Decisión**: research D8 y D9. Lo edita la persona responsable de la demo en cada cliente, y después se redespliega.

```ts
// esquema.ts (astro/zod). Si falla, `astro build` muestra la ruta del campo.
{
  sitio:      { nombre: string(1..40), lema: string(1..60), descripcion: string(50..160) },   // el logo vive en @blog/ui/identidad (§VII.6)
  hero:       { titulo: string(1..80), bajada: string(1..200), cta: string(1..30), imagen: { src, alt, ancho, alto } },
  propuesta:  { titulo: string, texto: string(1..400), puntos: string[](1..4) },
  servicios:  { titulo: string, items: { titulo: string(1..60), descripcion: string(1..200), icono: NombreIcono }[](3..6) },
  testimonios:{ titulo: string, items: { cita: string(1..300), nombre: string, cargo: string, foto?: { src, alt } }[](1..6) },
  blog:       { titulo: string, descripcion: string(50..160) },            // sección de últimos artículos y meta de /blog
  contacto:   { titulo: string, texto: string, whatsapp: string /* ^\d{8,15}$ */, mensaje: string(1..200),
                correo: string /* email */, asunto: string(1..80) },
}
```

- `NombreIcono` es la unión cerrada de los SVG que hay en `components/iconos/`.
- Las imágenes de la landing están en `apps/web/src/assets/landing/` y se optimizan en el build con `astro:assets`.
- Los testimonios de la demo son ficticios y lo dicen a la vista ("Testimonios de ejemplo"), para no presentar reseñas falsas como reales.
