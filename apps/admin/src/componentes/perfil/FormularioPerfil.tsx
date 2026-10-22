'use client';

// Perfil propio (Historia 6, RF-025): nombre, biografía y foto con texto alternativo. No ofrece rol ni estado.
// Reutiliza `ImagenEditable` del editor, que necesita su contexto (anuncios, subidas en curso, imagen ya guardada).
import type { ErrorBloque, Imagen } from '@blog/bloques';
import type { Perfil } from '@blog/db';
import { useMemo, useState } from 'react';
import { guardarPerfil } from '../../acciones/perfil';
import { useHidratado } from '../../lib/hidratado';
import { idDeCampo, mensajeDeCampo } from '../../lib/errores-campo';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { ContextoEditor, type ContextoDelEditor } from '../editor/ContextoEditor';
import { ImagenEditable } from '../editor/ImagenEditable';
import { Button, estadoOcupado } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

type Props = { perfil: Pick<Perfil, 'nombre' | 'biografia' | 'avatar'> };

const ID_AVATAR = idDeCampo({ indice: -1, campo: 'avatar.alt', mensaje: '' });

export function FormularioPerfil({ perfil }: Props) {
  const hidratado = useHidratado();
  const [nombre, setNombre] = useState(perfil.nombre);
  const [biografia, setBiografia] = useState(perfil.biografia ?? '');
  const [avatar, setAvatar] = useState<Imagen | null>(perfil.avatar as Imagen | null);
  const [guardada, setGuardada] = useState<string | null>((perfil.avatar as Imagen | null)?.ruta ?? null);
  const [subidas, setSubidas] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ id: number; tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [errores, setErrores] = useState<ErrorBloque[]>([]);
  const [errorNombre, setErrorNombre] = useState<string>();

  const contexto = useMemo<ContextoDelEditor>(
    () => ({
      anunciar: setAnuncio,
      subiendo: (delta) => setSubidas((n) => n + delta),
      imagenGuardada: (ruta) => ruta === guardada,
    }),
    [guardada],
  );

  const avisar = (tipo: 'exito' | 'error', texto: string) =>
    setAviso((previo) => ({ id: (previo?.id ?? 0) + 1, tipo, texto }));

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando || subidas > 0) return;
    setErrores([]);
    setErrorNombre(undefined);
    setAviso(null);
    setGuardando(true);
    try {
      const resultado = await guardarPerfil({ nombre, biografia, avatar });
      if (resultado.ok) {
        setGuardada((resultado.datos.avatar as Imagen | null)?.ruta ?? null);
        return avisar('exito', 'Perfil guardado');
      }
      if (resultado.errores?.length) {
        setErrores(resultado.errores);
        const texto = resultado.errores.map((error) => error.mensaje).join(' ');
        return avisar('error', texto);
      }
      if (resultado.codigo === 'validacion' && nombre.trim() === '') setErrorNombre('Escribe tu nombre');
      avisar('error', resultado.mensaje);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ContextoEditor.Provider value={contexto}>
      <form onSubmit={guardar} data-perfil={hidratado ? 'listo' : 'cargando'} className="flex max-w-2xl flex-col gap-6">
        {aviso && (
          <AvisoEstado key={aviso.id} tipo={aviso.tipo} enfocar={aviso.tipo === 'error'}>
            {aviso.texto}
          </AvisoEstado>
        )}
        <CampoFormulario etiqueta="Nombre" error={errorNombre}>
          {(a) => <Input {...a} value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />}
        </CampoFormulario>
        <CampoFormulario etiqueta="Biografía" ayuda="Aparece en tu ficha de autor del sitio. Hasta 500 caracteres.">
          {(a) => <Textarea {...a} value={biografia} maxLength={500} onChange={(e) => setBiografia(e.target.value)} />}
        </CampoFormulario>
        <div role="group" aria-labelledby="titulo-foto" className="flex flex-col gap-3">
          <p id="titulo-foto" className="font-semibold">
            Foto de perfil
          </p>
          <ImagenEditable
            imagen={avatar}
            alCambiar={setAvatar}
            idRuta={`${ID_AVATAR}-ruta`}
            idAlt={ID_AVATAR}
            errorAlt={mensajeDeCampo(errores, 'avatar.alt')}
          />
        </div>
        <Button
          type="submit"
          variante="primaria"
          aria-disabled={subidas > 0 || undefined}
          {...estadoOcupado(guardando, 'Guardando…')}
          className="self-start"
        >
          Guardar perfil
        </Button>
        <p role="status" className="sr-only">
          {anuncio}
        </p>
      </form>
    </ContextoEditor.Provider>
  );
}
