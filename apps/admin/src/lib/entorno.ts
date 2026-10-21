// Variables de entorno públicas de Supabase para el panel. Las lee el servidor (sesión, proxy) y las
// repite el navegador solo para subir archivos con una URL firmada.

/** Falla con un mensaje claro si falta una variable en lugar de mandar `undefined` a Supabase. */
function requerida(valor: string | undefined, nombre: string): string {
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example)`);
  return valor;
}

export function entornoSupabase() {
  return {
    url: requerida(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    claveAnon: requerida(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}
