const REFERENCE_SERVICE_URL = process.env.REFERENCE_SERVICE_URL || 'http://reference-service:6773';

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

export async function matchFaculty(facultyId, departmentName) {
  try {
    const response = await fetch(`${REFERENCE_SERVICE_URL}/faculties`);
    if (!response.ok) {
      throw new Error(`Failed to fetch faculties: ${response.statusText}`);
    }
    const faculties = await response.json();

    if (facultyId) {
      const fac = faculties.find(f => f.id === facultyId);
      if (fac) {
        return {
          faculty_id: fac.id,
          career_ids: fac.career_ids || [],
          delegation_id: fac.delegation_id
        };
      }
    }

    if (departmentName) {
      const dptClean = normalizeString(departmentName);
      let matchedFac = null;

      // 1. Abreviaciones clave
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
        return {
          faculty_id: matchedFac.id,
          career_ids: matchedFac.career_ids || [],
          delegation_id: matchedFac.delegation_id
        };
      }
    }
  } catch (err) {
    console.error('Error during matchFaculty:', err);
  }
  return null;
}
