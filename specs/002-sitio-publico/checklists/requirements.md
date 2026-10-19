# Checklist de calidad de la especificación: Sitio público (landing y blog)

**Propósito**: validar que la spec esté completa y tenga calidad antes de planificar
**Creada**: 2026-10-19
**Feature**: [spec.md](../spec.md)

## Calidad del contenido

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs)
- [x] Centrada en el valor para el usuario y el negocio
- [x] Redactada para personas no técnicas
- [x] Todas las secciones obligatorias completas

## Completitud de los requisitos

- [x] No quedan marcadores [NECESITA ACLARACIÓN]
- [x] Los requisitos se pueden testear y no son ambiguos
- [x] Los criterios de éxito son medibles
- [x] Los criterios de éxito no dependen de la tecnología
- [x] Todos los escenarios de aceptación están definidos
- [x] Se identificaron los casos borde
- [x] El alcance está bien delimitado
- [x] Se identificaron las dependencias y los supuestos

## Preparación de la feature

- [x] Cada requisito funcional tiene criterios de aceptación claros
- [x] Los escenarios cubren los flujos principales
- [x] La feature cumple los resultados medibles de los criterios de éxito
- [x] No se filtran detalles de implementación en la spec

## Notas

- Las rutas (`/blog/{slug}`…), Open Graph, JSON-LD, sitemap y RSS aparecen en la spec porque los fija la constitución (§IV), no por elección de implementación.
- Los 2 marcadores (canal de contacto y fuente de los textos de la landing) se resolvieron con el usuario el 2026-10-19.
- Se resolvió con un supuesto lo que la spec 001 había dejado abierto: las páginas de los artículos se actualizan cuando cambia una taxonomía (RF-019).
