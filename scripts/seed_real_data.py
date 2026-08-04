import os
import csv
import re
import json
import psycopg2

# INITIALS MAP
INITIALS_MAP = {
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
    'MPN': 'Docente MPN'
}

FIME_CAREERS = [
    { "id": 349, "slug": "ingenieria-en-computacion-inteligente", "name": "Ingeniería en Computación Inteligente", "groups": ["B", "D"] },
    { "id": 371, "slug": "ingeniero-mecanico-electricista", "name": "Ingeniero Mecánico Electricista", "groups": ["A", "G", "H"] },
    { "id": 418, "slug": "ingenieria-en-mecatronica", "name": "Ingeniería en Mecatrónica", "groups": ["I", "J"] },
    { "id": 99, "slug": "ingenieria-en-sistemas-electronicos-y-telecomunicaciones", "name": "Ingeniería en Sistemas Electrónicos y Telecomunicaciones", "groups": ["C"] }
]

DEFAULT_PASSWORD_HASH = '$2b$10$sJ9wtmXBK9UWArp7EGfUCupb05kG9R6jRwrqDdSS3uq0lcrcHQI42'

def slugify(text):
    if not text:
        return ''
    text = text.lower().strip()
    # Normalize accents
    text = re.sub(r'[áàäâ]', 'a', text)
    text = re.sub(r'[éèëê]', 'e', text)
    text = re.sub(r'[íìïî]', 'i', text)
    text = re.sub(r'[óòöô]', 'o', text)
    text = re.sub(r'[úùüû]', 'u', text)
    text = re.sub(r'ñ', 'n', text)
    text = re.sub(r'[^a-z0-9 -]', '', text)
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text

def parse_env():
    env = {}
    for filename in ['.env.production', '.env']:
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            env[parts[0].strip()] = parts[1].strip()
    return env

def main():
    env = parse_env()
    db_url = os.environ.get('DATABASE_URL') or env.get('DATABASE_URL')
    
    if not db_url:
        db_user = env.get('DB_USER', 'admin')
        db_pass = env.get('DB_PASSWORD', 'admin_pass')
        db_host = env.get('DB_HOST', 'localhost')
        db_port = env.get('DB_PORT', '5432')
        db_name = env.get('DB_NAME', 'pica_db')
        db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    print("🔌 Conectando a la base de datos...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    try:
        # 1. Truncate tables
        print("🧹 Limpiando registros anteriores de la base de datos...")
        cur.execute("TRUNCATE admin_users, exam_dates, schedules, professor_groups, students, class_groups, professors, subject_syllabus CASCADE;")

        # 2. Read and parse CSV
        csv_path = "horarios_completos (1).csv"
        print(f"📄 Leyendo archivo {csv_path}...")
        
        rows = []
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append({k.strip(): v.strip() if v else '' for k, v in row.items()})

        print(f"✅ CSV cargado con {len(rows)} registros.")

        # 3. Identify Unique Professors
        print("👨‍🏫 Identificando profesores únicos...")
        unique_profs = set()
        
        for row in rows:
            doc = row.get('Docente', '')
            if doc and doc != '-':
                names = [n.strip() for n in doc.split('/')]
                for name in names:
                    if name and name != '-':
                        resolved = INITIALS_MAP.get(name, name)
                        if len(resolved) > 6:
                            unique_profs.add(resolved)

        unique_profs.add('Docente MPN')

        print(f"Encontrados {len(unique_profs)} profesores únicos. Insertando...")
        professor_map = {} # name -> id
        
        for idx, fullName in enumerate(sorted(list(unique_profs))):
            base_slug = slugify(fullName)
            slug = f"{base_slug}-{idx + 1}"
            email = f"{base_slug.replace('-', '.')}@ucol.mx"
            
            profile_data = {
                "slug": slug,
                "fullName": fullName,
                "photoUrl": "/images/profesores/default.jpg",
                "title": "Profesor de FIME",
                "department": "Facultad de Ingeniería Mecánica y Eléctrica",
                "institutionalEmail": email,
                "admissionYear": 2015,
                "contactInfo": {
                    "phone": f"312 316 1000 Ext. {100 + idx}",
                    "office": f"Edificio FIME PTC, Cubículo {idx + 1}",
                    "officeHours": "Lunes a Jueves 11:00-13:00"
                },
                "academicFormation": {
                    "doctorados": [],
                    "maestrias": [],
                    "licenciatura": {
                        "degree": "Ingeniería",
                        "institution": "Universidad de Colima",
                        "year": 2010
                    }
                },
                "scientificProduction": { "articles": [], "books": [] },
                "educationalMaterials": [],
                "teaching": { "courses": [], "theses": [] },
                "certifications": [],
                "academicBody": {
                    "name": "Cuerpo Académico de FIME",
                    "level": "En Consolidación"
                }
            }

            cur.execute("""
                INSERT INTO professors (slug, full_name, email, delegation_id, profile_data)
                VALUES (%s, %s, %s, %s, %s) RETURNING id;
            """, (slug, fullName, email, 4, json.dumps(profile_data)))
            professor_map[fullName] = cur.fetchone()[0]

        print("✅ Profesores insertados.")

        # 4. Insert Unique Groups
        print("🏫 Creando grupos de clase...")
        unique_groups = sorted(list(set(row['Grupo'] for row in rows if row.get('Grupo'))))
        group_map = {} # group_name -> id
        
        for g_name in unique_groups:
            match = re.match(r'^(\d+)\s+([A-J])$', g_name, re.IGNORECASE)
            if not match:
                continue
            semester = int(match.group(1))
            letter = match.group(2).upper()
            slug_group = f"{semester}-{letter.lower()}"
            
            career = next((c for c in FIME_CAREERS if letter in c['groups']), FIME_CAREERS[0])
            group_slug = f"{slug_group}-{career['id']}"
            shift = 'Matutino' if semester <= 5 else 'Vespertino'
            
            cur.execute("""
                INSERT INTO class_groups (slug, career_id, name, academic_period, shift, semester, group_letter)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;
            """, (group_slug, career['id'], f"{semester}° {letter}", "Ago-Ene 2026", shift, semester, letter))
            group_map[g_name] = cur.fetchone()[0]

        print("✅ Grupos de clase creados.")

        # 5. Insert Schedules, Syllabus and professor-groups
        print("📅 Creando horarios y materias...")
        subject_syllabus_set = set()
        
        for row in rows:
            g_name = row.get('Grupo', '')
            day = row.get('Día', '')
            horario = row.get('Horario', '')
            subject_str = row.get('Materia', '')
            docente_str = row.get('Docente', '')
            observaciones = row.get('Observaciones', '')
            
            if not g_name or not day or not horario or not subject_str:
                continue
                
            group_id = group_map.get(g_name)
            if not group_id:
                continue
                
            cur.execute("SELECT career_id FROM class_groups WHERE id = %s", (group_id,))
            career_id = cur.fetchone()[0]
            
            # Parse Horario
            time_match = re.match(r'^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$', horario)
            if not time_match:
                time_match = re.match(r'^(\d{2}:\d{2})\s*–\s*(\d{2}:\d{2})$', horario)
            
            if not time_match:
                continue
                
            start_time = f"{time_match.group(1)}:00"
            end_time = f"{time_match.group(2)}:00"
            
            # Resolve teachers
            doc_teachers = []
            if docente_str and docente_str != '-':
                doc_teachers = [INITIALS_MAP.get(t.strip(), t.strip()) for t in docente_str.split('/') if t.strip()]
            
            mat_parts = [p.strip() for p in subject_str.split('/')]
            mat_teachers = []
            subjects = []
            
            for part in mat_parts:
                resolved = INITIALS_MAP.get(part, part)
                if resolved in unique_profs or part in INITIALS_MAP:
                    mat_teachers.append(resolved)
                else:
                    subjects.append(part)
                    
            all_teachers = mat_teachers + doc_teachers
            if not subjects:
                subjects.append('HTI')
                
            entries = []
            if not all_teachers:
                for sub in subjects:
                    entries.append({"subject": sub, "teacher": None})
            else:
                num_entries = max(len(subjects), len(all_teachers))
                for i in range(num_entries):
                    sub = subjects[i] if i < len(subjects) else subjects[-1]
                    teacher = all_teachers[i] if i < len(all_teachers) else all_teachers[-1]
                    entries.append({"subject": sub, "teacher": teacher})
                        
            for entry in entries:
                prof_name = entry["teacher"]
                prof_id = professor_map.get(prof_name) if prof_name else None
                sub_name = entry["subject"]
                
                is_lab = 'taller' in sub_name.lower() or 'laboratorio' in sub_name.lower() or 'laboratorio' in observaciones.lower() or 'lab' in observaciones.lower()
                classroom = 'Cómputo y Talleres' if is_lab else 'Aulas'
                
                cur.execute("""
                    INSERT INTO schedules (class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (group_id, sub_name, prof_id, classroom, day, start_time, end_time, is_lab))
                
                if prof_id:
                    cur.execute("""
                        INSERT INTO professor_groups (professor_id, class_group_id, subject_taught)
                        VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;
                    """, (prof_id, group_id, sub_name))
                    
                # Syllabus
                syllabus_key = f"{slugify(sub_name)}-{career_id}"
                if syllabus_key not in subject_syllabus_set:
                    eval_criteria = {
                        "Exámenes": "50%",
                        "Prácticas y Laboratorio": "30%",
                        "Tareas y Proyectos": "20%"
                    }
                    cur.execute("""
                        INSERT INTO subject_syllabus (slug, subject_name, career_id, program_description, evaluation_criteria, resources, created_by)
                        VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;
                    """, (syllabus_key, sub_name, career_id, f"Programa oficial para la asignatura de {sub_name}.", json.dumps(eval_criteria), json.dumps([]), prof_id))
                    subject_syllabus_set.add(syllabus_key)

        print("✅ Horarios y planes creados.")

        # 6. Exam dates
        print("📅 Generando fechas de exámenes...")
        cur.execute("SELECT DISTINCT class_group_id, subject_name FROM schedules;")
        group_subjects = cur.fetchall()
        for g_id, sub_name in group_subjects:
            cur.execute("""
                INSERT INTO exam_dates (class_group_id, subject_name, exam_name, exam_date, exam_time) VALUES
                (%s, %s, 'Evaluación de 1er Parcial', '2026-10-14', '09:00:00'),
                (%s, %s, 'Evaluación de 2do Parcial', '2026-11-20', '09:00:00');
            """, (g_id, sub_name, g_id, sub_name))
        print("✅ Fechas de exámenes creadas.")

        # 7. Students
        print("👨‍🎓 Creando estudiantes de prueba...")
        cur.execute("SELECT id FROM class_groups WHERE slug = '1-a-371';")
        target_group = cur.fetchone()
        
        # Bcrypt hash for 'password'
        STUDENT_PASS_HASH = '$2a$10$bGDWi3wEQcVLXApe/bTDNuaKhl99uqwz02Txx4yaGDU9stZLO/E8u'
        
        if target_group:
            cur.execute("""
                INSERT INTO students (enrollment_id, full_name, email, password_hash, class_group_id)
                VALUES (%s, %s, %s, %s, %s);
            """, ('20180000', 'Miguel Ángel Ortiz', 'miguel@ucol.mx', STUDENT_PASS_HASH, target_group[0]))

        cur.execute("SELECT id, slug FROM class_groups;")
        all_groups = cur.fetchall()
        enrollment = 20260001
        for g_id, g_slug in all_groups:
            email = f"estudiante.{g_slug.replace('-', '_')}@ucol.mx"
            cur.execute("""
                INSERT INTO students (enrollment_id, full_name, email, password_hash, class_group_id)
                VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;
            """, (str(enrollment), f"Estudiante Prueba {g_slug.upper()}", email, STUDENT_PASS_HASH, g_id))
            enrollment += 1
        print("✅ Estudiantes creados.")

        # 8. Admin users
        print("🔐 Creando administradores de AdminHUB...")
        cur.execute("SELECT id, email FROM professors LIMIT 2;")
        profs = cur.fetchall()
        prof1_id = profs[0][0] if len(profs) > 0 else None
        prof2_id = profs[1][0] if len(profs) > 1 else None

        cur.execute("""
            INSERT INTO admin_users (username, email, password_hash, role, professor_id, career_id, faculty_id, faculty_ids) VALUES
            ('admin',       'admin@ucol.mx',        %s, 'admin_general',         NULL, NULL, NULL, NULL),
            ('jefe.carrera','jcarrera@ucol.mx',     %s, 'jefe_carrera',          NULL, 349, NULL, NULL),
            ('coord.fic',   'cfic@ucol.mx',         %s, 'coordinador_facultad',  NULL, NULL, 4, NULL),
            ('admin.dir',   'admindir@ucol.mx',     %s, 'admin_direccion',       NULL, NULL, NULL, ARRAY[4]);
        """, (DEFAULT_PASSWORD_HASH, DEFAULT_PASSWORD_HASH, DEFAULT_PASSWORD_HASH, DEFAULT_PASSWORD_HASH))

        if prof1_id:
            cur.execute("""
                INSERT INTO admin_users (username, email, password_hash, role, professor_id)
                VALUES ('docente1', 'docente1@ucol.mx', %s, 'docente', %s);
            """, (DEFAULT_PASSWORD_HASH, prof1_id))
        if prof2_id:
            cur.execute("""
                INSERT INTO admin_users (username, email, password_hash, role, professor_id)
                VALUES ('docente2', 'docente2@ucol.mx', %s, 'docente', %s);
            """, (DEFAULT_PASSWORD_HASH, prof2_id))
            
        print("✅ Administradores creados.")

        conn.commit()
        print("\n🎉 ¡Población de datos en base de datos con Python finalizada con éxito!")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error durante el proceso de población: {e}")
        raise e
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
