import pool from './db.js';

/**
 * Carga todos los perfiles de docentes en tiempo de ejecución desde PostgreSQL.
 */
export async function cargarProfesores() {
  try {
    const query = `
      SELECT p.id, p.slug, p.full_name, p.email, p.delegation_id, p.profile_data,
             COALESCE(
               json_agg(g.career_id) FILTER (WHERE g.career_id IS NOT NULL),
               '[]'
             ) as career_ids
      FROM professors p
      LEFT JOIN professor_groups pg ON p.id = pg.professor_id
      LEFT JOIN class_groups g ON pg.class_group_id = g.id
      GROUP BY p.id
      ORDER BY p.full_name ASC
    `;
    const res = await pool.query(query);
    return res.rows.map(row => {
      const profile = row.profile_data;
      profile.id = row.id;
      profile.slug = row.slug;
      profile.fullName = row.full_name;
      profile.institutionalEmail = row.email;
      profile.delegation_id = row.delegation_id;
      
      const combinedCareers = new Set(row.career_ids || []);
      if (profile.auto_career_ids) {
        profile.auto_career_ids.forEach(cid => combinedCareers.add(cid));
      }
      profile.career_ids = Array.from(combinedCareers);
      
      return profile;
    });
  } catch (err) {
    console.error('Error al cargar profesores de PostgreSQL en runtime:', err);
    return [];
  }
}

/**
 * Carga un docente específico a partir de su slug desde PostgreSQL.
 * @param {string} slug 
 */
export async function cargarProfesor(slug) {
  try {
    const res = await pool.query('SELECT profile_data FROM professors WHERE slug = $1', [slug]);
    if (res.rows.length > 0) {
      return res.rows[0].profile_data;
    }
    return null;
  } catch (err) {
    console.error(`Error al cargar profesor con slug "${slug}" desde PostgreSQL:`, err);
    return null;
  }
}
