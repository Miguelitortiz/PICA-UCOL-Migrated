const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://admin:admin_pass@localhost:5432/pica_db';
const pool = new Pool({ connectionString });

const FIME_CAREERS = [
  { id: 349, slug: 'ingenieria-en-computacion-inteligente', name: 'Ingeniería en Computación Inteligente', groups: ['B', 'D'] },
  { id: 371, slug: 'ingeniero-mecanico-electricista', name: 'Ingeniero Mecánico Electricista', groups: ['A', 'G', 'H'] },
  { id: 418, slug: 'ingenieria-en-mecatronica', name: 'Ingeniería en Mecatrónica', groups: ['I', 'J'] },
  { id: 99, slug: 'ingenieria-en-sistemas-electronicos-y-telecomunicaciones', name: 'Ingeniería en Sistemas Electrónicos y Telecomunicaciones', groups: ['C'] }
];

const timeSlotsMap = {
  1: ["07:00:00", "07:50:00"],
  2: ["07:50:00", "08:40:00"],
  3: ["09:10:00", "10:00:00"],
  4: ["10:00:00", "10:50:00"],
  5: ["10:50:00", "11:40:00"],
  6: ["11:40:00", "12:30:00"],
  7: ["12:30:00", "13:20:00"],
  8: ["13:20:00", "14:10:00"],
  9: ["14:10:00", "15:00:00"],
  10: ["15:30:00", "16:20:00"],
  11: ["16:20:00", "17:10:00"],
  12: ["17:10:00", "18:00:00"],
  13: ["18:00:00", "18:50:00"],
  14: ["18:50:00", "19:40:00"]
};

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function readCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filePath}`);
    return [];
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
  }
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length >= headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = parts[idx];
      });
      rows.push(row);
    }
  }
  return rows;
}

const DEFAULT_PASSWORD_HASH = '$2b$10$sJ9wtmXBK9UWArp7EGfUCupb05kG9R6jRwrqDdSS3uq0lcrcHQI42';

async function seed() {
  console.log('🔌 Conectando a la base de datos de PICA-UCOL...');
  const client = await pool.connect();

  try {
    // 1. Limpieza de base de datos
    console.log('🧹 Limpiando registros anteriores de la base de datos...');
    await client.query('TRUNCATE admin_users, exam_dates, schedules, professor_groups, students, class_groups, professors, subject_syllabus CASCADE');

    const dbHorariosDir = path.join(process.cwd(), 'db_horarios');
    
    // Cargar semblanzas
    console.log('📖 Cargando semblanzas desde semblanzas.json...');
    let semblanzasSlugMap = new Map();
    const semblanzasPath = path.join(dbHorariosDir, 'semblanzas.json');
    if (fs.existsSync(semblanzasPath)) {
      const semblanzasRaw = JSON.parse(fs.readFileSync(semblanzasPath, 'utf8'));
      for (const [name, text] of Object.entries(semblanzasRaw)) {
        semblanzasSlugMap.set(slugify(name), text);
      }
    }

    // 2. Cargar Profesores
    console.log('👥 Cargando profesores desde profesores.csv...');
    const profesoresRows = readCSV(path.join(dbHorariosDir, 'profesores.csv'));
    console.log(`Encontrados ${profesoresRows.length} profesores.`);
    
    for (const prof of profesoresRows) {
      const id = parseInt(prof.id_profesor, 10);
      const fullName = prof.Nombre;
      const abrev = prof.Abreviatura;
      const baseSlug = slugify(fullName);
      const slug = `${baseSlug}-${id}`;
      const profileData = {
        slug,
        fullName,
        photoUrl: null,
        biography: semblanzasSlugMap.get(baseSlug) || null,
        title: null,
        department: null,
        institutionalEmail: null,
        admissionYear: null,
        contactInfo: {
          phone: null,
          office: null,
          officeHours: null
        },
        academicFormation: {
          doctorados: [],
          maestrias: [],
          licenciatura: null
        },
        scientificProduction: { articles: [], books: [] },
        educationalMaterials: [],
        teaching: { courses: [], theses: [] },
        certifications: [],
        academicBody: null
      };

      await client.query(`
        INSERT INTO professors (id, slug, full_name, email, delegation_id, profile_data)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [id, slug, fullName, null, 4, JSON.stringify(profileData)]);
    }
    
    // Sincronizar secuencia de serial
    await client.query("SELECT setval('professors_id_seq', COALESCE((SELECT MAX(id)+1 FROM professors), 1), false)");
    console.log('✅ Profesores insertados con éxito.');

    // 3. Cargar Clases / Grupos
    console.log('🏫 Cargando clases desde clases.csv...');
    const clasesRows = readCSV(path.join(dbHorariosDir, 'clases.csv'));
    console.log(`Encontrados ${clasesRows.length} clases.`);

    const groupMap = new Map(); // id_clase -> career_id
    
    for (const clase of clasesRows) {
      const id = parseInt(clase.id_clase, 10);
      const className = clase['Nombre de la clase'];
      const abrev = clase.Abreviatura;
      
      const match = className.match(/^(\d+)\s+([A-J])$/i);
      if (!match) {
        console.warn(`⚠️ Clase con formato no reconocido: ${className}, se asigna por defecto.`);
        continue;
      }
      const semester = parseInt(match[1], 10);
      const letter = match[2].toUpperCase();
      
      // Determinar carrera a partir de la letra
      let career = FIME_CAREERS.find(c => c.groups.includes(letter));
      if (!career) {
        career = FIME_CAREERS[0];
      }
      
      groupMap.set(id, career.id);
      const groupSlug = `${semester}-${letter.toLowerCase()}-${career.id}`;
      const shift = semester <= 5 ? 'Matutino' : 'Vespertino';

      await client.query(`
        INSERT INTO class_groups (id, slug, career_id, name, academic_period, shift, semester, group_letter)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [id, groupSlug, career.id, abrev, 'Ago-Ene 2026', shift, semester, letter]);
    }
    
    // Sincronizar secuencia
    await client.query("SELECT setval('class_groups_id_seq', COALESCE((SELECT MAX(id)+1 FROM class_groups), 1), false)");
    console.log('✅ Clases insertadas con éxito.');

    // 4. Cargar Asignaturas / Syllabus
    console.log('📚 Cargando asignaturas desde asignaturas.csv...');
    const asignaturasRows = readCSV(path.join(dbHorariosDir, 'asignaturas.csv'));
    console.log(`Encontrados ${asignaturasRows.length} asignaturas.`);
    
    const asignaturasMap = new Map(); // id_asignatura -> Asignatura
    for (const asig of asignaturasRows) {
      asignaturasMap.set(parseInt(asig.id_asignatura, 10), asig.Asignatura);
    }

    // Para cada asignatura, registrar su Syllabus para las carreras que la usan
    // O por defecto registrarla en todas las carreras para mayor cobertura
    for (const [idAsig, nameAsig] of asignaturasMap.entries()) {
      for (const career of FIME_CAREERS) {
        const syllabusKey = `${slugify(nameAsig)}-${career.id}`;
        
        await client.query(`
          INSERT INTO subject_syllabus (slug, subject_name, career_id, program_description, evaluation_criteria, resources)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (slug) DO NOTHING;
        `, [
          syllabusKey,
          nameAsig,
          career.id,
          null,
          JSON.stringify({}),
          JSON.stringify([])
        ]);
      }
    }
    console.log('✅ Asignaturas y syllabus insertados con éxito.');

    // 5. Cargar Lecciones (Mapeo de combinaciones Profesor-Clase-Asignatura)
    console.log('📖 Cargando lecciones desde lecciones.csv...');
    const leccionesRows = readCSV(path.join(dbHorariosDir, 'lecciones.csv'));
    console.log(`Encontrados ${leccionesRows.length} lecciones.`);

    // Crear un mapa de combinación para resolver el profesor de un horario
    // key: `${id_clase}-${id_asignatura}` -> id_profesor
    const lessonProfessorMap = new Map();
    for (const lecc of leccionesRows) {
      const idClase = parseInt(lecc.id_clase, 10);
      const idAsig = parseInt(lecc.id_asignatura, 10);
      const idProf = parseInt(lecc.id_profesor, 10);
      if (idClase && idAsig && idProf) {
        lessonProfessorMap.set(`${idClase}-${idAsig}`, idProf);
      }
    }

    // 6. Cargar Horarios Detalle
    console.log('📅 Cargando horarios detallados desde horarios_detalle.csv...');
    const horariosRows = readCSV(path.join(dbHorariosDir, 'horarios_detalle.csv'));
    console.log(`Encontrados ${horariosRows.length} registros de horarios.`);

    for (const hor of horariosRows) {
      const idClase = parseInt(hor.id_clase, 10);
      const idAsig = parseInt(hor.id_asignatura, 10);
      const esHti = parseInt(hor.es_hti, 10) === 1;
      const dia = hor.dia;
      const periodo = parseInt(hor.periodo, 10);
      
      const subjectName = asignaturasMap.get(idAsig) || 'Materia Desconocida';
      const profId = lessonProfessorMap.get(`${idClase}-${idAsig}`) || null;
      
      const timeSlot = timeSlotsMap[periodo];
      if (!timeSlot) {
        console.warn(`⚠️ Periodo desconocido: ${periodo} para horario ID ${hor.id_horario}`);
        continue;
      }
      const startTime = timeSlot[0];
      const endTime = timeSlot[1];
      
      const isLab = subjectName.toLowerCase().includes('taller') || 
                    subjectName.toLowerCase().includes('laboratorio') || 
                    subjectName.toLowerCase().includes('práctica') || 
                    subjectName.toLowerCase().includes('computación') || 
                    subjectName.toLowerCase().includes('experimental');

      // Insertar en schedules
      await client.query(`
        INSERT INTO schedules (class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory, is_hti)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `, [
        idClase,
        subjectName,
        profId,
        isLab ? 'Cómputo y Talleres' : 'Aulas',
        dia,
        startTime,
        endTime,
        isLab,
        esHti
      ]);

      // Insertar asignación profesor-grupo
      if (profId) {
        await client.query(`
          INSERT INTO professor_groups (professor_id, class_group_id, subject_taught)
          VALUES ($1, $2, $3)
          ON CONFLICT (professor_id, class_group_id, subject_taught) DO NOTHING;
        `, [profId, idClase, subjectName]);
      }
    }
    console.log('✅ Horarios insertados con éxito.');

    // 7. Cuentas de Estudiantes de Prueba (Solo credenciales provistas)
    console.log('👨‍🎓 Creando cuenta de estudiante de prueba...');
    const firstGroupRes = await client.query('SELECT id, slug FROM class_groups LIMIT 1');
    const firstGroupId = firstGroupRes.rows[0] ? firstGroupRes.rows[0].id : null;
    if (firstGroupId) {
      await client.query(`
        INSERT INTO students (enrollment_id, full_name, email, password_hash, class_group_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (enrollment_id) DO NOTHING;
      `, ['20180000', 'Miguel Ángel Ortiz', 'miguel@ucol.mx', 'password', firstGroupId]);
    }

    // 9. Usuarios Administradores del AdminHUB
    console.log('🔐 Creando usuarios administradores...');
    const profsRes = await client.query('SELECT id, email FROM professors LIMIT 3');
    const prof1 = profsRes.rows[0];
    const prof2 = profsRes.rows[1];

    await client.query(`
      INSERT INTO admin_users (username, email, password_hash, role, professor_id, career_id, faculty_id, faculty_ids) VALUES
      ('admin',       'admin@ucol.mx',        $1, 'admin_general',         NULL, NULL, NULL, NULL),
      ('jefe.carrera','jcarrera@ucol.mx',     $1, 'jefe_carrera',          NULL, 349, NULL, NULL),
      ('coord.fic',   'cfic@ucol.mx',         $1, 'coordinador_facultad',  NULL, NULL, 4, NULL),
      ('admin.dir',   'admindir@ucol.mx',     $1, 'admin_direccion',       NULL, NULL, NULL, ARRAY[4])
      ON CONFLICT (username) DO NOTHING;
    `, [DEFAULT_PASSWORD_HASH]);

    if (prof1) {
      await client.query(`
        INSERT INTO admin_users (username, email, password_hash, role, professor_id)
        VALUES ($1, $2, $3, 'docente', $4)
        ON CONFLICT (username) DO NOTHING;
      `, ['docente1', 'docente1@ucol.mx', DEFAULT_PASSWORD_HASH, prof1.id]);
    }
    if (prof2) {
      await client.query(`
        INSERT INTO admin_users (username, email, password_hash, role, professor_id)
        VALUES ($1, $2, $3, 'docente', $4)
        ON CONFLICT (username) DO NOTHING;
      `, ['docente2', 'docente2@ucol.mx', DEFAULT_PASSWORD_HASH, prof2.id]);
    }
    console.log('✅ Usuarios del AdminHUB insertados.');

    console.log('\n🎉 ¡La base de datos ha sido exitosamente reconstruida con los datos reales de db_horarios!');

  } catch (err) {
    console.error('❌ Error durante la siembra de base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
