'use client';

// Cambio de estado y eliminación de un artículo desde la barra del editor (spec 004, D8). El estado se cambia
// sobre lo guardado: con cambios sin guardar pide guardar antes.
import type { Articulo } from '@blog/db';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cambiarEstadoAccion, eliminarArticuloAccion } from '../../acciones/articulos';
import { mensajeDeError } from '../../lib/mensajes';
import { urlDeSalida } from '../../lib/salir';
import { useContextoEditor } from '../editor/ContextoEditor';
import { ANUNCIOS, destinoDe, type AccionEstado } from './acciones-disponibles';

/** `mensaje` vacío: ya se redirigió al ingreso y no hay nada que mostrar. */
export type ResultadoCambio = { ok: true } | { ok: false; mensaje: string };

type Opciones = {
  id: string;
  version: number;
  hayCambiosSinGuardar: boolean;
  /** El estado cambió: el editor adopta el artículo devuelto (versión y fechas nuevas). */
  alCambiarEstado: (articulo: Articulo) => void;
};

export function useCambioDeEstado({ id, version, hayCambiosSinGuardar, alCambiarEstado }: Opciones) {
  const router = useRouter();
  const { anunciar } = useContextoEditor();
  const [ocupado, setOcupado] = useState(false);

  async function cambiar(accion: Exclude<AccionEstado, 'eliminar'>, programadoPara?: string): Promise<ResultadoCambio> {
    if (hayCambiosSinGuardar) return { ok: false, mensaje: 'Guarda los cambios antes de cambiar el estado.' };
    setOcupado(true);
    try {
      const resultado = await cambiarEstadoAccion({ id, version, destino: destinoDe(accion), programadoPara });
      if (resultado.ok) {
        alCambiarEstado(resultado.datos);
        anunciar(ANUNCIOS[resultado.datos.estado]);
        return { ok: true };
      }
      if (resultado.codigo === 'no_autenticado') {
        router.push(urlDeSalida(resultado.motivo));
        return { ok: false, mensaje: '' };
      }
      return { ok: false, mensaje: resultado.mensaje };
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(): Promise<ResultadoCambio> {
    const resultado = await eliminarArticuloAccion({ id });
    if (resultado.ok) {
      router.push('/articulos');
      return { ok: true };
    }
    if (resultado.codigo === 'no_autenticado') {
      router.push(urlDeSalida(resultado.motivo));
      return { ok: false, mensaje: '' };
    }
    return { ok: false, mensaje: resultado.mensaje || mensajeDeError('desconocido') };
  }

  return { ocupado, cambiar, eliminar };
}
