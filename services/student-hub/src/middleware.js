export const onRequest = async (context, next) => {
  const { url, cookies, redirect, locals } = context;

  // Rutas públicas
  if (url.pathname.startsWith('/login') || url.pathname.startsWith('/student-auth/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/favicon.svg') || url.pathname.startsWith('/_astro')) {
    return next();
  }

  // Verificar cookie
  const sessionCookie = cookies.get('pica_session');
  if (!sessionCookie) {
    // La raíz funciona como entrada inteligente: muestra login si no hay sesión.
    if (url.pathname === '/') {
      return next();
    }
    return redirect('/login', 302);
  }

  try {
    const student = JSON.parse(sessionCookie.value);
    locals.student = student;
  } catch (error) {
    // Si la cookie es inválida, borrarla y redirigir
    cookies.delete('pica_session', { path: '/' });
    if (url.pathname === '/') {
      return next();
    }
    return redirect('/login', 302);
  }

  return next();
};
