// globalSetup de Vitest: resuelve la conexión a Supabase local para los tests de
// integración. Solo para tests.
import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

export type EntornoSupabase = {
  url: string;
  claveAnon: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: EntornoSupabase | null;
  }
}

function desdeVariables(): EntornoSupabase | null {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return { url: SUPABASE_URL, claveAnon: SUPABASE_ANON_KEY };
}

function desdeSupabaseStatus(): EntornoSupabase | null {
  try {
    const salida = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const valores = Object.fromEntries(
      salida
        .split('\n')
        .map((linea) => linea.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1], m[2]]),
    );
    if (!valores.API_URL || !valores.ANON_KEY) return null;
    return { url: valores.API_URL, claveAnon: valores.ANON_KEY };
  } catch {
    return null;
  }
}

export default function setup(proyecto: TestProject) {
  const entorno = desdeVariables() ?? desdeSupabaseStatus();
  if (!entorno) {
    if (process.env.CI === 'true') {
      throw new Error('Supabase local no está disponible: los tests de integración son obligatorios en CI.');
    }
    console.warn('[@blog/db] Supabase local no disponible: se saltan los tests de integración.');
  }
  proyecto.provide('supabase', entorno);
}
