// Claves de los plugins del documento que otras piezas necesitan leer (los errores se muestran en cada isla).
import { PluginKey } from '@tiptap/pm/state';

/** Errores de validación por `bloqueId`. */
export const claveErrores = new PluginKey<Map<string, string[]>>('marcasDeError');

/** Modo elementos: `true` mientras hay uno o varios elementos seleccionados enteros (no texto). */
export const claveModo = new PluginKey<boolean>('modoElementos');

/** La transacción ya fue confirmada por la persona (quitar una imagen ya guardada). */
export const claveConfirmado = new PluginKey<boolean>('confirmado');

/** Elementos con una subida de imagen en curso (`bloqueId`): su isla lo muestra y no se pueden mover ni quitar. */
export const claveSubidas = new PluginKey<ReadonlySet<string>>('subidas');
