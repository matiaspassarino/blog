'use client';

// Barra fija del editor (spec 004, RF-005): "Guardar" y las acciones de estado juntas, en posiciones fijas; solo
// cambia el nivel. La principal sale de `accionPrincipalEditor`. "Programar" y "Eliminar" abren diálogos
// controlados que viven fuera de los grupos de botones.
import type { Articulo, EstadoArticulo, RolMiembro } from '@blog/db';
import { useRef, useState } from 'react';
import { AvisoEstado } from '../AvisoEstado';
import { BarraAcciones } from '../estructura/BarraAcciones';
import { ConfirmarAccion } from '../ConfirmarAccion';
import { Icono } from '../Icono';
import { EnlaceConAviso } from '../salida/EnlaceConAviso';
import { Button } from '../ui/button';
import {
  accionPrincipalEditor,
  distribuirBarraEditor,
  ETIQUETAS,
  guardarHabilitado,
  type AccionBarra,
} from './acciones-disponibles';
import { useCambioDeEstado } from './cambio-de-estado';
import { DialogoProgramar } from './DialogoProgramar';

type Props = {
  /** Sin `id` el artículo es nuevo: la barra solo ofrece "Guardar". */
  id: string | undefined;
  version: number;
  estado: EstadoArticulo;
  rol: RolMiembro;
  hayCambiosSinGuardar: boolean;
  guardando: boolean;
  /** Guardar no está disponible por otra razón (subida de imagen, carga de la versión vigente). */
  bloqueado: boolean;
  subiendoImagen: boolean;
  guardadoOk: boolean;
  slugAjustado: string | null;
  alGuardar: () => void;
  alCambiarEstado: (articulo: Articulo) => void;
};

export function BarraEditor({
  id,
  version,
  estado,
  rol,
  hayCambiosSinGuardar,
  guardando,
  bloqueado,
  subiendoImagen,
  guardadoOk,
  slugAjustado,
  alGuardar,
  alCambiarEstado,
}: Props) {
  const grupo = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [programando, setProgramando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const guardado = id !== undefined;
  const cambio = useCambioDeEstado({
    id: id ?? '',
    version,
    hayCambiosSinGuardar,
    alCambiarEstado,
  });

  const { enBarra, enMenu } = distribuirBarraEditor({ estado, rol, guardado, hayCambiosSinGuardar });
  const principal = accionPrincipalEditor({ estado, guardado, hayCambiosSinGuardar });
  const habilitado = guardarHabilitado({ guardado, hayCambiosSinGuardar, ocupado: guardando || bloqueado });
  const idMotivo = 'motivo-guardar';
  const motivo = subiendoImagen
    ? 'Subiendo imagen…'
    : guardado && !hayCambiosSinGuardar && !guardadoOk
      ? 'Sin cambios'
      : null;

  const propsOcupado = guardando
    ? ({ ocupado: true, textoOcupado: 'Guardando…' } as const)
    : ({ ocupado: false } as const);

  /** Lleva el foco a un botón de la barra una vez que el estado nuevo se pintó (research D11). */
  function enfocar(selector: string) {
    setTimeout(() => grupo.current?.querySelector<HTMLElement>(selector)?.focus(), 0);
  }
  const enfocarPrincipal = () => enfocar('[data-nivel="primaria"]');

  async function cambiarEstado(accion: Exclude<AccionBarra, 'guardar' | 'vista_previa' | 'eliminar'>) {
    setError(null);
    const resultado = await cambio.cambiar(accion);
    if (resultado.ok) enfocarPrincipal();
    else if (resultado.mensaje) setError(resultado.mensaje);
  }

  function abrirProgramar() {
    setError(null);
    if (hayCambiosSinGuardar) return setError('Guarda los cambios antes de cambiar el estado.');
    setProgramando(true);
  }

  function nivelDe(accion: 'guardar' | 'publicar') {
    return principal === accion ? 'primaria' : 'secundaria';
  }

  function boton(accion: AccionBarra) {
    switch (accion) {
      case 'guardar':
        return (
          <Button
            key={accion}
            data-accion="guardar"
            variante={nivelDe('guardar')}
            aria-disabled={!habilitado || undefined}
            aria-describedby={motivo ? idMotivo : undefined}
            {...propsOcupado}
            onClick={alGuardar}
          >
            Guardar
          </Button>
        );
      case 'vista_previa':
        return (
          <Button key={accion} asChild variante="terciaria">
            <EnlaceConAviso href={`/articulos/${id}/vista-previa`}>Vista previa</EnlaceConAviso>
          </Button>
        );
      case 'eliminar':
        return null;
      case 'programar':
        return (
          <Button key={accion} data-accion={accion} variante="secundaria" onClick={abrirProgramar}>
            {ETIQUETAS[accion]}
          </Button>
        );
      default:
        return (
          <Button
            key={accion}
            data-accion={accion}
            variante={accion === 'publicar' ? nivelDe('publicar') : 'secundaria'}
            aria-disabled={cambio.ocupado || undefined}
            onClick={() => void cambiarEstado(accion)}
          >
            {ETIQUETAS[accion]}
          </Button>
        );
    }
  }

  const puedeEliminar = enMenu.includes('eliminar');

  return (
    <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-separador bg-fondo px-4 py-3 md:-mx-8 md:px-8">
      {error && (
        <AvisoEstado tipo="error" cerrable={false}>
          {error}
        </AvisoEstado>
      )}
      <div className="flex flex-wrap items-center gap-x-4">
        <p aria-live="polite" className="font-semibold text-advertencia">
          {hayCambiosSinGuardar ? 'Cambios sin guardar' : ''}
        </p>
        <p role="status" className="font-semibold text-exito">
          {guardadoOk && !hayCambiosSinGuardar
            ? slugAjustado
              ? `Guardado. La dirección quedó como ${slugAjustado}`
              : 'Guardado'
            : ''}
        </p>
        {motivo && (
          <p id={idMotivo} className="text-texto-suave">
            {motivo}
          </p>
        )}
      </div>
      <div ref={grupo}>
        <BarraAcciones
          etiqueta="Acciones del artículo"
          destructivas={
            puedeEliminar ? (
              <Button data-accion="eliminar" variante="peligro" onClick={() => setEliminando(true)}>
                <Icono nombre="papelera" />
                {ETIQUETAS.eliminar}
              </Button>
            ) : undefined
          }
        >
          {[...enBarra, ...enMenu].map(boton)}
        </BarraAcciones>
      </div>

      {guardado && (
        <>
          <DialogoProgramar
            abierto={programando}
            alCambiarAbierto={setProgramando}
            onProgramar={async (iso) => {
              const resultado = await cambio.cambiar('programar', iso);
              return resultado.ok ? resultado : { ok: false, mensaje: resultado.mensaje || 'No se pudo programar.' };
            }}
            alCerrar={(motivoCierre) =>
              enfocar(motivoCierre === 'confirmado' ? '[data-nivel="primaria"]' : '[data-accion="programar"]')
            }
          />
          <ConfirmarAccion
            titulo="¿Eliminar este artículo?"
            descripcion="Se elimina para siempre del panel y del sitio. No se puede deshacer."
            etiquetaConfirmar="Eliminar"
            variante="peligro"
            abierto={eliminando}
            alCambiarAbierto={setEliminando}
            alCerrar={(motivoCierre) => motivoCierre === 'cancelado' && enfocar('[data-accion="eliminar"]')}
            onConfirmar={async () => {
              const resultado = await cambio.eliminar();
              if (resultado.ok) return;
              if (resultado.mensaje) setError(resultado.mensaje);
            }}
          />
        </>
      )}
    </div>
  );
}
