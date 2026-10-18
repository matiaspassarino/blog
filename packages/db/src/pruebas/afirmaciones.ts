// Afirmaciones compartidas por los tests de integración. Solo para tests.
import { expect } from 'vitest';
import { ErrorDominio } from '../errores';

/** Ejecuta la promesa y devuelve el error con el que se rechaza (o falla si se resuelve). */
export async function rechazoDe(promesa: Promise<unknown>): Promise<ErrorDominio> {
  const error = await promesa.then(
    () => {
      throw new Error('se esperaba que la operación se rechazara');
    },
    (motivo: unknown) => motivo,
  );
  expect(error).toBeInstanceOf(ErrorDominio);
  return error as ErrorDominio;
}
