'use client';

// Una fecha en la hora del navegador (research D18). En el servidor no se conoce esa zona, así que se
// renderiza en UTC y, ya en el navegador, React usa el valor local: `useSyncExternalStore` evita el aviso de
// hidratación porque distingue el snapshot del servidor del del cliente.
import { useSyncExternalStore } from 'react';
import { formatearFecha } from '../lib/fechas';

const sinSuscripcion = () => () => {};

export function FechaLocal({ iso }: { iso: string }) {
  const texto = useSyncExternalStore(
    sinSuscripcion,
    () => formatearFecha(iso),
    () => formatearFecha(iso, 'UTC'),
  );
  // La base entrega "…+00:00"; el atributo lleva el ISO canónico (UTC con "Z").
  const canonico = Number.isNaN(Date.parse(iso)) ? iso : new Date(iso).toISOString();
  return <time dateTime={canonico}>{texto ?? iso}</time>;
}
