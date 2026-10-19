// T046: video sin JS con iframe srcdoc (spec 002, RF-004, H1-E4, research D6;
// contracts/bloques-render.md, fila "video").
import { describe, expect, it } from 'vitest';
import { contenidoDe, desescapar, renderizar } from './ayudas-prueba';

const ID_YOUTUBE = 'dQw4w9WgXcQ';
const ID_VIMEO = '76979871';

function renderizarVideo(proveedor: 'youtube' | 'vimeo', idVideo: string, titulo = 'Video de presentación') {
  const html = renderizar(contenidoDe({ tipo: 'video', proveedor, idVideo, titulo }));
  const iframe = html.match(/<iframe\s[^>]*>/)?.[0] ?? '';
  const srcdoc = desescapar(iframe.match(/\ssrcdoc="([^"]*)"/i)?.[1] ?? '');
  // Lo que queda fuera del iframe (el enlace "Ver en …").
  const fuera = html.replace(/<iframe[\s\S]*?<\/iframe>/, '');
  return { html, iframe, srcdoc, fuera };
}

describe('bloque video de YouTube', () => {
  it('H1-E4: produce un <figure> con un <iframe> con título accesible y carga diferida', () => {
    const { html, iframe } = renderizarVideo('youtube', ID_YOUTUBE, 'Cómo armar una grilla');

    expect(html).toMatch(/<figure[\s>]/);
    expect(iframe).not.toBe('');
    expect(iframe).toMatch(/\stitle="Cómo armar una grilla"/);
    expect(iframe).toMatch(/\sloading="lazy"/);
  });

  it('RF-004: no tiene src hacia el proveedor: el reproductor no se descarga al cargar la página', () => {
    const { iframe } = renderizarVideo('youtube', ID_YOUTUBE);

    expect(iframe).not.toMatch(/\ssrc="/);
    expect(iframe).toMatch(/\ssrcdoc="/i);
  });

  it('research D6: el srcdoc muestra la miniatura de i.ytimg.com', () => {
    const { srcdoc } = renderizarVideo('youtube', ID_YOUTUBE);

    expect(srcdoc).toContain(`i.ytimg.com/vi/${ID_YOUTUBE}/hqdefault.jpg`);
  });

  it('research D6: el srcdoc enlaza al embed de youtube-nocookie.com con autoplay', () => {
    const { srcdoc } = renderizarVideo('youtube', ID_YOUTUBE);

    expect(srcdoc).toMatch(
      new RegExp(`<a\\s[^>]*href="https://(www\\.)?youtube-nocookie\\.com/embed/${ID_YOUTUBE}\\?autoplay=1"`),
    );
    expect(srcdoc).not.toMatch(/youtube\.com\/embed/);
  });

  it('caso borde (proveedor caído): debajo del iframe hay un enlace "Ver en YouTube"', () => {
    const { fuera } = renderizarVideo('youtube', ID_YOUTUBE);

    const enlace = fuera.match(/<a\s[^>]*>(?:(?!<\/a>).)*Ver en YouTube(?:(?!<\/a>).)*<\/a>/s)?.[0];
    expect(enlace).toBeDefined();
    expect(enlace).toMatch(new RegExp(`href="https://[^"]*youtu[^"]*${ID_YOUTUBE}[^"]*"`));
  });

  it('RF-003: el título del video se escapa, también dentro del srcdoc', () => {
    const { html, srcdoc } = renderizarVideo('youtube', ID_YOUTUBE, '<script>alert(1)</script>');

    expect(html).not.toContain('<script');
    expect(srcdoc).not.toContain('<script');
  });
});

describe('bloque video de Vimeo', () => {
  it('H1-E4: produce un <iframe> con título, carga diferida y sin src', () => {
    const { iframe } = renderizarVideo('vimeo', ID_VIMEO, 'Recorrido por el estudio');

    expect(iframe).toMatch(/\stitle="Recorrido por el estudio"/);
    expect(iframe).toMatch(/\sloading="lazy"/);
    expect(iframe).not.toMatch(/\ssrc="/);
  });

  it('research D6: el srcdoc enlaza a player.vimeo.com/video/<id>', () => {
    const { srcdoc } = renderizarVideo('vimeo', ID_VIMEO);

    expect(srcdoc).toMatch(new RegExp(`<a\\s[^>]*href="https://player\\.vimeo\\.com/video/${ID_VIMEO}[^"]*"`));
  });

  it('caso borde (proveedor caído): debajo del iframe hay un enlace "Ver en Vimeo"', () => {
    const { fuera } = renderizarVideo('vimeo', ID_VIMEO);

    const enlace = fuera.match(/<a\s[^>]*>(?:(?!<\/a>).)*Ver en Vimeo(?:(?!<\/a>).)*<\/a>/s)?.[0];
    expect(enlace).toBeDefined();
    expect(enlace).toMatch(new RegExp(`href="https://[^"]*vimeo\\.com/[^"]*${ID_VIMEO}[^"]*"`));
  });
});
