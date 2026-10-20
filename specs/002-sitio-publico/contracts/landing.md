# Contrato: contenido de la landing (`apps/web/src/contenido/`)

**Decisión**: research D8 y D9. Lo edita la persona responsable de la demo en cada cliente, y después se redespliega.

```ts
// esquema.ts (astro/zod). Si falla, `astro build` muestra la ruta del campo.
{
  sitio:      { nombre: string(1..40), lema: string(1..60), descripcion: string(50..160) },   // el logo vive en @blog/ui/identidad (§VII.6)
  hero:       { titulo: string(1..80), bajada: string(1..200), cta: string(1..30), imagen: { src: ImageMetadata, alt } },
  propuesta:  { titulo: string, texto: string(1..400), puntos: string[](1..4) },
  servicios:  { titulo: string, items: { titulo: string(1..60), descripcion: string(1..200), icono: NombreIcono }[](3..6) },
  testimonios:{ titulo: string, items: { cita: string(1..300), nombre: string, cargo: string, foto?: { src: ImageMetadata, alt } }[](1..6) },
  blog:       { titulo: string, descripcion: string(50..160) },            // sección de últimos artículos y meta de /blog
  contacto:   { titulo: string, texto: string, whatsapp: string /* ^\d{8,15}$ */,
                whatsappVisible: string /* ^\+?[\d\s().-]{8,25}$, mismos dígitos que whatsapp */,
                mensaje: string(1..200), correo: string /* email */, asunto: string(1..80) },
}
```

- `whatsappVisible` es el número que se muestra como texto en el pie (por ejemplo, "+54 9 11 0000-0000"). `whatsapp` se usa para armar el enlace `wa.me`. Si los dígitos de los dos campos no coinciden, el build falla.

- `NombreIcono` es la unión cerrada de los SVG que hay en `components/iconos/`.
- Las imágenes de la landing están en `apps/web/src/assets/landing/`, se importan en `landing.ts` y se optimizan con `astro:assets`. El ancho y el alto salen de los metadatos de la imagen importada, así que no se repiten en el contenido.
- Los testimonios de la demo son ficticios y lo dicen a la vista ("Testimonios de ejemplo"), para no presentar reseñas falsas como reales.
