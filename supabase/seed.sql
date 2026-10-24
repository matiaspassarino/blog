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
-- Elementos del documento (válidos según esquemaDocumento de @blog/bloques). Funciones temporales de la sesión.
-- Los ids salen de una secuencia: son los mismos en cada `db:reset` y las pruebas son repetibles.
-- ---------------------------------------------------------------------------
create temporary sequence ids_de_elementos;
create function pg_temp.id() returns text language sql as $$
  select '00000000-0000-4000-b000-' || lpad(nextval('pg_temp.ids_de_elementos')::text, 12, '0')
$$;
create function pg_temp.imagen(semilla text, alt text) returns jsonb language sql as $$
  select jsonb_build_object('ruta', 'https://picsum.photos/seed/' || semilla || '/1600/900',
                            'ancho', 1600, 'alto', 900, 'alt', alt, 'decorativa', false)
$$;
create function pg_temp.doc(variadic elementos jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object('type', 'doc', 'content', to_jsonb(elementos))
$$;
-- Un tramo de texto con marcas (bold, italic, code) o con un enlace.
create function pg_temp.texto(texto text, variadic marcas text[] default '{}') returns jsonb language sql as $$
  select jsonb_build_object('type', 'text', 'text', texto)
    || case when cardinality(marcas) = 0 then '{}'::jsonb
       else jsonb_build_object('marks', (select jsonb_agg(jsonb_build_object('type', m) order by i)
                                         from unnest(marcas) with ordinality as x(m, i))) end
$$;
create function pg_temp.enlace(texto text, href text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'text', 'text', texto,
    'marks', jsonb_build_array(jsonb_build_object('type', 'link', 'attrs', jsonb_build_object('href', href))))
$$;
create function pg_temp.salto() returns jsonb language sql as $$
  select jsonb_build_object('type', 'hardBreak')
$$;
create function pg_temp.parrafo_con(variadic partes jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', pg_temp.id()), 'content', to_jsonb(partes))
$$;
create function pg_temp.parrafo(texto text) returns jsonb language sql as $$
  select pg_temp.parrafo_con(pg_temp.texto(texto))
$$;
create function pg_temp.titulo(nivel int, texto text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('id', pg_temp.id(), 'level', nivel),
                            'content', jsonb_build_array(pg_temp.texto(texto)))
$$;
create function pg_temp.elemento_imagen(semilla text, alt text, leyenda text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'imagen', 'attrs', jsonb_build_object('id', pg_temp.id(),
    'imagen', pg_temp.imagen(semilla, alt), 'leyenda', leyenda))
$$;
create function pg_temp.cita(texto text, autor text, fuente text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'blockquote',
    'attrs', jsonb_build_object('id', pg_temp.id(), 'autor', autor, 'fuente', fuente),
    'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(pg_temp.texto(texto)))))
$$;
-- Un ítem de lista con sus tramos.
create function pg_temp.item(variadic partes jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object('type', 'listItem',
    'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', to_jsonb(partes))))
$$;
create function pg_temp.lista_de(ordenada boolean, variadic items jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object('type', case when ordenada then 'orderedList' else 'bulletList' end,
    'attrs', jsonb_build_object('id', pg_temp.id()), 'content', to_jsonb(items))
$$;
create function pg_temp.lista(ordenada boolean, items text[]) returns jsonb language sql as $$
  select jsonb_build_object('type', case when ordenada then 'orderedList' else 'bulletList' end,
    'attrs', jsonb_build_object('id', pg_temp.id()),
    'content', (select jsonb_agg(pg_temp.item(pg_temp.texto(t)) order by i) from unnest(items) with ordinality as x(t, i)))
$$;
create function pg_temp.galeria(semillas text[], alts text[], columnas int default 3) returns jsonb language sql as $$
  select jsonb_build_object('type', 'galeria', 'attrs', jsonb_build_object('id', pg_temp.id(), 'columnas', columnas,
    'imagenes', (select jsonb_agg(pg_temp.imagen(s, a) order by i)
                 from unnest(semillas, alts) with ordinality as x(s, a, i))))
$$;
create function pg_temp.cta(titulo text, texto text, etiqueta text, url text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'cta', 'attrs', jsonb_build_object('id', pg_temp.id(), 'titulo', titulo,
    'texto', texto, 'etiquetaBoton', etiqueta, 'url', url, 'variante', 'primaria'))
$$;
create function pg_temp.separador() returns jsonb language sql as $$
  select jsonb_build_object('type', 'horizontalRule', 'attrs', jsonb_build_object('id', pg_temp.id()))
$$;
create function pg_temp.codigo(lenguaje text, codigo text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'codeBlock', 'attrs', jsonb_build_object('id', pg_temp.id(), 'lenguaje', lenguaje),
                            'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', codigo)))
$$;
create function pg_temp.video(id_video text, titulo text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'video', 'attrs', jsonb_build_object('id', pg_temp.id(), 'proveedor', 'youtube',
    'idVideo', id_video, 'titulo', titulo))
$$;
create function pg_temp.parrafo_alineado(alineacion text, variadic partes jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object(
    'type', 'paragraph',
    'attrs', jsonb_strip_nulls(jsonb_build_object('id', pg_temp.id(), 'textAlign', alineacion)),
    'content', to_jsonb(partes)
  )
$$;
create function pg_temp.tabla(descripcion text, variadic filas jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object(
    'type', 'table',
    'attrs', jsonb_strip_nulls(jsonb_build_object('id', pg_temp.id(), 'descripcion', descripcion)),
    'content', to_jsonb(filas)
  )
$$;
create function pg_temp.th(texto text, colspan int default null, rowspan int default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'type', 'tableHeader',
    'attrs', jsonb_strip_nulls(jsonb_build_object('colspan', colspan, 'rowspan', rowspan)),
    'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(pg_temp.texto(texto))))
  )
$$;
create function pg_temp.td(texto text, colspan int default null, rowspan int default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'type', 'tableCell',
    'attrs', jsonb_strip_nulls(jsonb_build_object('colspan', colspan, 'rowspan', rowspan)),
    'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(pg_temp.texto(texto))))
  )
$$;
create function pg_temp.td_parrafos(parrafos text[], colspan int default null, rowspan int default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'type', 'tableCell',
    'attrs', jsonb_strip_nulls(jsonb_build_object('colspan', colspan, 'rowspan', rowspan)),
    'content', (select jsonb_agg(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(pg_temp.texto(p))) order by i)
                from unnest(parrafos) with ordinality as x(p, i))
  )
$$;
create function pg_temp.tr(variadic celdas jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object(
    'type', 'tableRow',
    'content', to_jsonb(celdas)
  )
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
  pg_temp.doc(
    pg_temp.parrafo_con(pg_temp.texto('La tipografía es la '), pg_temp.texto('voz visual', 'bold'),
      pg_temp.texto(' de tu marca: transmite personalidad antes de que alguien lea una palabra.')),
    pg_temp.titulo(2, 'Empezá por los valores de la marca'),
    pg_temp.parrafo('Definí tres adjetivos que describan tu marca y buscá familias tipográficas que los reflejen.'),
    pg_temp.elemento_imagen('muestras', 'Comparación entre una serif clásica y una sans geométrica', 'Serif y sans: dos personalidades distintas.'),
    pg_temp.cita('La tipografía es lo que el lenguaje parece.', 'Ellen Lupton', 'https://ellenlupton.com'),
    pg_temp.lista(false, array['Elegí como máximo dos familias.', 'Probá la legibilidad en pantallas chicas.', 'Revisá la licencia de uso web.'])
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '80 days', null
),
(
  'Principios de accesibilidad web que todo sitio necesita',
  'Contraste, navegación por teclado y textos alternativos: lo mínimo para que tu sitio funcione para todas las personas.',
  pg_temp.imagen('accesibilidad', 'Persona navegando un sitio con un lector de pantalla'),
  pg_temp.doc(
    pg_temp.parrafo_con(pg_temp.texto('Un sitio accesible es un sitio que '), pg_temp.texto('funciona mejor para todos', 'bold'),
      pg_temp.texto(', no solo para personas con discapacidad.')),
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
  pg_temp.doc(
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
  pg_temp.doc(
    pg_temp.parrafo_con(pg_temp.texto('Antes de pensar en palabras clave, asegurate de que los buscadores '),
      pg_temp.texto('puedan leer', 'bold'), pg_temp.texto(' tu sitio.')),
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
  pg_temp.doc(
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
  pg_temp.doc(
    pg_temp.parrafo_con(pg_temp.texto('En la web la gente '), pg_temp.texto('escanea', 'bold'),
      pg_temp.texto(' antes de leer. Escribí para que un vistazo alcance.')),
    pg_temp.cita('Omití las palabras innecesarias.', 'William Strunk Jr.', 'https://es.wikipedia.org/wiki/The_Elements_of_Style'),
    pg_temp.parrafo_con(pg_temp.texto('Usá títulos que digan algo, listas para los pasos y enlaces con textos descriptivos como '),
      pg_temp.enlace('esta guía', '/blog'), pg_temp.texto('.')),
    pg_temp.cta('Te ayudamos con tus contenidos', 'Armamos tu estrategia de contenidos y un calendario editorial.', 'Conversemos', '/#contacto')
  ),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000001', 'publicado', now() - interval '35 days', null
),
(
  'Primeros pasos con JavaScript moderno',
  'Módulos, async/await y las funciones del lenguaje que más vas a usar en el día a día.',
  pg_temp.imagen('javascript', 'Editor de código con JavaScript'),
  pg_temp.doc(
    pg_temp.parrafo('JavaScript cambió mucho en los últimos años. Estas son las herramientas que conviene conocer primero.'),
    pg_temp.codigo('js', E'const respuesta = await fetch(\'/api/articulos\');\nconst articulos = await respuesta.json();'),
    pg_temp.lista_de(true,
      pg_temp.item(pg_temp.texto('Módulos con '), pg_temp.texto('import', 'code'), pg_temp.texto(' y '), pg_temp.texto('export', 'code'), pg_temp.texto('.')),
      pg_temp.item(pg_temp.texto('Promesas y '), pg_temp.texto('async', 'code'), pg_temp.texto('/'), pg_temp.texto('await', 'code'), pg_temp.texto('.')),
      pg_temp.item(pg_temp.texto('Desestructuración y operador spread.')))
  ),
  pg_temp.categoria('Desarrollo'), '00000000-0000-4000-a000-000000000003', 'publicado', now() - interval '28 days', null
),
(
  'Cómo validar una idea de negocio en una semana',
  'Un proceso simple para saber si una idea tiene demanda antes de invertir meses de trabajo.',
  pg_temp.imagen('negocio', 'Equipo trabajando con notas adhesivas en una pizarra'),
  pg_temp.doc(
    pg_temp.parrafo_con(pg_temp.texto('La pregunta no es si la idea es buena, sino si '), pg_temp.texto('alguien pagaría', 'bold'),
      pg_temp.texto(' por ella.')),
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
  pg_temp.doc(
    pg_temp.parrafo('No hace falta estar en todas las redes: alcanza con estar bien en una o dos.'),
    pg_temp.elemento_imagen('calendario', 'Calendario de publicaciones semanal', 'Un calendario simple ayuda a sostener la constancia.'),
    pg_temp.parrafo('Medí las consultas que llegan por cada red, no solo los "me gusta".')
  ),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '10 days', null
),
(
  'Tendencias de diseño para el próximo año',
  'Lo que viene en identidad visual y diseño de interfaces.',
  pg_temp.imagen('tendencias', 'Paleta de colores y bocetos de interfaz'),
  pg_temp.doc(pg_temp.parrafo('Un repaso por las tendencias que vemos crecer en los proyectos de este año.')),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'programado', null, now() + interval '7 days'
),
(
  'Métricas que importan para un sitio de servicios',
  'Qué medir para saber si tu sitio está generando clientes.',
  pg_temp.imagen('metricas', 'Panel con gráficos de métricas'),
  pg_temp.doc(pg_temp.parrafo('Consultas, conversiones y tiempo de respuesta: las métricas que de verdad mueven el negocio.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'programado', null, now() + interval '14 days'
),
(
  'Checklist de lanzamiento de un sitio',
  'Todo lo que hay que revisar antes de publicar.',
  null,
  pg_temp.doc(pg_temp.parrafo('Borrador en preparación.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'borrador', null, null
),
(
  'Componentes reutilizables en el frontend',
  'Cómo evitar duplicar interfaces.',
  null,
  '{"type": "doc", "content": []}'::jsonb,
  pg_temp.categoria('Desarrollo'), '00000000-0000-4000-a000-000000000003', 'borrador', null, null
),
(
  'Anuncio de la versión beta del estudio',
  'Contamos cómo empezó el proyecto.',
  pg_temp.imagen('beta', 'Equipo celebrando un lanzamiento'),
  pg_temp.doc(pg_temp.parrafo('Este anuncio ya no está vigente y quedó archivado.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'archivado', now() - interval '120 days', null
);

-- ---------------------------------------------------------------------------
-- Artículos para las pruebas del sitio público (spec 002, T012): todos los tipos
-- de elemento, título y extracto al máximo sin imagen destacada, galería con el
-- mínimo de dos imágenes y los publicados necesarios para tener una segunda página de /blog.
-- ---------------------------------------------------------------------------
insert into public.articulos
  (titulo, extracto, imagen_destacada, contenido, categoria_id, autor_id, estado, publicado_en, programado_para)
values
(
  'Guía visual: todos los bloques del blog',
  'Un artículo de muestra con los diez tipos de bloque que admite el editor, en el orden en que se presentan.',
  pg_temp.imagen('bloques', 'Piezas de un sistema de diseño ordenadas sobre una mesa'),
  pg_temp.doc(
    pg_temp.parrafo('Este artículo reúne todos los bloques del editor.'),
    pg_temp.parrafo_con(pg_temp.texto('Sirve para revisar que cada uno se vea bien.'), pg_temp.salto(),
      pg_temp.texto('Este renglón va en la misma línea lógica que el anterior.')),
    pg_temp.titulo(2, 'Imágenes y citas'),
    pg_temp.elemento_imagen('bloque-imagen', 'Boceto de una interfaz dibujado a mano', 'Un boceto antes de pasar a la pantalla.'),
    jsonb_build_object('type', 'imagen', 'attrs', jsonb_build_object('id', pg_temp.id(),
      'imagen', jsonb_build_object('ruta', 'https://picsum.photos/seed/decorativa/1600/900',
                                   'ancho', 1600, 'alto', 900, 'decorativa', true))),
    pg_temp.cita('El diseño no es solo cómo se ve, sino cómo funciona.', 'Steve Jobs', 'https://www.nytimes.com'),
    pg_temp.lista(true, array['Definir el objetivo.', 'Elegir el bloque adecuado.', 'Revisar en el celular.']),
    pg_temp.galeria(array['galeria-1', 'galeria-2', 'galeria-3', 'galeria-4'],
                    array['Paleta de colores impresa', 'Tarjetas personales sobre papel kraft',
                          'Pantalla con una grilla de diseño', 'Cuaderno con tipografías dibujadas'], 4),
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
  pg_temp.doc(pg_temp.parrafo('Este artículo no tiene imagen destacada: la tarjeta y la vista previa en redes usan la imagen genérica del sitio.')),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000003', 'publicado', now() - interval '5 days', null
),
(
  'Dos fotos también cuentan una historia',
  'Cómo elegir las imágenes que resumen un proyecto cuando hay lugar para pocas.',
  pg_temp.imagen('una-foto', 'Cámara de fotos sobre un escritorio'),
  pg_temp.doc(
    pg_temp.parrafo('A veces una galería tiene el mínimo de imágenes, y tiene que verse igual de bien.'),
    pg_temp.galeria(array['foto-antes', 'foto-despues'], array['Fachada de un local antes de la renovación', 'La misma fachada con su cartel nuevo'])
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '30 days', null
),
(
  'Cómo responder consultas más rápido',
  'Plantillas y horarios para que ningún cliente espere demasiado.',
  pg_temp.imagen('consultas', 'Persona respondiendo mensajes desde una notebook'),
  pg_temp.doc(pg_temp.parrafo('Responder en menos de una hora multiplica las chances de cerrar una venta.')),
  pg_temp.categoria('Negocios'), '00000000-0000-4000-a000-000000000001', 'publicado', now() - interval '45 days', null
),
(
  'Fotos de producto con el celular',
  'Luz, fondo y encuadre: lo básico para que tus productos se vean profesionales.',
  pg_temp.imagen('producto', 'Producto fotografiado con luz natural'),
  pg_temp.doc(pg_temp.parrafo('Con luz de ventana y un fondo liso alcanza para empezar.')),
  pg_temp.categoria('Marketing'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '60 days', null
),
(
  'Formatos, alineación y tablas en el editor',
  'Un artículo de muestra con los nueve formatos en línea, las cuatro alineaciones y una tabla de 5 columnas con celdas combinadas.',
  pg_temp.imagen('tablas', 'Cuadrícula con tablas y tipografías sobre un escritorio'),
  pg_temp.doc(
    pg_temp.parrafo('Este artículo demuestra los nuevos formatos de texto, las alineaciones disponibles y la estructura de tablas avanzadas.'),
    pg_temp.parrafo_alineado('center', pg_temp.texto('Párrafo centrado con texto en negrita y cursiva.', 'bold', 'italic')),
    pg_temp.parrafo_alineado('right', pg_temp.texto('Párrafo alineado a la derecha.', 'italic')),
    pg_temp.parrafo_alineado('justify',
      pg_temp.texto('Párrafo justificado con '),
      pg_temp.texto('subrayado', 'underline'),
      pg_temp.texto(', '),
      pg_temp.texto('tachado', 'strike'),
      pg_temp.texto(', '),
      pg_temp.texto('resaltado', 'highlight'),
      pg_temp.texto(', '),
      pg_temp.enlace('un enlace web', 'https://ejemplo.com'),
      pg_temp.texto(', superíndice m'),
      pg_temp.texto('2', 'superscript'),
      pg_temp.texto(', subíndice H'),
      pg_temp.texto('2', 'subscript'),
      pg_temp.texto('O y fragmento de '),
      pg_temp.texto('código en línea', 'code'),
      pg_temp.texto('.')
    ),
    pg_temp.tabla(
      'Comparativa de planes y precios',
      pg_temp.tr(
        pg_temp.th('Plan'),
        pg_temp.th('Proyectos'),
        pg_temp.th('Almacenamiento'),
        pg_temp.th('Soporte'),
        pg_temp.th('Precio')
      ),
      pg_temp.tr(
        pg_temp.td('Básico'),
        pg_temp.td('1 proyecto'),
        pg_temp.td('5 GB'),
        pg_temp.td('Comunidad y foro', null, 2),
        pg_temp.td('Gratis')
      ),
      pg_temp.tr(
        pg_temp.td('Profesional'),
        pg_temp.td('10 proyectos'),
        pg_temp.td('50 GB'),
        pg_temp.td('15 USD/mes')
      ),
      pg_temp.tr(
        pg_temp.td('Empresarial'),
        pg_temp.td('Ilimitados con copia de seguridad diaria', 2, null),
        pg_temp.td('24/7 dedicado'),
        pg_temp.td_parrafos(array['50 USD/mes', 'Facturación anual'])
      )
    )
  ),
  pg_temp.categoria('Diseño'), '00000000-0000-4000-a000-000000000002', 'publicado', now() - interval '1 day', null
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
  ('Fotos de producto con el celular', array['Redes sociales', 'Contenidos']),
  ('Formatos, alineación y tablas en el editor', array['Diseño', 'UX'])
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
