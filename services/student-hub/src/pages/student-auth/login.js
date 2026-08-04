import pool from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { encryptSession } from '../../lib/session.js';

export const POST = async ({ request, cookies }) => {
  try {
    const data = await request.formData();
    const enrollment = String(data.get('enrollment_id') || '').trim();
    const password = String(data.get('password') || '').trim();

    if (!enrollment || !password) {
      return new Response(JSON.stringify({ error: 'Faltan credenciales' }), { status: 400 });
    }

    const query = `
      SELECT s.id, s.enrollment_id, s.full_name, s.email, s.class_group_id, s.password_hash, c.slug as class_group_slug
      FROM students s
      LEFT JOIN class_groups c ON s.class_group_id = c.id
      WHERE s.enrollment_id = $1
      LIMIT 1
    `;
    const res = await pool.query(query, [enrollment]);

    const studentRow = res.rows[0];
    if (!studentRow) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
    }

    const storedPassword = String(studentRow.password_hash || '');
    const passwordMatches = storedPassword.startsWith('$2')
      ? await bcrypt.compare(String(password), storedPassword)
      : storedPassword === String(password);

    if (!passwordMatches) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
    }

    const { password_hash, ...student } = studentRow;

    // Set cookie with encryption, signature, and security flags
    const sessionToken = encryptSession(student);
    cookies.set('pica_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 1 día
    });

    return new Response(JSON.stringify({ success: true, student }), { status: 200 });
  } catch (error) {
    console.error('Error en login:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};
