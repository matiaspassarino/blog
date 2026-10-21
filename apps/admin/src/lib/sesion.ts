// Capa de acceso a la sesión del panel (research D2 de la spec 003). La autorización real vive aquí y
// en la base (RLS): el proxy solo hace comprobaciones baratas. No cierra la sesión por sí misma: al
// renderizar no se pueden escribir cookies; de eso se encarga `/salir`.
import { obtenerPerfilPropio, type RolMiembro } from '@blog/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { COOKIE_ACTIVIDAD, limiteInactividad, sesionVencida } from './actividad';
import { urlDeSalida } from './salir';
import { crearClienteDeSesion } from './supabase';

export type MiembroSesion = { id: string; correo: string; nombre: string; rol: RolMiembro };

export type MotivoSesion = 'sin_sesion' | 'desactivada' | 'inactividad';

export type SesionPanel = { miembro: MiembroSesion; motivo?: undefined } | { miembro: null; motivo: MotivoSesion };

/** Quién usa el panel: verifica el token y lee el perfil (rol y estado) en cada petición. */
export const obtenerMiembro = cache(async (): Promise<SesionPanel> => {
  const cliente = await crearClienteDeSesion();
  const { data, error } = await cliente.auth.getClaims();
  if (error || !data?.claims.sub) return { miembro: null, motivo: 'sin_sesion' };

  // El proxy deja pasar las Server Actions con la sesión vencida (no puede redirigirlas) y no renueva la cookie:
  // el vencimiento se aplica acá, y la interfaz navega a `/salir` con este motivo.
  const ultima = (await cookies()).get(COOKIE_ACTIVIDAD)?.value;
  if (sesionVencida(ultima, Date.now(), limiteInactividad)) return { miembro: null, motivo: 'inactividad' };

  const perfil = await obtenerPerfilPropio(cliente, data.claims.sub);
  // Sin perfil o desactivado: se comporta como anónimo (spec, "Requisitos de permisos").
  if (!perfil || !perfil.activo) return { miembro: null, motivo: 'desactivada' };

  return {
    miembro: { id: perfil.id, correo: String(data.claims.email ?? ''), nombre: perfil.nombre, rol: perfil.rol },
  };
});

/** Para páginas y layouts: redirige al ingreso (o a `/salir` si la cuenta está desactivada). */
export async function exigirMiembro(): Promise<MiembroSesion> {
  const sesion = await obtenerMiembro();
  if (!sesion.miembro) redirect(sesion.motivo === 'sin_sesion' ? '/ingreso' : urlDeSalida(sesion.motivo));
  return sesion.miembro;
}
