// T040 (spec 003, RF-026): plantilla del correo de recuperación (contracts/correos.md). FASE ROJA:
// `supabase/templates/recuperacion.html` no existe aún. La de invitacion.html es de H6 (T063+), no va aquí.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../../../..');
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');

describe('supabase/templates/recuperacion.html', () => {
  const html = leer('supabase/templates/recuperacion.html');

  it('RF-026: el enlace usa el token y el tipo de recuperación', () => {
    expect(html).toContain('{{ .TokenHash }}');
    expect(html).toContain('type=recovery');
  });

  it('RF-026: el enlace apunta a /auth/confirmar del sitio configurado', () => {
    expect(html).toContain('{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery');
  });

  it('RF-026: avisa que el enlace sirve una sola vez y vence en 24 horas', () => {
    expect(html).toContain('Este enlace sirve una sola vez y vence en 24 horas');
  });

  it('RF-026: aclara qué hacer si no se esperaba el correo', () => {
    expect(html).toContain('Si no esperabas este correo, ignóralo');
  });

  it('RF-026: tiene un único botón con el enlace (más el texto alternativo del pie)', () => {
    const enlaces = html.match(/<a\s[^>]*href=/gi) ?? [];
    expect(enlaces).toHaveLength(1);
  });

  it('RF-026: ningún enlace apunta a otro dominio', () => {
    const destinos = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    expect(destinos.length).toBeGreaterThan(0);
    for (const destino of destinos) expect(destino.startsWith('{{ .SiteURL }}/')).toBe(true);
    // Tampoco imágenes ni URLs sueltas que no sean la variable del sitio.
    const absolutas = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/gi)].map((m) => m[0]);
    expect(absolutas).toEqual([]);
  });

  it('RF-026: usa estilos en línea (los clientes de correo no cargan hojas de estilo)', () => {
    expect(html).toMatch(/style="/);
    expect(html).not.toMatch(/<link\s/i);
    expect(html).not.toMatch(/<script/i);
  });
});

describe('supabase/config.toml', () => {
  const config = leer('supabase/config.toml');

  it('RF-026: registra la plantilla de recuperación con su asunto', () => {
    expect(config).toMatch(/\[auth\.email\.template\.recovery\]/);
    expect(config).toContain('subject = "Define una nueva contraseña"');
    expect(config).toContain('content_path = "./supabase/templates/recuperacion.html"');
  });
});
