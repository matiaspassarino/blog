'use client';

// Sube una imagen en dos pasos (research D9): el navegador la manda directo a Storage con una URL firmada y
// el servidor comprueba después el tipo real y las dimensiones. Estados accesibles: progreso anunciado en
// la región role="status" del editor, error en role="alert" y foco de vuelta al botón.
import { crearClienteNavegador } from '@blog/db/navegador';
import { useId, useRef, useState } from 'react';
import { firmarSubidaMedio, registrarMedio } from '../../acciones/medios';
import { Button } from '../ui/button';
import { useEditor } from './ContextoEditor';

const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const LIMITE_BYTES = 5_242_880;
const MENSAJE_FORMATO = 'Solo se aceptan imágenes JPEG, PNG, WebP o AVIF de hasta 5 MB.';

type ImagenSubida = { ruta: string; ancho: number; alto: number };

type Props = {
  etiqueta: 'Elegir imagen' | 'Agregar imagen';
  alSubir: (imagen: ImagenSubida) => void;
  /** Id del botón: es el que enfoca el guardado cuando falta la imagen. */
  idBoton?: string;
  /** Mensaje de validación del formulario (por ejemplo "La imagen necesita una ruta"). */
  error?: string;
};

export function SelectorImagen({ etiqueta, alSubir, idBoton, error }: Props) {
  const { anunciar, subiendo } = useEditor();
  const entrada = useRef<HTMLInputElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idError = useId();
  const [fallo, setFallo] = useState<string | null>(null);

  function rechazar(mensaje: string) {
    setFallo(mensaje);
    anunciar('No se pudo subir la imagen');
    boton.current?.focus();
  }

  async function subir(archivo: File) {
    setFallo(null);
    if (!TIPOS_ACEPTADOS.includes(archivo.type)) return rechazar(MENSAJE_FORMATO);
    if (archivo.size > LIMITE_BYTES) return rechazar('La imagen supera los 5 MB. Elige una más liviana.');

    subiendo(1);
    anunciar('Subiendo imagen…');
    try {
      const firma = await firmarSubidaMedio({ nombre: archivo.name, bytes: archivo.size });
      if (!firma.ok) return rechazar(firma.mensaje);

      const cliente = crearClienteNavegador(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      );
      const { error: errorSubida } = await cliente.storage
        .from('medios')
        .uploadToSignedUrl(firma.datos.ruta, firma.datos.token, archivo, { contentType: archivo.type });
      if (errorSubida) return rechazar('No se pudo subir la imagen. Prueba de nuevo.');

      const registro = await registrarMedio({ ruta: firma.datos.ruta });
      if (!registro.ok) return rechazar(registro.mensaje);

      anunciar('Imagen subida');
      alSubir(registro.datos);
    } catch {
      rechazar('No se pudo subir la imagen. Prueba de nuevo.');
    } finally {
      subiendo(-1);
    }
  }

  const mensaje = fallo ?? error;
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_ACEPTADOS.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          evento.target.value = ''; // permite elegir el mismo archivo otra vez
          if (archivo) void subir(archivo);
        }}
      />
      <Button
        ref={boton}
        id={idBoton}
        variante="secundaria"
        className="self-start"
        aria-describedby={mensaje ? idError : undefined}
        aria-invalid={error && !fallo ? true : undefined}
        onClick={() => entrada.current?.click()}
      >
        {etiqueta}
      </Button>
      {mensaje && (
        <p id={idError} role={fallo ? 'alert' : undefined} className="text-sm font-semibold text-error">
          {mensaje}
        </p>
      )}
    </div>
  );
}
