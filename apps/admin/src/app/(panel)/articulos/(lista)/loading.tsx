// Esqueleto mientras carga una pantalla del panel. Sin animación de pulso (prefers-reduced-motion).
export default function Cargando() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Cargando…
      </p>
      <div className="h-8 w-48 rounded-md bg-superficie" />
      <div className="mt-6 h-40 rounded-md bg-superficie" />
    </div>
  );
}
