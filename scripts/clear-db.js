const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://admin:admin_pass@localhost:5432/pica_db';
const pool = new Pool({ connectionString });

async function clearDB() {
  console.log('🔌 Conectando a la base de datos de PICA-UCOL...');
  const client = await pool.connect();
  try {
    console.log('🧹 Limpiando todos los datos de las tablas...');
    await client.query('TRUNCATE admin_users, exam_dates, schedules, professor_groups, students, class_groups, professors, subject_syllabus CASCADE');
    console.log('✅ Base de datos limpiada con éxito.');
  } catch (err) {
    console.error('❌ Error al limpiar la base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

clearDB();
