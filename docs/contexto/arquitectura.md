# Arquitectura de PICA-UCOL

## En una frase
PICA-UCOL es una plataforma modular monorepo diseñada para mejorar la experiencia estudiantil y la gestión académica de la Universidad de Colima, estructurada en tres servicios principales: StudentHUB (vitrina pública y horario del estudiante), AdminHUB (gestión docente y administrativa con extractor de PDFs) y ProjectHUB (módulo de colaboración científica en fase de planeación).

## Stack
- **Lenguaje / runtime:** Node.js (v22) y Python 3 (para el motor de extracción curricular).
- **Framework principal:** Astro (Astro SSR/standalone para `student-hub`, Astro SSG para `admin-hub-frontend` y `project-hub`) y Express (para la API REST `admin-hub-backend`).
- **Base de datos:** PostgreSQL 15 (con tablas para perfiles, grupos, horarios, exámenes y planes de estudio).
- **Servicios externos:** Proxy inverso Nginx (`services/proxy`) que actúa como puerta de enlace de tráfico y gestiona la caché/purga.

## Mapa de carpetas
- `data/reference/` &rarr; Archivos YAML de datos maestros (delegaciones, carreras, facultades).
- `scripts/` &rarr; Scripts del sistema (DDL SQL `init.sql` y generador de datos estáticos `generate-static-data.js`).
- `services/student-hub/` &rarr; Portal interactivo para estudiantes (Horarios, Materias, Profesores, Mapa de Aulas).
- `services/admin-hub-frontend/` &rarr; Panel de edición de CVs, syllabus y asignación administrativa.
- `services/admin-hub-backend/` &rarr; API Express en Node.js conectada a PostgreSQL y con el extractor de Python.
- `services/project-hub/` &rarr; Módulo estático placeholder para futuras fases de colaboración en investigación.
- `services/proxy/` &rarr; Configuración de Nginx para control de rutas.

## Flujo de datos
1. **Ruteo del Proxy:** Nginx enruta `/` a `student-hub`, `/admin` a `admin-hub-frontend`, `/api` a `admin-hub-backend` y `/project` a `project-hub`.
2. **Carga Docente:** Los profesores cargan sus perfiles (vía PDF) y sus planes de estudio (syllabus) o reservan laboratorios en el AdminHUB.
3. **Carga Administrativa:** Los administrativos configuran la asignación de materias, tutores, horarios de clase y fechas de exámenes.
4. **Consulta Estudiantil:** Los estudiantes acceden al StudentHUB para ver su horario semanal, hacer clic en asignaturas para ver detalles del programa y exámenes, y consultar ubicaciones en el mapa interactivo.
