'use server';

// Acciones de acceso: ingreso, cierre de sesión, recuperación y definición de contraseña
// (contracts/acciones.md, "Acceso"). Son las acciones anónimas de la tabla de permisos: ninguna exige
// sesión salvo `definirContrasena`, que la abre `confirmarEnlace`. Todas sirven a `useActionState`.
import { obtenerPerfilPropio } from '@blog/db';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { borrarActividad, marcarActividad } from '../lib/cookie-actividad';
import { entornoUrlAdmin } from '../lib/entorno';
import { envolverAccion, exito, fallo, type ResultadoAccion } from '../lib/resultado';
import { crearClienteDeSesion } from '../lib/supabase';
import { rutaInterna } from '../lib/volver';

/** Largo mínimo de una contraseña (RF-028); Auth lo exige igual con `minimum_password_length`. */
const LARGO_MINIMO = 8;

const esquemaIngreso = z.object({
  correo: z.string().trim().min(1),
  contrasenia: z.string().min(1),
  volver: z.string().optional(),
});

/** Estado de `useActionState`: nada antes de enviar, o el resultado de la última vez. */
type Estado = ResultadoAccion<unknown> | null;

const texto = (datos: FormData, campo: string) => {
  const valor = datos.get(campo);
  return typeof valor === 'string' ? valor : '';
};

export async function ingresar(_estado: Estado, datos: FormData): Promise<ResultadoAccion<never>> {
  return envolverAccion(async () => {
    const entrada = esquemaIngreso.safeParse({
      correo: texto(datos, 'correo'),
      contrasenia: texto(datos, 'contrasenia'),
      volver: texto(datos, 'volver') || undefined,
    });
    // Un formulario vacío da el mismo mensaje que uno equivocado: no se revela qué falló (H1-E2).
    if (!entrada.success) return fallo('credenciales_invalidas');

    const cliente = await crearClienteDeSesion();
    const { data, error } = await cliente.auth.signInWithPassword({
      email: entrada.data.correo,
      password: entrada.data.contrasenia,
    });
    if (error || !data.user) return fallo('credenciales_invalidas');

    // Recién con la contraseña correcta se revela que la cuenta está desactivada (H1-E3).
    const perfil = await obtenerPerfilPropio(cliente, data.user.id);
    if (!perfil?.activo) {
      await cliente.auth.signOut();
      return fallo('cuenta_desactivada');
    }

    await marcarActividad();
    redirect(rutaInterna(entrada.data.volver));
  }) as Promise<ResultadoAccion<never>>;
}

export async function cerrarSesion(): Promise<never> {
  const cliente = await crearClienteDeSesion();
  await cliente.auth.signOut();
  await borrarActividad();
  redirect('/ingreso');
}

const esquemaCorreo = z.object({ correo: z.email() });

/** Responde lo mismo exista o no el correo, para no revelar quién es parte del equipo (RF-026). */
export async function pedirRecuperacion(_estado: Estado, datos: FormData): Promise<ResultadoAccion<{ enviado: true }>> {
  return envolverAccion(async () => {
    const entrada = esquemaCorreo.safeParse({ correo: texto(datos, 'correo').trim() });
    if (!entrada.success) return fallo('validacion', { detalle: 'Escribe un correo válido.' });

    const cliente = await crearClienteDeSesion();
    // El resultado se ignora a propósito: un error de Auth (límite de envíos, correo inexistente) no
    // debe distinguirse de un envío correcto.
    await cliente.auth.resetPasswordForEmail(entrada.data.correo, {
      redirectTo: `${entornoUrlAdmin()}/auth/confirmar`,
    });
    return exito({ enviado: true as const });
  });
}

const esquemaEnlace = z.object({ tokenHash: z.string().min(1), tipo: z.enum(['invite', 'recovery']) });

/** Canjea el enlace del correo, que sirve una sola vez (RF-026, RF-027), y abre la sesión. */
export async function confirmarEnlace(_estado: Estado, datos: FormData): Promise<ResultadoAccion<never>> {
  return envolverAccion(async () => {
    const entrada = esquemaEnlace.safeParse({ tokenHash: texto(datos, 'tokenHash'), tipo: texto(datos, 'tipo') });
    if (!entrada.success) return fallo('enlace_invalido');

    const cliente = await crearClienteDeSesion();
    const { error } = await cliente.auth.verifyOtp({ token_hash: entrada.data.tokenHash, type: entrada.data.tipo });
    if (error) return fallo('enlace_invalido');

    await marcarActividad();
    redirect('/definir-contrasena');
  }) as Promise<ResultadoAccion<never>>;
}

export async function definirContrasena(_estado: Estado, datos: FormData): Promise<ResultadoAccion<never>> {
  return envolverAccion(async () => {
    const cliente = await crearClienteDeSesion();
    const { data } = await cliente.auth.getClaims();
    if (!data?.claims.sub) return fallo('no_autenticado', { motivo: 'sin_sesion' });

    const contrasenia = texto(datos, 'contrasenia');
    if (contrasenia.length < LARGO_MINIMO) return fallo('contrasenia_corta');
    if (contrasenia !== texto(datos, 'repetir')) return fallo('no_coinciden');

    const { error } = await cliente.auth.updateUser({ password: contrasenia });
    if (error) {
      if (/different from the old password|same_password/i.test(`${error.code} ${error.message}`)) {
        return fallo('validacion', { detalle: 'Elige una contraseña distinta de la anterior.' });
      }
      return fallo('desconocido');
    }

    // Si la cuenta está desactivada, `exigirMiembro` la expulsa en la pantalla siguiente (casos borde).
    redirect('/articulos');
  }) as Promise<ResultadoAccion<never>>;
}
