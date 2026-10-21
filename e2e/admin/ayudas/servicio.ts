// Cliente de servicio para preparar y limpiar datos de los E2E. Solo tests (no viola constitucion.md
// §III.4: nunca llega al navegador). Se importa por ruta relativa porque @blog/db/pruebas usa `inject`
// de Vitest y no sirve bajo Playwright (spec 003, T008).
import { crearClienteAdmin } from '../../../packages/db/src/servicio';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:56321';

function servicio() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY (de `supabase status`) para los E2E del panel');
  return crearClienteAdmin(URL, clave);
}

export type MiembroDePrueba = {
  id: string;
  correo: string;
  contrasenia: string;
  desactivar(): Promise<void>;
  eliminar(): Promise<void>;
};

/** Miembro (editor activo y confirmado) con correo único; `eliminar` lo borra junto con su perfil. */
export async function crearMiembro(nombre: string, rol: 'editor' | 'admin' = 'editor'): Promise<MiembroDePrueba> {
  const s = servicio();
  const correo = `e2e-${crypto.randomUUID().slice(0, 8)}@demo.local`;
  const contrasenia = `e2e-${crypto.randomUUID()}`;
  const { data, error } = await s.auth.admin.createUser({
    email: correo,
    password: contrasenia,
    email_confirm: true,
    user_metadata: { nombre },
    app_metadata: { rol },
  });
  if (error || !data.user) throw new Error(`No se pudo crear el miembro de prueba: ${error?.message}`);
  const id = data.user.id;
  await s.from('perfiles').update({ activo: true }).eq('id', id);
  return {
    id,
    correo,
    contrasenia,
    async desactivar() {
      await s.from('perfiles').update({ activo: false }).eq('id', id);
    },
    async eliminar() {
      await s.from('articulos').delete().eq('autor_id', id);
      await s.from('perfiles').delete().eq('id', id);
      await s.auth.admin.deleteUser(id);
    },
  };
}

/** Borra cuentas por correo (las creadas por una invitación de los E2E). */
export async function eliminarPorCorreo(correo: string) {
  const s = servicio();
  const { data } = await s.auth.admin.listUsers({ perPage: 200 });
  const usuario = data.users.find((u) => u.email === correo);
  if (!usuario) return;
  await s.from('articulos').delete().eq('autor_id', usuario.id);
  await s.from('perfiles').delete().eq('id', usuario.id);
  await s.auth.admin.deleteUser(usuario.id);
}

/** Borra los artículos, categorías y etiquetas creados por los E2E (prefijo `e2e-`). */
export async function limpiarDatosE2E() {
  const s = servicio();
  await s.from('articulos').delete().like('titulo', 'e2e-%');
  await s.from('categorias').delete().like('nombre', 'e2e-%');
  await s.from('etiquetas').delete().like('nombre', 'e2e-%');
}
