const fs = require('fs');
const path = require('path');

const oldCsvPath = path.join(__dirname, '..', 'horarios_completos.csv');
const newCsvPath = path.join(__dirname, '..', 'horarios_completos_corregido.csv');
const sqlOutputPath = path.join(__dirname, 'import_horarios.sql');

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

function cleanString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function run() {
  console.log('📖 Cargando diccionarios desde CSV original...');
  const oldContent = fs.readFileSync(oldCsvPath, 'utf-8');
  const oldLines = oldContent.split(/\r?\n/).filter(line => line.trim().length > 0).slice(1);

  const cleanProfs = new Set();
  const cleanSubjects = new Set();

  oldLines.forEach(line => {
    const parts = parseCSVLine(line);
    if (parts.length >= 5) {
      let subject = parts[3].replace(/^HTI\s*\/\s*/i, '').trim();
      let prof = parts[4].trim();
      if (prof && prof !== '-') cleanProfs.add(prof);
      if (subject && subject !== '-') cleanSubjects.add(subject);
    }
  });

  const subjectList = Array.from(cleanSubjects);
  const profList = Array.from(cleanProfs);

  console.log('📖 Cargando semblanzas desde db_horarios/semblanzas.json...');
  let semblanzasSlugMap = new Map();
  const semblanzasPath = path.join(__dirname, '..', 'db_horarios', 'semblanzas.json');
  if (fs.existsSync(semblanzasPath)) {
    const semblanzasRaw = JSON.parse(fs.readFileSync(semblanzasPath, 'utf8'));
    for (const [name, text] of Object.entries(semblanzasRaw)) {
      semblanzasSlugMap.set(slugify(name), text);
    }
  }

  console.log('📖 Leyendo CSV corregido...');
  const newContent = fs.readFileSync(newCsvPath, 'utf-8');
  const newLines = newContent.split(/\r?\n/).filter(line => line.trim().length > 0).slice(1);

  const professorsMap = new Map();
  const groupsMap = new Map();
  const schedulesList = [];

  let profIdCounter = 1;
  let groupIdCounter = 1;

  // Mapa de slots de tiempo FIME
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

  for (const line of newLines) {
    const parts = parseCSVLine(line);
    if (parts.length < 5) continue;
    let [grupoStr, dia, slotStr, rawSubject, rawTeacher] = parts;

    if (!grupoStr || grupoStr === '-') continue;

    // 1. Resolver Grupo
    const matchGroup = grupoStr.match(/^(\d+)\s*([A-Z])$/i);
    if (!matchGroup) continue;

    const semester = parseInt(matchGroup[1], 10);
    const groupLetter = matchGroup[2].toUpperCase();
    
    let careerId = 371; // Default IME
    if (['B', 'D'].includes(groupLetter)) {
      careerId = 349; // ICI
    } else if (['I', 'J'].includes(groupLetter)) {
      careerId = 418; // IMT
    } else if (groupLetter === 'C') {
      careerId = 99;  // ISET
    }

    const groupKey = `${semester}-${groupLetter}-${careerId}`;
    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        id: groupIdCounter++,
        slug: groupKey.toLowerCase(),
        name: `${semester}° ${groupLetter}`,
        semester,
        group_letter: groupLetter,
        career_id: careerId
      });
    }
    const activeGroup = groupsMap.get(groupKey);

    // 2. Limpieza especial y cruce de datos
    const rawSubjectClean = cleanString(rawSubject);
    const rawTeacherClean = cleanString(rawTeacher);
    const combined = cleanString(rawSubject + ' ' + rawTeacher);

    let matchedSubject = null;
    let matchedProf = null;

    if (rawSubjectClean === 'ii' && rawTeacherClean === '') {
      matchedSubject = 'Seminario de investigación II';
      matchedProf = 'Gaytán Lugo Laura Sanely';
    } else if (combined === 'villalobosllamasgilbertovillalobosllamasgilberto') {
      matchedSubject = 'Dinámica';
      matchedProf = 'Villalobos Llamas Gilberto';
    } else if (combined === 'moraquinonesjesusurielmoraquinonesjesusuriel') {
      matchedProf = 'Mora Quiñones Jesús Uriel';
      if (grupoStr === '3 A') matchedSubject = 'Métodos numéricos';
      else if (grupoStr === '3 C') matchedSubject = 'Electrónica analógica';
      else if (grupoStr === '5 C') matchedSubject = 'Controladores lógicos programables';
      else if (grupoStr === '7 C') matchedSubject = 'Control digital';
    } else if (combined === 'gonzalezpotesapolinargonzalezpotesapolinar') {
      matchedSubject = 'Sistemas operativos';
      matchedProf = 'González Potes Apolinar';
    } else if (combined === 'arroyoledesmajaimearroyoledesmajaime' || combined === 'controlarroyoledesmajaime') {
      matchedSubject = 'Modelado y control';
      matchedProf = 'Arroyo Ledesma Jaime';
    } else if (combined === 'venegastrujillotiberiovenegastrujillotiberio') {
      matchedSubject = 'Análisis de sistemas de potencia';
      matchedProf = 'Venegas Trujillo Tiberio';
    } else if (rawSubjectClean.includes('materialesii') || rawSubjectClean === 'materialesii') {
      matchedSubject = 'Mecánica de materiales II';
      if (combined.includes('diaz')) {
        matchedProf = 'Díaz Álvarez Juan Pablo';
      }
    } else if (rawSubjectClean.includes('neumatico')) {
      matchedSubject = 'Sistemas hidráulicos y neumáticos';
      matchedProf = 'López Barajas Gabriel';
    } else if (rawSubjectClean.includes('calor')) {
      matchedSubject = 'Transferencia de calor';
      matchedProf = 'Escobar del Pozo Carlos';
    } else if (rawSubjectClean.includes('humanocomputadora')) {
      matchedSubject = 'Interacción humano-computadora';
    } else if (rawSubjectClean.includes('operativos')) {
      matchedSubject = 'Sistemas operativos';
    } else if (rawSubjectClean.includes('relacionales')) {
      matchedSubject = 'Bases de datos no relacionales';
      matchedProf = 'Evangelista Salazar Martha Elizabeth';
    } else if (rawSubjectClean.includes('aquitect') || rawSubjectClean.includes('microprocesador')) {
      matchedSubject = 'Arquitectura de microprocesadores';
      matchedProf = 'Ochoa Brust Alberto Manuel';
    } else if (rawSubjectClean.includes('energia') || rawSubjectClean.includes('energetica')) {
      matchedSubject = 'Legislación y financiamiento en materia energética';
      if (combined.includes('moya') || combined.includes('miguel')) {
        matchedProf = 'Moya Mendoza Miguel Angel';
      } else if (combined.includes('jardines') || combined.includes('ivan')) {
        matchedProf = 'Jardines González Arturo Iván';
      }
    } else if (rawSubjectClean.includes('moviles')) {
      matchedSubject = 'Programación para dispositivos móviles';
      matchedProf = 'Verduzco Ramirez Jesus Alberto';
    } else if (rawSubjectClean.includes('xochitl') || rawTeacherClean.includes('xochitl')) {
      if (grupoStr.startsWith('3')) {
        matchedSubject = 'Métodos numéricos';
      } else if (grupoStr.startsWith('7')) {
        matchedSubject = 'Seguridad de redes';
      }
      matchedProf = 'Nava Bautista Martha Xóchitl';
    } else if (rawSubjectClean.includes('probabilidady') || rawSubjectClean.includes('estadisticaprobabilidad')) {
      matchedSubject = 'Probabilidad y estadística';
      matchedProf = 'Huizar Padilla Emilio';
    } else if (rawSubjectClean.includes('robotic')) {
      matchedSubject = 'Robótica';
      matchedProf = 'Moya Mendoza Miguel Angel';
    } else if (rawSubjectClean.includes('investigacionileonel') || rawSubjectClean.includes('seminariodeinvestigacioni')) {
      matchedSubject = 'Seminario de investigación I';
      matchedProf = 'Soriano Equigua Leonel';
    } else if (rawSubjectClean.includes('emprendedores')) {
      matchedSubject = 'Taller de emprendedores';
      matchedProf = 'Montejo Que Marco';
    } else if (rawSubjectClean === 'optiv') {
      matchedSubject = 'Optativa IV';
    } else if (rawSubjectClean.includes('horacomun') || combined.includes('horacomun') || rawSubjectClean.includes('bgag') || rawSubjectClean.includes('mcshpe') || rawSubjectClean.includes('smtajgai')) {
      matchedSubject = 'Hora Común';
    }

    if (!matchedProf) {
      let maxProfLen = 0;
      for (const prof of profList) {
        const cp = cleanString(prof);
        const ct = cleanString(rawTeacher);
        if (combined.includes(cp) || (ct.length >= 5 && cp.includes(ct)) || (cp.length >= 5 && ct.includes(cp))) {
          if (cp.length > maxProfLen) {
            matchedProf = prof;
            maxProfLen = cp.length;
          }
        }
      }
    }

    if (!matchedSubject) {
      let maxSubLen = 0;
      for (const sub of subjectList) {
        const cs = cleanString(sub);
        const crs = cleanString(rawSubject);
        if (crs.includes(cs) || combined.includes(cs) || (cs.length >= 5 && crs.startsWith(cs.substring(0, 8)))) {
          if (cs.length > maxSubLen) {
            matchedSubject = sub;
            maxSubLen = cs.length;
          }
        }
      }
    }

    if (!matchedSubject) {
      matchedSubject = rawSubject;
    }

    const isHti = rawSubject.toUpperCase().includes('HTI');

    // 3. Registrar profesor en el mapa para el seed
    let teacherId = null;
    if (matchedProf) {
      const slug = slugify(matchedProf);
      if (!professorsMap.has(slug)) {
        professorsMap.set(slug, {
          id: profIdCounter++,
          slug,
          full_name: matchedProf,
          email: null,
          profile_data: {
            biography: semblanzasSlugMap.get(slug) || null
          }
        });
      }
      teacherId = professorsMap.get(slug).id;
    }

    // 4. Mapear ranura de tiempo
    const slotIdx = parseInt(slotStr.trim(), 10);
    const times = timeSlotsMap[slotIdx];
    if (!times) {
      console.warn(`Warning: slot index desconocido ${slotStr} en la línea del grupo ${grupoStr}`);
      continue;
    }
    const [startTime, endTime] = times;

    schedulesList.push({
      class_group_id: activeGroup.id,
      subject_name: matchedSubject,
      professor_id: teacherId,
      day_of_week: dia,
      start_time: startTime,
      end_time: endTime,
      is_laboratory: matchedSubject.toLowerCase().includes('taller') || matchedSubject.toLowerCase().includes('laboratorio') || matchedSubject.toLowerCase().includes('experimental'),
      is_hti: isHti
    });
  }

  // Generar SQL
  console.log('✍️ Generando SQL...');
  let sql = `-- SQL generado automáticamente para importar horarios corregidos desde CSV\n\n`;
  sql += `BEGIN;\n\n`;
  sql += `-- Limpiar tablas anteriores de manera segura\n`;
  sql += `TRUNCATE admin_users, exam_dates, schedules, professor_groups, students, class_groups, professors, subject_syllabus CASCADE;\n\n`;

  sql += `-- 1. Inserción de Profesores\n`;
  for (const [name, prof] of professorsMap.entries()) {
    const profileJson = JSON.stringify(prof.profile_data);
    const emailVal = prof.email ? `'${prof.email}'` : 'NULL';
    sql += `INSERT INTO professors (id, slug, full_name, email, delegation_id, profile_data) VALUES (${prof.id}, '${prof.slug}', '${prof.full_name.replace(/'/g, "''")}', ${emailVal}, 1, '${profileJson.replace(/'/g, "''")}');\n`;
  }
  sql += `SELECT setval('professors_id_seq', ${profIdCounter});\n\n`;

  sql += `-- 2. Inserción de Grupos\n`;
  for (const [key, grp] of groupsMap.entries()) {
    sql += `INSERT INTO class_groups (id, slug, career_id, name, academic_period, shift, semester, group_letter) VALUES (${grp.id}, '${grp.slug}', ${grp.career_id}, '${grp.name}', 'Ago-Ene 2026', 'Matutino', ${grp.semester}, '${grp.group_letter}');\n`;
  }
  sql += `SELECT setval('class_groups_id_seq', ${groupIdCounter});\n\n`;

  sql += `-- 3. Inserción de Horarios de Clase\n`;
  for (const sch of schedulesList) {
    const profIdVal = sch.professor_id ? sch.professor_id : 'NULL';
    sql += `INSERT INTO schedules (class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory, is_hti) VALUES (${sch.class_group_id}, '${sch.subject_name.replace(/'/g, "''")}', ${profIdVal}, 'Aulas FIME', '${sch.day_of_week}', '${sch.start_time}', '${sch.end_time}', ${sch.is_laboratory}, ${sch.is_hti});\n`;
  }

  sql += `\nCOMMIT;\n`;

  fs.writeFileSync(sqlOutputPath, sql);
  console.log(`✅ SQL generado exitosamente en ${sqlOutputPath}`);
}

run().catch(err => {
  console.error('Error al generar SQL:', err);
});
