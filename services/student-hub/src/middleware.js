export const onRequest = async (context, next) => {
  const { url, cookies, redirect, locals } = context;

  // Rutas públicas y recursos estáticos
  if (url.pathname.startsWith('/favicon.svg') || url.pathname.startsWith('/_astro') || url.pathname.startsWith('/student-auth/')) {
    return next();
  }

  // Redirigir la antigua ruta de login a la raíz
  if (url.pathname === '/login') {
    return redirect('/', 302);
  }

  // Verificar la cookie de grupo seleccionado
  const selectedGroupCookie = cookies.get('pica_selected_group');
  if (selectedGroupCookie && selectedGroupCookie.value) {
    locals.student = {
      is_anonymous: true,
      class_group_slug: selectedGroupCookie.value,
      full_name: 'Estudiante',
      email: 'estudiante@ucol.mx'
    };
    return next();
  }

  // Si no hay grupo seleccionado y no es la raíz, redirigir a la raíz para seleccionar uno (excepto el mapa y sus recursos)
  if (url.pathname !== '/' && !url.pathname.startsWith('/mapa') && !url.pathname.startsWith('/api/') && url.pathname !== '/campus.geojson') {
    return redirect('/', 302);
  }

  return next();
};
