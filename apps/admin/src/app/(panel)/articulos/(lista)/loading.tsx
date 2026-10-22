// Esqueleto mientras carga una pantalla del panel. Sin animación de pulso (prefers-reduced-motion).
export default function Cargando() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Cargando…
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="h-10 w-48 rounded-md bg-superficie" />
        <div className="h-(--tactil-min) w-40 rounded-md bg-superficie" />
      </div>
      <div className="mt-6 h-40 rounded-md bg-superficie" />
    </div>
  );
}
