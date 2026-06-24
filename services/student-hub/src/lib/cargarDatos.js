import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import pool from './db.js';

// Directorio de referencias YAML en runtime
const referenceDir = path.join(process.cwd(), 'data', 'reference');

export function cargarDelegaciones() {
  try {
    const fileContent = fs.readFileSync(path.join(referenceDir, 'delegations.yaml'), 'utf-8');
    return yaml.load(fileContent) || [];
  } catch (err) {
    console.error('Error al leer delegations.yaml en runtime:', err);
    return [];
  }
}

export function cargarCarreras() {
  try {
    const fileContent = fs.readFileSync(path.join(referenceDir, 'careers.yaml'), 'utf-8');
    return yaml.load(fileContent) || [];
  } catch (err) {
    console.error('Error al leer careers.yaml en runtime:', err);
    return [];
  }
}

export function cargarFacultades() {
  try {
    const fileContent = fs.readFileSync(path.join(referenceDir, 'faculties.yaml'), 'utf-8');
    return yaml.load(fileContent) || [];
  } catch (err) {
    console.error('Error al leer faculties.yaml en runtime:', err);
    return [];
  }
}

export function cargarFacultadesDeDelegacion(delegationId) {
  const faculties = cargarFacultades();
  return faculties.filter(f => f.delegation_id === delegationId);
}

export function cargarFacultadPorSlug(slug) {
  const faculties = cargarFacultades();
  return faculties.find(f => f.slug === slug) || null;
}

export function cargarCarrerasDeFacultad(faculty) {
  const allCareers = cargarCarreras();
  const careerIds = faculty.career_ids || [];
  return allCareers.filter(c => careerIds.includes(c.id));
}

export function cargarDelegacionPorSlug(slug) {
  const delegations = cargarDelegaciones();
  return delegations.find(d => d.slug === slug) || null;
}

export function cargarCarreraPorSlug(slug) {
  const careers = cargarCarreras();
  return careers.find(c => c.slug === slug) || null;
}

export function cargarCarrerasDeDelegacion(delegationId) {
  const careers = cargarCarreras();
  return careers.filter(c => c.delegation_id === delegationId);
}

export async function cargarGruposDeCarrera(careerId) {
  try {
    const res = await pool.query('SELECT * FROM class_groups WHERE career_id = $1 ORDER BY name ASC', [careerId]);
    return res.rows;
  } catch (err) {
    console.error(`Error al cargar grupos de carrera ${careerId} desde PostgreSQL:`, err);
    return [];
  }
}

export async function cargarGrupoConProfesores(g_slug) {
  try {
    const groupRes = await pool.query(`
      SELECT g.*, p.full_name as tutor_name, p.email as tutor_email, p.slug as tutor_slug
      FROM class_groups g
      LEFT JOIN professors p ON g.tutor_id = p.id
      WHERE g.slug = $1
    `, [g_slug]);
    if (groupRes.rows.length === 0) return null;
    
    const grp = groupRes.rows[0];
    
    const profsRes = await pool.query(`
      SELECT p.slug, p.full_name as "fullName", p.email, pg.subject_taught
      FROM professors p
      JOIN professor_groups pg ON p.id = pg.professor_id
      WHERE pg.class_group_id = $1
      ORDER BY p.full_name ASC
    `, [grp.id]);
    
    return {
      id: grp.id,
      slug: grp.slug,
      name: grp.name,
      career_id: grp.career_id,
      academic_period: grp.academic_period,
      shift: grp.shift,
      tutor_id: grp.tutor_id,
      tutor_name: grp.tutor_name,
      tutor_email: grp.tutor_email,
      tutor_slug: grp.tutor_slug,
      professors: profsRes.rows
    };
  } catch (err) {
    console.error(`Error al cargar grupo con profesores para slug "${g_slug}" desde PostgreSQL:`, err);
    return null;
  }
}

export async function cargarHorarioDeGrupo(groupId) {
  try {
    const res = await pool.query(`
      SELECT s.*, p.full_name as "professorName", p.email as "professorEmail", p.slug as "professorSlug"
      FROM schedules s
      LEFT JOIN professors p ON s.professor_id = p.id
      WHERE s.class_group_id = $1
      ORDER BY s.day_of_week, s.start_time
    `, [groupId]);
    return res.rows;
  } catch (err) {
    console.error(`Error al cargar horarios del grupo ${groupId}:`, err);
    return [];
  }
}

export async function cargarExamenesDeGrupo(groupId) {
  try {
    const res = await pool.query(`
      SELECT * FROM exam_dates
      WHERE class_group_id = $1
      ORDER BY exam_date, exam_time
    `, [groupId]);
    return res.rows;
  } catch (err) {
    console.error(`Error al cargar exámenes del grupo ${groupId}:`, err);
    return [];
  }
}

export async function cargarSyllabusPorSlug(slug) {
  try {
    const res = await pool.query(`
      SELECT ss.*, p.full_name as "creatorName", p.email as "creatorEmail", p.slug as "creatorSlug", p.profile_data
      FROM subject_syllabus ss
      LEFT JOIN professors p ON ss.created_by = p.id
      WHERE ss.slug = $1
    `, [slug]);
    return res.rows[0] || null;
  } catch (err) {
    console.error(`Error al cargar syllabus por slug "${slug}":`, err);
    return null;
  }
}

export async function cargarSyllabusDeCarrera(careerId) {
  try {
    const res = await pool.query(`
      SELECT ss.*, p.full_name as "creatorName"
      FROM subject_syllabus ss
      LEFT JOIN professors p ON ss.created_by = p.id
      WHERE ss.career_id = $1
      ORDER BY ss.subject_name ASC
    `, [careerId]);
    return res.rows;
  } catch (err) {
    console.error(`Error al cargar planes de estudio de carrera ${careerId}:`, err);
    return [];
  }
}
