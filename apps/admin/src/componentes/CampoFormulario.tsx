// Campo de formulario accesible: etiqueta visible, ayuda opcional y error enlazado con
// `aria-describedby`. El control recibe sus atributos por función para no acoplarse al tipo de control.
import { useId, type ReactNode } from 'react';
import { Label } from './ui/label';

type AtributosControl = { id: string; 'aria-invalid': boolean | undefined; 'aria-describedby': string | undefined };

type Props = {
  etiqueta: string;
  /** Id del control; si no se da, se genera uno. Es el que usa `idDeCampo` para enfocar errores. */
  id?: string;
  ayuda?: string;
  error?: string;
  /** El error se anuncia como alerta (por ejemplo, dentro de un diálogo). */
  alerta?: boolean;
  children: (atributos: AtributosControl) => ReactNode;
};

export function CampoFormulario({ etiqueta, id, ayuda, error, alerta = false, children }: Props) {
  const generado = useId();
  const idControl = id ?? generado;
  const idAyuda = `${idControl}-ayuda`;
  const idError = `${idControl}-error`;
  const descripcion = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={idControl}>{etiqueta}</Label>
      {children({ id: idControl, 'aria-invalid': error ? true : undefined, 'aria-describedby': descripcion })}
      {ayuda && (
        <p id={idAyuda} className="text-sm text-texto-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} role={alerta ? 'alert' : undefined} className="text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}
