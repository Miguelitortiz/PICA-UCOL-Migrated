import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://admin:admin_pass@localhost:5432/eduvitae';
const pool = new pg.Pool({ connectionString });

const FIRST_NAMES = ['Juan', 'María', 'Pedro', 'Ana', 'Luis', 'Gabriela', 'Carlos', 'Sofía', 'Miguel', 'Laura', 'José', 'Elena', 'Fernando', 'Lucía', 'Roberto', 'Patricia', 'David', 'Clara', 'Jorge', 'Isabel'];
const LAST_NAMES = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez'];
const ACADEMIC_TITLES = ['Profesor Investigador de Tiempo Completo', 'Profesor de Asignatura', 'Profesor Asociado C', 'Investigador Titular B'];
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

async function seed() {
  console.log('🔌 Conectando a la base de datos...');
  const client = await pool.connect();

  try {
    console.log('🧹 Limpiando registros anteriores de profesores y asignaciones...');
    await client.query('TRUNCATE professors, professor_groups CASCADE');

    console.log('🏫 Cargando carreras desde careers.yaml...');
    const careersPath = path.join(process.cwd(), 'data', 'reference', 'careers.yaml');
    const careersContent = fs.readFileSync(careersPath, 'utf-8');
    const careers = yaml.load(careersContent) || [];

    console.log('🏫 Creando grupos de clase estándar para cada carrera...');
    const groupIds = [];
    
    // Asegurar que hay grupos para cada carrera
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
          
          groupIds.push(res.rows[0]);
        }
      }
    }

    console.log(`✅ ${groupIds.length} grupos de clase listos para asignación.`);

    const count = parseInt(process.argv[2], 10) || 100;
    console.log(`📝 Generando ${count} registros de profesores simulados...`);

    // Iniciar transacción para velocidad
    await client.query('BEGIN');

    for (let i = 1; i <= count; i++) {
      const name = `${getRandomElement(FIRST_NAMES)} ${getRandomElement(FIRST_NAMES)} ${getRandomElement(LAST_NAMES)} ${getRandomElement(LAST_NAMES)}`;
      const baseSlug = slugify(name);
      // Asegurar slug único agregando índice
      const slug = `${baseSlug}-${i}`;
      const email = `${baseSlug.replace(/-/g, '_')}_${i}@ucol.mx`;
      
      const delegationId = getRandomInt(1, 5); // Delegaciones 1 a 5
      const title = getRandomElement(ACADEMIC_TITLES);
      const dept = getRandomElement(DEPARTMENTS);
      const admissionYear = getRandomInt(1995, 2025);

      // Estructura JSONB del perfil
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

      // Guardar en la tabla de profesores
      const profRes = await client.query(`
        INSERT INTO professors (slug, full_name, email, delegation_id, profile_data)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `, [slug, name, email, delegationId, JSON.stringify(profileData)]);

      const professorId = profRes.rows[0].id;

      // Asignar el profesor a 1 o 2 grupos pertenecientes a la misma delegación
      // Mapeamos dinámicamente según la delegación de cada carrera
      const eligibleGroups = groupIds.filter(g => {
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
              VALUES ($1, $2, $3);
            `, [professorId, group.id, getRandomElement(SUBJECTS)]);
          }
        }
      }

      if (i % 500 === 0) {
        console.log(`... ${i} profesores insertados`);
      }
    }

    await client.query('COMMIT');
    console.log(`\n🎉 Inyección de base de datos finalizada con éxito.`);
    console.log(`Total de profesores inyectados: ${count}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la siembra de base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
