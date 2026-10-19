// Clientes Supabase para tests de integración. Solo para tests.
import { inject } from 'vitest';
import { crearClientePublico } from '../cliente';

const entorno = inject('supabase');

/** `describe.skipIf(sinSupabase)` para suites que necesitan la base local. */
export const sinSupabase = entorno === null;

function requerirEntorno() {
  if (!entorno) throw new Error('Supabase local no disponible');
  return entorno;
}

export function clienteAnon() {
  const { url, claveAnon } = requerirEntorno();
  return crearClientePublico(url, claveAnon);
}

/** Cliente con la sesión de un usuario demo (ver quickstart.md, "Usuarios de demo"). */
export async function clienteComo(email: string, contrasenia: string) {
  const cliente = clienteAnon();
  const { error } = await cliente.auth.signInWithPassword({ email, password: contrasenia });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  return cliente;
}

/** Sesiones de los usuarios demo del seed (editor y admin) y el id del editor. */
export async function sesionesDemo() {
  const editor = await clienteComo('editor@demo.local', 'demo-editor-2026');
  const admin = await clienteComo('admin@demo.local', 'demo-admin-2026');
  const { data, error } = await editor.auth.getUser();
  if (error || !data.user) throw new Error('No se pudo obtener el usuario editor');
  return { editor, admin, idEditor: data.user.id };
}

/** Cliente con la clave de servicio: solo para dar de alta y de baja usuarios de prueba. */
function clienteServicio() {
  const { url, claveServicio } = requerirEntorno();
  if (!claveServicio) throw new Error('Falta la clave de servicio de Supabase local (SERVICE_ROLE_KEY)');
  return crearClientePublico(url, claveServicio);
}

/**
 * Crea un miembro del equipo (editor) con su perfil y devuelve su sesión. `eliminar` borra el
 * perfil y el usuario: antes hay que borrar sus artículos (las FK son restrict).
 */
export async function crearMiembroDePrueba(nombre: string) {
  const servicio = clienteServicio();
  const email = `prueba-${crypto.randomUUID().slice(0, 8)}@prueba.local`;
  const contrasenia = `prueba-${crypto.randomUUID()}`;
  const { data, error } = await servicio.auth.admin.createUser({
    email,
    password: contrasenia,
    email_confirm: true,
    user_metadata: { nombre },
    app_metadata: { rol: 'editor' },
  });
  if (error || !data.user) throw new Error(`No se pudo crear el miembro de prueba: ${error?.message}`);
  const id = data.user.id;
  // GoTrue guarda app_metadata después del alta: el trigger crear_perfil no ve el rol y deja el
  // perfil inactivo. El servicio no es un cliente (privado.es_cliente) y puede activarlo.
  const { error: errorActivar } = await servicio.from('perfiles').update({ activo: true }).eq('id', id);
  if (errorActivar) throw new Error(`No se pudo activar el miembro de prueba: ${errorActivar.message}`);
  return {
    id,
    sesion: await clienteComo(email, contrasenia),
    async eliminar() {
      const { error: errorPerfil } = await servicio.from('perfiles').delete().eq('id', id);
      if (errorPerfil) throw new Error(`No se pudo borrar el perfil de prueba: ${errorPerfil.message}`);
      const { error: errorUsuario } = await servicio.auth.admin.deleteUser(id);
      if (errorUsuario) throw new Error(`No se pudo borrar el usuario de prueba: ${errorUsuario.message}`);
    },
  };
}
