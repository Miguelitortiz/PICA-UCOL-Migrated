UPDATE professors
SET profile_data = profile_data 
  || jsonb_build_object(
      'biography', 'Walter Alexander Mata López es profesor investigador de tiempo completo en la Facultad de Ingeniería Mecánica y Eléctrica de la Universidad de Colima, institución a la que ingresó en 1997. Cuenta con formación como Ingeniero en Sistemas Computacionales por el Instituto Tecnológico de Colima, una Maestría en Computación y estudios doctorales enfocados en Educación y Tecnología Educativa. Adscrito al cuerpo académico de "Automatización y Sistemas" (CAEC), imparte docencia en programas de licenciatura y posgrado en materias sobre lógica, pensamiento algorítmico y ciencias de datos. Su trayectoria académica e investigadora abarca la autoría de libros, artículos científicos y proyectos centrados en la inteligencia artificial generativa, el desarrollo de aplicaciones para la educación y el uso de tecnologías en la agricultura y la salud. Además, complementa su labor académica mediante la creación de recursos digitales didácticos, la dirección de tesis, la organización de eventos científicos y la evaluación de proyectos e iniciativas tecnológicas nacionales e internacionales.',
      'showOnlyBiography', true
  )
WHERE slug = 'mata-lopez-walter-alexander';
