'use client';

// Equipo (Historia 6, RF-021 a RF-024): una fila por miembro con su estado y las acciones que le corresponden.
// El rol se cambia al elegirlo; desactivar pide confirmación y reactivar no; reenviar solo existe para quien
// todavía no aceptó la invitación. Debajo de 768 px cada fila es una tarjeta (`ui/table`).
import type { FilaEquipo } from '@blog/db';
import { useState } from 'react';
import { cambiarActivoAccion, cambiarRolAccion, reenviarInvitacion } from '../../acciones/equipo';
import { ConfirmarAccion } from '../ConfirmarAccion';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Icono } from '../Icono';
import { EstadoVacio } from '../estructura/EstadoVacio';

type Props = {
  equipo: FilaEquipo[];
  /** Quien usa la pantalla: si se quita el rol de admin, la página ya no se vuelve a pedir. */
  miembroId: string;
  alExito: (mensaje: string) => void;
  alError: (mensaje: string | null) => void;
};

const ETIQUETA_ACCESO = { activo: 'Activo', invitado: 'Invitado', desactivado: 'Desactivado' } as const;

export function TablaEquipo({ equipo, miembroId, alExito, alError }: Props) {
  // Una acción a la vez: evita que dos clics seguidos manden cambios que se pisan.
  const [ocupado, setOcupado] = useState(false);
  const [rolPropioLocal, setRolPropioLocal] = useState<string | null>(null);

  async function ejecutar(operacion: () => Promise<{ ok: true } | { ok: false; mensaje: string }>, exito: string) {
    if (ocupado) return;
    alError(null);
    setOcupado(true);
    try {
      const resultado = await operacion();
      if (resultado.ok) alExito(exito);
      else alError(resultado.mensaje);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarRol(fila: FilaEquipo, rol: string) {
    const propioADejarDeSerAdmin = fila.id === miembroId && rol !== 'admin';
    await ejecutar(
      async () => {
        const resultado = await cambiarRolAccion({ id: fila.id, rol });
        if (resultado.ok && propioADejarDeSerAdmin) setRolPropioLocal(rol);
        return resultado;
      },
      propioADejarDeSerAdmin ? 'Rol actualizado. Al recargar ya no verás el equipo.' : 'Rol actualizado',
    );
  }

  if (equipo.length === 0) return <EstadoVacio mensaje="Todavía no hay miembros." />;

  return (
    <Table role="table">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Nombre</TableHead>
          <TableHead scope="col">Correo</TableHead>
          <TableHead scope="col">Rol</TableHead>
          <TableHead scope="col">Estado</TableHead>
          <TableHead scope="col">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {equipo.map((fila) => (
          <TableRow key={fila.id}>
            <TableCell etiqueta="Nombre" className="font-semibold">
              {fila.nombre}
            </TableCell>
            <TableCell etiqueta="Correo">{fila.correo}</TableCell>
            <TableCell etiqueta="Rol">
              <Select
                aria-label={`Rol de ${fila.nombre}`}
                value={fila.id === miembroId && rolPropioLocal ? rolPropioLocal : fila.rol}
                disabled={ocupado}
                onChange={(evento) => cambiarRol(fila, evento.target.value)}
              >
                <option value="editor">Editor</option>
                <option value="admin">Administrador</option>
              </Select>
            </TableCell>
            <TableCell etiqueta="Estado">
              <Badge estado={fila.acceso}>{ETIQUETA_ACCESO[fila.acceso]}</Badge>
            </TableCell>
            <TableCell etiqueta="Acciones">
              <div className="flex flex-wrap gap-2">
                {fila.acceso === 'invitado' && (
                  <Button
                    variante="secundaria"
                    tamanio="compacto"
                    aria-disabled={ocupado || undefined}
                    onClick={() =>
                      ejecutar(() => reenviarInvitacion({ id: fila.id }), `Invitación reenviada a ${fila.correo}`)
                    }
                  >
                    Reenviar invitación
                    <span className="sr-only"> a {fila.nombre}</span>
                  </Button>
                )}
                {fila.activo ? (
                  <ConfirmarAccion
                    titulo={`¿Desactivar a ${fila.nombre}?`}
                    descripcion="Ya no podrá ingresar al panel ni usar sus acciones. Sus artículos no se borran y puedes reactivar la cuenta cuando quieras."
                    etiquetaConfirmar="Desactivar"
                    variante="peligro"
                    onConfirmar={() =>
                      ejecutar(() => cambiarActivoAccion({ id: fila.id, activo: false }), 'Miembro desactivado')
                    }
                  >
                    <Button variante="peligro" tamanio="compacto">
                      Desactivar
                      <span className="sr-only"> {fila.nombre}</span>
                      <Icono nombre="prohibido" className="order-first" />
                    </Button>
                  </ConfirmarAccion>
                ) : (
                  <Button
                    variante="secundaria"
                    tamanio="compacto"
                    aria-disabled={ocupado || undefined}
                    onClick={() =>
                      ejecutar(() => cambiarActivoAccion({ id: fila.id, activo: true }), 'Miembro reactivado')
                    }
                  >
                    Reactivar
                    <span className="sr-only"> {fila.nombre}</span>
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
