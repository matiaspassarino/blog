// Enlaces de contacto de la landing (specs/002-sitio-publico/research.md D9).

/** Conversación de WhatsApp con un mensaje inicial. `numero` en E.164 sin "+". */
export function enlaceWhatsapp(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function enlaceCorreo(correo: string, asunto: string): string {
  return `mailto:${correo}?subject=${encodeURIComponent(asunto)}`;
}
