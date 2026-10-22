// Claves de los plugins del documento que otras piezas necesitan leer (los errores se muestran en cada isla).
import { PluginKey } from '@tiptap/pm/state';

/** Errores de validación por `bloqueId`. */
export const claveErrores = new PluginKey<Map<string, string[]>>('marcasDeError');
