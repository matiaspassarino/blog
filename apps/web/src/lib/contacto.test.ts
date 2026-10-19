// T025 (spec 002): enlaces de contacto por WhatsApp y correo (research D9, H3-E4).
import { describe, expect, it } from 'vitest';
import { enlaceCorreo, enlaceWhatsapp } from './contacto';

describe('enlaceWhatsapp', () => {
  it('H3-E4: arma el enlace wa.me con el mensaje codificado', () => {
    expect(enlaceWhatsapp('5491100000000', 'Hola, quiero info')).toBe(
      'https://wa.me/5491100000000?text=Hola%2C%20quiero%20info',
    );
  });
});

describe('enlaceCorreo', () => {
  it('H3-E4: arma el mailto con el asunto codificado', () => {
    expect(enlaceCorreo('a@b.com', 'Consulta & demo')).toBe('mailto:a@b.com?subject=Consulta%20%26%20demo');
  });
});
