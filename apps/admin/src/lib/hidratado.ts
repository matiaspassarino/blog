// Marca de hidratación: los formularios con estado la exponen (`data-editor`, `data-perfil`) para que los E2E
// esperen a que respondan antes de escribir.
import { useSyncExternalStore } from 'react';

const sinSuscripcion = () => () => {};

/** Falso en el servidor y durante la hidratación; verdadero cuando el componente ya responde a la persona. */
export const useHidratado = () =>
  useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
