// Ayuda de tests (spec 003): simula `next/headers`, `next/navigation` y `next/cache` para correr las
// Server Actions sin un servidor Next. Solo para tests. Se usa así, en el archivo de prueba:
//
//   vi.mock('next/headers', async () => (await import('../test/next-simulado')).moduloHeaders);
//   vi.mock('next/navigation', async () => (await import('../test/next-simulado')).moduloNavegacion);
//   vi.mock('next/cache', async () => (await import('../test/next-simulado')).moduloCache);
//
// El almacén de cookies es el de la "petición" en curso: iniciar sesión con la acción `ingresar` deja
// ahí las cookies de Supabase, y vaciarlo equivale a ser anónimo.
import { vi } from 'vitest';

export class Redireccion extends Error {
  constructor(readonly destino: string) {
    super(`NEXT_REDIRECT ${destino}`);
  }
}

export const almacenCookies = new Map<string, string>();

export const moduloHeaders = {
  cookies: async () => ({
    getAll: () => [...almacenCookies].map(([name, value]) => ({ name, value })),
    get: (name: string) => (almacenCookies.has(name) ? { name, value: almacenCookies.get(name)! } : undefined),
    has: (name: string) => almacenCookies.has(name),
    set: (name: string, value: string, opciones?: { maxAge?: number }) => {
      if (value === '' || opciones?.maxAge === 0) almacenCookies.delete(name);
      else almacenCookies.set(name, value);
    },
    delete: (name: string) => almacenCookies.delete(name),
  }),
};

export const moduloNavegacion = {
  redirect: (destino: string) => {
    throw new Redireccion(destino);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Redireccion) throw error;
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  forbidden: () => {
    throw new Error('NEXT_FORBIDDEN');
  },
};

export const moduloCache = { revalidatePath: vi.fn(), revalidateTag: vi.fn() };

export function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos)) datos.set(clave, valor);
  return datos;
}

/** Ejecuta la acción y devuelve el destino si redirigió, o su resultado si devolvió. */
export async function correr<T>(accion: () => Promise<T>): Promise<{ redirigio: string } | { resultado: T }> {
  try {
    return { resultado: await accion() };
  } catch (error) {
    if (error instanceof Redireccion) return { redirigio: error.destino };
    throw error;
  }
}

export const hayCookieDeSesion = () => [...almacenCookies.keys()].some((nombre) => /auth-token/.test(nombre));
