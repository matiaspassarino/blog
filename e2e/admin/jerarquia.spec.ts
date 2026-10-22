// T015, T016, T031 a T033 y T046 (spec 004, CE-001, CE-002, CE-003, H1 a H3, RF-002 a RF-014, RF-018, RF-019; research D8 a D13).
// FASE ROJA: hoy casi ningún botón expone `data-nivel`, no existe la barra "Acciones del artículo", ni "Más acciones", ni
// `EncabezadoPagina`/`EstadoVacio`/`TituloSeccion`.
//
// SUPUESTOS DE INTERFAZ (contracts/componentes.md y contracts/matriz-acciones.md; si la real difiere, se ajusta aquí):
//   - Todo `Button` (y todo enlace con aspecto de botón de `Button asChild`) lleva `data-nivel` y `data-tamanio`. La
//     paginación y los enlaces de texto ("Olvidé mi contraseña", "Ver en el sitio") no cuentan como acciones.
//   - `EncabezadoPagina` es un `<header>` dentro de `<main>` que contiene el `h1`; las acciones de pantalla van dentro.
//   - `EstadoVacio` lleva `data-estado="vacio"`. `TituloSeccion` es un `h2` (o `legend`) con `text-titulo-3`.
//   - "Más acciones" es un botón con `aria-label`, `aria-expanded` y `aria-controls` hacia un panel con las acciones del
//     menú (cada una con `data-nivel`) y un separador (`role="separator"` o `<hr>`) antes de las destructivas.
//   - El estado "ocupado" de un botón agrega un `<span role="status">` dentro del propio botón, sin cambiar su ancho.
//   - El texto de apoyo (fechas, ayudas, conteos) lleva la clase `text-texto-suave` (tokens del panel).
// Datos: prefijo `e2e-je-`; cada prueba que cambia un artículo siembra el suyo. Se corre a 1440 px salvo donde se indica.
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import {
  imagenSemilla,
  diezBloques,
  limpiarArticulosE2E,
  parrafo,
  pasarAComoServicio,
  publicarComoServicio,
  sembrarArticulo,
  subirObjeto,
} from './ayudas/articulos';
import { fechaFutura, nombreDePrueba } from './ayudas/datos';
import { esperarEditorListo, guardarYEsperar } from './ayudas/editor';
import { correoUnico } from './ayudas/equipo';
import {
  abrirDialogoProgramar,
  botonDeEstado,
  botonConfirmarProgramar,
  dialogoProgramar,
  esperarEstado,
  panelPublicacion,
  campoFechaProgramada,
} from './ayudas/estado';
import {
  accionesPorNivel,
  accionesSuperpuestasOCortadas,
  alturasDelGrupo,
  anchoDe,
  areaTactil,
  barraDelEditor,
  controlesBajoElMinimo,
  estaAlineado,
  gruposDesalineados,
  NIVELES,
  ocupaUnaLinea,
  posicionDe,
  verificarNivel,
  type Nivel,
} from './ayudas/jerarquia';
import { ANCHOS, PANTALLAS, abrirPantalla, datosDePantallas, type Pantalla } from './ayudas/pantallas';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { crearMiembro, eliminarPorCorreo, servicio, type MiembroDePrueba } from './ayudas/servicio';
import { pngDecodificable } from '../../packages/db/src/pruebas/imagenes';

const PREFIJO = 'e2e-je-';
const titulo = (etiqueta: string) => nombreDePrueba(`je-${etiqueta}`);

let idConImagen = '';
const miembros: MiembroDePrueba[] = [];
const correosInvitados: string[] = [];
let nombreInvitado = '';

test.beforeAll(async () => {
  const ruta = `pruebas-e2e/${crypto.randomUUID()}.png`;
  await subirObjeto(ruta, pngDecodificable(4, 3));
  const diez = await sembrarArticulo({ titulo: titulo('diez'), contenido: diezBloques(imagenSemilla(ruta)) });
  datosDePantallas.prefijoLista = PREFIJO;
  datosDePantallas.idArticulo = diez.id;
  idConImagen = (await sembrarArticulo({ titulo: titulo('con imagen'), imagen_destacada: imagenSemilla(ruta) })).id;

  // Equipo: un invitado (para "Reenviar invitación") y un desactivado (para "Reactivar").
  nombreInvitado = nombreDePrueba('je-invitado');
  const correoInvitado = correoUnico('je-invitado');
  correosInvitados.push(correoInvitado);
  const { error } = await servicio().auth.admin.createUser({
    email: correoInvitado,
    email_confirm: false,
    user_metadata: { nombre: nombreInvitado },
    app_metadata: { rol: 'editor' },
  });
  if (error) throw new Error(`No se pudo crear el invitado de prueba: ${error.message}`);
  const desactivado = await crearMiembro(nombreDePrueba('je-desactivado'));
  await desactivado.desactivar();
  miembros.push(desactivado);
});

test.afterAll(async () => {
  await limpiarArticulosE2E(PREFIJO);
  for (const miembro of miembros.splice(0)) await miembro.eliminar();
  for (const correo of correosInvitados.splice(0)) await eliminarPorCorreo(correo);
});

// --- Ayudas del archivo ----------------------------------------------------------------------------------------------

type EstadoDelCaso = 'nuevo' | 'borrador' | 'programado' | 'publicado' | 'archivado';

/** Siembra un artículo en el estado pedido (un borrador ya es "guardado"; el nuevo no se siembra). */
async function sembrarEn(estado: Exclude<EstadoDelCaso, 'nuevo'>, etiqueta: string) {
  const articulo = await sembrarArticulo({ titulo: titulo(etiqueta), contenido: [parrafo('Texto inicial')] });
  if (estado === 'programado') await pasarAComoServicio(articulo.id, 'programado', new Date(Date.now() + 86_400_000));
  if (estado === 'publicado' || estado === 'archivado') await publicarComoServicio(articulo.id);
  if (estado === 'archivado') await pasarAComoServicio(articulo.id, 'archivado');
  return articulo;
}

/** Abre el editor del artículo (o `/articulos/nuevo`) con la sesión indicada y espera a que esté listo. */
async function abrirEditor(
  page: Page,
  estado: EstadoDelCaso,
  etiqueta: string,
  usuario: keyof typeof USUARIOS = 'admin',
) {
  const ruta = estado === 'nuevo' ? '/articulos/nuevo' : `/articulos/${(await sembrarEn(estado, etiqueta)).id}`;
  await ingresar(page, USUARIOS[usuario], ruta);
  await esperarEditorListo(page);
  return ruta;
}

/** Cambia el extracto: marca el artículo con cambios sin guardar. */
const escribirCambio = (page: Page) => page.getByLabel('Extracto', { exact: true }).fill('Un extracto nuevo');

async function nombresVisibles(ambito: Locator) {
  return ambito
    .locator('[data-nivel]:visible')
    .evaluateAll((els) =>
      els.map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()),
    );
}

const botonMasAcciones = (page: Page) =>
  barraDelEditor(page).getByRole('button', { name: 'Más acciones', exact: true });

// =====================================================================================================================
// T015 — Acción principal (CE-001, CE-002, H1 esc. 1 a 6)
// =====================================================================================================================

test.describe('Acción principal', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  type Esperado = Partial<Record<Nivel, (string | RegExp)[]>>;
  type Fila = Pantalla & { esperado: Esperado; opcionales?: Esperado; conNavegacion?: boolean };
  const NAVEGACION = 'Cerrar sesión';

  // Una fila de contracts/matriz-acciones.md por pantalla. La navegación del panel agrega "Cerrar sesión" (terciaria).
  const FILAS: Fila[] = [
    {
      nombre: 'Ingreso',
      ruta: () => '/ingreso',
      usuario: null,
      conNavegacion: false,
      esperado: { primaria: ['Ingresar'], terciaria: ['Mostrar contraseña'] },
    },
    {
      nombre: 'Olvidé mi contraseña',
      ruta: () => '/olvide-contrasena',
      usuario: null,
      conNavegacion: false,
      esperado: { primaria: ['Enviar enlace'] },
    },
    {
      nombre: 'Confirmar enlace',
      ruta: () => '/auth/confirmar?token_hash=inventado&type=recovery',
      usuario: null,
      conNavegacion: false,
      esperado: { primaria: ['Continuar'] },
    },
    {
      nombre: 'Lista de artículos',
      ruta: () => `/articulos?q=${PREFIJO}`,
      usuario: 'editor',
      esperado: { primaria: ['Nuevo artículo'], secundaria: ['Filtrar'] },
    },
    {
      nombre: 'Lista sin resultados',
      ruta: () => `/articulos?q=${PREFIJO}que-no-existe`,
      usuario: 'editor',
      esperado: { primaria: ['Nuevo artículo'], secundaria: ['Filtrar', 'Quitar filtros'] },
    },
    {
      nombre: 'Categorías',
      ruta: () => '/categorias',
      usuario: 'editor',
      esperado: { primaria: ['Crear categoría'], secundaria: [/^Editar /], peligro: [/^Eliminar /] },
    },
    {
      nombre: 'Etiquetas',
      ruta: () => '/etiquetas',
      usuario: 'editor',
      // Las filas dependen de las etiquetas que haya cargadas: pueden no existir.
      esperado: { primaria: ['Crear etiqueta'] },
      opcionales: { secundaria: [/^Editar /], peligro: [/^Eliminar /] },
    },
    {
      nombre: 'Equipo',
      ruta: () => '/equipo',
      usuario: 'admin',
      esperado: {
        primaria: ['Enviar invitación'],
        secundaria: [/^Reenviar invitación a /, /^Reactivar /],
        peligro: [/^Desactivar /],
      },
    },
    {
      nombre: 'Perfil',
      ruta: () => '/perfil',
      usuario: 'editor',
      listo: (page) => expect(page.locator('[data-perfil="listo"]')).toBeVisible(),
      esperado: { primaria: ['Guardar perfil'], secundaria: [/^(Elegir|Agregar) imagen/] },
      opcionales: { peligro: ['Quitar imagen'] },
    },
    {
      nombre: 'No encontrado',
      ruta: () => '/esto-no-existe',
      usuario: 'editor',
      conNavegacion: false,
      esperado: { secundaria: ['Ir a los artículos'] },
    },
    {
      nombre: 'No tienes permiso',
      ruta: () => '/equipo',
      usuario: 'editor',
      conNavegacion: false,
      esperado: { secundaria: ['Ir a los artículos'] },
    },
    {
      nombre: 'Vista previa',
      ruta: () => `/articulos/${datosDePantallas.idArticulo}/vista-previa`,
      usuario: 'editor',
      esperado: {},
      opcionales: { terciaria: ['Cerrar aviso'] },
    },
  ];

  for (const fila of FILAS) {
    test(`CE-001: ${fila.nombre} tiene como máximo una principal y las acciones de la matriz en cada nivel`, async ({
      page,
    }) => {
      await abrirPantalla(page, fila);

      const acciones = await accionesPorNivel(page);

      expect(
        acciones.primaria.length,
        `acciones principales: ${JSON.stringify(acciones.primaria)}`,
      ).toBeLessThanOrEqual(1);
      for (const nivel of NIVELES) {
        const esperadas = [...(fila.esperado[nivel] ?? [])];
        if (nivel === 'terciaria' && fila.conNavegacion !== false) esperadas.push(NAVEGACION);
        verificarNivel(acciones[nivel], esperadas, `${fila.nombre} (${nivel})`, fila.opcionales?.[nivel]);
      }
    });
  }

  test.describe('Editor: la barra fija, en el artículo nuevo y en los cuatro estados (admin)', () => {
    type CasoEditor = {
      nombre: string;
      estado: EstadoDelCaso;
      conCambios?: boolean;
      esperado: Record<Nivel, string[]>;
    };
    const CASOS: CasoEditor[] = [
      {
        nombre: 'artículo nuevo',
        estado: 'nuevo',
        esperado: { primaria: ['Guardar'], secundaria: [], terciaria: [], peligro: [] },
      },
      {
        nombre: 'borrador sin cambios',
        estado: 'borrador',
        esperado: {
          primaria: ['Publicar'],
          secundaria: ['Guardar', 'Programar'],
          terciaria: ['Vista previa'],
          peligro: ['Eliminar'],
        },
      },
      {
        nombre: 'borrador con cambios',
        estado: 'borrador',
        conCambios: true,
        esperado: {
          primaria: ['Guardar'],
          secundaria: ['Publicar', 'Programar'],
          terciaria: ['Vista previa'],
          peligro: ['Eliminar'],
        },
      },
      {
        nombre: 'programado',
        estado: 'programado',
        esperado: {
          primaria: ['Guardar'],
          secundaria: ['Publicar', 'Cancelar programación'],
          terciaria: ['Vista previa'],
          peligro: ['Eliminar'],
        },
      },
      {
        nombre: 'publicado',
        estado: 'publicado',
        esperado: {
          primaria: ['Guardar'],
          secundaria: ['Volver a borrador', 'Archivar'],
          terciaria: ['Vista previa'],
          peligro: ['Eliminar'],
        },
      },
      {
        nombre: 'archivado',
        estado: 'archivado',
        esperado: {
          primaria: ['Guardar'],
          secundaria: ['Volver a borrador'],
          terciaria: ['Vista previa'],
          peligro: ['Eliminar'],
        },
      },
    ];

    for (const caso of CASOS) {
      test(`CE-002 (H1-E2): ${caso.nombre}: la barra tiene exactamente las acciones de la matriz y es la única principal de la pantalla`, async ({
        page,
      }) => {
        await abrirEditor(page, caso.estado, `barra ${caso.nombre}`);
        if (caso.conCambios) await escribirCambio(page);

        const barra = await accionesPorNivel(barraDelEditor(page));
        const pagina = await accionesPorNivel(page);

        for (const nivel of NIVELES) verificarNivel(barra[nivel], caso.esperado[nivel], `${caso.nombre} (${nivel})`);
        // Ninguna otra principal en el editor (ni "Guardar" ni "Publicar" duplicados fuera de la barra) y ninguna destructiva como principal.
        expect(pagina.primaria, 'la pantalla entera tiene una sola principal').toEqual(caso.esperado.primaria);
        expect(pagina.peligro.filter((nombre) => caso.esperado.primaria.includes(nombre))).toEqual([]);
      });
    }

    test('H1-E2: un artículo nuevo solo tiene "Guardar", habilitado y principal, y no tiene "Vista previa"', async ({
      page,
    }) => {
      await abrirEditor(page, 'nuevo', 'nuevo guardar');
      const guardar = barraDelEditor(page).getByRole('button', { name: 'Guardar', exact: true });

      await expect(guardar).toBeVisible();
      await expect(guardar).toHaveAttribute('data-nivel', 'primaria');
      await expect(guardar).not.toHaveAttribute('aria-disabled', 'true');
      await expect(barraDelEditor(page).getByText('Vista previa')).toHaveCount(0);
      await expect(barraDelEditor(page).getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
    });

    test('H1-E3: en un borrador sin cambios "Guardar" está deshabilitado con "Sin cambios" asociado, y sigue en su lugar al escribir', async ({
      page,
    }) => {
      await abrirEditor(page, 'borrador', 'posiciones');
      const barra = barraDelEditor(page);
      const guardar = barra.getByRole('button', { name: 'Guardar', exact: true });
      const publicar = barra.getByRole('button', { name: 'Publicar', exact: true });

      await expect(publicar).toHaveAttribute('data-nivel', 'primaria');
      await expect(guardar).toHaveAttribute('data-nivel', 'secundaria');
      await expect(guardar).toHaveAttribute('aria-disabled', 'true');
      await expect(guardar).toHaveAccessibleDescription(/Sin cambios/);
      const [guardarAntes, publicarAntes] = [await posicionDe(guardar), await posicionDe(publicar)];

      await escribirCambio(page);

      await expect(guardar).toHaveAttribute('data-nivel', 'primaria');
      await expect(publicar).toHaveAttribute('data-nivel', 'secundaria');
      await expect(guardar).not.toHaveAttribute('aria-disabled', 'true');
      expect(await posicionDe(guardar), '"Guardar" no se mueve al pasar a principal').toEqual(guardarAntes);
      expect(await posicionDe(publicar), '"Publicar" no se mueve al pasar a secundaria').toEqual(publicarAntes);

      await guardarYEsperar(page);

      await expect(publicar).toHaveAttribute('data-nivel', 'primaria');
      await expect(guardar).toHaveAttribute('data-nivel', 'secundaria');
    });

    test('H1-E5: "Eliminar" va al final, separado de las demás y con un ícono además del color', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'eliminar separado');
      const barra = barraDelEditor(page);
      const eliminar = barra.getByRole('button', { name: 'Eliminar', exact: true });
      const botones = barra.locator('[data-nivel]:visible');
      const cantidad = await botones.count();

      await expect(eliminar).toHaveAttribute('data-nivel', 'peligro');
      await expect(eliminar.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      expect(await nombresVisibles(barra), 'es la última acción').toEqual(expect.arrayContaining(['Eliminar']));
      expect((await nombresVisibles(barra)).at(-1)).toBe('Eliminar');
      const cajaEliminar = (await eliminar.boundingBox())!;
      const cajaAnterior = (await botones.nth(cantidad - 2).boundingBox())!;
      expect(
        cajaEliminar.x - (cajaAnterior.x + cajaAnterior.width),
        'más separación que el hueco normal entre botones (12 px)',
      ).toBeGreaterThan(16);
    });

    test('Rol editor: no existe "Eliminar" y la barra no deja un hueco', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'editor sin eliminar', 'editor');
      const barra = barraDelEditor(page);

      await expect(barra.getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
      await expect(barra.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
      const botones = barra.locator('[data-nivel]:visible');
      const cantidad = await botones.count();
      expect(cantidad).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < cantidad; i += 1) {
        const anterior = (await botones.nth(i - 1).boundingBox())!;
        const actual = (await botones.nth(i).boundingBox())!;
        expect(actual.x - (anterior.x + anterior.width), `hueco entre el botón ${i} y el ${i + 1}`).toBeLessThanOrEqual(
          16,
        );
      }
    });
  });

  test.describe('Diálogos: cada uno evalúa su jerarquía solo', () => {
    test('H1-E4: "Programar la publicación": "Programar" es la principal y "Cancelar" secundaria', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'dialogo programar');

      await abrirDialogoProgramar(page);
      const acciones = await accionesPorNivel(page);

      verificarNivel(acciones.primaria, ['Programar'], 'diálogo de programar (primaria)');
      verificarNivel(acciones.secundaria, ['Cancelar'], 'diálogo de programar (secundaria)');
      expect(acciones.peligro).toEqual([]);
      expect(acciones.terciaria).toEqual([]);
    });

    test('H1-E4: "¿Eliminar este artículo?": "Eliminar" es destructiva, "Cancelar" secundaria y no hay principal', async ({
      page,
    }) => {
      await abrirEditor(page, 'borrador', 'dialogo eliminar');

      await botonDeEstado(page, 'Eliminar').click();
      const dialogo = page.getByRole('alertdialog');
      await expect(dialogo).toBeVisible();
      const acciones = await accionesPorNivel(page);

      verificarNivel(acciones.peligro, ['Eliminar'], 'diálogo de eliminar (peligro)');
      verificarNivel(acciones.secundaria, ['Cancelar'], 'diálogo de eliminar (secundaria)');
      expect(acciones.primaria).toEqual([]);
    });

    test('H1-E4: "¿Quitar esta imagen?": "Quitar imagen" es destructiva y "Cancelar" secundaria', async ({ page }) => {
      await ingresar(page, USUARIOS.editor, `/articulos/${idConImagen}`);
      await esperarEditorListo(page);

      await page.getByRole('button', { name: 'Quitar imagen' }).first().click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      const acciones = await accionesPorNivel(page);

      verificarNivel(acciones.peligro, ['Quitar imagen'], 'diálogo de quitar imagen (peligro)');
      verificarNivel(acciones.secundaria, ['Cancelar'], 'diálogo de quitar imagen (secundaria)');
      expect(acciones.primaria).toEqual([]);
    });

    test('H1-E4: "Tienes cambios sin guardar": "Salir sin guardar" es destructiva y "Seguir editando" secundaria', async ({
      page,
    }) => {
      await abrirEditor(page, 'borrador', 'dialogo salir');
      await escribirCambio(page);

      await page.getByRole('link', { name: 'Categorías', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      const acciones = await accionesPorNivel(page);

      verificarNivel(acciones.peligro, ['Salir sin guardar'], 'diálogo de salir (peligro)');
      verificarNivel(acciones.secundaria, ['Seguir editando'], 'diálogo de salir (secundaria)');
      expect(acciones.primaria).toEqual([]);
    });

    test('H1-E4: el diálogo de editar una categoría tiene "Guardar cambios" como principal y "Cancelar" secundaria', async ({
      page,
    }) => {
      await ingresar(page, USUARIOS.editor, '/categorias');

      await page
        .getByRole('button', { name: /^Editar /i })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      const acciones = await accionesPorNivel(page);

      verificarNivel(acciones.primaria, ['Guardar cambios'], 'diálogo de edición (primaria)');
      verificarNivel(acciones.secundaria, ['Cancelar'], 'diálogo de edición (secundaria)');
      expect(acciones.peligro).toEqual([]);
    });

    test('H1-E4: el diálogo de eliminar una categoría tiene "Eliminar" destructiva y "Cancelar" secundaria', async ({
      page,
    }) => {
      await ingresar(page, USUARIOS.editor, '/categorias');

      await page
        .getByRole('button', { name: /^Eliminar /i })
        .first()
        .click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      const acciones = await accionesPorNivel(page);

      verificarNivel(acciones.peligro, ['Eliminar'], 'diálogo de eliminar categoría (peligro)');
      verificarNivel(acciones.secundaria, ['Cancelar'], 'diálogo de eliminar categoría (secundaria)');
      expect(acciones.primaria).toEqual([]);
    });

    test('H1-E6: el diálogo de desactivar un miembro tiene "Desactivar" destructiva y "Cancelar" secundaria', async ({
      page,
    }) => {
      await ingresar(page, USUARIOS.admin, '/equipo');

      await page.getByRole('button', { name: new RegExp(`^Desactivar ${USUARIOS.editora.nombre}`) }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      const acciones = await accionesPorNivel(page);

      verificarNivel(acciones.peligro, ['Desactivar'], 'diálogo de desactivar (peligro)');
      verificarNivel(acciones.secundaria, ['Cancelar'], 'diálogo de desactivar (secundaria)');
      expect(acciones.primaria).toEqual([]);
    });

    test('H1-E4: el aviso de conflicto y su diálogo: "Reemplazar" es destructiva y "Ver la versión vigente" secundaria', async ({
      browser,
    }) => {
      const { primera, segunda } = await dosPersonasEnElMismoArticulo(browser);
      await primera.page.getByLabel('Título', { exact: true }).fill(titulo('conflicto primera'));
      await guardarYEsperar(primera.page);
      await segunda.page.getByLabel('Título', { exact: true }).fill(titulo('conflicto segunda'));
      await barraDelEditor(segunda.page).getByRole('button', { name: 'Guardar', exact: true }).click();
      const aviso = segunda.page.getByRole('alert').filter({ hasText: 'Alguien guardó cambios más nuevos' });
      await expect(aviso).toBeVisible();

      const delAviso = await accionesPorNivel(aviso);
      verificarNivel(delAviso.secundaria, ['Ver la versión vigente'], 'aviso de conflicto (secundaria)');
      verificarNivel(delAviso.peligro, ['Reemplazar con la vigente'], 'aviso de conflicto (peligro)');
      expect(delAviso.primaria).toEqual([]);

      await aviso.getByRole('button', { name: 'Reemplazar con la vigente' }).click();
      await expect(segunda.page.getByRole('alertdialog')).toBeVisible();
      const delDialogo = await accionesPorNivel(segunda.page);
      verificarNivel(
        delDialogo.peligro,
        ['Reemplazar con la vigente', 'Reemplazar'].map((t) => new RegExp(`^${t}`)),
        'diálogo de reemplazar (peligro)',
      );
      verificarNivel(delDialogo.secundaria, ['Cancelar'], 'diálogo de reemplazar (secundaria)');
      expect(delDialogo.primaria).toEqual([]);

      await primera.contexto.close();
      await segunda.contexto.close();
    });
  });
});

/** Dos personas distintas con el mismo borrador abierto (para provocar el conflicto de versión). */
async function dosPersonasEnElMismoArticulo(browser: Browser) {
  const articulo = await sembrarEn('borrador', 'conflicto');
  const abrir = async (usuario: (typeof USUARIOS)[keyof typeof USUARIOS]) => {
    const contexto = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      viewport: { width: 1440, height: 900 },
    });
    const page = await contexto.newPage();
    await ingresar(page, usuario, `/articulos/${articulo.id}`);
    await esperarEditorListo(page);
    return { contexto, page };
  };
  return { articulo, primera: await abrir(USUARIOS.editor), segunda: await abrir(USUARIOS.editora) };
}

// =====================================================================================================================
// T016 — Foco al cambiar de estado (research D11)
// =====================================================================================================================

test.describe('Foco al cambiar de estado', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('D11: publicar un borrador desde la barra deja el foco en la nueva principal y se anuncia', async ({ page }) => {
    await abrirEditor(page, 'borrador', 'foco publicar');

    await botonDeEstado(page, 'Publicar').click();

    await esperarEstado(page, 'publicado');
    await expect(page.getByRole('status').filter({ hasText: 'El artículo se publicó' })).toBeAttached();
    const principal = barraDelEditor(page).locator('[data-nivel="primaria"]');
    await expect(principal).toHaveCount(1);
    await expect(principal).toBeFocused(); // el botón "Publicar" desapareció: el foco no queda en <body>
  });

  test('D11: cancelar el diálogo de programar devuelve el foco a "Programar"', async ({ page }) => {
    await abrirEditor(page, 'borrador', 'foco cancelar');

    await abrirDialogoProgramar(page);
    await expect(campoFechaProgramada(page)).toBeFocused();
    await dialogoProgramar(page).getByRole('button', { name: 'Cancelar', exact: true }).click();

    await expect(dialogoProgramar(page)).toHaveCount(0);
    await expect(botonDeEstado(page, 'Programar')).toBeFocused();
  });

  test('D11: programar con una fecha futura se anuncia y deja el foco en una acción de la barra', async ({ page }) => {
    await abrirEditor(page, 'borrador', 'foco programar');

    await abrirDialogoProgramar(page);
    await campoFechaProgramada(page).fill(fechaFutura(60 * 24));
    await botonConfirmarProgramar(page).click();

    await esperarEstado(page, 'programado');
    await expect(page.getByRole('status').filter({ hasText: 'El artículo quedó programado' })).toBeAttached();
    await expect(barraDelEditor(page).locator(':focus')).toHaveCount(1);
  });

  test('D11: archivar un publicado lleva el foco a una acción de la barra (no a <body>)', async ({ page }) => {
    await abrirEditor(page, 'publicado', 'foco archivar');

    await botonDeEstado(page, 'Archivar').click();

    await esperarEstado(page, 'archivado');
    await expect(barraDelEditor(page).locator(':focus')).toHaveCount(1);
  });

  test('D11: eliminar (admin) confirma y navega a la lista', async ({ page }) => {
    await abrirEditor(page, 'borrador', 'foco eliminar');

    await botonDeEstado(page, 'Eliminar').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(page).toHaveURL(/\/articulos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Artículos' })).toBeVisible();
  });
});

// =====================================================================================================================
// T031 — Botones parejos (CE-003, H2 esc. 1 a 3 y 6)
// =====================================================================================================================

test.describe('Botones parejos', () => {
  for (const pantalla of PANTALLAS) {
    test(`CE-003 (H2-E1): en ${pantalla.nombre}, los botones de cada grupo miden y se alinean igual y tienen 44 × 44 px a 360, 768, 1024 y 1440 px`, async ({
      page,
    }) => {
      test.slow();
      await abrirPantalla(page, pantalla);

      for (const ancho of ANCHOS) {
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.waitForTimeout(200);

        expect(await gruposDesalineados(page), `botones desalineados o de distinta altura a ${ancho} px`).toEqual([]);
        expect(await controlesBajoElMinimo(page), `controles menores que 44 × 44 px a ${ancho} px`).toEqual([]);
      }
    });
  }

  test.describe('Alineación con los campos (H2 esc. 2)', () => {
    for (const ancho of ANCHOS) {
      test(`H2-E2: "Filtrar" queda alineado con los campos de filtro y no con sus etiquetas a ${ancho} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: ancho, height: 900 });
        await ingresar(page, USUARIOS.editor, `/articulos?q=${PREFIJO}`);
        const filtrar = page.getByRole('button', { name: 'Filtrar', exact: true });
        const campos = [
          page.getByLabel('Estado', { exact: true }),
          page.getByLabel('Categoría', { exact: true }),
          page.getByLabel('Autor', { exact: true }),
          page.getByLabel('Buscar por título'),
        ];

        let enLaMismaFila = 0;
        for (const campo of campos) {
          const [cajaBoton, cajaCampo] = [(await filtrar.boundingBox())!, (await campo.boundingBox())!];
          const solape =
            Math.min(cajaBoton.y + cajaBoton.height, cajaCampo.y + cajaCampo.height) -
            Math.max(cajaBoton.y, cajaCampo.y);
          if (solape <= 0) continue;
          enLaMismaFila += 1;
          expect(await estaAlineado(filtrar, campo), 'el botón y el campo comparten borde superior e inferior').toBe(
            true,
          );
        }
        // Desde 1024 px los filtros van en una sola fila: el botón tiene que compartirla con los campos.
        if (ancho >= 1024) expect(enLaMismaFila).toBeGreaterThan(0);
      });
    }

    test('H2-E2: "Crear categoría" queda alineado con el campo que tiene al lado, si lo tiene', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await ingresar(page, USUARIOS.editor, '/categorias');
      const crear = page.getByRole('button', { name: 'Crear categoría', exact: true });
      const campos = page
        .getByRole('form', { name: 'Nueva categoría', exact: true })
        .locator('input, textarea, select');

      for (let i = 0; i < (await campos.count()); i += 1) {
        const [cajaBoton, cajaCampo] = [(await crear.boundingBox())!, (await campos.nth(i).boundingBox())!];
        const solape =
          Math.min(cajaBoton.y + cajaBoton.height, cajaCampo.y + cajaCampo.height) - Math.max(cajaBoton.y, cajaCampo.y);
        if (solape > 0) expect(await estaAlineado(crear, campos.nth(i)), `alineado con el campo ${i + 1}`).toBe(true);
      }
    });
  });

  test.describe('Tamaño compacto en las filas (H2 esc. 3)', () => {
    for (const [ruta, usuario] of [
      ['/categorias', 'editor'],
      ['/etiquetas', 'editor'],
      ['/equipo', 'admin'],
    ] as const) {
      test(`H2-E3: todas las acciones de las filas de ${ruta} son compactas y de 44 px`, async ({ page }) => {
        await ingresar(page, USUARIOS[usuario], ruta);
        const deFila = page.getByRole('row').locator('[data-nivel]:visible');
        const cantidad = await deFila.count();
        test.skip(
          cantidad === 0 && ruta === '/etiquetas',
          'no hay etiquetas cargadas: sus filas se cubren en categorías',
        );

        expect(cantidad).toBeGreaterThan(0);
        for (let i = 0; i < cantidad; i += 1) {
          await expect(deFila.nth(i)).toHaveAttribute('data-tamanio', 'compacto');
          expect((await areaTactil(deFila.nth(i))).ok, `área táctil de la acción ${i + 1}`).toBe(true);
        }
      });
    }

    test('H2-E3: el selector de rol del equipo tiene la misma altura que los botones de su fila', async ({ page }) => {
      await ingresar(page, USUARIOS.admin, '/equipo');
      const fila = page.getByRole('row').filter({ hasText: USUARIOS.editora.correo });
      const selector = fila.getByLabel(`Rol de ${USUARIOS.editora.nombre}`, { exact: true });
      const botones = await alturasDelGrupo(fila);

      const altoSelector = (await selector.boundingBox())!.height;

      expect(botones.length).toBeGreaterThan(0);
      for (const alto of botones) expect(Math.abs(alto - altoSelector)).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Ocupado conserva el ancho (H2 esc. 6)', () => {
    /** Demora las Server Actions para poder medir el botón mientras está ocupado. */
    async function demorarAcciones(page: Page) {
      await page.route('**/*', async (route) => {
        if (route.request().headers()['next-action']) await new Promise((resolver) => setTimeout(resolver, 2_000));
        await route.continue();
      });
    }

    test('H2-E6: al guardar en el editor, "Guardar" ocupado conserva el ancho y anuncia "Guardando…"', async ({
      page,
    }) => {
      await ingresar(page, USUARIOS.editor, '/articulos/nuevo');
      await esperarEditorListo(page);
      await page.getByLabel('Título', { exact: true }).fill(titulo('ocupado editor'));
      const guardar = barraDelEditor(page).locator('[data-nivel="primaria"]');
      const antes = await anchoDe(guardar);
      await demorarAcciones(page);

      await guardar.click();

      await expect(guardar.getByRole('status')).toHaveText(/Guardando/);
      await expect(guardar).toHaveAttribute('aria-disabled', 'true');
      expect(await anchoDe(guardar)).toBeCloseTo(antes, 0);
    });

    test('H2-E6: al guardar el perfil, "Guardar perfil" ocupado conserva el ancho', async ({ page }) => {
      const miembro = await crearMiembro(nombreDePrueba('je-perfil'));
      miembros.push(miembro);
      await ingresar(page, miembro, '/perfil');
      await expect(page.locator('[data-perfil="listo"]')).toBeVisible();
      await page.getByLabel('Biografía', { exact: true }).fill('Biografía de la prueba de jerarquía');
      const guardar = page.locator('[data-nivel="primaria"]');
      const antes = await anchoDe(guardar);
      await demorarAcciones(page);

      await guardar.click();

      await expect(guardar.getByRole('status')).toHaveText(/Guardando/);
      expect(await anchoDe(guardar)).toBeCloseTo(antes, 0);
    });
  });
});

// =====================================================================================================================
// T032 — Barra del editor angosta (RF-019, H2 esc. 4)
// =====================================================================================================================

test.describe('Barra del editor angosta', () => {
  type CasoAngosto = {
    estado: EstadoDelCaso;
    enBarra: string[];
    enMenu: string[];
    enLinea: string[];
  };
  // data-model.md, "Barra del editor": qué queda en la barra a 360 px, qué va a "Más acciones" y qué se ve en línea desde 768 px.
  const CASOS: CasoAngosto[] = [
    { estado: 'nuevo', enBarra: ['Guardar'], enMenu: [], enLinea: ['Guardar'] },
    {
      estado: 'borrador',
      enBarra: ['Guardar', 'Publicar'],
      enMenu: ['Programar', 'Vista previa', 'Eliminar'],
      enLinea: ['Guardar', 'Publicar', 'Programar', 'Vista previa', 'Eliminar'],
    },
    {
      estado: 'programado',
      enBarra: ['Guardar', 'Publicar'],
      enMenu: ['Cancelar programación', 'Vista previa', 'Eliminar'],
      enLinea: ['Guardar', 'Publicar', 'Cancelar programación', 'Vista previa', 'Eliminar'],
    },
    {
      estado: 'publicado',
      enBarra: ['Guardar', 'Volver a borrador'],
      enMenu: ['Archivar', 'Vista previa', 'Eliminar'],
      enLinea: ['Guardar', 'Volver a borrador', 'Archivar', 'Vista previa', 'Eliminar'],
    },
    {
      estado: 'archivado',
      enBarra: ['Guardar', 'Volver a borrador'],
      enMenu: ['Vista previa', 'Eliminar'],
      enLinea: ['Guardar', 'Volver a borrador', 'Vista previa', 'Eliminar'],
    },
  ];

  test.describe('a 360 px', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    for (const caso of CASOS) {
      test(`H2-E4: ${caso.estado}: la barra ocupa una línea con ${caso.enBarra.join(' y ')}${caso.enMenu.length > 0 ? ' y "Más acciones"' : ''}`, async ({
        page,
      }) => {
        await abrirEditor(page, caso.estado, `angosto ${caso.estado}`);
        const barra = barraDelEditor(page);

        expect(await ocupaUnaLinea(barra), 'todas las acciones visibles comparten línea').toBe(true);
        const visibles = await nombresVisibles(barra);
        expect(visibles).toEqual(caso.enMenu.length > 0 ? [...caso.enBarra, 'Más acciones'] : caso.enBarra);
        if (caso.enMenu.length === 0) await expect(botonMasAcciones(page)).toHaveCount(0);
      });
    }

    test('RF-019: "Más acciones" anuncia su estado y apunta al panel con aria-expanded y aria-controls', async ({
      page,
    }) => {
      await abrirEditor(page, 'borrador', 'mas acciones aria');
      const mas = botonMasAcciones(page);

      await expect(mas).toHaveAttribute('aria-expanded', 'false');
      const idPanel = (await mas.getAttribute('aria-controls'))!;
      expect(idPanel).toBeTruthy();
      await expect(page.locator(`[id="${idPanel}"]`)).toBeHidden();

      await mas.click();

      await expect(mas).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(`[id="${idPanel}"]`)).toBeVisible();
    });

    for (const caso of CASOS.filter((c) => c.enMenu.length > 0)) {
      test(`H2-E4: ${caso.estado}: el menú trae ${caso.enMenu.join(', ')}, con "Eliminar" al final tras un separador`, async ({
        page,
      }) => {
        await abrirEditor(page, caso.estado, `menu ${caso.estado}`);
        const mas = botonMasAcciones(page);
        await mas.click();
        const panel = page.locator(`[id="${(await mas.getAttribute('aria-controls'))!}"]`);

        expect(await nombresVisibles(panel)).toEqual(caso.enMenu);
        const separador = panel.locator('[role="separator"], hr');
        await expect(separador).toHaveCount(1);
        const cajaSeparador = (await separador.boundingBox())!;
        const cajaEliminar = (await panel.getByRole('button', { name: 'Eliminar', exact: true }).boundingBox())!;
        const cajaPrevia = (await panel
          .locator('[data-nivel]:visible')
          .nth(caso.enMenu.length - 2)
          .boundingBox())!;
        expect(cajaSeparador.y).toBeGreaterThan(cajaPrevia.y);
        expect(cajaEliminar.y).toBeGreaterThan(cajaSeparador.y);
      });
    }

    test('RF-019: se abre con Enter, se recorre con Tab y Esc lo cierra devolviendo el foco', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'menu teclado');
      const mas = botonMasAcciones(page);

      await mas.focus();
      await page.keyboard.press('Enter');
      await expect(mas).toHaveAttribute('aria-expanded', 'true');
      const panel = page.locator(`[id="${(await mas.getAttribute('aria-controls'))!}"]`);
      await page.keyboard.press('Tab');
      await expect(panel.locator('[data-nivel]:visible').first()).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(panel.locator('[data-nivel]:visible').nth(1)).toBeFocused();

      await page.keyboard.press('Escape');

      await expect(mas).toHaveAttribute('aria-expanded', 'false');
      await expect(mas).toBeFocused();
    });

    test('RF-019: el clic afuera cierra el menú', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'menu clic afuera');
      const mas = botonMasAcciones(page);
      await mas.click();
      await expect(mas).toHaveAttribute('aria-expanded', 'true');

      await page.getByRole('heading', { level: 1 }).click();

      await expect(mas).toHaveAttribute('aria-expanded', 'false');
    });

    test('D11: "Programar" desde el menú abre el diálogo y, al cancelar, el foco vuelve a "Más acciones"', async ({
      page,
    }) => {
      await abrirEditor(page, 'borrador', 'menu programar');
      const mas = botonMasAcciones(page);
      await mas.click();

      await page
        .locator(`[id="${(await mas.getAttribute('aria-controls'))!}"]`)
        .getByRole('button', { name: 'Programar', exact: true })
        .click();
      await expect(dialogoProgramar(page)).toBeVisible();
      await dialogoProgramar(page).getByRole('button', { name: 'Cancelar', exact: true }).click();

      await expect(dialogoProgramar(page)).toHaveCount(0);
      await expect(mas).toBeFocused();
    });
  });

  for (const ancho of [768, 1024, 1440]) {
    test.describe(`a ${ancho} px`, () => {
      test.use({ viewport: { width: ancho, height: 900 } });

      for (const caso of CASOS) {
        test(`RF-019: ${caso.estado}: se ven todas las acciones en línea y no hay "Más acciones"`, async ({ page }) => {
          await abrirEditor(page, caso.estado, `ancho ${ancho} ${caso.estado}`);
          const barra = barraDelEditor(page);

          expect(await nombresVisibles(barra)).toEqual(caso.enLinea);
          await expect(botonMasAcciones(page)).toBeHidden();
          expect(await ocupaUnaLinea(barra), `la barra ocupa una línea a ${ancho} px`).toBe(true);
        });
      }
    });
  }
});

// =====================================================================================================================
// T033 — Orden y casos borde (H2 esc. 5, RF-008, RF-009)
// =====================================================================================================================

test.describe('Orden y casos borde', () => {
  test.describe('a 360 px, fuera del editor', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    for (const pantalla of PANTALLAS.filter((p) => !/artículo nuevo|10 bloques|vista previa/.test(p.nombre))) {
      test(`H2-E5: en ${pantalla.nombre} las acciones se reacomodan sin cortarse ni superponerse`, async ({ page }) => {
        await abrirPantalla(page, pantalla);

        expect(await accionesSuperpuestasOCortadas(page)).toEqual([]);
        const medidas = await page.evaluate(() => ({
          desplazable: document.documentElement.scrollWidth,
          visible: document.documentElement.clientWidth,
        }));
        expect(medidas.desplazable).toBeLessThanOrEqual(medidas.visible);
      });
    }

    test('H2-E5: en la lista, la acción principal ("Nuevo artículo") es la primera que se encuentra al recorrer con el teclado', async ({
      page,
    }) => {
      await ingresar(page, USUARIOS.editor, `/articulos?q=${PREFIJO}`);

      const primera = await page
        .locator('main [data-nivel]:visible')
        .first()
        .evaluate((el) => el.textContent?.trim());

      expect(primera).toBe('Nuevo artículo');
    });

    test('RF-009: en un diálogo "Cancelar" va antes que la confirmación en el DOM y a la izquierda, sin cortes', async ({
      page,
    }) => {
      await abrirEditor(page, 'borrador', 'angosto dialogo');
      await botonMasAcciones(page).click();
      await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
      const dialogo = page.getByRole('alertdialog');
      await expect(dialogo).toBeVisible();

      const nombres = await nombresVisibles(dialogo);

      expect(nombres).toEqual(['Cancelar', 'Eliminar']);
      expect(await accionesSuperpuestasOCortadas(page)).toEqual([]);
      const [cancelar, eliminar] = [
        (await dialogo.getByRole('button', { name: 'Cancelar' }).boundingBox())!,
        (await dialogo.getByRole('button', { name: 'Eliminar', exact: true }).boundingBox())!,
      ];
      expect(cancelar.x, 'la confirmación queda a la derecha').toBeLessThan(eliminar.x);
    });
  });

  test.describe('Textos de las filas', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    test('RF-017: "Reenviar invitación" muestra texto corto y conserva el nombre accesible completo', async ({
      page,
    }) => {
      await ingresar(page, USUARIOS.admin, '/equipo');
      const completo = page.getByRole('button', { name: `Reenviar invitación a ${nombreInvitado}`, exact: true });

      await expect(completo).toBeVisible();
      await expect(completo.locator('.sr-only')).toHaveText(new RegExp(nombreInvitado));
      const visible = await completo.evaluate((boton) =>
        [...boton.childNodes]
          .filter((nodo) => !(nodo instanceof HTMLElement && nodo.classList.contains('sr-only')))
          .map((nodo) => nodo.textContent)
          .join('')
          .trim(),
      );
      expect(visible).toBe('Reenviar invitación');
    });

    test('RF-017: "Editar" y "Eliminar" de las categorías llevan el nombre como sufijo sr-only', async ({ page }) => {
      await ingresar(page, USUARIOS.editor, '/categorias');
      for (const accion of ['Editar', 'Eliminar']) {
        const boton = page.getByRole('button', { name: new RegExp(`^${accion} .+`) }).first();

        await expect(boton.locator('.sr-only')).toHaveCount(1);
        expect(((await boton.locator('.sr-only').textContent()) ?? '').trim().length).toBeGreaterThan(0);
        expect(await boton.evaluate((el) => (el.firstChild?.textContent ?? '').trim())).toBe(accion);
      }
    });
  });

  test.describe('Zoom al 200 % (viewport de 720 px a escala 2)', () => {
    // Un navegador de 720 px de ancho con el zoom al 200 % ofrece 360 px de CSS.
    test.use({ viewport: { width: 360, height: 450 }, deviceScaleFactor: 2 });

    test('los grupos del editor no se salen de la pantalla ni se superponen', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'zoom grupos');

      expect(await accionesSuperpuestasOCortadas(page)).toEqual([]);
      const medidas = await page.evaluate(() => ({
        desplazable: document.documentElement.scrollWidth,
        visible: document.documentElement.clientWidth,
      }));
      expect(medidas.desplazable).toBeLessThanOrEqual(medidas.visible);
    });

    test('el panel de "Más acciones" cabe en la pantalla y se puede desplazar', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'zoom menu');
      const mas = botonMasAcciones(page);
      await mas.click();
      const panel = page.locator(`[id="${(await mas.getAttribute('aria-controls'))!}"]`);

      const estilo = await panel.evaluate((el) => {
        const { overflowY, maxHeight } = getComputedStyle(el);
        const caja = el.getBoundingClientRect();
        return { overflowY, maxHeight, arriba: caja.top, abajo: caja.bottom, alto: window.innerHeight };
      });

      expect(estilo.overflowY, 'desplazamiento propio').toMatch(/auto|scroll/);
      expect(estilo.maxHeight, 'altura máxima').not.toBe('none');
      expect(estilo.arriba).toBeGreaterThanOrEqual(0);
      expect(estilo.abajo).toBeLessThanOrEqual(estilo.alto);
    });
  });
});

// =====================================================================================================================
// T046 — Estructura (H3 esc. 1 a 4)
// =====================================================================================================================

test.describe('Estructura', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const SIN_VISTA_PREVIA = PANTALLAS.filter((p) => !/vista previa/.test(p.nombre));

  for (const pantalla of SIN_VISTA_PREVIA) {
    test(`H3-E1 (RF-011): ${pantalla.nombre} tiene un único h1 dentro de un encabezado`, async ({ page }) => {
      await abrirPantalla(page, pantalla);

      await expect(page.locator('h1:visible')).toHaveCount(1);
      await expect(page.locator('main header').filter({ has: page.locator('h1') })).toHaveCount(1);
    });
  }

  test.describe('Ubicación de la acción principal (columna "Ubic." de la matriz)', () => {
    test('E: en la lista, "Nuevo artículo" está en el encabezado', async ({ page }) => {
      await ingresar(page, USUARIOS.editor, `/articulos?q=${PREFIJO}`);
      const encabezado = page.locator('main header').filter({ has: page.locator('h1') });

      await expect(encabezado.locator('[data-nivel="primaria"]')).toHaveText('Nuevo artículo');
    });

    for (const [nombre, ruta, usuario, boton] of [
      ['el ingreso', '/ingreso', null, 'Ingresar'],
      ['la recuperación', '/olvide-contrasena', null, 'Enviar enlace'],
      ['las categorías', '/categorias', 'editor', 'Crear categoría'],
      ['las etiquetas', '/etiquetas', 'editor', 'Crear etiqueta'],
      ['el equipo', '/equipo', 'admin', 'Enviar invitación'],
      ['el perfil', '/perfil', 'editor', 'Guardar perfil'],
    ] as const) {
      test(`F: en ${nombre}, "${boton}" es el envío de un formulario y va después de sus campos`, async ({ page }) => {
        if (usuario) await ingresar(page, USUARIOS[usuario], ruta);
        else await page.goto(ruta);
        const principal = page.locator('[data-nivel="primaria"]');
        await expect(principal).toHaveCount(1);
        await expect(principal).toHaveText(boton);

        const camposDespues = await principal.evaluate((el) => {
          const formulario = el.closest('form');
          if (!formulario) return ['(no está dentro de un formulario)'];
          return [...formulario.querySelectorAll('input:not([type="hidden"]):not([type="file"]), select, textarea')]
            .filter((campo) => !!(el.compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_FOLLOWING))
            .map((campo) => campo.id || campo.getAttribute('name') || campo.tagName);
        });
        expect(camposDespues, 'campos del formulario que quedan después del botón de envío').toEqual([]);
      });
    }

    test('B: en el editor, la principal está en la barra fija', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'ubicacion barra');

      await expect(barraDelEditor(page).locator('[data-nivel="primaria"]')).toHaveCount(1);
      await expect(page.locator('[data-nivel="primaria"]')).toHaveCount(1);
    });
  });

  test.describe('Secciones: mismo título y más separación entre ellas que dentro', () => {
    const SECCIONES_DEL_EDITOR = ['Contenido', 'Imagen destacada', 'Taxonomías', 'Para buscadores', 'Publicación'];

    test('H3-E2: el editor tiene un h2 por sección', async ({ page }) => {
      await abrirEditor(page, 'borrador', 'secciones h2');

      for (const seccion of SECCIONES_DEL_EDITOR) {
        await expect(page.getByRole('heading', { level: 2, name: seccion, exact: true }), seccion).toBeVisible();
      }
    });

    test('H3-E2: en el editor y en el perfil todos los títulos de sección tienen el mismo tamaño de fuente', async ({
      page,
    }) => {
      const tamanios = new Set<string>();
      await abrirEditor(page, 'borrador', 'secciones tamanio');
      for (const seccion of SECCIONES_DEL_EDITOR) {
        tamanios.add(
          await page
            .getByRole('heading', { level: 2, name: seccion, exact: true })
            .evaluate((el) => getComputedStyle(el).fontSize),
        );
      }
      await page.goto('/perfil');
      await expect(page.locator('[data-perfil="listo"]')).toBeVisible();
      const titulosDelPerfil = page.locator('main h2');
      for (let i = 0; i < (await titulosDelPerfil.count()); i += 1) {
        tamanios.add(await titulosDelPerfil.nth(i).evaluate((el) => getComputedStyle(el).fontSize));
      }

      expect([...tamanios], 'tamaños de fuente distintos entre títulos de sección').toHaveLength(1);
    });

    test('H3-E2 (RF-013): en el editor la separación entre secciones es mayor que la separación dentro de ellas', async ({
      page,
    }) => {
      await abrirEditor(page, 'borrador', 'secciones espacio');

      const medidas = await page.evaluate(() => {
        const visibles = [...document.querySelectorAll<HTMLElement>('main section[aria-labelledby]')].filter(
          (s) =>
            s.getClientRects().length > 0 &&
            document.getElementById(s.getAttribute('aria-labelledby') ?? '')?.tagName === 'H2',
        );
        // Solo las secciones de primer nivel.
        const secciones = visibles.filter((s) => !visibles.some((otra) => otra !== s && otra.contains(s)));
        secciones.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const entre = secciones
          .slice(1)
          .map((s, i) => s.getBoundingClientRect().top - secciones[i]!.getBoundingClientRect().bottom);
        const dentro = secciones.flatMap((s) => {
          const hijos = [...s.children].filter((h) => (h as HTMLElement).getClientRects().length > 0);
          return hijos.slice(1).map((h, i) => h.getBoundingClientRect().top - hijos[i]!.getBoundingClientRect().bottom);
        });
        return { cantidad: secciones.length, entre, dentro };
      });

      expect(medidas.cantidad, 'secciones con h2 en el editor').toBeGreaterThanOrEqual(4);
      expect(Math.min(...medidas.entre)).toBeGreaterThan(Math.max(...medidas.dentro));
    });
  });

  test.describe('Estados vacíos con el mismo componente (RF-014)', () => {
    test('H3-E3: la lista sin resultados usa EstadoVacio', async ({ page }) => {
      await ingresar(page, USUARIOS.editor, `/articulos?q=${PREFIJO}que-no-existe`);

      await expect(page.locator('[data-estado="vacio"]')).toBeVisible();
      await expect(page.locator('[data-estado="vacio"]').getByRole('link', { name: 'Quitar filtros' })).toBeVisible();
    });

    for (const [ruta, usuario] of [
      ['/categorias', 'editor'],
      ['/etiquetas', 'editor'],
    ] as const) {
      test(`H3-E3: ${ruta} sin elementos usa EstadoVacio (y con elementos, tabla)`, async ({ page }) => {
        await ingresar(page, USUARIOS[usuario], ruta);
        const hayFilas = (await page.getByRole('row').count()) > 1;
        test.skip(hayFilas, 'hay elementos cargados: el vacío se cubre con la lista y con estructura.test.tsx');

        await expect(page.locator('[data-estado="vacio"]')).toBeVisible();
      });
    }
  });

  test('H3-E4 (RF-012): el texto de apoyo tiene el mismo color y tamaño en todas las pantallas', async ({ page }) => {
    test.slow();
    await ingresar(page, USUARIOS.admin);
    const estilos = new Map<string, string[]>();
    for (const pantalla of PANTALLAS.filter((p) => p.usuario !== null && !/vista previa/.test(p.nombre))) {
      await page.goto(pantalla.ruta());
      await pantalla.listo?.(page);
      const encontrados = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main .text-texto-suave')]
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => `${getComputedStyle(el).color} / ${getComputedStyle(el).fontSize}`),
      );
      for (const estilo of encontrados) estilos.set(estilo, [...(estilos.get(estilo) ?? []), pantalla.nombre]);
    }

    expect(estilos.size, 'debe haber texto de apoyo en las pantallas').toBeGreaterThan(0);
    expect(
      [...estilos.entries()].map(([estilo, donde]) => `${estilo}: ${[...new Set(donde)].join(', ')}`),
      'el texto de apoyo usa más de un color o tamaño',
    ).toHaveLength(1);
  });

  test('H3-E1: el editor y la lista comparten el mismo encabezado (mismo tamaño de título)', async ({ page }) => {
    await ingresar(page, USUARIOS.editor, `/articulos?q=${PREFIJO}`);
    const tamanioLista = await page.locator('main h1').evaluate((el) => getComputedStyle(el).fontSize);

    await page.goto(`/articulos/${(await sembrarEn('borrador', 'encabezado igual')).id}`);
    await esperarEditorListo(page);
    const tamanioEditor = await page.locator('main h1').evaluate((el) => getComputedStyle(el).fontSize);

    expect(tamanioEditor).toBe(tamanioLista);
    await expect(panelPublicacion(page)).toBeVisible();
  });
});
