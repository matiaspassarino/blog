// A dónde ir cuando una acción responde `no_autenticado`: `/salir` cierra la sesión (y borra las cookies) y lleva
// al ingreso con el aviso que corresponde al motivo.
import type { MotivoSesion } from './sesion';

export const urlDeSalida = (motivo: MotivoSesion | undefined) =>
  `/salir?motivo=${motivo === 'desactivada' || motivo === 'inactividad' ? motivo : 'sesion'}`;
