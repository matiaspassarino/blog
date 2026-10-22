// T040 (spec 003, RF-026): plantilla del correo de recuperación (contracts/correos.md). FASE ROJA:
// `supabase/templates/recuperacion.html` no existe aún. La de invitacion.html (H6) se prueba más abajo (T089).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

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

// T089 (spec 003, RF-027): plantilla del correo de invitación. FASE ROJA: `supabase/templates/invitacion.html`
// no existe aún (T093). El saludo usa el nombre que carga el admin: `inviteUserByEmail(…, { data: { nombre } })`
// lo deja en `user_metadata`, que la plantilla lee como `{{ .Data.nombre }}`.
describe('supabase/templates/invitacion.html', () => {
  // Se lee en beforeAll: si el archivo falta, fallan solo estas pruebas y no las de recuperación.
  let html = '';
  let destinos: string[] = [];
  beforeAll(() => {
    html = leer('supabase/templates/invitacion.html');
    destinos = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
  });

  it('RF-027: el enlace usa el token y el tipo de invitación, no el de recuperación', () => {
    expect(html).toContain('{{ .TokenHash }}');
    expect(html).toContain('type=invite');
    expect(html).not.toContain('type=recovery');
  });

  it('RF-027: el enlace apunta a /auth/confirmar del sitio configurado', () => {
    expect(html).toContain('{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite');
  });

  it('RF-027: saluda con el nombre que cargó el admin', () => {
    expect(html).toContain('{{ .Data.nombre }}');
    expect(html).toMatch(/Hola/);
  });

  it('RF-027: avisa que el enlace sirve una sola vez, vence en 24 horas y qué hacer si no se esperaba', () => {
    expect(html).toContain('Este enlace sirve una sola vez y vence en 24 horas');
    expect(html).toContain('Si no esperabas este correo, ignóralo');
  });

  it('RF-027: tiene un único botón con el enlace, y ninguno apunta a otro dominio', () => {
    expect(html.match(/<a\s[^>]*href=/gi) ?? []).toHaveLength(1);
    expect(destinos.every((destino) => destino.startsWith('{{ .SiteURL }}/'))).toBe(true);
    expect(html.match(/https?:\/\/[^\s"'<>)]+/gi) ?? []).toEqual([]);
  });

  it('RF-027: usa estilos en línea, sin hojas de estilo ni scripts', () => {
    expect(html).toMatch(/style="/);
    expect(html).not.toMatch(/<link\s|<script/i);
  });
});

describe('supabase/config.toml', () => {
  const config = leer('supabase/config.toml');

  it('RF-026: registra la plantilla de recuperación con su asunto', () => {
    expect(config).toMatch(/\[auth\.email\.template\.recovery\]/);
    expect(config).toContain('subject = "Define una nueva contraseña"');
    expect(config).toContain('content_path = "./supabase/templates/recuperacion.html"');
  });

  it('RF-027: registra la plantilla de invitación con su asunto (descomentada)', () => {
    // Con ancla de línea: hoy existen las mismas claves, pero comentadas con "# ".
    expect(config).toMatch(/^\[auth\.email\.template\.invite\]$/m);
    expect(config).toMatch(/^subject = "Te invitaron al panel del blog"$/m);
    expect(config).toMatch(/^content_path = "\.\/supabase\/templates\/invitacion\.html"$/m);
  });
});
