// Lectura de los correos de Auth en Mailpit (supabase start, :56324). Solo para E2E (research D22).
const BASE = process.env.MAILPIT_URL ?? 'http://127.0.0.1:56324';

type Resumen = { ID: string; To: { Address: string }[]; Created: string };

/** Espera el último correo enviado a `correo` y devuelve el primer enlace del cuerpo HTML. */
export async function enlaceDelCorreo(correo: string, { intentos = 20, esperaMs = 500 } = {}): Promise<string> {
  for (let i = 0; i < intentos; i += 1) {
    const lista = (await (await fetch(`${BASE}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`)).json()) as {
      messages?: Resumen[];
    };
    const ultimo = lista.messages?.[0];
    if (ultimo) {
      const mensaje = (await (await fetch(`${BASE}/api/v1/message/${ultimo.ID}`)).json()) as { HTML?: string };
      const enlace = /href="([^"]+)"/.exec(mensaje.HTML ?? '')?.[1];
      if (enlace) return enlace.replaceAll('&amp;', '&');
    }
    await new Promise((resolver) => setTimeout(resolver, esperaMs));
  }
  throw new Error(`No llegó ningún correo a ${correo}`);
}

/** Cuántos correos hay para `correo` (para comprobar que NO se envió ninguno). */
export async function cantidadDeCorreos(correo: string): Promise<number> {
  const lista = (await (await fetch(`${BASE}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`)).json()) as {
    messages_count?: number;
  };
  return lista.messages_count ?? 0;
}

/** Borra los correos de la bandeja (empezar cada spec sin ruido). */
export async function vaciarBandeja() {
  await fetch(`${BASE}/api/v1/messages`, { method: 'DELETE' });
}
