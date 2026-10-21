'use client';

// Editor de un artículo (Historia 2): título, slug, extracto, imagen destacada, categoría, etiquetas, SEO y
// bloques. El estado vive en un reductor puro (reductor.ts). Valida en el navegador con el mismo esquema que
// el servidor, enfoca el primer campo inválido, detecta ediciones concurrentes sin perder lo escrito (D13) y
// avisa antes de salir con cambios sin guardar (RF-010).
import type { ErrorBloque } from '@blog/bloques';
import { rutasDeImagenes } from '@blog/bloques';
import type { Articulo, EstadoArticulo, ReferenciaTaxonomia, RolMiembro } from '@blog/db';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  crearArticuloAccion,
  guardarArticulo,
  leerArticuloVigente,
  previsualizarSlugAccion,
} from '../../acciones/articulos';
import { agruparPorBloque, idDeCampo, mensajeDeCampo } from '../../lib/errores-campo';
import { AccionesEstado } from '../articulo/AccionesEstado';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { EnlaceConAviso } from '../salida/EnlaceConAviso';
import { useSalida } from '../salida/ProveedorSalida';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { resumenDeErrores } from './anuncios';
import { AvisoConflicto } from './AvisoConflicto';
import { ComparacionVersiones } from './ComparacionVersiones';
import { urlDeSalida } from '../../lib/salir';
import type { MotivoSesion } from '../../lib/sesion';
import { useHidratado } from '../../lib/hidratado';
import { ContextoEditor } from './ContextoEditor';
import { aDatosArticulo, validarEditor } from './datos';
import { ImagenEditable } from './ImagenEditable';
import { ListaBloques } from './ListaBloques';
import { estaSucio, estadoInicial, reductor, type DatosArticulo } from './reductor';

/** Lo que el panel de publicación muestra del artículo, además de lo que edita el formulario. */
export type Publicacion = {
  estado: EstadoArticulo;
  programado_para: string | null;
  publicado_en: string | null;
};

const publicacionDe = (articulo: Articulo): Publicacion => ({
  estado: articulo.estado,
  programado_para: articulo.programado_para,
  publicado_en: articulo.publicado_en,
});

type Props = {
  /** Cierto en `/articulos/nuevo`: el slug se sugiere desde el título hasta que la persona lo escribe. */
  nuevo: boolean;
  id?: string;
  datos: DatosArticulo;
  /** Estado y fechas del artículo; en uno nuevo es un borrador. */
  publicacion?: Publicacion;
  rol: RolMiembro;
  categorias: ReferenciaTaxonomia[];
  etiquetas: ReferenciaTaxonomia[];
};

/** Enfoca el primer campo con error que exista en pantalla (algunos errores no tienen control visible). */
function enfocarPrimerCampo(errores: ErrorBloque[]) {
  for (const error of [...errores].sort((a, b) => a.indice - b.indice)) {
    const elemento = document.getElementById(idDeCampo(error));
    if (elemento) {
      elemento.focus();
      return;
    }
  }
}

const vacioANulo = (valor: string) => (valor.trim() === '' ? null : valor);

export function EditorArticulo({
  nuevo,
  id: idInicial,
  datos,
  publicacion: publicacionInicial,
  rol,
  categorias,
  etiquetas,
}: Props) {
  const router = useRouter();
  const { setSucio } = useSalida();
  const [estado, despachar] = useReducer(reductor, undefined, () => estadoInicial(datos, { nuevo }));
  const [id, setId] = useState(idInicial);
  const [publicacion, setPublicacion] = useState<Publicacion>(
    publicacionInicial ?? { estado: 'borrador', programado_para: null, publicado_en: null },
  );
  const [errores, setErrores] = useState<ErrorBloque[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subidas, setSubidas] = useState(0);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [slugAjustado, setSlugAjustado] = useState<string | null>(null);
  const [errorTitulo, setErrorTitulo] = useState<string>();
  const [conflicto, setConflicto] = useState(false);
  const [vigente, setVigente] = useState<DatosArticulo | null>(null);
  const [verVigente, setVerVigente] = useState(false);
  // Mientras se carga la versión vigente para reemplazar, el formulario no admite cambios (se perderían).
  const [reemplazando, setReemplazando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  const hidratado = useHidratado();
  const sucio = estaSucio(estado);
  const { datos: actual } = estado;

  // El indicador de cambios sin guardar se comparte con el aviso de salida del panel.
  useEffect(() => {
    setSucio(sucio);
    return () => setSucio(false);
  }, [sucio, setSucio]);

  // Slug sugerido: con retardo de 300 ms, solo en un artículo nuevo y mientras la persona no lo escriba.
  useEffect(() => {
    if (id || estado.slugManual || actual.titulo.trim() === '') return;
    const espera = setTimeout(async () => {
      const resultado = await previsualizarSlugAccion({ texto: actual.titulo, tipo: 'articulo' });
      if (resultado.ok) despachar({ tipo: 'sugerir_slug', slug: resultado.datos });
    }, 300);
    return () => clearTimeout(espera);
  }, [actual.titulo, estado.slugManual, id]);

  const rutasGuardadas = useMemo(
    () => new Set(rutasDeImagenes(estado.guardado)),
    // `guardado` solo cambia al guardar o al adoptar la versión vigente.
    [estado.guardado],
  );
  const contexto = useMemo(
    () => ({
      anunciar: setAnuncio,
      subiendo: (delta: 1 | -1) => setSubidas((cuenta) => cuenta + delta),
      imagenGuardada: (ruta: string) => rutasGuardadas.has(ruta),
    }),
    [rutasGuardadas],
  );

  function irASalir(motivo: MotivoSesion | undefined) {
    router.push(urlDeSalida(motivo));
  }

  function mostrarErrores(lista: ErrorBloque[]) {
    setErrores(lista);
    setAnuncio(resumenDeErrores(lista));
    setTimeout(() => enfocarPrimerCampo(lista), 0);
  }

  async function guardar() {
    if (guardando || subidas > 0) return;
    setAviso(null);
    setConflicto(false);
    setErrorTitulo(undefined);

    if (actual.titulo.trim() === '') {
      const mensaje = 'Escribe un título para el artículo.';
      setErrorTitulo(mensaje);
      setAviso(mensaje);
      setAnuncio(mensaje);
      setTimeout(() => document.getElementById('campo-titulo')?.focus(), 0);
      return;
    }

    const invalidos = validarEditor(actual);
    if (invalidos.length > 0) return mostrarErrores(invalidos);
    setErrores([]);

    setGuardando(true);
    try {
      const campos = {
        titulo: actual.titulo,
        slug: actual.slug || undefined,
        extracto: actual.extracto,
        titulo_seo: actual.titulo_seo,
        descripcion_seo: actual.descripcion_seo,
        imagen_destacada: actual.imagen_destacada,
        contenido: actual.contenido,
        categoria_id: actual.categoria_id,
      };
      const resultado = id
        ? await guardarArticulo({ id, version: actual.version, cambios: campos, etiquetas: actual.etiquetas })
        : await crearArticuloAccion({ ...campos, etiquetas: actual.etiquetas });

      if (resultado.ok) {
        const guardado = resultado.datos;
        despachar({ tipo: 'guardado', articulo: aDatosArticulo(guardado, actual.etiquetas) });
        setPublicacion(publicacionDe(guardado));
        setGuardadoOk(true);
        // Si el sistema agregó un sufijo al slug escrito, se avisa cuál quedó (RF-008).
        setSlugAjustado(actual.slug && guardado.slug !== actual.slug ? guardado.slug : null);
        if (!id) {
          setId(guardado.id);
          // El editor sigue montado: solo cambia la dirección, sin recargar ni perder el foco.
          window.history.replaceState(null, '', `/articulos/${guardado.id}`);
        }
        return;
      }
      if (resultado.codigo === 'no_autenticado') return irASalir(resultado.motivo);
      if (resultado.codigo === 'contenido_invalido' && resultado.errores) return mostrarErrores(resultado.errores);
      if (resultado.codigo === 'conflicto_version') {
        setConflicto(true);
        // Se precarga la versión vigente: "Reemplazar" no espera a la red ni pisa lo que se escriba mientras tanto.
        void cargarVigente();
        return;
      }
      setAviso(resultado.mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function cargarVigente(): Promise<DatosArticulo | null> {
    if (!id) return null;
    const resultado = await leerArticuloVigente({ id });
    if (!resultado.ok) {
      setAviso(resultado.mensaje);
      return null;
    }
    const cargada = aDatosArticulo(resultado.datos, resultado.datos.etiquetas);
    setVigente(cargada);
    return cargada;
  }

  async function reemplazarConVigente() {
    setReemplazando(true);
    const cargada = vigente ?? (await cargarVigente());
    setReemplazando(false);
    if (!cargada) return;
    despachar({ tipo: 'adoptar_vigente', articulo: cargada });
    setConflicto(false);
    setVerVigente(false);
    setErrores([]);
    setAnuncio('Se cargó la versión vigente');
    // Radix devuelve el foco al botón que abrió el diálogo: se espera a que termine para fijarlo.
    setTimeout(() => titulo.current?.focus(), 150);
  }

  const erroresDestacada = agruparPorBloque(errores).get(-1) ?? [];

  return (
    <ContextoEditor.Provider value={contexto}>
      <div className="flex flex-col gap-6" data-editor={hidratado ? 'listo' : 'cargando'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 ref={titulo} tabIndex={-1} className="font-titulos text-titulo-2 font-semibold">
            {nuevo ? 'Nuevo artículo' : 'Editar artículo'}
          </h1>
          {id && (
            <Button asChild variante="secundaria">
              <EnlaceConAviso href={`/articulos/${id}/vista-previa`}>Vista previa</EnlaceConAviso>
            </Button>
          )}
        </div>

        {aviso && (
          <AvisoEstado tipo="error" enfocar>
            {aviso}
          </AvisoEstado>
        )}
        {errores.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-error-borde bg-error-suave p-3 font-semibold text-error"
          >
            {resumenDeErrores(errores)}
          </div>
        )}
        {conflicto && (
          <AvisoConflicto
            alVerVigente={async () => {
              if (await cargarVigente()) setVerVigente(true);
            }}
            alReemplazar={reemplazarConVigente}
          />
        )}
        {verVigente && vigente && <ComparacionVersiones propia={actual} vigente={vigente} />}

        <fieldset disabled={reemplazando} className="contents">
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <CampoFormulario etiqueta="Título" id="campo-titulo" error={errorTitulo}>
                {(a) => (
                  <Input
                    {...a}
                    value={actual.titulo}
                    onChange={(e) => despachar({ tipo: 'campo', campo: 'titulo', valor: e.target.value })}
                  />
                )}
              </CampoFormulario>
              <CampoFormulario etiqueta="Slug" id="campo-slug" ayuda="La dirección del artículo en el sitio.">
                {(a) => (
                  <Input
                    {...a}
                    value={actual.slug}
                    onChange={(e) => despachar({ tipo: 'campo', campo: 'slug', valor: e.target.value })}
                  />
                )}
              </CampoFormulario>
              <CampoFormulario etiqueta="Extracto" id="campo-extracto">
                {(a) => (
                  <Textarea
                    {...a}
                    value={actual.extracto ?? ''}
                    onChange={(e) => despachar({ tipo: 'campo', campo: 'extracto', valor: vacioANulo(e.target.value) })}
                  />
                )}
              </CampoFormulario>

              <fieldset className="flex flex-col gap-3 rounded-md border border-borde p-4">
                <legend className="px-1 font-semibold">Imagen destacada</legend>
                <ImagenEditable
                  imagen={actual.imagen_destacada}
                  alCambiar={(imagen) => despachar({ tipo: 'campo', campo: 'imagen_destacada', valor: imagen })}
                  idRuta="campo-imagen_destacada"
                  idAlt="campo-imagen_destacada"
                  errorRuta={mensajeDeCampo(erroresDestacada, 'imagen_destacada.ruta')}
                  errorAlt={mensajeDeCampo(erroresDestacada, 'imagen_destacada.alt')}
                />
              </fieldset>

              <section aria-labelledby="titulo-contenido" className="flex flex-col gap-3">
                <h2 id="titulo-contenido" className="font-titulos text-xl font-semibold">
                  Contenido
                </h2>
                <ListaBloques
                  contenido={actual.contenido}
                  errores={errores.filter((error) => error.indice >= 0)}
                  despachar={despachar}
                  anunciar={setAnuncio}
                />
              </section>
            </div>

            <div className="flex flex-col gap-6">
              {id && (
                <AccionesEstado
                  id={id}
                  slug={estado.guardado.slug}
                  version={estado.guardado.version}
                  estado={publicacion.estado}
                  programadoPara={publicacion.programado_para}
                  publicadoEn={publicacion.publicado_en}
                  rol={rol}
                  hayCambiosSinGuardar={sucio}
                  alCambiarEstado={(articulo) => {
                    despachar({ tipo: 'guardado', articulo: aDatosArticulo(articulo, actual.etiquetas) });
                    setPublicacion(publicacionDe(articulo));
                  }}
                />
              )}
              <CampoFormulario etiqueta="Categoría" id="campo-categoria">
                {(a) => (
                  <Select
                    {...a}
                    value={actual.categoria_id ?? ''}
                    onChange={(e) =>
                      despachar({
                        tipo: 'campo',
                        campo: 'categoria_id',
                        valor: e.target.value === '' ? null : e.target.value,
                      })
                    }
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </Select>
                )}
              </CampoFormulario>

              <fieldset className="flex flex-col gap-1 rounded-md border border-borde p-4">
                <legend className="px-1 font-semibold">Etiquetas</legend>
                {etiquetas.length === 0 && <p className="text-texto-suave">Todavía no hay etiquetas.</p>}
                {etiquetas.map((etiqueta) => (
                  <label key={etiqueta.id} className="flex min-h-(--tactil-min) items-center gap-2">
                    <Checkbox
                      checked={actual.etiquetas.includes(etiqueta.id)}
                      onChange={(e) =>
                        despachar({
                          tipo: 'campo',
                          campo: 'etiquetas',
                          valor: e.target.checked
                            ? [...actual.etiquetas, etiqueta.id]
                            : actual.etiquetas.filter((otra) => otra !== etiqueta.id),
                        })
                      }
                    />
                    {etiqueta.nombre}
                  </label>
                ))}
              </fieldset>

              <fieldset className="flex flex-col gap-4 rounded-md border border-borde p-4">
                <legend className="px-1 font-semibold">Para buscadores</legend>
                <CampoFormulario
                  etiqueta="Título SEO"
                  id="campo-titulo-seo"
                  ayuda="Si lo dejas vacío, se usa el título."
                >
                  {(a) => (
                    <Input
                      {...a}
                      value={actual.titulo_seo ?? ''}
                      onChange={(e) =>
                        despachar({ tipo: 'campo', campo: 'titulo_seo', valor: vacioANulo(e.target.value) })
                      }
                    />
                  )}
                </CampoFormulario>
                <CampoFormulario etiqueta="Descripción SEO" id="campo-descripcion-seo">
                  {(a) => (
                    <Textarea
                      {...a}
                      value={actual.descripcion_seo ?? ''}
                      onChange={(e) =>
                        despachar({ tipo: 'campo', campo: 'descripcion_seo', valor: vacioANulo(e.target.value) })
                      }
                    />
                  )}
                </CampoFormulario>
              </fieldset>
            </div>
          </div>
        </fieldset>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-separador bg-fondo px-4 py-3 md:-mx-8 md:px-8">
          <Button
            aria-disabled={guardando || subidas > 0 || reemplazando || undefined}
            aria-busy={guardando || undefined}
            onClick={guardar}
          >
            Guardar
          </Button>
          <p aria-live="polite" className="font-semibold text-advertencia">
            {sucio ? 'Cambios sin guardar' : ''}
          </p>
          <p role="status" className="font-semibold text-exito">
            {guardadoOk && !sucio
              ? slugAjustado
                ? `Guardado. La dirección quedó como ${slugAjustado}`
                : 'Guardado'
              : ''}
          </p>
        </div>
        {/* Región persistente de anuncios (movimientos de bloques, subidas, errores): no se recrea. */}
        <p role="status" className="sr-only">
          {anuncio}
        </p>
      </div>
    </ContextoEditor.Provider>
  );
}
