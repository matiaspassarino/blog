// T019 (spec 003): mensajes de error en español, sin jerga (RF-023; contracts/acciones.md, "Códigos y mensajes").
// Firma supuesta (T033), exportada desde './mensajes':
//   mensajeDeError(codigo: CodigoError | CodigoPanel, detalle?: string): string
// El tipo `CodigoError` sale de @blog/db; el `Record` de abajo obliga (en el typecheck) a listar todos
// los códigos del dominio: si @blog/db suma uno, este test deja de compilar hasta que se cubra.
import type { CodigoError } from '@blog/db';
import { describe, expect, it } from 'vitest';
import { mensajeDeError } from './mensajes';

const CODIGOS_DEL_DOMINIO: Record<CodigoError, true> = {
  conflicto_version: true,
  estado_invalido: true,
  requisitos_publicacion: true,
  fecha_no_futura: true,
  categoria_en_uso: true,
  ultimo_admin: true,
  sin_permiso: true,
  contenido_invalido: true,
  slug_duplicado: true,
  validacion: true,
  no_encontrado: true,
  desconocido: true,
};

const CODIGOS_DEL_PANEL = [
  'no_autenticado',
  'imagen_invalida',
  'credenciales_invalidas',
  'cuenta_desactivada',
] as const;

const TODOS = [...(Object.keys(CODIGOS_DEL_DOMINIO) as CodigoError[]), ...CODIGOS_DEL_PANEL];

// Texto exacto de la tabla del contrato (códigos sin detalle).
const MENSAJES_FIJOS: Record<string, string> = {
  no_autenticado: 'Tu sesión terminó. Ingresa de nuevo para seguir.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  conflicto_version: 'Alguien guardó cambios más nuevos en este artículo.',
  estado_invalido: 'Esa acción no está disponible para el estado actual del artículo.',
  fecha_no_futura: 'Elige una fecha y hora que todavía no hayan pasado.',
  ultimo_admin: 'Siempre tiene que quedar al menos un administrador activo.',
  contenido_invalido: 'Revisa los campos marcados.',
  slug_duplicado: 'Esa dirección ya está en uso.',
  no_encontrado: 'Ya no existe. Puede que lo hayan eliminado.',
  credenciales_invalidas: 'El correo o la contraseña no son correctos.',
  cuenta_desactivada: 'Tu cuenta está desactivada. Habla con un administrador.',
  desconocido: 'Algo salió mal. Prueba de nuevo en unos minutos.',
};

const JERGA =
  /\b(RLS|trigger|uuid|postgres|postgrest|supabase|jwt|stack|exception|null|undefined)\b|P0001|42501|23505|23503|23514|PGRST/i;

describe('mensajeDeError', () => {
  it.each(TODOS)('RF-023: %s tiene un mensaje en español', (codigo) => {
    const mensaje = mensajeDeError(codigo, 'detalle de prueba');

    expect(typeof mensaje).toBe('string');
    expect(mensaje.trim().length).toBeGreaterThan(0);
  });

  it.each(Object.entries(MENSAJES_FIJOS))('RF-023: %s usa el texto del contrato', (codigo, esperado) => {
    expect(mensajeDeError(codigo as CodigoError)).toBe(esperado);
  });

  it('RF-023: requisitos_publicacion incluye el detalle de lo que falta', () => {
    expect(mensajeDeError('requisitos_publicacion', 'sin categoría')).toContain('sin categoría');
    expect(mensajeDeError('requisitos_publicacion', 'sin bloques')).toContain('sin bloques');
  });

  it('RF-023: categoria_en_uso incluye el conteo de artículos', () => {
    expect(mensajeDeError('categoria_en_uso', '3')).toContain('3');
    expect(mensajeDeError('categoria_en_uso', '12')).toContain('12');
  });

  it('RF-023: imagen_invalida muestra el detalle que se le pasa', () => {
    expect(mensajeDeError('imagen_invalida', 'La imagen supera los 5 MB')).toContain('La imagen supera los 5 MB');
  });

  it.each(TODOS)('RF-023: el mensaje de %s no contiene jerga técnica', (codigo) => {
    expect(mensajeDeError(codigo)).not.toMatch(JERGA);
    expect(mensajeDeError(codigo, 'detalle de prueba')).not.toMatch(JERGA);
  });

  it('RF-023: los mensajes de errores distintos son distintos', () => {
    const sinDetalle = TODOS.filter((c) => c !== 'imagen_invalida').map((c) => mensajeDeError(c));

    expect(new Set(sinDetalle).size).toBe(sinDetalle.length);
  });
});
