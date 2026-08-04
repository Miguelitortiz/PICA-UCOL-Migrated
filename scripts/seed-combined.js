const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://admin:admin_pass@localhost:5432/pica_db';
const pool = new Pool({ connectionString });

// Datos de Carreras de FIME en UCOL (de seed-fime-data.js)
const FIME_CAREERS = [
  { id: 349, slug: 'ingenieria-en-computacion-inteligente', name: 'Ingeniería en Computación Inteligente', groups: ['B', 'D'] },
  { id: 371, slug: 'ingeniero-mecanico-electricista', name: 'Ingeniero Mecánico Electricista', groups: ['A', 'G', 'H'] },
  { id: 418, slug: 'ingenieria-en-mecatronica', name: 'Ingeniería en Mecatrónica', groups: ['I', 'J'] },
  { id: 99, slug: 'ingenieria-en-sistemas-electronicos-y-telecomunicaciones', name: 'Ingeniería en Sistemas Electrónicos y Telecomunicaciones', groups: ['C'] }
];

// Semestres impares a sembrar
const ODD_SEMESTERS = [1, 3, 5, 7, 9];

// Carga de materias por carrera y grado (Semestres Impares)
const CAREER_SUBJECTS = {
  349: { // ICI
    1: ["Precálculo", "Matemáticas Discretas", "Fundamentos de Programación", "Física General", "Epistemología Computacional", "Inglés I"],
    3: ["Estructuras de Datos", "Cálculo Integral", "Álgebra Lineal y Vectorial", "Programación Orientada a Objetos", "Circuitos Eléctricos y Electrónicos", "Inglés III"],
    5: ["Bases de Datos", "Inteligencia Artificial I", "Análisis y Diseño de Algoritmos", "Redes de Computadoras I", "Sistemas Operativos Modernos", "Ingeniería de Software I"],
    7: ["Aprendizaje de Máquina (Machine Learning)", "Minería de Datos", "Visión por Computadora", "Cómputo en la Nube", "Proyecto Integrador I", "Ética Profesional y Sociedad"],
    9: ["Estancia Profesional", "Proyecto de Titulación", "Temas Selectos de Inteligencia Artificial"]
  },
  371: { // IME
    1: ["Álgebra y Trigonometría", "Química General", "Introducción a la IME", "Dibujo para Ingeniería", "Física I (Mecánica)", "Inglés I"],
    3: ["Cálculo Vectorial", "Termodinámica Clásica", "Estática", "Circuitos Eléctricos I", "Ciencia de Materiales", "Inglés III"],
    5: ["Dinámica de Fluidos", "Mecánica de Materiales I", "Máquinas Eléctricas I", "Electrónica Analógica", "Análisis de Sistemas de Potencia", "Métodos Numéricos"],
    7: ["Transferencia de Calor", "Diseño de Elementos de Máquinas", "Instalaciones Eléctricas Industriales", "Control Automático", "Subestaciones Eléctricas", "Ingeniería Económica"],
    9: ["Centrales Eléctricas", "Mantenimiento Industrial", "Proyecto de IME", "Vibraciones Mecánicas", "Seguridad e Higiene Industrial"]
  },
  418: { // IMT
    1: ["Precálculo", "Álgebra Lineal", "Introducción a la Mecatrónica", "Dibujo Asistido por Computadora", "Química de Materiales", "Inglés I"],
    3: ["Cálculo Multivariable", "Estática y Dinámica", "Circuitos Eléctricos", "Programación Estructurada", "Metrología e Instrumentación", "Inglés III"],
    5: ["Mecánica de Materiales", "Electrónica Digital y Microcontroladores", "Teoría de Control", "Mecanismos y Elementos de Máquinas", "Sensores y Actuadores", "Termofluidos"],
    7: ["Robótica Industrial", "Sistemas Oleohidráulicos y Neumáticos", "Diseño Mecatrónico", "Autómatas Programables (PLC)", "Control Digital", "Formulación de Proyectos"],
    9: ["Integración Mecatrónica (CIM)", "Estancia Profesional", "Mantenimiento y Seguridad Mecatrónica"]
  },
  99: { // ISET
    1: ["Matemáticas Básicas", "Física de Mecánica", "Introducción a la Electrónica y Telecom", "Programación en C", "Química Básica", "Inglés I"],
    3: ["Cálculo de Varias Variables", "Teoría de Circuitos I", "Electrónica de Diodos y Transistores", "Matemáticas Especiales", "Teoría Electromagnética", "Inglés III"],
    5: ["Electrónica Analógica Avanzada", "Sistemas de Comunicación Analógica", "Microcontroladores", "Líneas de Transmisión y Antenas", "Procesamiento Digital de Señales", "Redes de Datos"],
    7: ["Sistemas de Comunicación Digital", "Comunicaciones por Satélite", "Instrumentación Electrónica", "Redes de Nueva Generación", "Electrónica de Potencia", "Administración de Proyectos"],
    9: ["Comunicaciones Ópticas", "Telefonía Móvil", "Proyecto de Telecomunicaciones", "Regulación y Políticas de Telecom"]
  }
};

// Generador de nombres aleatorios
const FIRST_NAMES = ['José', 'María', 'Luis', 'Ana', 'Carlos', 'Laura', 'Juan', 'Elena', 'Francisco', 'Patricia', 'Jorge', 'Sofía', 'Miguel', 'Clara', 'Fernando', 'Lucía', 'David', 'Gabriela', 'Roberto', 'Isabel'];
const LAST_NAMES = ['González', 'Rodríguez', 'García', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'López', 'Ruiz', 'Hernández', 'Díaz', 'Álvarez', 'Moreno', 'Muñoz', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Vargas'];
const ACADEMIC_TITLES = ['Profesor Investigador de Tiempo Completo (PTC)', 'Profesor de Asignatura', 'Profesor Asociado C', 'Investigador Titular B'];
const DEPARTMENTS = ['Facultad de Ingeniería Mecánica y Eléctrica', 'Facultad de Contabilidad y Administración', 'Facultad de Teleinformática', 'Facultad de Ciencias Químicas', 'Facultad de Ciencias de la Educación'];
const SUBJECTS = ['Programación Estructurada', 'Bases de Datos', 'Inteligencia Artificial', 'Redes de Computadoras', 'Cálculo Diferencial', 'Sistemas Operativos', 'Ingeniería de Software', 'Álgebra Lineal', 'Física General', 'Teoría de Autómatas'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slugify(text) {
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

// Cargar Hash bcrypt pregenerado para la contraseña "prueba123"
const DEFAULT_PASSWORD_HASH = '$2b$10$sJ9wtmXBK9UWArp7EGfUCupb05kG9R6jRwrqDdSS3uq0lcrcHQI42';

async function seed() {
  console.log('🔌 Conectando a la base de datos de PICA-UCOL...');
  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // Fase 1: Limpieza General de la DB
    // -------------------------------------------------------------------------
    console.log('🧹 Limpiando registros anteriores de la base de datos...');
    await client.query('TRUNCATE admin_users, exam_dates, schedules, professor_groups, students, class_groups, professors, subject_syllabus CASCADE');

    // -------------------------------------------------------------------------
    // Fase 2: Sembrado de datos detallados de FIME (de seed-fime-data.js)
    // -------------------------------------------------------------------------
    console.log('📝 Generando 45 profesores de FIME...');
    const fimeProfessors = [];
    for (let i = 1; i <= 45; i++) {
      const isFemale = Math.random() > 0.5;
      const firstName = getRandomElement(FIRST_NAMES);
      const lastName1 = getRandomElement(LAST_NAMES);
      const lastName2 = getRandomElement(LAST_NAMES);
      const prefix = i % 3 === 0 ? (isFemale ? 'Dra.' : 'Dr.') : (isFemale ? 'Mtra.' : 'Mtro.');
      const fullName = `${prefix} ${firstName} ${lastName1} ${lastName2}`;
      const baseSlug = slugify(`${firstName}-${lastName1}-${lastName2}`);
      const slug = `${baseSlug}-${i}`;
      const email = `${slugify(firstName)}.${slugify(lastName1)}_${i}@ucol.mx`;
      
      const title = getRandomElement(ACADEMIC_TITLES);
      const admissionYear = getRandomInt(1998, 2025);

      const profileData = {
        slug,
        fullName,
        photoUrl: '/images/profesores/default.jpg',
        title,
        department: 'Facultad de Ingeniería Mecánica y Eléctrica',
        institutionalEmail: email,
        admissionYear,
        contactInfo: {
          phone: `312 316 1000 Ext. ${100 + i}`,
          office: `Edificio FIME PTC, Cubículo ${i}`,
          officeHours: 'Lunes a Jueves 11:00-13:00'
        },
        academicFormation: {
          doctorados: prefix.startsWith('Dr') ? [{
            degree: 'Doctor en Ciencias de la Ingeniería',
            institution: 'Universidad de Colima',
            year: admissionYear + 4
          }] : [],
          maestrias: [{
            degree: 'Maestría en Ingeniería Aplicada',
            institution: 'Universidad de Colima',
            year: admissionYear - 1
          }],
          licenciatura: {
            degree: 'Ingeniería Universitaria',
            institution: 'Universidad de Colima',
            year: admissionYear - 5
          }
        },
        scientificProduction: {
          articles: [
            {
              title: `Análisis e Investigación en Ingeniería Aplicada - Caso ${i}`,
              journal: 'Revista de Investigación Científica FIME-UCOL',
              year: 2025,
              doi: `https://doi.org/10.1007/fime-mock-doi-${i}`
            }
          ],
          books: []
        },
        educationalMaterials: [],
        teaching: {
          courses: [],
          theses: []
        },
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
      `, [slug, fullName, email, 4, JSON.stringify(profileData)]); // Delegación 4 = Coquimatlán

      fimeProfessors.push({
        id: profRes.rows[0].id,
        slug,
        fullName,
        email
      });
    }
    console.log(`✅ ${fimeProfessors.length} profesores de FIME inyectados.`);

    console.log('🏫 Creando grupos de clase para FIME (semestres impares)...');
    const fimeGroups = [];
    for (const career of FIME_CAREERS) {
      for (const semester of ODD_SEMESTERS) {
        for (const letter of career.groups) {
          const groupName = `${semester}° ${letter}`;
          const groupSlug = `${semester}-${letter.toLowerCase()}-${career.id}`;
          const shift = semester <= 5 ? 'Matutino' : 'Vespertino';

          const res = await client.query(`
            INSERT INTO class_groups (slug, career_id, name, academic_period, shift, semester, group_letter)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, career_id, name, slug;
          `, [groupSlug, career.id, groupName, 'Ago-Ene 2026', shift, semester, letter]);

          fimeGroups.push(res.rows[0]);
        }
      }
    }
    console.log(`✅ ${fimeGroups.length} grupos de clase creados para FIME.`);

    console.log('📚 Creando planes de estudio (Syllabus) de FIME...');
    for (const careerId of Object.keys(CAREER_SUBJECTS)) {
      const semesters = CAREER_SUBJECTS[careerId];
      for (const sem of Object.keys(semesters)) {
        const subjects = semesters[sem];
        for (const sub of subjects) {
          const slug = slugify(`${sub}-${careerId}`);
          const creator = getRandomElement(fimeProfessors);
          const evalCriteria = {
            "Exámenes": "50%",
            "Prácticas y Laboratorio": "30%",
            "Tareas y Proyectos": "20%"
          };
          
          await client.query(`
            INSERT INTO subject_syllabus (slug, subject_name, career_id, program_description, evaluation_criteria, resources, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
          `, [
            slug,
            sub,
            parseInt(careerId, 10),
            `Programa académico oficial para la materia de ${sub} dentro de la carrera. Se enfoca en las competencias profesionales del perfil del egresado de FIME.`,
            JSON.stringify(evalCriteria),
            JSON.stringify([]),
            creator.id
          ]);
        }
      }
    }
    console.log('✅ Catálogo de Planes de Estudio (Syllabus) FIME inicializado.');

    console.log('👨‍🏫 Asignando profesores de FIME a materias y grupos (evitando traslapes)...');
    const defaultCareerSubjectProf = {}; 
    const groupBusySlots = {};
    const profBusySlots = {};
    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const SLOTS = [
      { start: '07:00:00', end: '09:00:00' },
      { start: '09:00:00', end: '11:00:00' },
      { start: '11:00:00', end: '13:00:00' },
      { start: '13:00:00', end: '15:00:00' }
    ];

    fimeGroups.forEach(g => {
      groupBusySlots[g.id] = {};
      DAYS.forEach(d => {
        groupBusySlots[g.id][d] = [false, false, false, false];
      });
    });

    fimeProfessors.forEach(p => {
      profBusySlots[p.id] = {};
      DAYS.forEach(d => {
        profBusySlots[p.id][d] = [false, false, false, false];
      });
    });

    const groupProfessorMap = {};

    for (const group of fimeGroups) {
      groupProfessorMap[group.id] = new Set();
      const subjects = CAREER_SUBJECTS[group.career_id][parseInt(group.name.split('°')[0])];
      
      for (const subjectName of subjects) {
        const key = `${group.career_id}_${subjectName}`;
        if (!defaultCareerSubjectProf[key]) {
          defaultCareerSubjectProf[key] = getRandomElement(fimeProfessors).id;
        }

        let assignedProfId = defaultCareerSubjectProf[key];
        if (Math.random() < 0.15) {
          assignedProfId = getRandomElement(fimeProfessors).id;
        }

        groupProfessorMap[group.id].add(assignedProfId);

        await client.query(`
          INSERT INTO professor_groups (professor_id, class_group_id, subject_taught)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING;
        `, [assignedProfId, group.id, subjectName]);

        const isLab = subjectName.toLowerCase().includes('programación') || 
                      subjectName.toLowerCase().includes('laboratorio') || 
                      subjectName.toLowerCase().includes('circuitos') || 
                      subjectName.toLowerCase().includes('redes') || 
                      subjectName.toLowerCase().includes('electrónica') ||
                      subjectName.toLowerCase().includes('robótica');

        const classroom = isLab 
          ? (subjectName.toLowerCase().includes('programación') || subjectName.toLowerCase().includes('redes') ? 'Laboratorio de Cómputo' : 'Laboratorio de Electrónica') 
          : `Aula ${getRandomInt(1, 10)}`;

        const dayPairs = Math.random() > 0.5 ? [['Lunes', 'Miércoles'], ['Lunes', 'Miércoles']] : [['Martes', 'Jueves'], ['Martes', 'Jueves']];
        const assignedDays = dayPairs[0];

        let foundSlotIndex = -1;
        for (let slotIdx = 0; slotIdx < SLOTS.length; slotIdx++) {
          let slotFree = true;
          for (const day of assignedDays) {
            if (groupBusySlots[group.id][day][slotIdx] || profBusySlots[assignedProfId][day][slotIdx]) {
              slotFree = false;
              break;
            }
          }
          if (slotFree) {
            foundSlotIndex = slotIdx;
            break;
          }
        }

        if (foundSlotIndex === -1) {
          outerLoop:
          for (let slotIdx = 0; slotIdx < SLOTS.length; slotIdx++) {
            for (let d1 = 0; d1 < DAYS.length - 1; d1++) {
              for (let d2 = d1 + 1; d2 < DAYS.length; d2++) {
                const day1 = DAYS[d1];
                const day2 = DAYS[d2];
                if (!groupBusySlots[group.id][day1][slotIdx] && !profBusySlots[assignedProfId][day1][slotIdx] &&
                    !groupBusySlots[group.id][day2][slotIdx] && !profBusySlots[assignedProfId][day2][slotIdx]) {
                  assignedDays[0] = day1;
                  assignedDays[1] = day2;
                  foundSlotIndex = slotIdx;
                  break outerLoop;
                }
              }
            }
          }
        }

        if (foundSlotIndex === -1) {
          outerLoopFallback:
          for (let slotIdx = 0; slotIdx < SLOTS.length; slotIdx++) {
            for (const day1 of DAYS) {
              for (const day2 of DAYS) {
                if (day1 !== day2 && !groupBusySlots[group.id][day1][slotIdx] && !groupBusySlots[group.id][day2][slotIdx]) {
                  assignedDays[0] = day1;
                  assignedDays[1] = day2;
                  foundSlotIndex = slotIdx;
                  break outerLoopFallback;
                }
              }
            }
          }
        }

        if (foundSlotIndex !== -1) {
          const slot = SLOTS[foundSlotIndex];
          for (const day of assignedDays) {
            groupBusySlots[group.id][day][foundSlotIndex] = true;
            profBusySlots[assignedProfId][day][foundSlotIndex] = true;

            await client.query(`
              INSERT INTO schedules (class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            `, [group.id, subjectName, assignedProfId, classroom, day, slot.start, slot.end, isLab]);
          }
        }
      }
    }
    console.log('✅ Horarios de FIME programados.');

    console.log('🤝 Asignando tutores únicos a grupos de FIME...');
    const assignedTutors = new Set();
    for (const group of fimeGroups) {
      const candidates = Array.from(groupProfessorMap[group.id]);
      const availableCandidates = candidates.filter(profId => !assignedTutors.has(profId));
      let selectedTutorId = null;

      if (availableCandidates.length > 0) {
        selectedTutorId = getRandomElement(availableCandidates);
      } else {
        const fimeProfs = fimeProfessors.map(p => p.id).filter(id => !assignedTutors.has(id));
        if (fimeProfs.length > 0) {
          selectedTutorId = getRandomElement(fimeProfs);
          const subjects = CAREER_SUBJECTS[group.career_id][parseInt(group.name.split('°')[0])];
          const firstSubject = subjects[0];
          await client.query(`
            INSERT INTO professor_groups (professor_id, class_group_id, subject_taught)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING;
          `, [selectedTutorId, group.id, firstSubject]);
        }
      }

      if (selectedTutorId) {
        assignedTutors.add(selectedTutorId);
        await client.query(`
          UPDATE class_groups SET tutor_id = $1 WHERE id = $2;
        `, [selectedTutorId, group.id]);
      }
    }
    console.log('✅ Tutores de FIME asignados.');

    console.log('📅 Programando exámenes para FIME...');
    for (const group of fimeGroups) {
      const subjects = CAREER_SUBJECTS[group.career_id][parseInt(group.name.split('°')[0])];
      for (const subjectName of subjects) {
        const d1 = `2026-10-${getRandomInt(12, 16)}`;
        await client.query(`
          INSERT INTO exam_dates (class_group_id, subject_name, exam_name, exam_date, exam_time)
          VALUES ($1, $2, $3, $4, $5);
        `, [group.id, subjectName, '1° Parcial', d1, '09:00:00']);

        const d2 = `2026-11-${getRandomInt(16, 20)}`;
        await client.query(`
          INSERT INTO exam_dates (class_group_id, subject_name, exam_name, exam_date, exam_time)
          VALUES ($1, $2, $3, $4, $5);
        `, [group.id, subjectName, '2° Parcial', d2, '09:00:00']);

        const d3 = `2027-01-${getRandomInt(18, 22)}`;
        await client.query(`
          INSERT INTO exam_dates (class_group_id, subject_name, exam_name, exam_date, exam_time)
          VALUES ($1, $2, $3, $4, $5);
        `, [group.id, subjectName, 'Ordinario', d3, '09:00:00']);
      }
    }
    console.log('✅ Evaluaciones programadas.');

    console.log('🎓 Inyectando 5 estudiantes por grupo en FIME...');
    let studentIdCount = 20260000;
    for (const group of fimeGroups) {
      for (let s = 1; s <= 5; s++) {
        studentIdCount++;
        const firstName = getRandomElement(FIRST_NAMES);
        const lastName1 = getRandomElement(LAST_NAMES);
        const lastName2 = getRandomElement(LAST_NAMES);
        const fullName = `${firstName} ${lastName1} ${lastName2}`;
        const email = `alumno.${studentIdCount}@ucol.mx`;
        const enrollment = studentIdCount.toString();

        await client.query(`
          INSERT INTO students (enrollment_id, full_name, email, password_hash, class_group_id)
          VALUES ($1, $2, $3, $4, $5);
        `, [enrollment, fullName, email, 'password', group.id]);
      }
    }
    console.log(`✅ ${fimeGroups.length * 5} estudiantes inyectados.`);

    console.log('🔒 Creando usuarios administrativos y cuentas de docentes FIME...');
    for (const prof of fimeProfessors) {
      await client.query(`
        INSERT INTO admin_users (username, email, password_hash, role, professor_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO NOTHING;
      `, [prof.slug, prof.email, DEFAULT_PASSWORD_HASH, 'docente', prof.id]);
    }

    await client.query(`
      INSERT INTO admin_users (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING;
    `, ['admin', 'admin@ucol.mx', DEFAULT_PASSWORD_HASH, 'admin_general']);

    await client.query(`
      INSERT INTO admin_users (username, email, password_hash, role, faculty_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO NOTHING;
    `, ['coord.fime', 'coord.fime@ucol.mx', DEFAULT_PASSWORD_HASH, 'coordinador_facultad', 25]);

    for (const career of FIME_CAREERS) {
      const code = career.slug.replace('ingenieria-en-', '').replace('ingeniero-', '').substring(0, 10);
      const username = `jefe.${code}`;
      const email = `jefe.${code}@ucol.mx`;
      
      await client.query(`
        INSERT INTO admin_users (username, email, password_hash, role, career_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO NOTHING;
      `, [username, email, DEFAULT_PASSWORD_HASH, 'jefe_carrera', career.id]);
    }

    await client.query(`
      INSERT INTO admin_users (username, email, password_hash, role, faculty_ids)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO NOTHING;
    `, ['admin.dir', 'admindir@ucol.mx', DEFAULT_PASSWORD_HASH, 'admin_direccion', [25, 12]]);
    console.log('✅ Cuentas administrativas de FIME creadas.');

    // -------------------------------------------------------------------------
    // Fase 3: Adición de Dataset Masivo (de seed-large-dataset.js)
    // -------------------------------------------------------------------------
    console.log('\n🏫 Cargando carreras desde careers.yaml para dataset grande...');
    const careersPath = path.join(__dirname, '..', 'data', 'reference', 'careers.yaml');
    const careersContent = fs.readFileSync(careersPath, 'utf-8');
    const careers = yaml.load(careersContent) || [];

    console.log('🏫 Creando grupos de clase estándar para el dataset grande (sin borrar previos)...');
    const largeGroupIds = [];
    for (const car of careers) {
      const shifts = ['Matutino', 'Vespertino'];
      for (const shift of shifts) {
        const grades = ['1A', '2B', '3A', '4B'];
        for (const grade of grades) {
          const groupName = `Grupo ${grade}`;
          const groupSlug = `${slugify(groupName)}-${car.id}-${slugify(shift)}`;
          
          const res = await client.query(`
            INSERT INTO class_groups (slug, career_id, name, academic_period, shift)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, career_id;
          `, [groupSlug, car.id, `${groupName} (${shift})`, 'Feb-Jul 2026', shift]);
          
          largeGroupIds.push(res.rows[0]);
        }
      }
    }
    console.log(`✅ ${largeGroupIds.length} grupos de clase listos para asignación del dataset grande.`);

    const count = parseInt(process.argv[2], 10) || 100;
    console.log(`📝 Generando ${count} registros de profesores simulados para el dataset grande...`);

    // Usar transacción para velocidad
    await client.query('BEGIN');

    for (let i = 1; i <= count; i++) {
      const name = `${getRandomElement(FIRST_NAMES)} ${getRandomElement(FIRST_NAMES)} ${getRandomElement(LAST_NAMES)} ${getRandomElement(LAST_NAMES)}`;
      const baseSlug = slugify(name);
      // Asegurar slug único agregando índice y prefijo de lote grande
      const slug = `${baseSlug}-ld-${i}`;
      const email = `${baseSlug.replace(/-/g, '_')}_ld_${i}@ucol.mx`;
      
      const delegationId = getRandomInt(1, 5); 
      const title = getRandomElement(ACADEMIC_TITLES);
      const dept = getRandomElement(DEPARTMENTS);
      const admissionYear = getRandomInt(1995, 2025);

      const profileData = {
        slug,
        fullName: name,
        photoUrl: '/images/profesores/default.jpg',
        title,
        department: dept,
        institutionalEmail: email,
        admissionYear,
        academicFormation: {
          doctorados: getRandomInt(0, 1) === 1 ? [{
            degree: 'Doctor en Ciencias',
            institution: 'Universidad de Colima',
            year: getRandomInt(2010, 2024)
          }] : [],
          maestrias: [{
            degree: 'Maestría en Ingeniería',
            institution: 'Universidad de Colima',
            year: getRandomInt(2005, 2015)
          }],
          licenciatura: {
            degree: 'Licenciatura Universitaria',
            institution: 'Universidad de Colima',
            year: getRandomInt(2000, 2010)
          }
        },
        scientificProduction: {
          articles: Array.from({ length: getRandomInt(1, 4) }, (_, idx) => ({
            title: `Investigación Aplicada sobre Tecnologías y Educación - Parte ${idx + 1}`,
            journal: 'Revista de Investigación Científica Ucol',
            year: getRandomInt(2020, 2026),
            impactFactor: parseFloat((Math.random() * 4).toFixed(2)) || null,
            doi: `https://doi.org/10.1007/mock-doi-${i}-${idx}`
          })),
          books: getRandomInt(0, 1) === 1 ? [{
            title: `Fundamentos y aplicaciones de ${getRandomElement(SUBJECTS)}`,
            role: getRandomElement(['Autor', 'Coautor', 'Coordinador']),
            editorial: 'Editorial Universitaria',
            year: getRandomInt(2015, 2025)
          }] : []
        },
        educationalMaterials: [],
        teaching: {
          courses: Array.from({ length: getRandomInt(1, 3) }, () => ({
            name: getRandomElement(SUBJECTS),
            level: 'Licenciatura',
            students: getRandomInt(15, 40),
            period: 'Feb-Jul 2026'
          })),
          theses: []
        },
        certifications: [],
        academicBody: {
          name: 'Cuerpo Académico de Investigación',
          level: 'En Consolidación'
        }
      };

      const profRes = await client.query(`
        INSERT INTO professors (slug, full_name, email, delegation_id, profile_data)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id;
      `, [slug, name, email, delegationId, JSON.stringify(profileData)]);

      if (profRes.rows.length > 0) {
        const professorId = profRes.rows[0].id;

        // Asignar a grupos elegibles según delegación
        const eligibleGroups = largeGroupIds.filter(g => {
          const car = careers.find(c => c.id === g.career_id);
          return car && car.delegation_id === delegationId;
        });

        if (eligibleGroups.length > 0) {
          const numAssignments = getRandomInt(1, 2);
          const assigned = new Set();
          for (let a = 0; a < numAssignments; a++) {
            const group = getRandomElement(eligibleGroups);
            if (!assigned.has(group.id)) {
              assigned.add(group.id);
              await client.query(`
                INSERT INTO professor_groups (professor_id, class_group_id, subject_taught)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING;
              `, [professorId, group.id, getRandomElement(SUBJECTS)]);
            }
          }
        }
      }

      if (i % 500 === 0) {
        console.log(`... ${i} profesores del dataset grande insertados`);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Dataset grande agregado con éxito. Profesores del dataset grande: ${count}`);

    console.log('\n🎉 ¡Inyección de datos combinada finalizada con éxito!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la siembra de base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
