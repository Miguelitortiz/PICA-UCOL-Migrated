import json
import re
import os
import sys

def slugify(text):
    # Simplificado para caracteres comunes en español
    text = text.lower().strip()
    text = re.sub(r'[áàäâ]', 'a', text)
    text = re.sub(r'[éèëê]', 'e', text)
    text = re.sub(r'[íìïî]', 'i', text)
    text = re.sub(r'[óòöô]', 'o', text)
    text = re.sub(r'[úùüû]', 'u', text)
    text = re.sub(r'[ñ]', 'n', text)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text)
    text = re.sub(r'[\s-]+', '-', text)
    return text

def remove_accents(text):
    if not text:
        return ""
    import unicodedata
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def get_levenshtein_distance(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i-1] == b[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + 1)
    return dp[m][n]

def find_best_faculty_match(dpt_str, script_dir):
    if not dpt_str:
        return "Facultad"
    
    # Intento 1: Entorno de Docker (/app/data)
    yaml_path = os.path.abspath(os.path.join(script_dir, "..", "data", "reference", "faculties.yaml"))
    if not os.path.exists(yaml_path):
        # Intento 2: Entorno local
        yaml_path = os.path.abspath(os.path.join(script_dir, "..", "..", "..", "data", "reference", "faculties.yaml"))
        
    faculties = []
    try:
        if os.path.exists(yaml_path):
            with open(yaml_path, 'r', encoding='utf-8') as f:
                content = f.read()
                import re
                matches = re.finditer(r'^\s*name:\s*(.+)$', content, re.MULTILINE)
                for m in matches:
                    faculties.append(m.group(1).strip())
    except:
        pass
        
    dpt_clean = remove_accents(dpt_str).lower().strip()
    if not dpt_clean:
        return dpt_str

    # 1. Abreviaciones clave de la Universidad de Colima
    abbrev_map = {
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
    }

    if dpt_clean in abbrev_map:
        target = abbrev_map[dpt_clean]
        # Devolver el nombre exacto de faculties si existe en la lista
        for fac in faculties:
            if fac.strip() == target:
                return fac

    scraped_tokens = dpt_clean.split()
    for token in scraped_tokens:
        if token in abbrev_map:
            target = abbrev_map[token]
            for fac in faculties:
                if fac.strip() == target:
                    return fac

    # 2. Coincidencia exacta o subcadena completa (sin acentos, minúsculas)
    best_match = None
    max_score = -1

    for fac in faculties:
        fac_clean = remove_accents(fac).lower().strip()
        if fac_clean == dpt_clean:
            return fac
        if fac_clean in dpt_clean or dpt_clean in fac_clean:
            score = 1000 + min(len(dpt_clean), len(fac_clean))
            if score > max_score:
                max_score = score
                best_match = fac

    if best_match:
        return best_match

    # 3. Puntuación por palabras y Levenshtein
    stop_words = {"de", "y", "la", "el", "en", "para", "con", "del", "los", "las", "un", "una"}
    dpt_words = [w for w in dpt_clean.split() if w not in stop_words and len(w) > 1]

    for fac in faculties:
        fac_clean = remove_accents(fac).lower().strip()
        fac_words = [w for w in fac_clean.split() if w not in stop_words and len(w) > 1]

        score = 0
        for sw in dpt_words:
            best_word_score = 0
            for fw in fac_words:
                if sw == fw:
                    best_word_score = max(best_word_score, len(sw) * 10)
                elif fw in sw or sw in fw:
                    best_word_score = max(best_word_score, min(len(sw), len(fw)) * 5)
                elif len(sw) >= 4 and len(fw) >= 4:
                    dist = get_levenshtein_distance(sw, fw)
                    if dist <= 2:
                        best_word_score = max(best_word_score, (max(len(sw), len(fw)) - dist) * 4)
            score += best_word_score

        if score > max_score:
            max_score = score
            best_match = fac

    if max_score > 10:
        return best_match

    return dpt_str

def get_slug_from_name(full_name):
    # Mapeo para profesores conocidos y sus slugs correspondientes
    
        
    # Heurística para profesores desconocidos:
    words = full_name.split()
    if len(words) >= 4:
        short_name = f"{words[0]} {words[2]}"
    elif len(words) == 3:
        short_name = f"{words[0]} {words[1]}"
    else:
        short_name = full_name
    return slugify(short_name)

def clean_journal_name(journal):
    if not journal:
        return "Revista Científica"
    
    # Eliminar URLs entre paréntesis o solas
    journal = re.sub(r'\s*\([^)]*https?://[^)]*\)', '', journal)
    journal = re.sub(r'\s*https?://\S+', '', journal)
    journal = journal.strip()
    
    # Capitalización estética respetando preposiciones y acrónimos
    words = journal.split()
    capitalized_words = []
    for i, w in enumerate(words):
        w_clean = re.sub(r'[^a-zA-Z]', '', w)
        if w_clean.isupper() and (len(w_clean) <= 3 or re.match(r'^[IVX]+$', w_clean)):
            capitalized_words.append(w)
        elif i > 0 and w.lower() in ["de", "y", "en", "para", "con", "la", "el", "los", "las", "un", "una", "o", "a", "of", "and", "in", "for", "the", "on"]:
            capitalized_words.append(w.lower())
        else:
            if w.isupper() and len(w) > 3:
                capitalized_words.append(w.title())
            else:
                capitalized_words.append(w.capitalize())
    return " ".join(capitalized_words)

def clean_course_name(name):
    if not name:
        return ""
    name = name.strip()
    # Mapeos conocidos para nombres truncados
    
        
    # Limpieza general si termina en " y" o " Y"
    if name.endswith(" y") or name.endswith(" Y"):
        name = name[:-2].strip()
        
    words = name.split()
    capitalized_words = []
    for i, w in enumerate(words):
        if w.isupper() and (len(w) <= 3 or re.match(r'^[IVX]+$', w)):
            capitalized_words.append(w)
        elif i > 0 and w.lower() in ["de", "y", "en", "para", "con", "la", "el", "los", "las", "un", "una", "o", "a"]:
            capitalized_words.append(w.lower())
        else:
            capitalized_words.append(w.capitalize())
    return " ".join(capitalized_words)

def parse_date_year(date_str):
    if not date_str:
        return None
    match = re.match(r'^(\d{4})', str(date_str))
    if match:
        return int(match.group(1))
    return None

def clean_url(url_str):
    if not url_str:
        return None
    parts = url_str.split()
    if parts:
        return parts[0]
    return None

def format_professor_cv(input_path, output_dir):
    if not os.path.exists(input_path):
        print(f"Error: No se encontró el archivo de entrada {input_path}")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    prof_data = data.get("professorData", {})
    full_name = prof_data.get("fullName", "")
    
    # Inferir género para títulos académicos (Doctor vs Doctora)
    is_female = any(name in full_name.lower() for name in ["sofia", "sofía", "elena", "maria", "maría", "ana", "gabriela", "monica", "mónica"])
    
    contact = prof_data.get("contactInfo", {})
    labor = prof_data.get("laborData", {})
    
    admission_year = parse_date_year(labor.get("admissionDate")) or 1997 # Default coherente
    

    # 1. FORMACIÓN ACADÉMICA
    formation_raw = data.get("academicFormation", {})
    degrees_raw = formation_raw.get("degrees", [])
    
    doctorados = []
    maestrias = []
    licenciatura = None
    
    for deg in degrees_raw:
        level = deg.get("level")
        title = deg.get("title", "")
        
        # Limpieza de títulos de grados académicos
        title_clean = re.sub(r'\s*\(otros\)\s*', '', title, flags=re.IGNORECASE)
        title_clean = title_clean.replace("Educacion", "Educación")
        
        inst = deg.get("institution", "")
        
        # Calcular año
        year = parse_date_year(deg.get("graduationDate")) or deg.get("endDate") or deg.get("startDate")
        if not year or year == "grado":
            year = 2025 # Valor por defecto seguro si está en trámite
            
        deg_name = title_clean
        if level == "Doctorado":
            if not (title_clean.startswith("Doctor") or title_clean.startswith("Doctora")):
                prefix = "Doctora" if is_female else "Doctor"
                deg_name = f"{prefix} en {title_clean}"
            doctorados.append({
                "degree": deg_name,
                "institution": inst,
                "year": int(year) if year else 2025
            })
        elif level == "Maestría":
            if not title_clean.startswith("Maestría"):
                deg_name = f"Maestría en {title_clean}"
            maestrias.append({
                "degree": deg_name,
                "institution": inst,
                "year": int(year) if year else 2005
            })
        elif level == "Licenciatura":
            if not (title_clean.startswith("Licenciatura") or title_clean.startswith("Ingeniería") or title_clean.startswith("Ingeniero")):
                deg_name = f"Licenciatura en {title_clean}"
            licenciatura = {
                "degree": deg_name,
                "institution": inst,
                "year": int(year) if year else 1995
            }

    # 2. PRODUCCIÓN CIENTÍFICA
    prod_raw = data.get("scientificProduction", [])
    articles = []
    books = []
    
    for prod in prod_raw:
        prod_type = prod.get("type")
        title = prod.get("title")
        
        # Si no hay título, ignorar
        if not title:
            continue
            
        year = prod.get("year") or parse_date_year(prod.get("date")) or 2025
        if year == 0:
            year = parse_date_year(prod.get("date")) or 2025
            
        if prod_type == "Artículo Científico":
            articles.append({
                "title": title,
                "journal": clean_journal_name(prod.get("journalName", "Revista Científica")),
                "year": int(year),
                "impactFactor": prod.get("impactFactor"),
                "doi": clean_url(prod.get("doiOrUrl"))
            })
        elif prod_type == "Libro":
            # Limpiar rol
            role = prod.get("role", "Coautor")
            if "coordinador" in role.lower() or "editor" in role.lower():
                role = "Coordinador"
            elif "coautor" in role.lower():
                role = "Coautor"
                
            books.append({
                "title": title,
                "role": role,
                "editorial": prod.get("editorial", "Editorial Universitaria"),
                "year": int(year)
            })

    # 3. MATERIALES DIDÁCTICOS
    mat_raw = data.get("educationalMaterials", [])
    materials = []
    for mat in mat_raw:
        title = mat.get("title")
        if not title:
            continue
        materials.append({
            "title": title,
            "type": mat.get("resourceType", "Recurso digital"),
            "year": int(mat.get("year") or 2025),
            "url": clean_url(mat.get("accessUrl"))
        })

    # 4. DOCENCIA Y TESIS
    hr = data.get("humanResources", {})
    teaching_raw = hr.get("teaching", [])
    courses = []
    for t in teaching_raw:
        name = clean_course_name(t.get("courseName"))
        if not name:
            continue
            
        # Formatear periodo
        periodo_base = t.get("period", "Ago-Ene")
        periodo_year = t.get("year", "2025")
        
        try:
            students = int(t.get("students", 20))
        except:
            students = 25
            
        courses.append({
            "name": name,
            "level": t.get("level", "Licenciatura"),
            "students": students,
            "period": f"{periodo_base} {periodo_year}"
        })

    theses_raw = hr.get("theses", [])
    theses = []
    for th in theses_raw:
        student = th.get("studentName")
        title = th.get("thesisTitle")
        if not title:
            continue
            
        year = parse_date_year(th.get("endDate")) or 2025
        
        theses.append({
            "student": student,
            "title": title,
            "year": int(year),
            "role": th.get("role", "Asesor")
        })

    # 5. CERTIFICACIONES
    cert_raw = formation_raw.get("certifications", [])
    certifications = []
    for cert in cert_raw:
        title = cert.get("title")
        if not title:
            continue
        certifications.append({
            "title": title,
            "institution": cert.get("institution", "Institución"),
            "year": int(cert.get("year") or 2023)
        })

    # 6. CUERPO ACADÉMICO
    body_raw = labor.get("academicBody", {})
    academic_body = {
        "name": body_raw.get("name", "Cuerpo Académico"),
        "level": body_raw.get("consolidationLevel", "CAEC")
    }

    # Unificar en el esquema final
    slug = get_slug_from_name(full_name)
    
    # Capitalizar nombramiento de forma limpia (ej: "Profesor investigador de tiempo completo" -> "Profesor Investigador de Tiempo Completo")
    appointment_raw = labor.get("currentAppointment", "Profesor Investigador")
    appointment = " ".join([w.lower() if w.lower() in ["de"] else w.capitalize() for w in appointment_raw.split()])

    formatted_profile = {
      "slug": slug,
      "fullName": full_name,
      "photoUrl": f"/images/profesores/{slug}.jpg",
      "title": appointment,
      "department": find_best_faculty_match(labor.get("academicUnit", "Facultad"), os.path.dirname(os.path.abspath(__file__))),
      "institutionalEmail": contact.get("institutionalEmail", "correo@ucol.mx"),
      "admissionYear": int(admission_year),
      "academicFormation": {
        "doctorados": doctorados,
        "maestrias": maestrias,
        "licenciatura": licenciatura
      },
      "scientificProduction": {
        "articles": articles,
        "books": books
      },
      "educationalMaterials": materials,
      "teaching": {
        "courses": courses,
        "theses": theses
      },
      "certifications": certifications,
      "academicBody": academic_body
    }

    # Escribir archivo de salida
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{slug}.json")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(formatted_profile, f, indent=2, ensure_ascii=False)
        
    print(f"Éxito: Perfil procesado y guardado en {output_path}")

if __name__ == "__main__":
    # Si se pasan argumentos
    input_file = "cv_extracted.json"
    
    # Intentar resolver una ruta relativa al propio script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.abspath(os.path.join(script_dir, "..", "..", "App", "src", "content", "profesores"))
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
        
    format_professor_cv(input_file, output_dir)
