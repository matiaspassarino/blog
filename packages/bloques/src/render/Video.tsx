import type { ElementoDe } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { CLASE_ENLACE } from './enlaces';
import { PROVEEDORES } from './proveedores-video';

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

export function Video({ elemento }: { elemento: ElementoDe<'video'> }) {
  const campos = elemento.attrs;
  const proveedor = PROVEEDORES[campos.proveedor];
  const id = encodeURIComponent(campos.idVideo);
  return (
    <figure className="mt-10">
      <iframe
        title={campos.titulo}
        loading="lazy"
        srcDoc={documentoVistaPrevia(campos.titulo, proveedor.reproductor(id), proveedor.miniatura(id))}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-md bg-texto"
      />
      <figcaption className="mt-2 text-sm text-texto-suave">
        {campos.titulo} ·{' '}
        <a href={proveedor.original(id)} target="_blank" rel="noopener noreferrer" className={CLASE_ENLACE}>
          Ver en {proveedor.nombre}
          <AvisoOtraPestania />
        </a>
      </figcaption>
    </figure>
  );
}
