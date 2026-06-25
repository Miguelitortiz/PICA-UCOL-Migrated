import pool from '../../lib/db.js';

export const POST = async ({ request, cookies }) => {
  try {
    const data = await request.formData();
    const enrollment = data.get('enrollment_id');
    const password = data.get('password');

    if (!enrollment || !password) {
      return new Response(JSON.stringify({ error: 'Faltan credenciales' }), { status: 400 });
    }

    const query = `
      SELECT s.id, s.enrollment_id, s.full_name, s.email, s.class_group_id, c.slug as class_group_slug
      FROM students s
      LEFT JOIN class_groups c ON s.class_group_id = c.id
      WHERE s.enrollment_id = $1 AND s.password_hash = $2
    `;
    const res = await pool.query(query, [enrollment, password]);

    if (res.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
    }

    const student = res.rows[0];

    // Set cookie
    cookies.set('pica_session', JSON.stringify(student), {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 // 1 día
    });

    return new Response(JSON.stringify({ success: true, student }), { status: 200 });
  } catch (error) {
    console.error('Error en login:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};
