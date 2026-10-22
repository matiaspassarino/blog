// Pantallas sin sesión (ingreso, recuperación de contraseña): una columna centrada, sin navegación.
export default function LayoutPublico({ children }: LayoutProps<'/'>) {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4 md:p-8">
      {children}
    </main>
  );
}
