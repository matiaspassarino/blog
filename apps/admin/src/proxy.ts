// Proxy del panel (research D2 y D3 de la spec 003): renueva los tokens de la sesión, aplica el
// vencimiento por inactividad y lleva al ingreso a quien no tiene sesión. No autoriza: eso lo hacen
// `obtenerMiembro()` y la base. Next 16 lo llama `proxy` (antes `middleware`).
import { crearClienteServidor } from '@blog/db/servidor';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_ACTIVIDAD, limiteInactividad, sesionVencida } from './lib/actividad';
import { entornoSupabase } from './lib/entorno';

const RUTAS_PUBLICAS = [
  '/ingreso',
  '/olvide-contrasena',
  '/auth/confirmar',
  '/definir-contrasena',
  '/salir',
  '/robots.txt',
];

const esPublica = (ruta: string) =>
  RUTAS_PUBLICAS.some((publica) => ruta === publica || ruta.startsWith(`${publica}/`));

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const cliente = crearClienteServidor({
    ...entornoSupabase(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(lista) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await cliente.auth.getClaims();
  const hayClaims = Boolean(data?.claims.sub);
  const { pathname, search } = request.nextUrl;

  if (!hayClaims && !esPublica(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/ingreso';
    destino.search = `?volver=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(destino);
  }

  if (hayClaims && pathname !== '/salir') {
    const ultima = request.cookies.get(COOKIE_ACTIVIDAD)?.value;
    if (sesionVencida(ultima, Date.now(), limiteInactividad)) {
      // El cierre de sesión lo hace `/salir`, el único lugar donde se pueden borrar las cookies.
      const destino = request.nextUrl.clone();
      destino.pathname = '/salir';
      destino.search = '?motivo=inactividad';
      return NextResponse.redirect(destino);
    }
    // La cookie dura más que el límite: lo que vence la sesión es la comparación, no la cookie.
    respuesta.cookies.set(COOKIE_ACTIVIDAD, String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return respuesta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
