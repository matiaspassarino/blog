// Cookie con la hora de la última actividad (research D3). El proxy la renueva en cada petición; las
// acciones de ingreso la ponen al abrir la sesión y `/salir` y `cerrarSesion` la borran.
import { cookies } from 'next/headers';
import { COOKIE_ACTIVIDAD, limiteInactividad } from './actividad';

// Dura más que el límite: lo que vence la sesión es la comparación con la hora, no la cookie.
const DURACION_COOKIE_SEGUNDOS = 60 * 60 * 24 * 30;

export async function marcarActividad() {
  (await cookies()).set(COOKIE_ACTIVIDAD, String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.max(DURACION_COOKIE_SEGUNDOS, limiteInactividad / 1000),
  });
}

export async function borrarActividad() {
  (await cookies()).delete(COOKIE_ACTIVIDAD);
}
