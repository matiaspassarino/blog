'use client';

// Edición de una categoría o etiqueta en un diálogo nativo (`<dialog>`): atrapa el foco, cierra con Esc y tiene
// rol y nombre accesibles sin sumar dependencias. Si cambia el slug de una taxonomía con artículos publicados,
// avisa antes de guardar que la dirección pública cambia y la anterior seguirá redirigiendo (RF-019).
import type { TaxonomiaConConteo } from '@blog/db';
import { useEffect, useId, useRef, useState } from 'react';
import { actualizarTaxonomiaAccion } from '../../acciones/taxonomias';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import type { Tipo } from './textos';

type Props = { tipo: Tipo; taxonomia: TaxonomiaConConteo; alCerrar: () => void };

export function DialogoEdicion({ tipo, taxonomia, alCerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [nombre, setNombre] = useState(taxonomia.nombre);
  const [slug, setSlug] = useState(taxonomia.slug);
  const [descripcion, setDescripcion] = useState(taxonomia.descripcion ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const cambiaLaDireccion = slug.trim() !== taxonomia.slug && taxonomia.publicados > 0;

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando) return;
    setError(null);
    setGuardando(true);
    try {
      const resultado = await actualizarTaxonomiaAccion({
        tipo,
        id: taxonomia.id,
        cambios: {
          nombre,
          slug: slug.trim() || undefined,
          descripcion: descripcion.trim() === '' ? null : descripcion,
        },
      });
      if (resultado.ok) alCerrar();
      else setError(resultado.mensaje);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-borde bg-fondo p-6 text-texto backdrop:bg-overlay"
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <h2 id={idTitulo} className="font-titulos text-xl font-semibold">
          Editar {taxonomia.nombre}
        </h2>
        {error && (
          <AvisoEstado tipo="error" cerrable={false}>
            {error}
          </AvisoEstado>
        )}
        <CampoFormulario etiqueta="Nombre">
          {(a) => <Input {...a} value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />}
        </CampoFormulario>
        <CampoFormulario etiqueta="Slug">
          {(a) => <Input {...a} value={slug} onChange={(e) => setSlug(e.target.value)} />}
        </CampoFormulario>
        {cambiaLaDireccion && (
          <p
            role="status"
            className="rounded-md border border-advertencia-borde bg-advertencia-suave p-3 text-advertencia"
          >
            La dirección pública cambia: la anterior seguirá redirigiendo a la nueva.
          </p>
        )}
        <CampoFormulario etiqueta="Descripción">
          {(a) => (
            <Textarea {...a} value={descripcion} maxLength={300} onChange={(e) => setDescripcion(e.target.value)} />
          )}
        </CampoFormulario>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variante="secundaria" onClick={() => dialogo.current?.close()}>
            Cancelar
          </Button>
          <Button type="submit" variante="primaria" aria-disabled={guardando || undefined}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </dialog>
  );
}
