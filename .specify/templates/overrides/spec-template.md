# Especificación: [NOMBRE DE LA FEATURE]

**Rama**: `[###-nombre-feature]`

**Creada**: [FECHA]

**Estado**: Borrador

**Entrada**: Descripción del usuario: "$ARGUMENTS"

<!--
  REGLAS (ver /constitucion.md):
  - Redactar TODO en español.
  - La spec describe QUÉ y POR QUÉ, nunca CÓMO (sin frameworks, tablas ni componentes).
  - Cada historia debe ser independiente y testeable por sí sola.
  - Marcar dudas con [NECESITA ACLARACIÓN: ...] (máximo 3; el resto resolver con supuestos razonables).
-->

## Escenarios de usuario y pruebas *(obligatorio)*

<!--
  Historias PRIORIZADAS (P1 = más crítica). Cada una debe poder desarrollarse, testearse,
  desplegarse y demostrarse de forma independiente.
  Actores habituales: visitante (anónimo), editor, admin.
-->

### Historia 1 - [Título breve] (Prioridad: P1)

[Recorrido del usuario en lenguaje simple]

**Por qué esta prioridad**: [Valor que aporta]

**Prueba independiente**: [Cómo se verifica por sí sola]

**Escenarios de aceptación**:

1. **Dado** [estado inicial], **cuando** [acción], **entonces** [resultado esperado]
2. **Dado** [estado inicial], **cuando** [acción], **entonces** [resultado esperado]

---

### Historia 2 - [Título breve] (Prioridad: P2)

[Recorrido del usuario]

**Por qué esta prioridad**: [Valor]

**Prueba independiente**: [Verificación]

**Escenarios de aceptación**:

1. **Dado** [estado inicial], **cuando** [acción], **entonces** [resultado esperado]

---

[Agregar más historias según sea necesario, cada una con prioridad]

### Casos borde

- ¿Qué pasa cuando [condición límite]?
- ¿Cómo responde el sistema ante [error]?

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **RF-001**: El sistema DEBE [capacidad concreta]
- **RF-002**: El sistema DEBE [capacidad concreta]
- **RF-003**: Los usuarios con rol [rol] DEBEN poder [interacción]
- **RF-004**: El sistema DEBE [requisito de datos]

### Requisitos de SEO *(obligatorio si afecta páginas públicas)*

- **RSEO-001**: [Metadatos, datos estructurados, URL, indexación, sitemap/RSS afectados]

### Requisitos de permisos *(obligatorio si hay datos o acciones restringidas)*

| Acción | anónimo | editor | admin |
|---|---|---|---|
| [acción] | ✗ | ✓ | ✓ |

### Entidades clave *(si la feature involucra datos)*

- **[Entidad 1]**: [Qué representa, atributos clave, sin implementación]
- **[Entidad 2]**: [Relación con otras entidades]

## Criterios de éxito *(obligatorio)*

<!-- Medibles y agnósticos de tecnología. -->

### Resultados medibles

- **CE-001**: [Métrica medible, p. ej. "Un editor publica un artículo con 5 bloques en menos de 3 minutos"]
- **CE-002**: [Métrica SEO/rendimiento, p. ej. "Las páginas nuevas obtienen Lighthouse SEO ≥ 95"]
- **CE-003**: [Métrica de usabilidad/accesibilidad]

## Supuestos

- [Supuesto sobre usuarios, alcance, datos o dependencias]

## Fuera de alcance

- [Lo que explícitamente NO incluye esta spec]
