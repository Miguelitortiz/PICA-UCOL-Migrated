const fs = require('fs');
const path = require('path');

// Usamos js-yaml desde node_modules de student-hub (disponible via NODE_PATH)
const yaml = require('js-yaml');

async function main() {
  console.log('🔄 Iniciando generación de datos estáticos para PICA-UCOL...');

  // 1. Caminos y directorios
  const projectRoot = path.join(__dirname, '..');
  const referenceDir = path.join(projectRoot, 'data', 'reference');
  const outputDir = path.join(projectRoot, 'services', 'student-hub', 'src', 'content');
  const professorsOutputDir = path.join(outputDir, 'profesores');

  // Asegurar directorios de salida
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(professorsOutputDir, { recursive: true });

  // 2. Cargar datos maestros locales (YAML) usando js-yaml
  let delegations = [];
  let careers = [];
  let faculties = [];
  try {
    delegations = yaml.load(fs.readFileSync(path.join(referenceDir, 'delegations.yaml'), 'utf-8')) || [];
    careers     = yaml.load(fs.readFileSync(path.join(referenceDir, 'careers.yaml'),     'utf-8')) || [];
    faculties   = yaml.load(fs.readFileSync(path.join(referenceDir, 'faculties.yaml'),   'utf-8')) || [];
    console.log(`✅ Datos de referencia cargados: ${delegations.length} delegaciones, ${careers.length} carreras, ${faculties.length} facultades.`);
  } catch (err) {
    console.error('❌ Error al leer los archivos YAML de referencia:', err);
    process.exit(1);
  }

  // 3. Conectar a PostgreSQL e intentar consultar datos
  let professors = [];
  let groups = [];
  let schedules = [];
  let examDates = [];
  let subjectSyllabus = [];

  const dbConfig = {
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER || 'admin'}:${process.env.DB_PASSWORD || 'admin_pass'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'eduvitae'}`,
    ssl: false
  };

  try {
    const { Client } = require('pg');
    const client = new Client(dbConfig);
    console.log(`🔌 Intentando conectar a la base de datos: ${dbConfig.connectionString.replace(/:[^:@]+@/, ':***@')}`);
    
    await client.connect();
    console.log('✅ Conexión a PostgreSQL establecida con éxito.');

    // Consultar profesores con sus career_ids agregados
    const profRes = await client.query(`
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
    `);
    professors = profRes.rows.map(row => {
      const profile = row.profile_data;
      profile.id = row.id;
      profile.slug = row.slug;
      profile.fullName = row.full_name;
      profile.institutionalEmail = row.email;
      profile.delegation_id = row.delegation_id;
      profile.career_ids = row.career_ids;
      return profile;
    });

    // Consultar grupos con información de tutor
    const groupRes = await client.query(`
      SELECT g.*, p.full_name as tutor_name, p.email as tutor_email
      FROM class_groups g
      LEFT JOIN professors p ON g.tutor_id = p.id
    `);
    const groupsRaw = groupRes.rows;

    // Consultar asignaciones de profesores
    const pgRes = await client.query('SELECT * FROM professor_groups');
    const assignments = pgRes.rows;

    // Estructurar grupos con sus profesores anidados
    groups = groupsRaw.map(g => {
      const groupAssignments = assignments.filter(a => a.class_group_id === g.id);
      const groupProfessors = groupAssignments.map(a => {
        const prof = professors.find(p => p.id === a.professor_id);
        return prof ? {
          id: prof.id,
          slug: prof.slug,
          fullName: prof.fullName,
          email: prof.institutionalEmail,
          subject_taught: a.subject_taught
        } : null;
      }).filter(p => p !== null);

      return {
        id: g.id,
        slug: g.slug,
        name: g.name,
        career_id: g.career_id,
        academic_period: g.academic_period,
        shift: g.shift,
        tutor_id: g.tutor_id,
        tutor_name: g.tutor_name,
        tutor_email: g.tutor_email,
        professors: groupProfessors
      };
    });

    // Consultar horarios (schedules)
    const schedRes = await client.query(`
      SELECT s.*, p.full_name as professor_name, p.email as professor_email, p.slug as professor_slug
      FROM schedules s
      LEFT JOIN professors p ON s.professor_id = p.id
      ORDER BY s.day_of_week, s.start_time
    `);
    schedules = schedRes.rows;

    // Consultar fechas de exámenes (exam_dates)
    const examRes = await client.query('SELECT * FROM exam_dates ORDER BY exam_date, exam_time');
    examDates = examRes.rows;

    // Consultar planes de estudio (subject_syllabus)
    const sylRes = await client.query(`
      SELECT ss.*, p.full_name as creator_name
      FROM subject_syllabus ss
      LEFT JOIN professors p ON ss.created_by = p.id
    `);
    subjectSyllabus = sylRes.rows;

    await client.end();
    console.log(`✅ Base de datos consultada con éxito: ${professors.length} profesores, ${groups.length} grupos, ${schedules.length} clases en horario, ${examDates.length} exámenes, ${subjectSyllabus.length} planes de estudio.`);
  } catch (err) {
    console.warn('⚠️ No se pudo conectar o consultar la base de datos. Usando fallback vacío. Detalle:', err.message);
    professors = [];
    groups = [];
    schedules = [];
    examDates = [];
    subjectSyllabus = [];
    console.log('✅ Continuando con datos vacíos (BD no disponible en build).');
  }

  // 4. Escribir archivos de salida JSON
  try {
    // Datos de referencia maestros
    fs.writeFileSync(path.join(outputDir, 'delegations.json'), JSON.stringify(delegations, null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'careers.json'),     JSON.stringify(careers,     null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'faculties.json'),   JSON.stringify(faculties,   null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'groups.json'),      JSON.stringify(groups,      null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'schedules.json'),   JSON.stringify(schedules,   null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'exam_dates.json'),  JSON.stringify(examDates,   null, 2), 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'syllabus.json'),    JSON.stringify(subjectSyllabus, null, 2), 'utf-8');

    // Escribir cada profesor individualmente
    // Primero limpiar el directorio de profesores para no dejar archivos huérfanos
    if (fs.existsSync(professorsOutputDir)) {
      const existingFiles = fs.readdirSync(professorsOutputDir).filter(f => f.endsWith('.json'));
      for (const file of existingFiles) {
        fs.unlinkSync(path.join(professorsOutputDir, file));
      }
    } else {
      fs.mkdirSync(professorsOutputDir, { recursive: true });
    }

    for (const prof of professors) {
      const profFile = path.join(professorsOutputDir, `${prof.slug}.json`);
      fs.writeFileSync(profFile, JSON.stringify(prof, null, 2), 'utf-8');
    }

    console.log(`🏁 Generación finalizada: ${delegations.length} delegaciones, ${faculties.length} facultades, ${careers.length} carreras, ${groups.length} grupos, ${schedules.length} horarios, ${examDates.length} exámenes, ${subjectSyllabus.length} planes, ${professors.length} profesores.`);
  } catch (writeErr) {
    console.error('❌ Error al escribir los archivos JSON estáticos:', writeErr);
    process.exit(1);
  }
}

main();
