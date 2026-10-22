'use client';

// Una imagen del contenido (destacada, bloque de imagen o de galería): sin imagen muestra el selector;
// con imagen, la miniatura, el texto alternativo o la marca "decorativa" y quitarla. Después de subir, el
// foco va al texto alternativo. Quitar una imagen ya guardada pide confirmación (D11).
import type { Imagen } from '@blog/bloques';
import { urlImagen } from '@blog/db';
import { useEffect, useRef } from 'react';
import { CampoFormulario } from '../CampoFormulario';
import { ConfirmarAccion } from '../ConfirmarAccion';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { useEditor } from './ContextoEditor';
import { SelectorImagen } from './SelectorImagen';
import { Icono } from '../Icono';

type Props = {
  imagen: Imagen | null;
  alCambiar: (imagen: Imagen | null) => void;
  /** Ids de los controles que enfoca el guardado fallido. */
  idRuta: string;
  idAlt: string;
  errorRuta?: string;
  errorAlt?: string;
  etiquetaSelector?: 'Elegir imagen' | 'Agregar imagen';
};

export function ImagenEditable({
  imagen,
  alCambiar,
  idRuta,
  idAlt,
  errorRuta,
  errorAlt,
  etiquetaSelector = 'Elegir imagen',
}: Props) {
  const { imagenGuardada } = useEditor();
  const alt = useRef<HTMLInputElement>(null);
  const pedirFoco = useRef(false);

  // Tras subir, el foco va al texto alternativo; se aplica cuando el campo ya está en pantalla.
  useEffect(() => {
    if (pedirFoco.current && alt.current) {
      alt.current.focus();
      pedirFoco.current = false;
    }
  });

  if (!imagen || imagen.ruta === '') {
    return (
      <SelectorImagen
        etiqueta={etiquetaSelector}
        idBoton={idRuta}
        error={errorRuta}
        alSubir={({ ruta, ancho, alto }) => {
          pedirFoco.current = true;
          alCambiar({ ruta, ancho, alto, alt: '', decorativa: false });
        }}
      />
    );
  }

  const quitar = () => alCambiar(null);
  const botonQuitar = (
    <Button variante="peligro">
      <Icono nombre="papelera" />
      Quitar imagen
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de Storage, sin optimizar */}
      <img
        src={urlImagen(imagen.ruta, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')}
        width={imagen.ancho}
        height={imagen.alto}
        alt=""
        className="max-h-40 w-auto max-w-full self-start rounded-md bg-superficie"
      />
      <CampoFormulario etiqueta="Texto alternativo" id={idAlt} error={errorAlt}>
        {(atributos) => (
          <Input
            {...atributos}
            ref={alt}
            value={imagen.alt ?? ''}
            disabled={imagen.decorativa}
            onChange={(e) => alCambiar({ ...imagen, alt: e.target.value })}
          />
        )}
      </CampoFormulario>
      <label className="flex min-h-(--tactil-min) items-center gap-2">
        <Checkbox
          checked={imagen.decorativa}
          onChange={(e) =>
            alCambiar(
              e.target.checked
                ? { ruta: imagen.ruta, ancho: imagen.ancho, alto: imagen.alto, decorativa: true }
                : { ...imagen, decorativa: false, alt: '' },
            )
          }
        />
        Imagen decorativa
      </label>
      {imagenGuardada(imagen.ruta) ? (
        <ConfirmarAccion
          titulo="¿Quitar esta imagen?"
          descripcion="La imagen ya está guardada. Si la quitas y guardas, se borra del almacenamiento salvo que otro contenido la use."
          etiquetaConfirmar="Quitar imagen"
          variante="peligro"
          onConfirmar={quitar}
        >
          {botonQuitar}
        </ConfirmarAccion>
      ) : (
        <Button variante="peligro" className="self-start" onClick={quitar}>
          <Icono nombre="papelera" />
          Quitar imagen
        </Button>
      )}
    </div>
  );
}
