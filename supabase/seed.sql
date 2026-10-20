-- Datos de demo navegables (constitucion.md §V.9, spec 001 RF-028).
-- Solo para entornos locales y de demo: las contraseñas son públicas.

-- ---------------------------------------------------------------------------
-- Usuarios (el trigger privado.crear_perfil crea los perfiles)
-- ---------------------------------------------------------------------------
with usuarios (id, email, contrasenia, rol, nombre) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@demo.local', 'demo-admin-2026', 'admin', 'Ana Admin'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'editora@demo.local', 'demo-editora-2026', 'editor', 'Eva Editora'),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'editor@demo.local', 'demo-editor-2026', 'editor', 'Edu Editor')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt(u.contrasenia, extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'rol', u.rol),
  jsonb_build_object('nombre', u.nombre), now(), now(),
  '', '', '', ''
from usuarios u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@demo.local';

-- ---------------------------------------------------------------------------
-- Perfiles públicos de los autores
-- ---------------------------------------------------------------------------
update public.perfiles set biografia = 'Dirige el estudio y escribe sobre estrategia digital y negocios.'
  where id = '00000000-0000-4000-a000-000000000001';
update public.perfiles set biografia = 'Diseñadora de identidad visual. Le interesan la tipografía y la accesibilidad.'
  where id = '00000000-0000-4000-a000-000000000002';
update public.perfiles set biografia = 'Desarrollador web. Escribe sobre rendimiento, JavaScript y buenas prácticas.'
  where id = '00000000-0000-4000-a000-000000000003';

-- ---------------------------------------------------------------------------
-- Taxonomías (el slug lo genera a10_asignar_slug)
-- ---------------------------------------------------------------------------
insert into public.categorias (nombre, descripcion) values
  ('Diseño', 'Identidad visual, tipografía y experiencia de usuario.'),
  ('Desarrollo', 'Sitios rápidos, accesibles y fáciles de mantener.'),
  ('Marketing', 'Contenidos, SEO y redes para hacer crecer tu marca.'),
  ('Negocios', 'Estrategia, métricas y emprendimiento.');

insert into public.etiquetas (nombre) values
  ('Branding'), ('Tipografía'), ('UX'), ('Accesibilidad'), ('SEO'),
  ('Rendimiento'), ('JavaScript'), ('Contenidos'), ('Redes sociales'), ('Emprendimiento');

-- ---------------------------------------------------------------------------
-- Bloques (válidos según @blog/bloques). Funciones temporales de la sesión.
-- ---------------------------------------------------------------------------
create function pg_temp.imagen(semilla text, alt text) returns jsonb language sql as $$
  select jsonb_build_object('ruta', 'https://picsum.photos/seed/' || semilla || '/1600/900',
                            'ancho', 1600, 'alto', 900, 'alt', alt, 'decorativa', false)
$$;
create function pg_temp.parrafo(texto text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'parrafo', 'texto', texto)
$$;
create function pg_temp.titulo(nivel int, texto text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'titulo', 'nivel', nivel, 'texto', texto)
$$;
create function pg_temp.bloque_imagen(semilla text, alt text, leyenda text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'imagen', 'imagen', pg_temp.imagen(semilla, alt), 'leyenda', leyenda)
$$;
create function pg_temp.cita(texto text, autor text, fuente text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'cita', 'texto', texto, 'autor', autor, 'fuente', fuente)
$$;
create function pg_temp.lista(ordenada boolean, items text[]) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'lista', 'ordenada', ordenada, 'items', to_jsonb(items))
$$;
create function pg_temp.galeria(semillas text[], alts text[]) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'galeria', 'columnas', 3,
    'imagenes', (select jsonb_agg(pg_temp.imagen(s, a) order by i)
                 from unnest(semillas, alts) with ordinality as x(s, a, i)))
$$;
create function pg_temp.cta(titulo text, texto text, etiqueta text, url text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'cta', 'titulo', titulo, 'texto', texto,
                            'etiquetaBoton', etiqueta, 'url', url, 'variante', 'primaria')
$$;
create function pg_temp.separador() returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'separador')
$$;
create function pg_temp.codigo(lenguaje text, codigo text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'codigo', 'lenguaje', lenguaje, 'codigo', codigo)
$$;
create function pg_temp.video(id_video text, titulo text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'tipo', 'video', 'proveedor', 'youtube', 'idVideo', id_video, 'titulo', titulo)
$$;
create function pg_temp.categoria(nombre text) returns uuid language sql as $$
  select id from public.categorias where nombre = categoria.nombre
$$;

-- ---------------------------------------------------------------------------
-- Artículos (como postgres: el seed puede cargar cualquier estado y fecha)
-- ---------------------------------------------------------------------------
insert into public.articulos
  (titulo, extracto, imagen_destacada, contenido, categoria_id, autor_id, estado, publicado_en, programado_para)
values
(
  'Cómo elegir una tipografía para tu marca',
  'Una guía práctica para elegir tipografías que comuniquen la personalidad de tu marca y funcionen en todos los soportes.',
  pg_temp.imagen('tipografia', 'Muestras de tipografías impresas sobre una mesa'),
  jsonb_build_array(
    pg_temp.parrafo('La tipografía es la **voz visual** de tu marca: transmite personalidad antes de que alguien lea una palabra.'),
    pg_temp.titulo(2, 'Empezá por los valores de la marca'),
    pg_temp.parrafo('Definí tres adjetivos que describan tu marca y buscá familias tipográficas que los reflejen.'),
    pg_temp.bloque_imagen('muestras', 'Comparación entre una serif clásica y una sans geométrica', 'Serif y sans: dos personalidades distintas.'),
    pg_temp.cita('La tipografía es lo que el lenguaje parece.', 'Ellen Lupton', 'https://ellenlupton.com'),
    pg_temp.lista(false, array['Elegí como máximo dos familias.', 'Probá la legibilidad en pantallas chicas.', 'Revisá la licencia de uso web.'])
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '80 days', null
),
(
  'Principios de accesibilidad web que todo sitio necesita',
  'Contraste, navegación por teclado y textos alternativos: lo mínimo para que tu sitio funcione para todas las personas.',
  pg_temp.imagen('accesibilidad', 'Persona navegando un sitio con un lector de pantalla'),
  jsonb_build_array(
    pg_temp.parrafo('Un sitio accesible es un sitio que **funciona mejor para todos**, no solo para personas con discapacidad.'),
    pg_temp.titulo(2, 'Lo esencial'),
    pg_temp.lista(true, array['Contraste mínimo de 4.5:1 para el texto.', 'Todo se puede usar con el teclado.', 'Cada imagen tiene un texto alternativo útil.', 'Los formularios tienen etiquetas visibles.']),
    pg_temp.cta('¿Querés auditar tu sitio?', 'Revisamos la accesibilidad de tu sitio y te entregamos un plan de mejoras.', 'Pedir auditoría', '/#contacto')
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '70 days', null
),
(
  'Guía de rendimiento para sitios estáticos',
  'Cómo lograr tiempos de carga mínimos con generación estática, imágenes optimizadas y poco JavaScript.',
  pg_temp.imagen('rendimiento', 'Gráfico de métricas de rendimiento web'),
  jsonb_build_array(
    pg_temp.parrafo('El mejor JavaScript es el que no se envía. Un sitio estático bien armado carga en menos de un segundo.'),
    pg_temp.codigo('bash', 'npx lighthouse https://tusitio.com --only-categories=performance'),
    pg_temp.separador(),
    pg_temp.parrafo('Medí antes y después de cada cambio: la intuición falla seguido con el rendimiento.')
  ),
  pg_temp.categoria('Desarrollo'), '00000000-0000-4000-a000-000000000003', 'publicado', now() - interval '60 days', null
),
(
  'SEO técnico: lo esencial para empezar',
  'Metadatos, sitemap, datos estructurados y URLs estables: la base técnica para posicionar un sitio.',
  pg_temp.imagen('seo', 'Resultados de búsqueda en una pantalla'),
  jsonb_build_array(
    pg_temp.parrafo('Antes de pensar en palabras clave, asegurate de que los buscadores **puedan leer** tu sitio.'),
    pg_temp.titulo(2, 'Checklist técnico'),
    pg_temp.lista(false, array['Un título y una descripción únicos por página.', 'Un sitemap actualizado.', 'Datos estructurados en los artículos.', 'Redirecciones 301 cuando cambia una URL.']),
    pg_temp.video('M7lc1UVf-VE', 'Introducción al SEO técnico')
  ),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000001', 'publicado', now() - interval '50 days', null
),
(
  'Identidades visuales que nos inspiran',
  'Una selección de identidades visuales con sistemas claros y memorables.',
  pg_temp.imagen('identidades', 'Collage de logotipos y paletas de color'),
  jsonb_build_array(
    pg_temp.parrafo('Reunimos algunos sistemas de identidad que resuelven muy bien la consistencia entre soportes.'),
    pg_temp.galeria(array['identidad-1', 'identidad-2', 'identidad-3'],
                    array['Papelería con un sistema de color en azul', 'Señalética con tipografía geométrica', 'Aplicación de marca en redes sociales'])
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '42 days', null
),
(
  'Escribir para la web: claridad antes que todo',
  'Cómo escribir textos que se lean en pantalla: frases cortas, títulos claros y una idea por párrafo.',
  pg_temp.imagen('escritura', 'Cuaderno y laptop sobre un escritorio'),
  jsonb_build_array(
    pg_temp.parrafo('En la web la gente **escanea** antes de leer. Escribí para que un vistazo alcance.'),
    pg_temp.cita('Omití las palabras innecesarias.', 'William Strunk Jr.', 'https://es.wikipedia.org/wiki/The_Elements_of_Style'),
    pg_temp.parrafo('Usá títulos que digan algo, listas para los pasos y enlaces con textos descriptivos como [esta guía](/blog).'),
    pg_temp.cta('Te ayudamos con tus contenidos', 'Armamos tu estrategia de contenidos y un calendario editorial.', 'Conversemos', '/#contacto')
  ),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000001', 'publicado', now() - interval '35 days', null
),
(
  'Primeros pasos con JavaScript moderno',
  'Módulos, async/await y las funciones del lenguaje que más vas a usar en el día a día.',
  pg_temp.imagen('javascript', 'Editor de código con JavaScript'),
  jsonb_build_array(
    pg_temp.parrafo('JavaScript cambió mucho en los últimos años. Estas son las herramientas que conviene conocer primero.'),
    pg_temp.codigo('js', E'const respuesta = await fetch(\'/api/articulos\');\nconst articulos = await respuesta.json();'),
    pg_temp.lista(true, array['Módulos con `import` y `export`.', 'Promesas y `async`/`await`.', 'Desestructuración y operador spread.'])
  ),
  pg_temp.categoria('Desarrollo'), '00000000-0000-4000-a000-000000000003', 'publicado', now() - interval '28 days', null
),
(
  'Cómo validar una idea de negocio en una semana',
  'Un proceso simple para saber si una idea tiene demanda antes de invertir meses de trabajo.',
  pg_temp.imagen('negocio', 'Equipo trabajando con notas adhesivas en una pizarra'),
  jsonb_build_array(
    pg_temp.parrafo('La pregunta no es si la idea es buena, sino si **alguien pagaría** por ella.'),
    pg_temp.titulo(2, 'El plan de siete días'),
    pg_temp.lista(true, array['Definí el problema en una frase.', 'Hablá con diez posibles clientes.', 'Armá una página de prueba.', 'Medí cuántos dejan su correo.']),
    pg_temp.cta('¿Tenés una idea para validar?', 'Diseñamos la página de prueba y medimos los resultados con vos.', 'Empezar', '/#contacto')
  ),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'publicado', now() - interval '20 days', null
),
(
  'Redes sociales para pymes: menos es más',
  'Elegí pocas redes, publicá con constancia y medí lo que importa.',
  pg_temp.imagen('redes', 'Teléfono mostrando un perfil de redes sociales'),
  jsonb_build_array(
    pg_temp.parrafo('No hace falta estar en todas las redes: alcanza con estar bien en una o dos.'),
    pg_temp.bloque_imagen('calendario', 'Calendario de publicaciones semanal', 'Un calendario simple ayuda a sostener la constancia.'),
    pg_temp.parrafo('Medí las consultas que llegan por cada red, no solo los "me gusta".')
  ),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '10 days', null
),
(
  'Tendencias de diseño para el próximo año',
  'Lo que viene en identidad visual y diseño de interfaces.',
  pg_temp.imagen('tendencias', 'Paleta de colores y bocetos de interfaz'),
  jsonb_build_array(pg_temp.parrafo('Un repaso por las tendencias que vemos crecer en los proyectos de este año.')),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'programado', null, now() + interval '7 days'
),
(
  'Métricas que importan para un sitio de servicios',
  'Qué medir para saber si tu sitio está generando clientes.',
  pg_temp.imagen('metricas', 'Panel con gráficos de métricas'),
  jsonb_build_array(pg_temp.parrafo('Consultas, conversiones y tiempo de respuesta: las métricas que de verdad mueven el negocio.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'programado', null, now() + interval '14 days'
),
(
  'Checklist de lanzamiento de un sitio',
  'Todo lo que hay que revisar antes de publicar.',
  null,
  jsonb_build_array(pg_temp.parrafo('Borrador en preparación.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'borrador', null, null
),
(
  'Componentes reutilizables en el frontend',
  'Cómo evitar duplicar interfaces.',
  null,
  '[]'::jsonb,
  pg_temp.categoria('Desarrollo'), '00000000-0000-4000-a000-000000000003', 'borrador', null, null
),
(
  'Anuncio de la versión beta del estudio',
  'Contamos cómo empezó el proyecto.',
  pg_temp.imagen('beta', 'Equipo celebrando un lanzamiento'),
  jsonb_build_array(pg_temp.parrafo('Este anuncio ya no está vigente y quedó archivado.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'archivado', now() - interval '120 days', null
);

-- ---------------------------------------------------------------------------
-- Artículos para las pruebas del sitio público (spec 002, T012): todos los tipos
-- de bloque, título y extracto al máximo sin imagen destacada, galería con el
-- mínimo de dos imágenes y los publicados necesarios para tener una segunda página de /blog.
-- ---------------------------------------------------------------------------
insert into public.articulos
  (titulo, extracto, imagen_destacada, contenido, categoria_id, autor_id, estado, publicado_en, programado_para)
values
(
  'Guía visual: todos los bloques del blog',
  'Un artículo de muestra con los diez tipos de bloque que admite el editor, en el orden en que se presentan.',
  pg_temp.imagen('bloques', 'Piezas de un sistema de diseño ordenadas sobre una mesa'),
  jsonb_build_array(
    pg_temp.parrafo('Este artículo reúne todos los bloques del editor.

Sirve para revisar que cada uno se vea bien.
Este renglón va en la misma línea lógica que el anterior.'),
    pg_temp.titulo(2, 'Imágenes y citas'),
    pg_temp.bloque_imagen('bloque-imagen', 'Boceto de una interfaz dibujado a mano', 'Un boceto antes de pasar a la pantalla.'),
    jsonb_build_object('id', gen_random_uuid(), 'tipo', 'imagen',
      'imagen', jsonb_build_object('ruta', 'https://picsum.photos/seed/decorativa/1600/900',
                                   'ancho', 1600, 'alto', 900, 'decorativa', true)),
    pg_temp.cita('El diseño no es solo cómo se ve, sino cómo funciona.', 'Steve Jobs', 'https://www.nytimes.com'),
    pg_temp.lista(true, array['Definir el objetivo.', 'Elegir el bloque adecuado.', 'Revisar en el celular.']),
    jsonb_build_object('id', gen_random_uuid(), 'tipo', 'galeria', 'columnas', 4,
      'imagenes', jsonb_build_array(
        pg_temp.imagen('galeria-1', 'Paleta de colores impresa'),
        pg_temp.imagen('galeria-2', 'Tarjetas personales sobre papel kraft'),
        pg_temp.imagen('galeria-3', 'Pantalla con una grilla de diseño'),
        pg_temp.imagen('galeria-4', 'Cuaderno con tipografías dibujadas'))),
    pg_temp.cta('Conocé la documentación de accesibilidad', 'Las pautas WCAG explican cómo hacer sitios para todas las personas.', 'Ver las pautas', 'https://www.w3.org/WAI/standards-guidelines/wcag/'),
    pg_temp.separador(),
    pg_temp.titulo(3, 'Código y video'),
    pg_temp.codigo('html', '<script>alert(1)</script>
<p>Este código se muestra como texto y nunca se ejecuta.</p>'),
    pg_temp.video('dQw4w9WgXcQ', 'Video de muestra del bloque de video')
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '2 days', null
),
(
  'Guía completa para planificar, diseñar, escribir, publicar y evaluar el blog de una pyme de servicios sin perder el foco',
  'Un recorrido de punta a punta por el blog de una pyme de servicios: cómo definir los temas que buscan tus clientes, armar un calendario realista, escribir notas claras, cuidar el SEO técnico, difundir cada publicación y medir qué contenidos generan consultas para decidir qué escribir el próximo mes.',
  null,
  jsonb_build_array(pg_temp.parrafo('Este artículo no tiene imagen destacada: la tarjeta y la vista previa en redes usan la imagen genérica del sitio.')),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000003', 'publicado', now() - interval '5 days', null
),
(
  'Dos fotos también cuentan una historia',
  'Cómo elegir las imágenes que resumen un proyecto cuando hay lugar para pocas.',
  pg_temp.imagen('una-foto', 'Cámara de fotos sobre un escritorio'),
  jsonb_build_array(
    pg_temp.parrafo('A veces una galería tiene el mínimo de imágenes, y tiene que verse igual de bien.'),
    pg_temp.galeria(array['foto-antes', 'foto-despues'], array['Fachada de un local antes de la renovación', 'La misma fachada con su cartel nuevo'])
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '30 days', null
),
(
  'Cómo responder consultas más rápido',
  'Plantillas y horarios para que ningún cliente espere demasiado.',
  pg_temp.imagen('consultas', 'Persona respondiendo mensajes desde una notebook'),
  jsonb_build_array(pg_temp.parrafo('Responder en menos de una hora multiplica las chances de cerrar una venta.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'publicado', now() - interval '45 days', null
),
(
  'Fotos de producto con el celular',
  'Luz, fondo y encuadre: lo básico para que tus productos se vean profesionales.',
  pg_temp.imagen('producto', 'Producto fotografiado con luz natural'),
  jsonb_build_array(pg_temp.parrafo('Con luz de ventana y un fondo liso alcanza para empezar.')),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '60 days', null
);

-- ---------------------------------------------------------------------------
-- Etiquetado (como postgres; el panel usa asignar_etiquetas)
-- ---------------------------------------------------------------------------
insert into public.articulos_etiquetas (articulo_id, etiqueta_id)
select a.id, e.id
from (values
  ('Cómo elegir una tipografía para tu marca', array['Branding', 'Tipografía']),
  ('Principios de accesibilidad web que todo sitio necesita', array['UX', 'Accesibilidad']),
  ('Guía de rendimiento para sitios estáticos', array['Rendimiento', 'JavaScript']),
  ('SEO técnico: lo esencial para empezar', array['SEO', 'Contenidos']),
  ('Identidades visuales que nos inspiran', array['Branding']),
  ('Escribir para la web: claridad antes que todo', array['Contenidos', 'SEO']),
  ('Primeros pasos con JavaScript moderno', array['JavaScript']),
  ('Cómo validar una idea de negocio en una semana', array['Emprendimiento']),
  ('Redes sociales para pymes: menos es más', array['Redes sociales', 'Contenidos']),
  ('Tendencias de diseño para el próximo año', array['Branding', 'UX']),
  ('Guía visual: todos los bloques del blog', array['UX', 'Accesibilidad', 'Tipografía']),
  ('Dos fotos también cuentan una historia', array['Branding']),
  ('Cómo responder consultas más rápido', array['Emprendimiento']),
  ('Fotos de producto con el celular', array['Redes sociales', 'Contenidos'])
) as x(titulo, etiquetas)
join public.articulos a on a.titulo = x.titulo
join public.etiquetas e on e.nombre = any (x.etiquetas);

-- El insert directo en la tabla puente no recalcula la búsqueda (asignar_etiquetas sí).
select privado.recalcular_busqueda(array(select id from public.articulos));

-- ---------------------------------------------------------------------------
-- Cambios de slug para tener redirecciones de demo (spec 002, T012): un artículo
-- publicado cambia dos veces y una categoría y una etiqueta, una vez cada una.
-- ---------------------------------------------------------------------------
update public.articulos set slug = 'escribir-para-la-web'
  where slug = 'escribir-para-la-web-claridad-antes-que-todo';
update public.articulos set slug = 'claridad-al-escribir-para-la-web'
  where slug = 'escribir-para-la-web';
update public.categorias set slug = 'marketing-digital' where slug = 'marketing';
update public.etiquetas set slug = 'redes' where slug = 'redes-sociales';

-- ---------------------------------------------------------------------------
-- Secretos de revalidación (solo local; en la nube se cargan aparte). Al final,
-- para que la carga del seed no encole notificaciones.
-- ---------------------------------------------------------------------------
select vault.create_secret('http://172.17.0.1:4321', 'url_web_revalidacion')
where not exists (select 1 from vault.secrets where name = 'url_web_revalidacion');
select vault.create_secret('secreto-local-de-desarrollo-no-usar-en-produccion', 'secreto_revalidacion')
where not exists (select 1 from vault.secrets where name = 'secreto_revalidacion');
