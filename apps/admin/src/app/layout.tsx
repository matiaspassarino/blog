import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { template: '%s · Panel', default: 'Panel de administración' },
  // Ningún buscador entra al panel (RSEO-001); el encabezado X-Robots-Tag y robots.txt lo refuerzan.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
