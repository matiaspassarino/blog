'use client';

// Aviso persistente cuando otro guardado se adelantó (RF-009, D13). No es un toast: se queda hasta que la
// persona decide, recibe el foco al aparecer y lo escrito sigue intacto en el formulario.
import { ConfirmarAccion } from '../ConfirmarAccion';
import { Button } from '../ui/button';
import { Icono } from '../Icono';
import { AvisoEstado } from '../AvisoEstado';

type Props = { alVerVigente: () => void; alReemplazar: () => void };

export function AvisoConflicto({ alVerVigente, alReemplazar }: Props) {
  return (
    <AvisoEstado
      tipo="error"
      titulo="Alguien guardó cambios más nuevos"
      cerrable={false}
      enfocar
      acciones={
        <>
          <Button variante="secundaria" onClick={alVerVigente}>
            Ver la versión vigente
          </Button>
          <ConfirmarAccion
            titulo="¿Reemplazar con la versión vigente?"
            descripcion="Se descartarán tus cambios sin guardar en este artículo."
            etiquetaConfirmar="Reemplazar"
            variante="peligro"
            onConfirmar={alReemplazar}
          >
            <Button variante="peligro">
              <Icono nombre="prohibido" />
              Reemplazar con la vigente
            </Button>
          </ConfirmarAccion>
        </>
      }
    >
      Tu texto sigue aquí y no se perdió, pero no se guardó para no pisar lo que escribió la otra persona. Mira la
      versión vigente y decide.
    </AvisoEstado>
  );
}
