'use client';

// Estado del artículo y sus acciones (Historia 3, RF-012 a RF-015): muestra el estado y la fecha de
// publicación o programada, y ofrece solo las transiciones que permite la base. El estado se cambia sobre
// lo guardado: con cambios sin guardar pide guardar antes. Solo "Eliminar" pide confirmación (RF-024).
import { urlDeSalida } from '../../lib/salir';
import type { Articulo, EstadoArticulo, RolMiembro } from '@blog/db';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { cambiarEstadoAccion, eliminarArticuloAccion } from '../../acciones/articulos';
import { aIsoUtc } from '../../lib/fechas';
import { mensajeDeError } from '../../lib/mensajes';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { ConfirmarAccion } from '../ConfirmarAccion';
import { useEditor } from '../editor/ContextoEditor';
import { FechaLocal } from '../FechaLocal';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { accionesDisponibles, destinoDe, type AccionEstado } from './acciones-disponibles';

type Props = {
  id: string;
  slug: string;
  version: number;
  estado: EstadoArticulo;
  programadoPara: string | null;
  publicadoEn: string | null;
  rol: RolMiembro;
  hayCambiosSinGuardar: boolean;
  /** El estado cambió: el editor adopta el artículo devuelto (versión y fechas nuevas). */
  alCambiarEstado: (articulo: Articulo) => void;
};

const ETIQUETAS: Record<AccionEstado, string> = {
  publicar: 'Publicar',
  programar: 'Programar',
  cancelar_programacion: 'Cancelar programación',
  volver_a_borrador: 'Volver a borrador',
  archivar: 'Archivar',
  eliminar: 'Eliminar',
};

const ANUNCIOS: Record<EstadoArticulo, string> = {
  borrador: 'El artículo volvió a borrador',
  programado: 'El artículo quedó programado',
  publicado: 'El artículo se publicó',
  archivado: 'El artículo se archivó',
};

/** Valor para `min` de un datetime-local: ahora, en hora local y sin segundos. */
function ahoraLocal() {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  return ahora.toISOString().slice(0, 16);
}

export function AccionesEstado({
  id,
  slug,
  version,
  estado,
  programadoPara,
  publicadoEn,
  rol,
  hayCambiosSinGuardar,
  alCambiarEstado,
}: Props) {
  const router = useRouter();
  const { anunciar } = useEditor();
  const idTitulo = useId();
  // Campo sin controlar: se lee al pulsar "Programar". Un datetime-local controlado no se entera de un valor
  // asignado desde fuera de React (autocompletado del navegador, herramientas de prueba).
  const campoFecha = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { acciones, requiereGuardarAntes } = accionesDisponibles({ estado, rol, hayCambiosSinGuardar });
  const fechaDelEstado = estado === 'programado' ? programadoPara : estado === 'publicado' ? publicadoEn : null;
  const urlSitio = `${process.env.NEXT_PUBLIC_URL_SITIO ?? ''}/blog/${slug}`;

  async function ejecutar(accion: Exclude<AccionEstado, 'eliminar'>) {
    setError(null);
    if (requiereGuardarAntes) return setError('Guarda los cambios antes de cambiar el estado.');

    let programadoIso: string | undefined;
    if (accion === 'programar') {
      programadoIso = aIsoUtc(campoFecha.current?.value ?? '') ?? undefined;
      if (!programadoIso) return setError('Elige la fecha y hora de publicación.');
    }

    setOcupado(true);
    try {
      const resultado = await cambiarEstadoAccion({
        id,
        version,
        destino: destinoDe(accion),
        programadoPara: programadoIso,
      });
      if (resultado.ok) {
        alCambiarEstado(resultado.datos);
        anunciar(ANUNCIOS[resultado.datos.estado]);
      } else if (resultado.codigo === 'no_autenticado') {
        router.push(urlDeSalida(resultado.motivo));
      } else {
        setError(resultado.mensaje);
      }
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar() {
    setError(null);
    const resultado = await eliminarArticuloAccion({ id });
    if (resultado.ok) router.push('/articulos');
    else setError(resultado.mensaje || mensajeDeError('desconocido'));
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-borde p-4" aria-labelledby={idTitulo}>
      <legend id={idTitulo} className="px-1 font-semibold">
        Publicación
      </legend>
      <p>
        Estado: <Badge estado={estado}>{estado}</Badge>
      </p>
      {fechaDelEstado && (
        <p className="text-texto-suave">
          {estado === 'programado' ? 'Se publica el ' : 'Publicado el '}
          <FechaLocal iso={fechaDelEstado} />
        </p>
      )}
      {estado === 'publicado' && (
        <a href={urlSitio} className="flex min-h-(--tactil-min) items-center underline">
          Ver en el sitio
        </a>
      )}

      {error && (
        <AvisoEstado tipo="error" cerrable={false}>
          {error}
        </AvisoEstado>
      )}

      {estado === 'borrador' && (
        <CampoFormulario etiqueta="Fecha y hora de publicación">
          {(atributos) => <Input {...atributos} ref={campoFecha} type="datetime-local" min={ahoraLocal()} />}
        </CampoFormulario>
      )}

      <div className="flex flex-wrap gap-3">
        {acciones.map((accion) =>
          accion === 'eliminar' ? (
            <ConfirmarAccion
              key={accion}
              titulo="¿Eliminar este artículo?"
              descripcion="Se elimina para siempre del panel y del sitio. No se puede deshacer."
              etiquetaConfirmar="Eliminar"
              onConfirmar={eliminar}
            >
              <Button variante="peligro">Eliminar</Button>
            </ConfirmarAccion>
          ) : (
            <Button
              key={accion}
              variante={accion === 'publicar' ? 'primaria' : 'secundaria'}
              aria-disabled={ocupado || undefined}
              onClick={() => (ocupado ? undefined : void ejecutar(accion))}
            >
              {ETIQUETAS[accion]}
            </Button>
          ),
        )}
      </div>
    </fieldset>
  );
}
