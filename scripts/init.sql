-- DDL Schema Setup for PICA-UCOL

-- 1. Profesores (Almacena el perfil completo en JSONB)
CREATE TABLE professors (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    delegation_id INTEGER, -- Referencia al ID del YAML (sin FK)
    profile_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Grupos (Dinámicos)
CREATE TABLE class_groups (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    career_id INTEGER, -- Referencia al ID del YAML (sin FK)
    name VARCHAR(50) NOT NULL,
    academic_period VARCHAR(50),
    shift VARCHAR(50),
    tutor_id INTEGER REFERENCES professors(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2.5 Estudiantes
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    enrollment_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    class_group_id INTEGER REFERENCES class_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tabla Puente (Asignación Profesor <-> Grupo)
CREATE TABLE professor_groups (
    id SERIAL PRIMARY KEY,
    professor_id INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
    class_group_id INTEGER NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
    subject_taught VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(professor_id, class_group_id, subject_taught)
);

-- 4. Horarios de clases (Schedules)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    class_group_id INTEGER NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    professor_id INTEGER REFERENCES professors(id) ON DELETE SET NULL,
    classroom_name VARCHAR(100) NOT NULL,
    day_of_week VARCHAR(20) NOT NULL, -- 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_laboratory BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Fechas de Exámenes y Evaluaciones
CREATE TABLE exam_dates (
    id SERIAL PRIMARY KEY,
    class_group_id INTEGER NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    exam_name VARCHAR(100) NOT NULL, -- e.g., '1° Parcial', '2° Parcial', 'Ordinario'
    exam_date DATE NOT NULL,
    exam_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Planes de Estudio y Criterios por Materia (Syllabus)
CREATE TABLE subject_syllabus (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(150) UNIQUE NOT NULL, -- e.g. 'patrones-de-diseno-191'
    subject_name VARCHAR(255) NOT NULL,
    career_id INTEGER NOT NULL, -- Referencia al ID del YAML (sin FK)
    program_description TEXT,
    evaluation_criteria JSONB NOT NULL, -- Criterios de evaluación y calificación
    resources JSONB NOT NULL, -- Recursos adicionales (archivos, libros, links)
    created_by INTEGER REFERENCES professors(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_professors_delegation ON professors(delegation_id);
CREATE INDEX idx_groups_career ON class_groups(career_id);
CREATE INDEX idx_schedules_group ON schedules(class_group_id);
CREATE INDEX idx_exams_group ON exam_dates(class_group_id);
CREATE INDEX idx_syllabus_career ON subject_syllabus(career_id);


-- ==========================================
-- SEED DATA (DATOS SEMILLA COMPLETOS)
-- ==========================================

-- 1. Profesores Semilla
INSERT INTO professors (slug, full_name, email, delegation_id, profile_data) VALUES
('carlos-ruiz', 'Dr. Carlos Ruiz', 'cruiz@ucol.mx', 1, '{
  "slug": "carlos-ruiz",
  "fullName": "Dr. Carlos Ruiz",
  "institutionalEmail": "cruiz@ucol.mx",
  "contactInfo": {
    "phone": "312 316 1000 Ext. 104",
    "office": "Cubículos PTC, Planta Baja",
    "officeHours": "Lunes y Miércoles 10:00-12:00"
  },
  "title": "Profesor Investigador (PTC)",
  "image": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600"
}'),
('silvia-mendoza', 'Mtra. Silvia Mendoza', 'smendoza@ucol.mx', 1, '{
  "slug": "silvia-mendoza",
  "fullName": "Mtra. Silvia Mendoza",
  "institutionalEmail": "smendoza@ucol.mx",
  "contactInfo": {
    "phone": "312 316 1000 Ext. 201",
    "office": "Edificio de Cómputo y Talleres",
    "officeHours": "Jueves 16:00-18:00"
  },
  "title": "Profesora de Asignatura",
  "image": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=600"
}'),
('elena-ramirez', 'Dra. Elena Ramírez', 'eramirez@ucol.mx', 2, '{
  "slug": "elena-ramirez",
  "fullName": "Dra. Elena Ramírez",
  "institutionalEmail": "eramirez@ucol.mx",
  "contactInfo": {
    "phone": "312 316 1111",
    "office": "Dirección FIC",
    "officeHours": "Martes 10:00-12:00"
  },
  "title": "Profesora Investigadora (PTC)",
  "image": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600"
}');

-- 2. Grupos Semilla
-- 191 es Ingeniería de Software
INSERT INTO class_groups (slug, career_id, name, academic_period, shift, tutor_id) VALUES
('4-b-191', 191, '4° B', 'Ago-Ene 2026', 'Matutino', 1);

-- 3. Estudiantes
-- La contraseña será "password" pero guardada en texto plano (o un hash trivial) para el propósito del demo.
INSERT INTO students (enrollment_id, full_name, email, password_hash, class_group_id) VALUES
('20180000', 'Miguel Ángel', 'miguel@ucol.mx', 'password', 1);

-- 4. Tabla Puente de asignaciones (Docencia)
INSERT INTO professor_groups (professor_id, class_group_id, subject_taught) VALUES
(1, 1, 'Programación Orientada a Objetos'),
(2, 1, 'Sistemas Operativos Modernos'),
(3, 1, 'Ingeniería de Requisitos');

-- 5. Horarios Semilla para 4° B (id=1)
INSERT INTO schedules (class_group_id, subject_name, professor_id, classroom_name, day_of_week, start_time, end_time, is_laboratory) VALUES
(1, 'Programación Orientada a Objetos', 1, 'Aulas', 'Lunes', '07:00:00', '09:00:00', FALSE),
(1, 'Programación Orientada a Objetos', 1, 'Aulas', 'Miércoles', '07:00:00', '09:00:00', FALSE),
(1, 'Sistemas Operativos Modernos', 2, 'Cómputo y Talleres', 'Jueves', '11:00:00', '13:00:00', TRUE),
(1, 'Ingeniería de Requisitos', 3, 'Dirección FIC', 'Martes', '09:00:00', '11:00:00', FALSE);

-- 6. Fechas de Exámenes
INSERT INTO exam_dates (class_group_id, subject_name, exam_name, exam_date, exam_time) VALUES
(1, 'Programación Orientada a Objetos', 'Evaluación de 1er Parcial', '2026-10-14', '09:00:00'),
(1, 'Sistemas Operativos Modernos', 'Examen de Medio Término', '2026-10-25', '10:00:00'),
(1, 'Programación Orientada a Objetos', 'Evaluación de 2do Parcial', '2026-11-20', '09:00:00');

-- 7. Planes de Estudio / Syllabus Semilla
INSERT INTO subject_syllabus (slug, subject_name, career_id, program_description, evaluation_criteria, resources, created_by) VALUES
('poo-191', 'Programación Orientada a Objetos', 191, 
'Conceptos avanzados de abstracción, encapsulamiento, polimorfismo y herencia. Patrones de diseño de software.',
'{"exams": "50%", "project": "50%"}',
'[]', 1),
('so-191', 'Sistemas Operativos Modernos', 191, 
'Administración de memoria, concurrencia, sistemas de archivos y virtualización. Contenedores y orquestadores.',
'{"exams": "60%", "practice": "40%"}',
'[]', 2),
('req-191', 'Ingeniería de Requisitos', 191, 
'Técnicas de elicitación, análisis, especificación y validación de requisitos de software.',
'{"exams": "50%", "project": "50%"}',
'[]', 3);
