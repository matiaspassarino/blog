'use client';

// Alta de una categoría o etiqueta. El slug se sugiere desde el nombre (300 ms de retardo) mientras la persona no
// lo escriba; después de crear, el formulario queda vacío y el foco vuelve al nombre.
import { useEffect, useRef, useState } from 'react';
import { previsualizarSlugAccion } from '../../acciones/articulos';
import { crearTaxonomiaAccion } from '../../acciones/taxonomias';
import { CampoFormulario } from '../CampoFormulario';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { TEXTOS, type Tipo } from './textos';

type Props = { tipo: Tipo; alError: (mensaje: string | null) => void };

export function FormularioAlta({ tipo, alError }: Props) {
  const textos = TEXTOS[tipo];
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campoNombre = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (slugManual || nombre.trim() === '') return;
    const espera = setTimeout(async () => {
      const resultado = await previsualizarSlugAccion({ texto: nombre, tipo });
      if (resultado.ok) setSlug(resultado.datos);
    }, 300);
    return () => clearTimeout(espera);
  }, [nombre, slugManual, tipo]);

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    alError(null);
    setEnviando(true);
    try {
      const resultado = await crearTaxonomiaAccion({
        tipo,
        nombre,
        slug: slugManual && slug ? slug : undefined,
        descripcion: descripcion.trim() === '' ? null : descripcion,
      });
      if (!resultado.ok) return alError(resultado.mensaje);
      setNombre('');
      setSlug('');
      setSlugManual(false);
      setDescripcion('');
      campoNombre.current?.focus();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      aria-label={textos.formulario}
      onSubmit={crear}
      className="flex flex-col gap-4 rounded-md border border-borde p-4"
    >
      <h2 className="font-titulos text-xl font-semibold">{textos.formulario}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <CampoFormulario etiqueta="Nombre">
          {(a) => (
            <Input {...a} ref={campoNombre} value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
          )}
        </CampoFormulario>
        <CampoFormulario etiqueta="Slug" ayuda="La dirección en el sitio. Se sugiere desde el nombre.">
          {(a) => (
            <Input
              {...a}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManual(e.target.value !== '');
              }}
            />
          )}
        </CampoFormulario>
      </div>
      <CampoFormulario etiqueta="Descripción">
        {(a) => (
          <Textarea {...a} value={descripcion} maxLength={300} onChange={(e) => setDescripcion(e.target.value)} />
        )}
      </CampoFormulario>
      <Button type="submit" variante="primaria" aria-disabled={enviando || undefined} className="self-start">
        {textos.crear}
      </Button>
    </form>
  );
}
