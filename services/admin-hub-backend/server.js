import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pg from 'pg';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'pica-ucol-jwt-secret-2026';
const JWT_EXPIRES_IN = '8h';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper para resolver la ruta de datos de referencia (local vs docker)
function getReferencePath(filename) {
  const dockerPath = path.join(__dirname, 'data', 'reference', filename);
  if (existsSync(dockerPath)) {
    return dockerPath;
  }
  return path.join(__dirname, '..', '..', 'data', 'reference', filename);
}

const app = express();
const PORT = process.env.PORT || 6769;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configurar PostgreSQL Connection Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER || 'admin'}:${process.env.DB_PASSWORD || 'admin_pass'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'pica_db'}`
});

// Configurar multer para almacenar PDFs en un directorio temporal
const uploadDir = path.join(__dirname, 'temp_uploads');
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `uploaded_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.pdf`);
  }
});
const upload = multer({ storage });

// ── Middleware de Autenticación JWT ─────────────────────────────────────
function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Soporte para Bearer token (JWT desde la UI)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // { id, username, role, professor_id, career_id, faculty_id }
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado. Inicia sesión nuevamente.' });
    }
  }

  // Fallback: Basic Auth para compatibilidad con Nginx/proxy interno
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [user, pass] = credentials.split(':');
    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPass = process.env.ADMIN_PASSWORD || 'admin_pass';
    if (user === expectedUser && pass === expectedPass) {
      req.user = { id: 0, username: user, role: 'admin_general', professor_id: null };
      return next();
    }
  }

  return res.status(401).json({ error: 'Autenticación requerida. Inicia sesión en /admin/login.' });
}

// Aplicar JWT Auth a todos los endpoints /api/
app.use('/api', jwtAuth);

/**
 * Ejecuta un script de Python de forma asíncrona.
 */
function runPythonScript(pythonExe, scriptPath, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonExe, [scriptPath, ...args], { cwd });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`El script de Python falló con código ${code}.\nDetalles:\n${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Encontrar ejecutable de python
async function detectPython() {
  // En Docker o producción, usamos python3
  return process.env.PYTHON_PATH || 'python3';
}

// Helper para convertir strings a Slugs limpios
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Endpoints de Autenticación ──────────────────────────────────────────

// POST /auth/login — Autenticar usuario y emitir JWT
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    }

    // Buscar usuario por username o email
    const result = await pool.query(
      `SELECT u.*, p.full_name as professor_name, p.slug as professor_slug, p.profile_data as professor_profile
       FROM admin_users u
       LEFT JOIN professors p ON u.professor_id = p.id
       WHERE (u.username = $1 OR u.email = $1) AND u.is_active = TRUE`,
      [username.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    // Emitir JWT con perfil completo
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      professor_id: user.professor_id,
      professor_name: user.professor_name || null,
      professor_slug: user.professor_slug || null,
      career_id: user.career_id || null,
      faculty_id: user.faculty_id || null
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        professor_id: user.professor_id,
        professor_name: user.professor_name || null,
        professor_slug: user.professor_slug || null,
        professor_profile: user.professor_profile || null,
        career_id: user.career_id || null,
        faculty_id: user.faculty_id || null
      }
    });
  } catch (err) {
    console.error('Error en /auth/login:', err);
    return res.status(500).json({ error: 'Error interno de autenticación.' });
  }
});

// GET /auth/me — Devuelve el perfil del usuario autenticado (requiere JWT)
app.get('/auth/me', jwtAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, p.full_name as professor_name, p.slug as professor_slug, p.profile_data as professor_profile
       FROM admin_users u
       LEFT JOIN professors p ON u.professor_id = p.id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];
    delete user.password_hash; // No exponer el hash

    return res.json(user);
  } catch (err) {
    console.error('Error en /auth/me:', err);
    return res.status(500).json({ error: 'Error al obtener perfil de usuario.' });
  }
});

// ── Endpoints de Referencia (Datos Maestros) ───────────────────────────

app.get('/api/reference/delegations', async (req, res) => {
  try {
    const filepath = getReferencePath('delegations.yaml');
    const content = await fs.readFile(filepath, 'utf-8');
    const data = yaml.load(content);
    return res.json(data);
  } catch (err) {
    console.error('Error al leer delegations.yaml:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las delegaciones.' });
  }
});

app.get('/api/reference/careers', async (req, res) => {
  try {
    const filepath = getReferencePath('careers.yaml');
    const content = await fs.readFile(filepath, 'utf-8');
    const data = yaml.load(content);
    return res.json(data);
  } catch (err) {
    console.error('Error al leer careers.yaml:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las carreras.' });
  }
});

app.get('/api/reference/faculties', async (req, res) => {
  try {
    const filepath = getReferencePath('faculties.yaml');
    const content = await fs.readFile(filepath, 'utf-8');
    const data = yaml.load(content);
    return res.json(data);
  } catch (err) {
    console.error('Error al leer faculties.yaml:', err);
    return res.status(500).json({ error: 'No se pudieron cargar las facultades.' });
  }
});


// ── Endpoints de la API ──────────────────────────────────────────────

// POST /api/extract - Recibe PDF, ejecuta cv_scraper.py
app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  let tempJsonPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo PDF.' });
    }

    const tempPdfPath = req.file.path;
    const cvExtractorDir = path.join(__dirname, 'cv_extractor');
    const scraperScript = path.join(cvExtractorDir, 'cv_scraper.py');

    const tempJsonName = `cv_extracted_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.json`;
    tempJsonPath = path.join(cvExtractorDir, tempJsonName);

    const pythonExe = await detectPython();

    // Ejecutar extractor
    await runPythonScript(pythonExe, scraperScript, [tempPdfPath, tempJsonPath], cvExtractorDir);

    // Leer el JSON generado
    const jsonContent = await fs.readFile(tempJsonPath, 'utf-8');
    const parsedData = JSON.parse(jsonContent);

    // Limpiar archivos temporales
    await fs.unlink(tempPdfPath).catch(() => {});
    await fs.unlink(tempJsonPath).catch(() => {});

    return res.status(200).json(parsedData);
  } catch (err) {
    console.error('Error en /api/extract:', err);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    if (tempJsonPath) {
      await fs.unlink(tempJsonPath).catch(() => {});
    }
    return res.status(500).json({ error: err.message || 'Error interno al extraer los datos.' });
  }
});

// Función para purgar la caché del proxy Nginx en segundo plano
async function purgeCache(slug) {
  try {
    console.log(`🧹 Iniciando purga de caché para /profesores/${slug} y páginas relacionadas...`);
    
    const urlsToPurge = new Set();
    urlsToPurge.add('/');
    urlsToPurge.add('/buscar-profesor');
    urlsToPurge.add(`/profesores/${slug}`);

    // Consultar información del profesor en la base de datos
    const dbRes = await pool.query(`
      SELECT p.delegation_id, 
             coalesce(
               json_agg(
                 json_build_object('slug', g.slug, 'career_id', g.career_id)
               ) FILTER (WHERE g.slug IS NOT NULL),
               '[]'
             ) as groups
      FROM professors p
      LEFT JOIN professor_groups pg ON p.id = pg.professor_id
      LEFT JOIN class_groups g ON pg.class_group_id = g.id
      WHERE p.slug = $1
      GROUP BY p.id;
    `, [slug]);

    if (dbRes.rows.length > 0) {
      const { delegation_id, groups } = dbRes.rows[0];

      // Cargar YAMLs de referencia para mapear slugs
      let delegations = [];
      let careers = [];
      try {
        const delPath = getReferencePath('delegations.yaml');
        const delContent = await fs.readFile(delPath, 'utf-8');
        delegations = yaml.load(delContent) || [];
      } catch (e) {
        console.warn('⚠️ No se pudo cargar delegations.yaml al purgar cache:', e.message);
      }

      try {
        const carPath = getReferencePath('careers.yaml');
        const carContent = await fs.readFile(carPath, 'utf-8');
        careers = yaml.load(carContent) || [];
      } catch (e) {
        console.warn('⚠️ No se pudo cargar careers.yaml al purgar cache:', e.message);
      }

      const delegation = delegations.find(d => d.id === delegation_id);
      if (delegation) {
        urlsToPurge.add(`/delegaciones/${delegation.slug}`);

        if (Array.isArray(groups)) {
          for (const g of groups) {
            const career = careers.find(c => c.id === g.career_id);
            if (career) {
              urlsToPurge.add(`/delegaciones/${delegation.slug}/carreras/${career.slug}`);
              urlsToPurge.add(`/delegaciones/${delegation.slug}/carreras/${career.slug}/grupos/${g.slug}`);
            }
          }
        }
      }
    }

    // Enviar las purgas
    for (const relativeUrl of urlsToPurge) {
      const purgeUrl = `http://proxy${relativeUrl}`;
      console.log(`Enviando purga a: ${purgeUrl}`);
      await fetch(purgeUrl, {
        method: 'GET',
        headers: { 'X-Purge': '1' }
      }).catch(err => {
        // En desarrollo local o si el proxy no está arriba, fallará silenciosamente
        console.log(`Fallo al purgar ${purgeUrl}: ${err.message}`);
      });
    }

    console.log('✅ Purga de caché enviada con éxito al proxy para las URLs:', Array.from(urlsToPurge));
  } catch (err) {
    console.warn('⚠️ No se pudo enviar la purga de caché al proxy:', err.message);
  }
}

// POST /api/professors - Guarda perfil editado y relaciones de grupo
app.post('/api/professors', async (req, res) => {
  let tempRawJsonPath = null;
  let formattedDir = null;
  try {
    const { professorData, delegation_id, faculty_id, group_assignments } = req.body;
    if (!professorData) {
      return res.status(400).json({ error: 'Faltan los datos del profesor.' });
    }

    const cvExtractorDir = path.join(__dirname, 'cv_extractor');
    const tempRawName = `raw_save_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.json`;
    tempRawJsonPath = path.join(cvExtractorDir, tempRawName);

    // 1. Escribir los datos crudos editados a un archivo temporal
    await fs.writeFile(tempRawJsonPath, JSON.stringify(professorData, null, 2), 'utf-8');

    // 2. Crear un directorio temporal para la salida formateada
    formattedDir = path.join(__dirname, `temp_fmt_${Date.now()}`);
    await fs.mkdir(formattedDir, { recursive: true });

    // 3. Ejecutar format_cv.py para obtener la estructura limpia JSONB
    const pythonExe = await detectPython();
    const formatterScript = path.join(cvExtractorDir, 'format_cv.py');
    await runPythonScript(pythonExe, formatterScript, [tempRawJsonPath, formattedDir], cvExtractorDir);

    // 4. Leer el JSON formateado generado por format_cv.py
    const files = await fs.readdir(formattedDir);
    const formattedFile = files.find(f => f.endsWith('.json'));
    if (!formattedFile) {
      throw new Error('El script format_cv.py no generó ningún archivo de salida.');
    }

    const formattedPath = path.join(formattedDir, formattedFile);
    const formattedContent = await fs.readFile(formattedPath, 'utf-8');
    const formattedProfile = JSON.parse(formattedContent);

    // Limpiar archivos temporales de formateo
    await fs.unlink(tempRawJsonPath).catch(() => {});
    await fs.rm(formattedDir, { recursive: true, force: true }).catch(() => {});
    tempRawJsonPath = null;
    formattedDir = null;

    // 5. Guardar en PostgreSQL
    const slug = formattedProfile.slug;
    const fullName = formattedProfile.fullName;
    const email = formattedProfile.institutionalEmail;
    
    // Auto-vincular delegación y encontrar career_ids de la facultad
    let finalDelegationId = delegation_id;
    let autoMatched = false;

    if (faculty_id || formattedProfile.department) {
      let faculties = [];
      try {
        const facPath = getReferencePath('faculties.yaml');
        const facContent = await fs.readFile(facPath, 'utf-8');
        faculties = yaml.load(facContent) || [];
        
        if (faculty_id) {
          // Si el frontend envió un faculty_id explícito
          const fac = faculties.find(f => f.id === faculty_id);
          if (fac) {
            formattedProfile.faculty_id = fac.id;
            formattedProfile.auto_career_ids = fac.career_ids || [];
            if (!finalDelegationId) finalDelegationId = fac.delegation_id;
            autoMatched = true;
          }
        } 
        
        if (!autoMatched && formattedProfile.department) {
          // Si no, hacer match por string usando normalización sin acentos
          const normalizeString = (str) => {
            if (!str) return '';
            return str.toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          };

          const getLevenshteinDistance = (a, b) => {
            const tmp = [];
            for (let i = 0; i <= a.length; i++) {
              tmp[i] = [i];
            }
            for (let j = 0; j <= b.length; j++) {
              tmp[0][j] = j;
            }
            for (let i = 1; i <= a.length; i++) {
              for (let j = 1; j <= b.length; j++) {
                tmp[i][j] = Math.min(
                  tmp[i - 1][j] + 1,
                  tmp[i][j - 1] + 1,
                  tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
              }
            }
            return tmp[a.length][b.length];
          };

          const dptClean = normalizeString(formattedProfile.department);
          let matchedFac = null;

          // 1. Abreviaciones clave de la Universidad de Colima
          const abbrevMap = {
            'fime': 'Facultad de Ingeniería Mecánica y Eléctrica',
            'telematica': 'Facultad de Telemática',
            'fcac': 'Facultad de Contabilidad y Administración de Colima',
            'fcat': 'Facultad de Contabilidad y Administración de Tecomán',
            'fcam': 'Facultad de Contabilidad y Administración de Manzanillo',
            'fce': 'Facultad de Ciencias de la Educación',
            'fc': 'Facultad de Ciencias',
            'fayd': 'Facultad de Arquitectura y Diseño',
            'fcq': 'Facultad de Ciencias Químicas',
            'fic': 'Facultad de Ingeniería Civil',
            'fie': 'Facultad de Ingeniería Electromecánica',
            'facimar': 'Facultad de Ciencias Marinas',
            'fmvz': 'Facultad de Medicina Veterinaria y Zootecnia',
            'iuba': 'Instituto Universitario de Bellas Artes',
            'fd': 'Facultad de Derecho',
            'fm': 'Facultad de Medicina',
            'flc': 'Facultad de Letras y Comunicación',
            'fcps': 'Facultad de Ciencias Políticas y Sociales',
            'fe': 'Facultad de Economía',
            'fle': 'Facultad de Lenguas Extranjeras',
            'ft': 'Facultad de Turismo',
            'ftg': 'Facultad de Turismo y Gastronomía',
            'ef': 'Escuela de Filosofía',
            'em': 'Escuela de Mercadotecnia'
          };

          if (abbrevMap[dptClean]) {
            const targetName = abbrevMap[dptClean];
            matchedFac = faculties.find(f => f.name === targetName);
          }

          if (!matchedFac) {
            const scrapedTokens = dptClean.split(' ');
            for (const token of scrapedTokens) {
              if (abbrevMap[token]) {
                const targetName = abbrevMap[token];
                matchedFac = faculties.find(f => f.name === targetName);
                if (matchedFac) break;
              }
            }
          }

          // 2. Coincidencia exacta o subcadena completa
          if (!matchedFac) {
            let maxScore = -1;
            for (const fac of faculties) {
              const facClean = normalizeString(fac.name);
              if (facClean === dptClean) {
                matchedFac = fac;
                break;
              }
              if (facClean.includes(dptClean) || dptClean.includes(facClean)) {
                const score = 1000 + Math.min(dptClean.length, facClean.length);
                if (score > maxScore) {
                  maxScore = score;
                  matchedFac = fac;
                }
              }
            }
          }

          // 3. Puntuación por palabras y Levenshtein
          if (!matchedFac) {
            const stopWords = new Set(['de', 'y', 'la', 'el', 'en', 'para', 'con', 'del', 'los', 'las', 'un', 'una']);
            const dptWords = dptClean.split(' ').filter(w => w.length > 1 && !stopWords.has(w));
            let maxScore = -1;

            for (const fac of faculties) {
              const facClean = normalizeString(fac.name);
              const facWords = facClean.split(' ').filter(w => w.length > 1 && !stopWords.has(w));

              let score = 0;
              for (const sw of dptWords) {
                let bestWordScore = 0;
                for (const fw of facWords) {
                  if (sw === fw) {
                    bestWordScore = Math.max(bestWordScore, sw.length * 10);
                  } else if (fw.includes(sw) || sw.includes(fw)) {
                    bestWordScore = Math.max(bestWordScore, Math.min(sw.length, fw.length) * 5);
                  } else if (sw.length >= 4 && fw.length >= 4) {
                    const dist = getLevenshteinDistance(sw, fw);
                    if (dist <= 2) {
                      bestWordScore = Math.max(bestWordScore, (Math.max(sw.length, fw.length) - dist) * 4);
                    }
                  }
                }
                score += bestWordScore;
              }

              if (score > maxScore) {
                maxScore = score;
                matchedFac = fac;
              }
            }

            if (maxScore <= 10) {
              matchedFac = null;
            }
          }

          if (matchedFac) {
            formattedProfile.faculty_id = matchedFac.id;
            formattedProfile.auto_career_ids = matchedFac.career_ids || [];
            if (!finalDelegationId) finalDelegationId = matchedFac.delegation_id;
            autoMatched = true;
          }
        }
      } catch (e) {
        console.warn('⚠️ No se pudo cargar faculties.yaml para auto-asignar facultad:', e.message);
      }
    }

    // Obtener un cliente de la pool para hacer una transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert profesor
      const profQuery = `
        INSERT INTO professors (slug, full_name, email, delegation_id, profile_data, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (slug)
        DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, delegation_id = EXCLUDED.delegation_id, profile_data = EXCLUDED.profile_data, updated_at = NOW()
        RETURNING id;
      `;
      const profRes = await client.query(profQuery, [slug, fullName, email, finalDelegationId || null, formattedProfile]);
      const professorId = profRes.rows[0].id;

      // Limpiar relaciones anteriores
      await client.query('DELETE FROM professor_groups WHERE professor_id = $1', [professorId]);

      // Insertar nuevas relaciones de grupo si se especifican
      if (group_assignments && Array.isArray(group_assignments)) {
        for (const assoc of group_assignments) {
          if (assoc.class_group_id) {
            await client.query(
              'INSERT INTO professor_groups (professor_id, class_group_id, subject_taught) VALUES ($1, $2, $3)',
              [professorId, assoc.class_group_id, assoc.subject_taught || '']
            );
          }
        }
      }

      await client.query('COMMIT');
      
      // Lanzar purga de caché en segundo plano
      purgeCache(slug);

      return res.status(200).json({ success: true, message: 'Perfil guardado correctamente en la base de datos.', id: professorId, slug });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error en /api/professors:', err);
    if (tempRawJsonPath) {
      await fs.unlink(tempRawJsonPath).catch(() => {});
    }
    if (formattedDir) {
      await fs.rm(formattedDir, { recursive: true, force: true }).catch(() => {});
    }
    return res.status(500).json({ error: err.message || 'Error interno al guardar el perfil.' });
  }
});

// GET /api/professors - Lista profesores (con scoping por rol)
app.get('/api/professors', async (req, res) => {
  try {
    let query = `
      SELECT p.id, p.slug, p.full_name, p.email, p.delegation_id,
             COALESCE(
               json_agg(
                 json_build_object('class_group_id', pg.class_group_id, 'subject_taught', pg.subject_taught)
               ) FILTER (WHERE pg.class_group_id IS NOT NULL),
               '[]'
             ) as group_assignments
      FROM professors p
      LEFT JOIN professor_groups pg ON p.id = pg.professor_id
    `;
    let params = [];

    // Los docentes solo pueden ver su propio perfil
    if (req.user && req.user.role === 'docente' && req.user.professor_id) {
      query += ' WHERE p.id = $1';
      params.push(req.user.professor_id);
    }

    query += ' GROUP BY p.id ORDER BY p.full_name ASC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al listar profesores:', err);
    return res.status(500).json({ error: 'Error al consultar profesores en la base de datos.' });
  }
});

// GET /api/groups - Lista grupos filtrados opcionalmente por career_id (con scoping por rol)
app.get('/api/groups', async (req, res) => {
  try {
    const careerId = req.query.career_id;
    let query = 'SELECT cg.*, p.full_name as tutor_name FROM class_groups cg LEFT JOIN professors p ON cg.tutor_id = p.id';
    let params = [];

    // Jefe de carrera solo ve su carrera
    const scopeCareer = req.user?.role === 'jefe_carrera' ? req.user.career_id : null;
    const filterCareer = careerId ? parseInt(careerId, 10) : scopeCareer;

    if (filterCareer) {
      query += ' WHERE cg.career_id = $1';
      params.push(filterCareer);
    }
    query += ' ORDER BY cg.name ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al listar grupos:', err);
    return res.status(500).json({ error: 'Error al consultar grupos.' });
  }
});

// GET /api/professors/me/groups — Grupos y materias del docente autenticado
app.get('/api/professors/me/groups', async (req, res) => {
  try {
    if (!req.user || !req.user.professor_id) {
      return res.status(403).json({ error: 'Este endpoint es solo para docentes.' });
    }

    const result = await pool.query(`
      SELECT
        cg.id, cg.slug, cg.name as group_name, cg.academic_period, cg.shift, cg.career_id,
        pg.subject_taught,
        p.full_name as tutor_name
      FROM professor_groups pg
      JOIN class_groups cg ON pg.class_group_id = cg.id
      LEFT JOIN professors p ON cg.tutor_id = p.id
      WHERE pg.professor_id = $1
      ORDER BY cg.name ASC
    `, [req.user.professor_id]);

    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener grupos del docente:', err);
    return res.status(500).json({ error: 'Error al consultar grupos del docente.' });
  }
});

// POST /api/groups - Crea nuevo grupo
app.post('/api/groups', async (req, res) => {
  try {
    const { name, career_id, academic_period, shift } = req.body;
    if (!name || !career_id) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: name y career_id.' });
    }

    const groupSlug = `${slugify(name)}-${career_id}`;

    const query = `
      INSERT INTO class_groups (slug, career_id, name, academic_period, shift)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, academic_period = EXCLUDED.academic_period, shift = EXCLUDED.shift
      RETURNING *;
    `;
    
    const result = await pool.query(query, [groupSlug, parseInt(career_id, 10), name, academic_period || '', shift || '']);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear grupo:', err);
    return res.status(500).json({ error: 'Error al guardar el grupo.' });
  }
});

// ── Endpoints adicionales para PICA-UCOL (StudentHUB / AdminHUB) ──────────

// GET /api/schedules - Obtiene horarios de clases
app.get('/api/schedules', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, p.full_name as professor_name, g.name as group_name
      FROM schedules s
      LEFT JOIN professors p ON s.professor_id = p.id
      LEFT JOIN class_groups g ON s.class_group_id = g.id
      ORDER BY s.day_of_week, s.start_time
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener horarios:', err);
    return res.status(500).json({ error: 'Error al consultar horarios en la base de datos.' });
  }
});

// POST /api/schedules - Crea o modifica un horario
app.post('/api/schedules', async (req, res) => {
  try {
    const { class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory } = req.body;
    if (!class_group_id || !subject_name || !classroom_name || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para el horario.' });
    }

    const groupId = parseInt(class_group_id, 10);
    const profId = professor_id ? parseInt(professor_id, 10) : null;

    // Validación específica para docentes al reservar laboratorios
    if (is_laboratory === true) {
      if (!profId) {
        return res.status(400).json({ error: 'Se requiere el ID del docente para reservar un laboratorio.' });
      }

      // Validar si existe una clase ordinaria programada en ese dia y rango de horas que contenga la reserva
      // Se compara start_time y end_time de la reserva contra los de la clase regular
      const classQuery = `
        SELECT * FROM schedules 
        WHERE class_group_id = $1 
          AND subject_name = $2 
          AND professor_id = $3 
          AND day_of_week = $4 
          AND is_laboratory = FALSE
          AND start_time <= $5::time
          AND end_time >= $6::time
      `;
      const classCheck = await pool.query(classQuery, [
        groupId,
        subject_name,
        profId,
        day_of_week,
        start_time,
        end_time
      ]);

      if (classCheck.rows.length === 0) {
        return res.status(400).json({ 
          error: `No tienes asignada una clase de "${subject_name}" el día ${day_of_week} en el horario de ${start_time.substring(0,5)} a ${end_time.substring(0,5)} para este grupo.`
        });
      }
    }

    const query = `
      INSERT INTO schedules (class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const result = await pool.query(query, [
      groupId,
      subject_name,
      profId,
      classroom_name,
      day_of_week,
      start_time,
      end_time,
      is_laboratory || false
    ]);
    
    // Asegurar relación en professor_groups
    if (profId) {
      await pool.query(`
        INSERT INTO professor_groups (professor_id, class_group_id, subject_taught)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [profId, groupId, subject_name]);
    }

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al guardar horario:', err);
    return res.status(500).json({ error: 'Error al guardar el horario.' });
  }
});

// DELETE /api/schedules/:id - Elimina un horario
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM schedules WHERE id = $1', [parseInt(id, 10)]);
    return res.json({ success: true, message: 'Horario eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar horario:', err);
    return res.status(500).json({ error: 'Error al eliminar el horario.' });
  }
});

// GET /api/exams - Obtiene exámenes programados
app.get('/api/exams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, g.name as group_name
      FROM exam_dates e
      LEFT JOIN class_groups g ON e.class_group_id = g.id
      ORDER BY e.exam_date, e.exam_time
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener exámenes:', err);
    return res.status(500).json({ error: 'Error al consultar exámenes en la base de datos.' });
  }
});

// POST /api/exams - Programa un nuevo examen
app.post('/api/exams', async (req, res) => {
  try {
    const { class_group_id, subject_name, exam_name, exam_date, exam_time } = req.body;
    if (!class_group_id || !subject_name || !exam_name || !exam_date || !exam_time) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para el examen.' });
    }

    const groupId = parseInt(class_group_id, 10);

    // Validar cantidad de exámenes dictada por el coordinador (máximo 3 exámenes por materia y grupo)
    const countQuery = `
      SELECT COUNT(*) FROM exam_dates 
      WHERE class_group_id = $1 AND LOWER(TRIM(subject_name)) = LOWER(TRIM($2))
    `;
    const countCheck = await pool.query(countQuery, [groupId, subject_name]);
    const examCount = parseInt(countCheck.rows[0].count, 10);

    if (examCount >= 3) {
      return res.status(400).json({ 
        error: `Límite excedido: El coordinador académico dictamina un máximo de 3 fechas de evaluación/exámenes para la materia "${subject_name}" en este grupo.` 
      });
    }

    const query = `
      INSERT INTO exam_dates (class_group_id, subject_name, exam_name, exam_date, exam_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [
      groupId,
      subject_name,
      exam_name,
      exam_date,
      exam_time
    ]);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al guardar examen:', err);
    return res.status(500).json({ error: 'Error al guardar el examen.' });
  }
});

// DELETE /api/exams/:id - Elimina un examen programado
app.delete('/api/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM exam_dates WHERE id = $1', [parseInt(id, 10)]);
    return res.json({ success: true, message: 'Examen eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar examen:', err);
    return res.status(500).json({ error: 'Error al eliminar el examen.' });
  }
});

// GET /api/syllabus - Obtiene planes de estudio
app.get('/api/syllabus', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, p.full_name as creator_name
      FROM subject_syllabus s
      LEFT JOIN professors p ON s.created_by = p.id
      ORDER BY s.subject_name ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener syllabus:', err);
    return res.status(500).json({ error: 'Error al consultar syllabus.' });
  }
});

// POST /api/syllabus - Crea o modifica plan de estudio
app.post('/api/syllabus', async (req, res) => {
  try {
    const { subject_name, career_id, program_description, evaluation_criteria, resources, created_by } = req.body;
    if (!subject_name || !career_id || !evaluation_criteria || !resources) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para el syllabus.' });
    }

    // Procesar y validar criterios de evaluación
    let parsedCriteria = typeof evaluation_criteria === 'string' ? JSON.parse(evaluation_criteria) : evaluation_criteria;
    
    // Sumar todos los valores numéricos de los criterios y limpiarlos a enteros
    let totalPct = 0;
    const cleanCriteria = {};
    
    for (const [key, val] of Object.entries(parsedCriteria)) {
      // Extraer números del valor (ej. "50%" -> 50, 30 -> 30, "25" -> 25)
      const numStr = String(val).replace(/[^0-9.-]/g, '');
      const numVal = Math.round(parseFloat(numStr) || 0);
      cleanCriteria[key] = `${numVal}%`;
      totalPct += numVal;
    }

    if (totalPct !== 100) {
      return res.status(400).json({ 
        error: `La suma de los criterios de evaluación debe ser exactamente del 100%. Suma actual: ${totalPct}%.` 
      });
    }

    const slug = slugify(`${subject_name}-${career_id}`);

    const query = `
      INSERT INTO subject_syllabus (slug, subject_name, career_id, program_description, evaluation_criteria, resources, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (slug)
      DO UPDATE SET program_description = EXCLUDED.program_description, evaluation_criteria = EXCLUDED.evaluation_criteria, resources = EXCLUDED.resources, created_by = EXCLUDED.created_by, updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [
      slug,
      subject_name,
      parseInt(career_id, 10),
      program_description || '',
      cleanCriteria,
      typeof resources === 'string' ? JSON.parse(resources) : resources,
      created_by ? parseInt(created_by, 10) : null
    ]);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al guardar syllabus:', err);
    return res.status(500).json({ error: 'Error al guardar el syllabus.' });
  }
});

// POST /api/groups/tutor - Asigna tutor de grupo
app.post('/api/groups/tutor', async (req, res) => {
  try {
    const { group_id, tutor_id } = req.body;
    if (!group_id) {
      return res.status(400).json({ error: 'Falta el id del grupo.' });
    }
    await pool.query('UPDATE class_groups SET tutor_id = $1 WHERE id = $2', [
      tutor_id ? parseInt(tutor_id, 10) : null,
      parseInt(group_id, 10)
    ]);
    return res.json({ success: true, message: 'Tutor asignado con éxito.' });
  } catch (err) {
    console.error('Error al asignar tutor:', err);
    return res.status(500).json({ error: 'Error al asignar tutor en la base de datos.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend de PICA-UCOL corriendo en el puerto ${PORT}`);
});
