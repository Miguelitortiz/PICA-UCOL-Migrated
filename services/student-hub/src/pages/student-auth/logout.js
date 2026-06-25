export const POST = async ({ cookies, redirect }) => {
  cookies.delete('pica_session', { path: '/' });
  return redirect('/', 302);
};

export const GET = async ({ cookies, redirect }) => {
  cookies.delete('pica_session', { path: '/' });
  return redirect('/', 302);
};
