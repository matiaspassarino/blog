'use client';

// Editor de un artículo (Historia 2): título, slug, extracto, imagen destacada, categoría, etiquetas, SEO y
// bloques. El estado vive en un reductor puro (reductor.ts). Valida en el navegador con el mismo esquema que
// el servidor, enfoca el primer campo inválido, detecta ediciones concurrentes sin perder lo escrito (D13) y
// avisa antes de salir con cambios sin guardar (RF-010).
import type { Documento, ErrorElemento } from '@blog/bloques';
import { rutasDeImagenes } from '@blog/bloques';
import type { Articulo, EstadoArticulo, ReferenciaTaxonomia, RolMiembro } from '@blog/db';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  crearArticuloAccion,
  guardarArticulo,
  leerArticuloVigente,
  previsualizarSlugAccion,
} from '../../acciones/articulos';
import { agruparPorBloque, idDeCampo, mensajeDeCampo } from '../../lib/errores-campo';
import { BarraEditor } from '../articulo/BarraEditor';
import { InfoPublicacion } from '../articulo/InfoPublicacion';
import { AvisoEstado } from '../AvisoEstado';
import { CampoFormulario } from '../CampoFormulario';
import { useSalida } from '../salida/ProveedorSalida';
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
import { useAltoDe, useAnchoMinimo } from '../../lib/pantalla';
import { cn } from '../../lib/cn';
import { CargadorDeEditorDocumento } from './documento/CargadorDeEditorDocumento';
import type { AccionesDelLienzo } from './documento/EditorDocumento';
import { primerErrorDelDocumento } from './documento/mapa-errores';
import { PropiedadesDelElemento } from './documento/PropiedadesDelElemento';
import type { CambiosDeElemento } from './bloques/tipos';
import type { ElementoActivo, SeleccionDelDocumento } from './documento/tipos';
import { estaSucio, estadoInicial, iguales, reductor, type DatosArticulo } from './reductor';
import { EncabezadoPagina } from '../estructura/EncabezadoPagina';
import { TituloSeccion } from '../estructura/TituloSeccion';

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
function enfocarPrimerCampo(errores: ErrorElemento[]) {
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
  const [errores, setErrores] = useState<ErrorElemento[]>([]);
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
  // Sube al adoptar la versión vigente: el documento y su historial se vuelven a crear desde lo adoptado.
  const [reinicio, setReinicio] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);
  // El lienzo no se vuelve a dibujar en cada tecla: estas props tienen que ser estables.
  const erroresDeElementos = useMemo(() => errores.filter((error) => error.indice >= 0), [errores]);
  const alCambiarContenido = useCallback((valor: Documento) => despachar({ tipo: 'contenido', valor }), []);
  const acciones = useRef<AccionesDelLienzo>(null);
  const [seleccion, setSeleccion] = useState<SeleccionDelDocumento>({ tipo: 'texto' });
  const [elemento, setElemento] = useState<ElementoActivo | null>(null);
  const [pestania, setPestania] = useState<'articulo' | 'elemento'>('articulo');
  const [hojaAbierta, setHojaAbierta] = useState(false);
  // Sube cada vez que hay que llevar el foco al primer campo del panel.
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const anchoDeEscritorio = useAnchoMinimo(1280);
  const altoDeLaBarra = useAltoDe('[role="group"][aria-label="Acciones del artículo"]');
  const ultimoId = useRef<string | null>(null);
  const alSeleccionar = useCallback((nueva: SeleccionDelDocumento, activo: ElementoActivo | null) => {
    setSeleccion(nueva);
    setElemento(activo);
    const especial =
      nueva.tipo === 'elementos' && ['imagen', 'galeria', 'cta', 'video'].includes(nueva.elementos[0]?.type ?? '');
    // La pestaña cambia sola solo al seleccionar un elemento especial distinto del anterior (no al mover el cursor).
    if (activo && especial && activo.id !== ultimoId.current) setPestania('elemento');
    ultimoId.current = activo?.id ?? null;
    if (activo?.origen === 'insertar-texto') setPestania('elemento');
    if (activo?.origen === 'insertar') {
      setHojaAbierta(true);
      setPedidoDeFoco((n) => n + 1);
    }
  }, []);
  const alCambiarElemento = useCallback(
    (cambios: CambiosDeElemento) => {
      if (elemento) acciones.current?.actualizarElemento(elemento.id, cambios);
    },
    [elemento],
  );
  const alCerrarHoja = useCallback(() => setHojaAbierta(false), []);
  const alPropiedades = useCallback(() => {
    setPestania('elemento');
    setHojaAbierta(true);
    setPedidoDeFoco((n) => n + 1);
  }, []);

  // Foco al primer campo del panel (lateral u hoja) cuando se pide, y el elemento queda a la vista sobre la hoja.
  useEffect(() => {
    if (pedidoDeFoco === 0) return;
    const campo = document.querySelector<HTMLElement>(
      '[data-panel-propiedades] :is(input, select, textarea, button):not([tabindex="-1"]):not([data-cerrar-hoja])',
    );
    campo?.focus();
    document.querySelector('.ProseMirror-selectednode')?.scrollIntoView({ block: 'nearest' });
  }, [pedidoDeFoco]);

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
  // Qué elementos tienen una subida en curso: no se pueden mover ni quitar mientras suben.
  const [subidasPorId, setSubidasPorId] = useState<ReadonlyMap<string, number>>(new Map());
  const idsSubiendo = useMemo(
    () => new Set([...subidasPorId].filter(([, cuenta]) => cuenta > 0).map(([id]) => id)),
    [subidasPorId],
  );
  const contexto = useMemo(
    () => ({
      anunciar: setAnuncio,
      subiendo: (delta: 1 | -1) => setSubidas((cuenta) => cuenta + delta),
      imagenGuardada: (ruta: string) => rutasGuardadas.has(ruta),
    }),
    [rutasGuardadas],
  );

  // Las subidas que empiezan en el panel de un elemento quedan asociadas a ese elemento.
  const contextoDelPanel = useMemo(
    () => ({
      ...contexto,
      subiendo: (delta: 1 | -1) => {
        contexto.subiendo(delta);
        const id = elemento?.id;
        if (!id) return;
        setSubidasPorId((previas) => new Map(previas).set(id, (previas.get(id) ?? 0) + delta));
      },
    }),
    [contexto, elemento?.id],
  );

  function irASalir(motivo: MotivoSesion | undefined) {
    router.push(urlDeSalida(motivo));
  }

  function mostrarErrores(lista: ErrorElemento[]) {
    setErrores(lista);
    setAnuncio(resumenDeErrores(lista));
    const primero = lista.some((error) => error.indice < 0) ? null : primerErrorDelDocumento(actual.contenido, lista);
    if (!primero) return void setTimeout(() => enfocarPrimerCampo(lista), 0);
    // Un error en un elemento: se selecciona, se abre su panel y el foco va al campo con el error.
    acciones.current?.seleccionarElemento(primero.id);
    setPestania('elemento');
    setHojaAbierta(true);
    setTimeout(() => enfocarPrimerCampo([primero.error]), 120);
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
        const datos = aDatosArticulo(guardado, actual.etiquetas);
        despachar({ tipo: 'guardado', articulo: datos });
        setPublicacion(publicacionDe(guardado));
        setGuardadoOk(true);
        // Si el sistema agregó un sufijo al slug escrito, se avisa cuál quedó (RF-008).
        setSlugAjustado(actual.slug && guardado.slug !== actual.slug ? guardado.slug : null);
        // Si el servidor devolvió otro contenido (por ejemplo, normalizado), el lienzo lo adopta y se avisa.
        if (!iguales(datos.contenido, campos.contenido)) {
          acciones.current?.adoptarContenido(datos.contenido);
          setAnuncio('El servidor ajustó el contenido al guardar');
        }
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
    setReinicio((n) => n + 1);
    setSeleccion({ tipo: 'texto' });
    setElemento(null);
    setHojaAbierta(false);
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
        <EncabezadoPagina titulo={nuevo ? 'Nuevo artículo' : 'Editar artículo'} refTitulo={titulo} tituloEnfocable />

        {aviso && (
          <AvisoEstado tipo="error" enfocar>
            {aviso}
          </AvisoEstado>
        )}
        {errores.length > 0 && (
          <AvisoEstado tipo="error" cerrable={false}>
            {resumenDeErrores(errores)}
          </AvisoEstado>
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
          <div className="grid gap-panel-seccion xl:grid-cols-[1fr_var(--container-panel-propiedades)]">
            <div className="flex min-w-0 flex-col gap-panel-seccion">
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

              <section aria-labelledby="titulo-imagen-destacada" className="flex flex-col gap-4">
                <TituloSeccion id="titulo-imagen-destacada">Imagen destacada</TituloSeccion>
                <fieldset aria-labelledby="titulo-imagen-destacada" className="min-w-0">
                  <ImagenEditable
                    imagen={actual.imagen_destacada}
                    alCambiar={(imagen) => despachar({ tipo: 'campo', campo: 'imagen_destacada', valor: imagen })}
                    idRuta="campo-imagen_destacada"
                    idAlt="campo-imagen_destacada"
                    errorRuta={mensajeDeCampo(erroresDestacada, 'imagen_destacada.ruta')}
                    errorAlt={mensajeDeCampo(erroresDestacada, 'imagen_destacada.alt')}
                  />
                </fieldset>
              </section>

              <section aria-labelledby="titulo-contenido" className="flex flex-col gap-4">
                <TituloSeccion id="titulo-contenido">Contenido</TituloSeccion>
                <CargadorDeEditorDocumento
                  contenido={estado.guardado.contenido}
                  reinicio={reinicio}
                  errores={erroresDeElementos}
                  alCambiar={alCambiarContenido}
                  alSeleccionar={alSeleccionar}
                  alPropiedades={alPropiedades}
                  acciones={acciones}
                  anunciar={setAnuncio}
                  subidasEnCurso={idsSubiendo}
                  hojaAbierta={hojaAbierta}
                  alCerrarHoja={alCerrarHoja}
                  bloqueado={reemplazando}
                />
              </section>
            </div>

            <div className="flex min-w-0 flex-col gap-panel-seccion xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto">
              {id && (
                <InfoPublicacion
                  slug={estado.guardado.slug}
                  estado={publicacion.estado}
                  programadoPara={publicacion.programado_para}
                  publicadoEn={publicacion.publicado_en}
                />
              )}
              {anchoDeEscritorio && (
                <div
                  role="tablist"
                  aria-label="Panel del artículo"
                  className="flex gap-1 border-b border-separador"
                  onKeyDown={(evento) => {
                    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
                    evento.preventDefault();
                    const siguiente = pestania === 'articulo' ? 'elemento' : 'articulo';
                    setPestania(siguiente);
                    document.getElementById(`pestana-${siguiente}`)?.focus();
                  }}
                >
                  {(['articulo', 'elemento'] as const).map((clave) => (
                    <button
                      key={clave}
                      id={`pestana-${clave}`}
                      type="button"
                      role="tab"
                      aria-selected={pestania === clave}
                      aria-controls={`panel-${clave}`}
                      tabIndex={pestania === clave ? 0 : -1}
                      onClick={() => setPestania(clave)}
                      className={cn(
                        'min-h-(--tactil-min) border-b-2 px-4 font-titulos font-semibold',
                        // La pestaña es un control, no texto de apoyo: la activa se distingue por el borde y el color.
                        pestania === clave ? 'border-marca text-marca' : 'border-transparent text-texto',
                      )}
                    >
                      {clave === 'articulo' ? 'Artículo' : 'Elemento'}
                    </button>
                  ))}
                </div>
              )}
              <div
                id="panel-articulo"
                role={anchoDeEscritorio ? 'tabpanel' : undefined}
                aria-labelledby={anchoDeEscritorio ? 'pestana-articulo' : undefined}
                hidden={anchoDeEscritorio && pestania !== 'articulo'}
                className="flex flex-col gap-panel-seccion"
              >
                <section aria-labelledby="titulo-taxonomias" className="flex flex-col gap-4">
                  <TituloSeccion id="titulo-taxonomias">Taxonomías</TituloSeccion>
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
                    {etiquetas.length === 0 && <p className="text-sm text-texto-suave">Todavía no hay etiquetas.</p>}
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
                        <span className="min-w-0 wrap-anywhere">{etiqueta.nombre}</span>
                      </label>
                    ))}
                  </fieldset>
                </section>

                <section aria-labelledby="titulo-buscadores" className="flex flex-col gap-4">
                  <TituloSeccion id="titulo-buscadores">Para buscadores</TituloSeccion>
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
                </section>
              </div>
              {anchoDeEscritorio && (
                <div
                  id="panel-elemento"
                  role="tabpanel"
                  aria-labelledby="pestana-elemento"
                  hidden={pestania !== 'elemento'}
                  data-panel-propiedades
                >
                  <ContextoEditor.Provider value={contextoDelPanel}>
                    <PropiedadesDelElemento
                      variante="lateral"
                      seleccion={seleccion}
                      posicion={elemento?.posicion ?? 0}
                      indice={elemento?.indice ?? -1}
                      errores={errores.filter((error) => error.indice === elemento?.indice)}
                      alCambiar={alCambiarElemento}
                    />
                  </ContextoEditor.Provider>
                </div>
              )}
            </div>
          </div>
        </fieldset>

        {!anchoDeEscritorio && hojaAbierta && (
          <div
            data-panel-propiedades
            style={{ bottom: altoDeLaBarra }}
            className="sticky z-20 -mx-4 bg-fondo px-4 pt-2 pb-3 md:-mx-8 md:px-8"
            onKeyDown={(evento) => {
              if (evento.key !== 'Escape') return;
              evento.preventDefault();
              setHojaAbierta(false);
              acciones.current?.enfocar();
            }}
          >
            <ContextoEditor.Provider value={contextoDelPanel}>
              <PropiedadesDelElemento
                variante="hoja"
                seleccion={seleccion}
                posicion={elemento?.posicion ?? 0}
                indice={elemento?.indice ?? -1}
                errores={errores.filter((error) => error.indice === elemento?.indice)}
                alCambiar={alCambiarElemento}
                alCerrar={() => {
                  setHojaAbierta(false);
                  acciones.current?.enfocar();
                }}
              />
            </ContextoEditor.Provider>
          </div>
        )}

        <BarraEditor
          id={id}
          version={estado.guardado.version}
          estado={publicacion.estado}
          rol={rol}
          hayCambiosSinGuardar={sucio}
          guardando={guardando}
          bloqueado={subidas > 0 || reemplazando}
          subiendoImagen={subidas > 0}
          guardadoOk={guardadoOk}
          slugAjustado={slugAjustado}
          alGuardar={guardar}
          alCambiarEstado={(articulo) => {
            despachar({ tipo: 'guardado', articulo: aDatosArticulo(articulo, actual.etiquetas) });
            setPublicacion(publicacionDe(articulo));
          }}
        />
        {/* Región persistente de anuncios (movimientos de bloques, subidas, errores): no se recrea. */}
        <p role="status" className="sr-only">
          {anuncio}
        </p>
      </div>
    </ContextoEditor.Provider>
  );
}
