import { fetchFromService } from '../../lib/api-client.js';
import { encryptSession } from '../../lib/session.js';

export const POST = async ({ request, cookies }) => {
  try {
    const data = await request.formData();
    const enrollment = String(data.get('enrollment_id') || '').trim();
    const password = String(data.get('password') || '').trim();

    if (!enrollment || !password) {
      return new Response(JSON.stringify({ error: 'Faltan credenciales' }), { status: 400 });
    }

    let authRes;
    try {
      authRes = await fetchFromService('auth', '/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: enrollment, password: password })
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
    }

    if (!authRes || !authRes.student) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
    }

    const student = authRes.student;

    // Set cookie with encryption, signature, and security flags
    const sessionToken = encryptSession(student);
    cookies.set('pica_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: false, // Permitir login por HTTP para pruebas
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 1 día
    });

    return new Response(JSON.stringify({ success: true, student }), { status: 200 });
  } catch (error) {
    console.error('Error en login:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};
