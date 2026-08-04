const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://admin:admin_pass@localhost:5432/pica_db';
const pool = new Pool({ connectionString });

// Careers of FIME in UCOL
const FIME_CAREERS = [
  { id: 349, slug: 'ingenieria-en-computacion-inteligente', name: 'Ingeniería en Computación Inteligente', groups: ['B', 'D'] },
  { id: 371, slug: 'ingeniero-mecanico-electricista', name: 'Ingeniero Mecánico Electricista', groups: ['A', 'G', 'H'] },
  { id: 418, slug: 'ingenieria-en-mecatronica', name: 'Ingeniería en Mecatrónica', groups: ['I', 'J'] },
  { id: 99, slug: 'ingenieria-en-sistemas-electronicos-y-telecomunicaciones', name: 'Ingeniería en Sistemas Electrónicos y Telecomunicaciones', groups: ['C'] }
];

const INITIALS_MAP = {
  'AFJL': 'Álvarez Flores José Luis',
  'AGR': 'García Rebolledo Azael',
  'BCHG': 'Batista Castro Hugo Giovanny',
  'BGAG': 'Barragán González Ángel Gabriel',
  'CAB': 'Cerrato Abdalá Brenda',
  'CABL': 'Carrillo Avila Blanca Lorena',
  'DAJP': 'Díaz Álvarez Juan Pablo',
  'FCRA': 'Félix Cuadras Ramón Antonio',
  'GPA': 'González Potes Apolinar',
  'HPE': 'Huizar Padilla Emilio',
  'IPM': 'Plascencia Manzo Imelda',
  'JGAI': 'Jardines González Arturo Iván',
  'JGAL': 'Jardines González Arturo Iván',
  'LBG': 'López Barajas Gabriel',
  'LEIT': 'Ibarra Terrones Lourdes Edurnne',
  'MBFMR': 'Maciel Barboza Fermín Marcelo Rubén',
  'MCS': 'Martínez Camarena Sonia',
  'MOJU': 'Mora Quiñones Jesús Uriel',
  'MQJU': 'Mora Quiñones Jesús Uriel',
  'MSGJ': 'Martínez Sánchez Gregorio Josué',
  'NMG': 'Navarro Márquez Gabriel',
  'OBAM': 'Ochoa Brust Alberto Manuel',
  'PJM': 'Paredes Jacquez Manfredo',
  'PPZ': 'Pérez Pérez Zhared',
  'RBIN': 'Rodriguez Barragán Irving Naim',
  'REA': 'Regalado Escobedo Alejandro',
  'RMJM': 'Rodriguez Monroy José Miguel',
  'SADA': 'Sierra Andrade David Alejandro',
  'SEL': 'Soriano Equigua Leonel',
  'SMTA': 'Santillán Mata Tomás Adalberto',
  'TCCA': 'Torres Cantero Carlos Alberto',
  'VFEE': 'Fernández Erik Eduardo',
  'VTT': 'Venegas Trujillo Tiberio',
  'VVEH': 'Valencia Valencia Elías Humberto',
  'MPN': 'Docente MPN' // Fallback
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

// Cargar Hash bcrypt pregenerado para la contraseña "prueba123"
const DEFAULT_PASSWORD_HASH = '$2b$10$sJ9wtmXBK9UWArp7EGfUCupb05kG9R6jRwrqDdSS3uq0lcrcHQI42';

async function seed() {
  console.log('🔌 Conectando a la base de datos de PICA-UCOL...');
  const client = await pool.connect();

  try {
    // 1. Limpieza de base de datos
    console.log('🧹 Limpiando registros anteriores de la base de datos...');
    await client.query('TRUNCATE admin_users, exam_dates, schedules, professor_groups, students, class_groups, professors, subject_syllabus CASCADE');

    // 2. Leer y parsear el archivo CSV
    console.log('📄 Leyendo archivo horarios_completos (1).csv...');
    const csvPath = path.join(process.cwd(), 'horarios_completos (1).csv');
    let csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Remover UTF-8 BOM si está presente
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.substring(1);
    }

    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    console.log('Headers detectados:', headers);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length >= headers.length) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = parts[idx];
        });
        rows.push(row);
      }
    }
    console.log(`✅ CSV cargado con ${rows.length} registros de horarios.`);

    // 3. Extraer e insertar Profesores Únicos
    console.log('👨‍🏫 Identificando profesores...');
    const uniqueProfs = new Set();
    
    // Primero recolectar todos los nombres de profesores (despejando las iniciales)
    rows.forEach(row => {
      const doc = row['Docente'] ? row['Docente'].trim() : '';
      if (doc && doc !== '-') {
        const names = doc.split(/\s*\/\s*/);
        names.forEach(name => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== '-') {
            const resolved = INITIALS_MAP[trimmed] || trimmed;
            if (resolved.length > 6) { // Ignorar siglas sin resolver en esta fase
              uniqueProfs.add(resolved);
            }
          }
        });
      }
      
      const sub = row['Materia'] ? row['Materia'].trim() : '';
      // A veces los docentes vienen en el campo de materia para horas compartidas o tutorías
      if (sub && sub !== '-') {
        const parts = sub.split(/\s*\/\s*/);
        parts.forEach(part => {
          const trimmed = part.trim();
          const resolved = INITIALS_MAP[trimmed] || trimmed;
          if (resolved.length > 6 && (resolved.includes(' ') || resolved.includes('á') || resolved.includes('í') || resolved.includes('ó'))) {
            // Es un nombre completo
            if (!trimmed.toLowerCase().includes('instalaciones') && 
                !trimmed.toLowerCase().includes('dibujo') && 
                !trimmed.toLowerCase().includes('física') && 
                !trimmed.toLowerCase().includes('precalculo') && 
                !trimmed.toLowerCase().includes('precálculo') && 
                !trimmed.toLowerCase().includes('expresión') && 
                !trimmed.toLowerCase().includes('orientación') && 
                !trimmed.toLowerCase().includes('inglés') &&
                !trimmed.toLowerCase().includes('común')) {
              uniqueProfs.add(resolved);
            }
          }
        });
      }
    });

    // Agregar fallbacks conocidos
    uniqueProfs.add('Docente MPN');

    console.log(`Encontrados ${uniqueProfs.size} profesores únicos. Insertando...`);
    const professorMap = new Map(); // name -> db_id
    const professorList = Array.from(uniqueProfs);

    for (let i = 0; i < professorList.length; i++) {
      const fullName = professorList[i];
      const baseSlug = slugify(fullName);
      const slug = `${baseSlug}-${i + 1}`;
      const email = `${baseSlug.replace(/-/g, '.')}@ucol.mx`;
      
      const profileData = {
        slug,
        fullName,
        photoUrl: '/images/profesores/default.jpg',
        title: 'Profesor de FIME',
        department: 'Facultad de Ingeniería Mecánica y Eléctrica',
        institutionalEmail: email,
        admissionYear: 2015,
        contactInfo: {
          phone: '312 316 1000 Ext. ' + (100 + i),
          office: 'Edificio FIME PTC, Cubículo ' + (i + 1),
          officeHours: 'Lunes a Jueves 11:00-13:00'
        },
        academicFormation: {
          doctorados: [],
          maestrias: [],
          licenciatura: {
            degree: 'Ingeniería',
            institution: 'Universidad de Colima',
            year: 2010
          }
        },
        scientificProduction: { articles: [], books: [] },
        educationalMaterials: [],
        teaching: { courses: [], theses: [] },
        certifications: [],
        academicBody: {
          name: 'Cuerpo Académico de FIME',
          level: 'En Consolidación'
        }
      };

      const profRes = await client.query(`
        INSERT INTO professors (slug, full_name, email, delegation_id, profile_data)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `, [slug, fullName, email, 4, JSON.stringify(profileData)]); // 4 = Coquimatlán
      
      professorMap.set(fullName, profRes.rows[0].id);
    }
    console.log('✅ Profesores insertados con éxito.');

    // 4. Determinar e Insertar Grupos Únicos
    console.log('🏫 Identificando grupos de clase...');
    const uniqueGroups = new Set();
    rows.forEach(row => {
      if (row['Grupo']) uniqueGroups.add(row['Grupo'].trim());
    });

    console.log(`Encontrados ${uniqueGroups.size} grupos únicos. Mapeando a carreras y semestres...`);
    const groupMap = new Map(); // group_name -> db_id
    const groupList = Array.from(uniqueGroups);

    for (const groupName of groupList) {
      const match = groupName.match(/^(\d+)\s+([A-J])$/i);
      if (!match) {
        console.warn(`⚠️ Grupo con formato no reconocido: ${groupName}, ignorando.`);
        continue;
      }
      const semester = parseInt(match[1], 10);
      const letter = match[2].toUpperCase();
      const slugGroup = `${semester}-${letter.toLowerCase()}`;

      // Encontrar la carrera basada en la letra
      let career = FIME_CAREERS.find(c => c.groups.includes(letter));
      if (!career) {
        career = FIME_CAREERS[0];
      }

      const groupSlug = `${slugGroup}-${career.id}`;
      const shift = semester <= 5 ? 'Matutino' : 'Vespertino';

      const res = await client.query(`
        INSERT INTO class_groups (slug, career_id, name, academic_period, shift, semester, group_letter)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id;
      `, [groupSlug, career.id, `${semester}° ${letter}`, 'Ago-Ene 2026', shift, semester, letter]);

      groupMap.set(groupName, res.rows[0].id);
    }
    console.log('✅ Grupos de clase insertados.');

    // 5. Insertar Materias, Syllabus, Profesor-Grupo y Horarios con lógica inteligente
    console.log('📅 Insertando horarios y asignaciones de materias...');
    const subjectSyllabusMap = new Map(); // subject_name-career_id -> slug

    for (const row of rows) {
      const groupName = row['Grupo'] ? row['Grupo'].trim() : '';
      const day = row['Día'] ? row['Día'].trim() : '';
      const horarioStr = row['Horario'] ? row['Horario'].trim() : '';
      const subjectStr = row['Materia'] ? row['Materia'].trim() : '';
      const docenteStr = row['Docente'] ? row['Docente'].trim() : '';
      const observaciones = row['Observaciones'] ? row['Observaciones'].trim() : '';

      if (!groupName || !day || !horarioStr || !subjectStr) continue;

      const groupDbId = groupMap.get(groupName);
      if (!groupDbId) continue;

      const groupRes = await client.query('SELECT career_id FROM class_groups WHERE id = $1', [groupDbId]);
      const careerId = groupRes.rows[0].career_id;

      // Parsear el horario (Ej: "07:00 - 07:50")
      const timeMatch = horarioStr.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
      if (!timeMatch) {
        console.warn(`⚠️ Horario con formato inválido: ${horarioStr} para grupo ${groupName}`);
        continue;
      }
      const startTime = `${timeMatch[1]}:00`;
      const endTime = `${timeMatch[2]}:00`;

      // Resolver profesores e identificarlos
      let docTeachers = [];
      if (docenteStr && docenteStr !== '-') {
        docTeachers = docenteStr.split(/\s*\/\s*/).map(p => {
          const trimmed = p.trim();
          return INITIALS_MAP[trimmed] || trimmed;
        }).filter(t => t && t !== '-');
      }

      const matParts = subjectStr.split(/\s*\/\s*/);
      const matTeachers = [];
      const subjects = [];

      matParts.forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        
        const resolved = INITIALS_MAP[trimmed] || trimmed;
        if (uniqueProfs.has(resolved) || INITIALS_MAP[trimmed]) {
          matTeachers.push(resolved);
        } else {
          subjects.push(trimmed);
        }
      });

      const allTeachers = [...matTeachers, ...docTeachers];
      if (subjects.length === 0) {
        subjects.push('HTI');
      }

      // Generar entradas de horario
      const scheduleEntries = [];
      if (allTeachers.length === 0) {
        subjects.forEach(sub => {
          scheduleEntries.push({ subject: sub, teacherName: null });
        });
      } else {
        if (allTeachers.length === subjects.length) {
          for (let i = 0; i < allTeachers.length; i++) {
            scheduleEntries.push({ subject: subjects[i], teacherName: allTeachers[i] });
          }
        } else if (subjects.length === 1) {
          allTeachers.forEach(t => {
            scheduleEntries.push({ subject: subjects[0], teacherName: t });
          });
        } else {
          for (let i = 0; i < allTeachers.length; i++) {
            const sub = subjects[i] || subjects[0] || 'HTI';
            scheduleEntries.push({ subject: sub, teacherName: allTeachers[i] });
          }
        }
      }

      // Insertar cada entrada resuelta en la DB
      for (const entry of scheduleEntries) {
        const professorId = entry.teacherName ? (professorMap.get(entry.teacherName) || null) : null;
        const isLab = entry.subject.toLowerCase().includes('taller') || 
                      entry.subject.toLowerCase().includes('laboratorio') || 
                      observaciones.toLowerCase().includes('laboratorio') || 
                      observaciones.toLowerCase().includes('lab');

        await client.query(`
          INSERT INTO schedules (class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, [
          groupDbId,
          entry.subject,
          professorId,
          isLab ? 'Cómputo y Talleres' : 'Aulas',
          day,
          startTime,
          endTime,
          isLab
        ]);

        if (professorId) {
          await client.query(`
            INSERT INTO professor_groups (professor_id, class_group_id, subject_taught)
            VALUES ($1, $2, $3)
            ON CONFLICT (professor_id, class_group_id, subject_taught) DO NOTHING;
          `, [professorId, groupDbId, entry.subject]);
        }

        // Registrar Syllabus
        const syllabusKey = `${slugify(entry.subject)}-${careerId}`;
        if (!subjectSyllabusMap.has(syllabusKey)) {
          const evalCriteria = {
            "Exámenes": "50%",
            "Prácticas y Laboratorio": "30%",
            "Tareas y Proyectos": "20%"
          };

          await client.query(`
            INSERT INTO subject_syllabus (slug, subject_name, career_id, program_description, evaluation_criteria, resources, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (slug) DO NOTHING;
          `, [
            syllabusKey,
            entry.subject,
            careerId,
            `Programa oficial para la asignatura de ${entry.subject}.`,
            JSON.stringify(evalCriteria),
            JSON.stringify([]),
            professorId
          ]);

          subjectSyllabusMap.set(syllabusKey, true);
        }
      }
    }
    console.log('✅ Horarios, asignaciones y syllabus insertados con éxito.');

    // 6. Fechas de Exámenes Simuladas para cada materia real en cada grupo
    console.log('📅 Generando fechas de exámenes para las materias reales...');
    const groupSubjectsRes = await client.query('SELECT DISTINCT class_group_id, subject_name FROM schedules');
    for (const row of groupSubjectsRes.rows) {
      await client.query(`
        INSERT INTO exam_dates (class_group_id, subject_name, exam_name, exam_date, exam_time) VALUES
        ($1, $2, 'Evaluación de 1er Parcial', '2026-10-14', '09:00:00'),
        ($1, $2, 'Evaluación de 2do Parcial', '2026-11-20', '09:00:00');
      `, [row.class_group_id, row.subject_name]);
    }
    console.log('✅ Fechas de exámenes generadas.');

    // 7. Cuentas de Estudiantes de Prueba
    console.log('👨‍🎓 Creando cuentas de estudiantes de prueba...');
    // Estudiante por defecto "miguel@ucol.mx" en el primer grupo real
    const firstGroupRes = await client.query('SELECT id, slug FROM class_groups LIMIT 1');
    const firstGroupId = firstGroupRes.rows[0].id;
    await client.query(`
      INSERT INTO students (enrollment_id, full_name, email, password_hash, class_group_id)
      VALUES ($1, $2, $3, $4, $5);
    `, ['20180000', 'Miguel Ángel Ortiz', 'miguel@ucol.mx', 'password', firstGroupId]);

    // Crear un estudiante de prueba para cada grupo
    const allGroupsRes = await client.query('SELECT id, slug FROM class_groups');
    let enrollmentCounter = 20260001;
    for (const group of allGroupsRes.rows) {
      const email = `estudiante.${group.slug.replace(/-/g, '_')}@ucol.mx`;
      await client.query(`
        INSERT INTO students (enrollment_id, full_name, email, password_hash, class_group_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (enrollment_id) DO NOTHING;
      `, [String(enrollmentCounter++), `Estudiante Prueba ${group.slug.toUpperCase()}`, email, 'password', group.id]);
    }
    console.log(`✅ Creadas ${allGroupsRes.rows.length + 1} cuentas de estudiantes.`);

    // 8. Usuarios Administradores del AdminHUB
    console.log('🔐 Creando usuarios administradores...');
    const profsRes = await client.query('SELECT id, email FROM professors LIMIT 3');
    const prof1 = profsRes.rows[0];
    const prof2 = profsRes.rows[1];

    await client.query(`
      INSERT INTO admin_users (username, email, password_hash, role, professor_id, career_id, faculty_id, faculty_ids) VALUES
      ('admin',       'admin@ucol.mx',        $1, 'admin_general',         NULL, NULL, NULL, NULL),
      ('jefe.carrera','jcarrera@ucol.mx',     $1, 'jefe_carrera',          NULL, 349, NULL, NULL),
      ('coord.fic',   'cfic@ucol.mx',         $1, 'coordinador_facultad',  NULL, NULL, 4, NULL), -- 4 = Coquimatlán
      ('admin.dir',   'admindir@ucol.mx',     $1, 'admin_direccion',       NULL, NULL, NULL, ARRAY[4])
    `, [DEFAULT_PASSWORD_HASH]);

    if (prof1) {
      await client.query(`
        INSERT INTO admin_users (username, email, password_hash, role, professor_id)
        VALUES ($1, $2, $3, 'docente', $4);
      `, [prof1.email.split('@')[0], prof1.email, DEFAULT_PASSWORD_HASH, prof1.id]);
    }
    if (prof2) {
      await client.query(`
        INSERT INTO admin_users (username, email, password_hash, role, professor_id)
        VALUES ($1, $2, $3, 'docente', $4);
      `, [prof2.email.split('@')[0], prof2.email, DEFAULT_PASSWORD_HASH, prof2.id]);
    }
    console.log('✅ Usuarios del AdminHUB insertados.');

    console.log('\n🎉 ¡La base de datos ha sido exitosamente reconstruida con datos reales!');

  } catch (err) {
    console.error('❌ Error durante la siembra de base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
