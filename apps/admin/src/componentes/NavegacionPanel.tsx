'use client';

// Navegación del panel: barra lateral desde 1024 px y menú desplegable en pantallas angostas.
// Primer elemento enfocable: "Saltar al contenido" (landmarks: header, nav "Principal" y main).
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icono } from './Icono';
import { EnlaceConAviso } from './salida/EnlaceConAviso';
import { Button } from './ui/button';

const ENLACES = [
  { href: '/articulos', texto: 'Artículos' },
  { href: '/categorias', texto: 'Categorías' },
  { href: '/etiquetas', texto: 'Etiquetas' },
] as const;
const ENLACE_EQUIPO = { href: '/equipo', texto: 'Equipo' } as const;
const ENLACE_PERFIL = { href: '/perfil', texto: 'Mi perfil' } as const;

type Props = {
  nombre: string;
  rol: 'admin' | 'editor';
  puedeVerEquipo: boolean;
  /** Botón de cerrar sesión (un formulario con la acción `cerrarSesion`). */
  cerrarSesion?: ReactNode;
};

const ETIQUETA_ROL = { admin: 'Administrador', editor: 'Editor' } as const;

export function NavegacionPanel({ nombre, rol, puedeVerEquipo, cerrarSesion }: Props) {
  const ruta = usePathname();
  // El menú está abierto "en una ruta": al navegar se cierra solo, sin efectos que reasignen el estado.
  const [rutaAbierta, setRutaAbierta] = useState<string | null>(null);
  const abierto = rutaAbierta === ruta;
  const idMenu = useId();
  const botonMenu = useRef<HTMLButtonElement>(null);

  // Esc lo cierra y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      setRutaAbierta(null);
      botonMenu.current?.focus();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  const enlaces = [...ENLACES, ...(puedeVerEquipo ? [ENLACE_EQUIPO] : []), ENLACE_PERFIL];

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-fondo focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-separador bg-superficie lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 p-4">
          <p className="font-titulos text-lg font-semibold">Panel del blog</p>
          <Button
            ref={botonMenu}
            variante="secundaria"
            className="min-w-(--tactil-min) px-3 lg:hidden"
            aria-expanded={abierto}
            aria-controls={idMenu}
            onClick={() => setRutaAbierta(abierto ? null : ruta)}
          >
            <Icono nombre={abierto ? 'cerrar' : 'menu'} />
            <span>{abierto ? 'Cerrar menú' : 'Menú'}</span>
          </Button>
        </div>
        <div id={idMenu} className={abierto ? 'block' : 'hidden lg:block'}>
          <nav aria-label="Principal" className="px-2 pb-2">
            <ul className="flex flex-col gap-1">
              {enlaces.map(({ href, texto }) => {
                const actual = ruta === href || ruta.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <EnlaceConAviso
                      href={href}
                      aria-current={actual ? 'page' : undefined}
                      className="flex min-h-(--tactil-min) items-center rounded-md px-3 hover:bg-marca-suave aria-[current=page]:bg-marca-suave aria-[current=page]:font-semibold aria-[current=page]:text-marca"
                    >
                      {texto}
                    </EnlaceConAviso>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-t border-separador p-4">
            <p className="font-semibold">{nombre}</p>
            <p className="text-sm text-texto-suave">{ETIQUETA_ROL[rol]}</p>
            {cerrarSesion}
          </div>
        </div>
      </header>
    </>
  );
}
