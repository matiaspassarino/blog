import type { ReactNode, Ref } from 'react';

type Props = {
  titulo: string;
  descripcion?: string;
  /** Acciones de pantalla (navegar o crear): a la derecha del título desde 768 px y debajo en anchos menores. */
  acciones?: ReactNode;
  refTitulo?: Ref<HTMLHeadingElement>;
  /** El `h1` recibe el foco por código (por ejemplo, tras reemplazar con la versión vigente). */
  tituloEnfocable?: boolean;
};

/** Encabezado de pantalla: título, descripción breve opcional y la acción de pantalla en un lugar fijo (RF-011). */
export function EncabezadoPagina({ titulo, descripcion, acciones, refTitulo, tituloEnfocable = false }: Props) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1
          ref={refTitulo}
          tabIndex={tituloEnfocable ? -1 : undefined}
          className="font-titulos text-titulo-2 font-semibold"
        >
          {titulo}
        </h1>
        {descripcion && <p className="text-sm text-texto-suave">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-stretch gap-3">{acciones}</div>}
    </header>
  );
}
