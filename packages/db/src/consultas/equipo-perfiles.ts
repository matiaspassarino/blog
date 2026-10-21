// Operaciones sobre perfiles del equipo (contracts/db.md, "Operaciones del equipo"; RF-021 a RF-026).
// Rol y estado solo los cambia el admin (a20_proteger_perfil) y siempre queda un admin
// activo (z10_garantizar_admin): acá solo se traducen los errores.
import type { ClienteBlog } from '../cliente';
import { ErrorDominio, traducirError } from '../errores';
import type { Database } from '../tipos';
import type { RolMiembro } from '../tipos-dominio';
import { validarImagen } from '../validar-imagen';

type Tablas = Database['public']['Tables'];

export type Perfil = Tablas['perfiles']['Row'];
export type CambiosPerfilPropio = Partial<Pick<Perfil, 'nombre' | 'biografia' | 'avatar'>>;

/** El avatar se valida antes de llegar a la base, como la imagen destacada (constitución §VI.4). */
export async function actualizarPerfilPropio(c: ClienteBlog, cambios: CambiosPerfilPropio): Promise<Perfil> {
  const datos = { ...cambios };
  if (cambios.avatar !== undefined && cambios.avatar !== null) {
    const validacion = validarImagen(cambios.avatar, 'avatar');
    if (!validacion.ok) {
      throw new ErrorDominio('contenido_invalido', 'El perfil tiene campos inválidos', {
        errores: validacion.errores,
      });
    }
    datos.avatar = validacion.imagen;
  }

  // La sesión es local (sin petición): solo acota el update a la fila propia; RLS decide igual.
  const { data: sesion } = await c.auth.getSession();
  const id = sesion.session?.user.id;
  if (!id) throw new ErrorDominio('sin_permiso', 'No hay una sesión iniciada');
  return actualizarPerfil(c, id, datos);
}

export function cambiarRol(c: ClienteBlog, perfilId: string, rol: RolMiembro): Promise<Perfil> {
  return actualizarPerfil(c, perfilId, { rol });
}

export function cambiarActivo(c: ClienteBlog, perfilId: string, activo: boolean): Promise<Perfil> {
  return actualizarPerfil(c, perfilId, { activo });
}

async function actualizarPerfil(c: ClienteBlog, id: string, cambios: Tablas['perfiles']['Update']): Promise<Perfil> {
  const { data, error } = await c.from('perfiles').update(cambios).eq('id', id).select().maybeSingle();
  if (error) throw traducirError(error);
  // RLS filtra en silencio: sin filas, o no existe o no hay permiso para editarlo.
  if (!data) throw new ErrorDominio('no_encontrado', 'El perfil no existe o no se puede editar');
  return data;
}
