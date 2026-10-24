# Validación de especificación: Estética del editor de artículos y lienzo limpio (Spec 006)

**Rama**: `006-estetica-editor-articulo`  
**Fecha de validación**: 2026-10-24  
**Responsable**: Antigravity Assistant & Zorzal  

---

## 1. Criterios de éxito y resultados

### CE-001: Reducción del espacio vertical previo al editor
- **Antes**: En la columna principal del editor se apilaban:
  1. Campo tradicional de formulario para Título con marco y etiqueta (`CampoFormulario`).
  2. Campo tradicional para Slug con texto de ayuda (`CampoFormulario`).
  3. Campo de texto multilinea para Extracto (`CampoFormulario`).
  4. Sección completa "Imagen destacada" (`TituloSeccion`, `fieldset` con selector, miniatura, alt y decorativa).
  5. Rótulo de sección "Contenido".
  - *Distancia acumulada al primer bloque editable*: > 550 px en escritorio estándar, obligando al usuario a desplazarse hacia abajo antes de empezar a escribir.
- **Después**:
  1. El Título se integra directamente en el lienzo como encabezado limpio tipo Notion/Medium (`text-2xl sm:text-3xl lg:text-4xl font-titulos font-bold text-texto placeholder:text-texto-suave/40`, sin bordes ni cajas grises, autoajustable en altura).
  2. El editor de documento Tiptap (`CargadorDeEditorDocumento`) comienza inmediatamente a continuación del título (separación de solo `gap-6` / 24 px).
  3. Slug, Extracto e Imagen destacada se reubicaron en la pestaña «Artículo» de la barra lateral.
- **Resultado**: **CUMPLIDO**. Reducción vertical superior al 70%, ubicando la primera línea de contenido dentro del campo de visión inmediato (*above the fold*).

---

### CE-002: Persistencia e integridad funcional de los metadatos
- **Validación**:
  - El campo Slug conserva su autocompletado y normalización al escribir el título en artículos nuevos (con retardo de 300 ms).
  - Los campos Slug y Extracto se editan dentro de la sección "Detalles" en `panel-articulo`.
  - La sección "Imagen destacada" se renderiza en `panel-articulo` con el `fieldset` accesible `role="group"` y el selector `ImagenEditable` con soporte para subida, miniatura, texto alternativo, casilla decorativa y confirmación de borrado.
  - Las secciones "Taxonomías" y "Para buscadores" (SEO) permanecen organizadas secuencialmente debajo de "Imagen destacada".
- **Resultado**: **CUMPLIDO**.

---

### CE-003: Accesibilidad WCAG AA, foco y soporte táctil
- **Etiquetas y lectores de pantalla**:
  - El campo Título mantiene su `<label htmlFor="campo-titulo" className="sr-only">Título</label>` y `aria-label="Título"`, garantizando compatibilidad total con lectores de pantalla y selectores de prueba `getByLabel('Título', { exact: true })`.
  - Los campos Slug y Extracto mantienen sus etiquetas asociadas `for="campo-slug"` y `for="campo-extracto"`.
  - La sección de imagen destacada mantiene el `aria-labelledby="titulo-imagen-destacada"` sobre su `fieldset`.
- **Navegación por teclado y atajos**:
  - Al presionar `Enter` en el campo Título integrado, se previene el salto de línea y se transfiere el foco de inmediato al primer bloque del editor de documento (`acciones.current?.enfocar()`).
  - Si el usuario intenta guardar y hay un error de validación en campos del artículo (e.g. `imagen_destacada.alt` faltante) mientras la pestaña activa es «Elemento», el sistema conmuta automáticamente a la pestaña «Artículo» (`setPestania('articulo')`) y enfoca el control en falta.
- **Diseño responsive y áreas táctiles**:
  - En anchos < 1280 px (móviles y tabletas), el título adopta escala tipográfica fluida (`text-2xl sm:text-3xl lg:text-4xl`) y la barra lateral se apila verticalmente manteniendo el área táctil mínima de 44 px (`--tactil-min` / `min-h-(--tactil-min)`).
- **Resultado**: **CUMPLIDO**.

---

## 2. Resultados de las suites de verificación

| Verificación | Comando | Resultado | Notas |
|---|---|---|---|
| Tipos TypeScript | `pnpm.cmd typecheck` | **PASS** (0 errores) | Verificado en los 6 paquetes del monorepo. |
| Linters | `pnpm.cmd lint` | **PASS** (0 errores) | Verificado en los 6 paquetes del monorepo. |
| Formato de código | `pnpm.cmd formato:verificar` | **PASS** (100% Prettier) | Todos los archivos cumplen las reglas de formato. |
| Calidad y duplicación | `pnpm.cmd calidad` | **PASS** (0 alertas knip / jscpd dentro de umbral) | Sin dependencias huérfanas ni código duplicado nuevo. |
| Pruebas unitarias Admin | `pnpm.cmd --filter admin test -- run` | **PASS** (749/749 pruebas) | 29 archivos de prueba ejecutados en 8.8s. |

---

## 3. Conclusión

La especificación `006-estetica-editor-articulo` cumple el 100% de los requisitos estéticos, funcionales y constitucionales planteados por el usuario. La rama está lista para merge hacia `main`.
