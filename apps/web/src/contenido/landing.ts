// Contenido de la landing de la demo (specs/002-sitio-publico/contracts/landing.md). Para un
// cliente: editar este archivo (textos y datos de contacto) y redesplegar. La identidad
// visual (colores, tipografía y logo) está en packages/ui (tokens.css e identidad.ts).
import { esquemaLanding } from './esquema';
import imagenHero from '../assets/landing/hero.jpg';
import fotoTestimonio1 from '../assets/landing/testimonio-1.jpg';
import fotoTestimonio2 from '../assets/landing/testimonio-2.jpg';
import fotoTestimonio3 from '../assets/landing/testimonio-3.jpg';

export const landing = esquemaLanding.parse({
  sitio: {
    nombre: 'Estudio Demo',
    lema: 'Sitios que atraen clientes',
    descripcion:
      'Diseñamos y desarrollamos sitios rápidos y accesibles, con un blog que posiciona tu negocio en los buscadores.',
  },
  hero: {
    titulo: 'Tu negocio, encontrado por quienes lo buscan',
    bajada:
      'Creamos sitios rápidos, accesibles y fáciles de administrar, con un blog pensado para atraer clientes desde Google.',
    cta: 'Hablemos por WhatsApp',
    imagen: { src: imagenHero, alt: 'Maqueta de un sitio web con secciones de servicios y artículos' },
  },
  propuesta: {
    titulo: 'Un sitio que trabaja para vos',
    texto:
      'Cada página está optimizada para cargar rápido y para que los buscadores la entiendan. Vos publicás artículos desde un panel simple y el sitio se actualiza solo.',
    puntos: [
      'Carga en menos de dos segundos desde el celular.',
      'Accesible para todas las personas.',
      'Un blog que suma visitas mes a mes.',
    ],
  },
  servicios: {
    titulo: 'Qué hacemos',
    items: [
      {
        titulo: 'Estrategia digital',
        descripcion: 'Definimos qué buscan tus clientes y cómo tu sitio puede responderles.',
        icono: 'estrategia',
      },
      {
        titulo: 'Diseño de identidad',
        descripcion: 'Una imagen coherente en el sitio, las redes y cada pieza de tu marca.',
        icono: 'diseno',
      },
      {
        titulo: 'Desarrollo web',
        descripcion: 'Sitios rápidos y seguros, fáciles de mantener y de hacer crecer.',
        icono: 'desarrollo',
      },
      {
        titulo: 'Posicionamiento SEO',
        descripcion: 'Contenido y técnica para aparecer en los primeros resultados.',
        icono: 'seo',
      },
    ],
  },
  testimonios: {
    titulo: 'Lo que dicen nuestros clientes',
    items: [
      {
        cita: 'En tres meses empezamos a recibir consultas desde Google todas las semanas.',
        nombre: 'Lucía Fernández',
        cargo: 'Dueña de una consultora contable',
        foto: { src: fotoTestimonio1, alt: 'Retrato ilustrado de Lucía Fernández' },
      },
      {
        cita: 'El panel es tan simple que publico un artículo por semana sin ayuda.',
        nombre: 'Martín Gómez',
        cargo: 'Director de una escuela de idiomas',
        foto: { src: fotoTestimonio2, alt: 'Retrato ilustrado de Martín Gómez' },
      },
      {
        cita: 'El sitio carga rapidísimo y por fin se ve bien en el celular.',
        nombre: 'Sofía Ramírez',
        cargo: 'Fundadora de un estudio de arquitectura',
        foto: { src: fotoTestimonio3, alt: 'Retrato ilustrado de Sofía Ramírez' },
      },
    ],
  },
  blog: {
    titulo: 'Últimos artículos',
    descripcion:
      'Guías y consejos sobre diseño, desarrollo, marketing y negocios para hacer crecer tu marca en internet.',
  },
  contacto: {
    titulo: '¿Hablamos de tu proyecto?',
    texto: 'Contanos qué necesitás y te respondemos en el día.',
    whatsapp: '5491100000000',
    whatsappVisible: '+54 9 11 0000-0000',
    mensaje: 'Hola, vi su sitio y quiero hacer una consulta.',
    correo: 'hola@estudiodemo.com',
    asunto: 'Consulta desde el sitio',
  },
});
