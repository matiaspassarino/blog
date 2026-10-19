import type { BloqueDe } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { CLASE_ENLACE } from './enlaces';

// Video sin JS (research D6): el iframe carga un documento propio (srcdoc) con la miniatura
// y un enlace al reproductor con autoplay. El reproductor del proveedor recién se descarga
// cuando el visitante hace clic (RF-004).

const escaparHtml = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const PROVEEDORES = {
  youtube: {
    nombre: 'YouTube',
    reproductor: (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
    original: (id: string) => `https://www.youtube.com/watch?v=${id}`,
    miniatura: (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  },
  vimeo: {
    nombre: 'Vimeo',
    reproductor: (id: string) => `https://player.vimeo.com/video/${id}?autoplay=1`,
    original: (id: string) => `https://vimeo.com/${id}`,
    // Vimeo no expone la miniatura sin su API: fondo liso con el título.
    miniatura: () => null,
  },
} as const;

// El srcdoc es un documento aislado: no hereda los tokens de la página, así que usa los
// colores convencionales de un reproductor (negro y blanco).
function documentoVistaPrevia(titulo: string, reproductor: string, miniatura: string | null) {
  const t = escaparHtml(titulo);
  const fondo = miniatura ? `<img src="${escaparHtml(miniatura)}" alt="">` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}html,body{height:100%;background:#000;font-family:system-ui,sans-serif}
a{position:relative;display:flex;height:100%;align-items:center;justify-content:center;color:#fff;text-decoration:none}
img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
span{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;margin:16px;padding:16px 20px;border-radius:12px;background:rgba(0,0,0,.72);text-align:center}
b{display:flex;width:72px;height:72px;align-items:center;justify-content:center;border-radius:50%;background:rgba(0,0,0,.75);font-size:28px}
a:focus-visible b,a:hover b{background:#000;outline:3px solid #fff}
</style></head><body><a href="${escaparHtml(reproductor)}">${fondo}<span><b aria-hidden="true">▶</b>Reproducir: ${t}</span></a></body></html>`;
}

export function Video({ bloque }: { bloque: BloqueDe<'video'> }) {
  const proveedor = PROVEEDORES[bloque.proveedor];
  const id = encodeURIComponent(bloque.idVideo);
  return (
    <figure className="mt-10">
      <iframe
        title={bloque.titulo}
        loading="lazy"
        srcDoc={documentoVistaPrevia(bloque.titulo, proveedor.reproductor(id), proveedor.miniatura(id))}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-md bg-texto"
      />
      <figcaption className="mt-2 text-sm text-texto-suave">
        {bloque.titulo} ·{' '}
        <a href={proveedor.original(id)} target="_blank" rel="noopener noreferrer" className={CLASE_ENLACE}>
          Ver en {proveedor.nombre}
          <AvisoOtraPestania />
        </a>
      </figcaption>
    </figure>
  );
}
