# Glosario y Entidades - PICA-UCOL

## Términos del dominio
- **StudentHUB (`services/student-hub`):** Portal web optimizado y accesible para que los estudiantes consulten de manera rápida y sencilla sus horarios, materias, docentes y aulas.
- **AdminHUB (`services/admin-hub-frontend` y `services/admin-hub-backend`):** Área protegida en `/admin` que divide su funcionamiento para docentes (carga de CV y planes de estudio) y personal administrativo (gestión de horarios, tutores y exámenes).
- **ProjectHUB (`services/project-hub`):** Módulo de colaboración científica en desarrollo que centralizará proyectos de investigación y tesis.
- **Formato CV2026:** Estructura oficial del documento PDF generado por el Sistema Institucional de Currículum Vitae de la Universidad de Colima.

## Entidades principales
- **Profesor (`professors`):** Entidad central que almacena el nombre, correo, delegación y un JSONB `profile_data` con la trayectoria del docente.
- **Grupo (`class_groups`):** Contiene el nombre del grupo (ej. "4° B"), periodo escolar, turno y tutor asignado (`tutor_id`).
- **Horario (`schedules`):** Define el bloque de tiempo (día, hora inicio/fin), materia, aula o laboratorio asignado y profesor titular de un grupo.
- **Syllabus / Plan de Estudio (`subject_syllabus`):** Contiene la descripción del programa, criterios de evaluación y recursos didácticos de una asignatura.
- **Fechas de Examen (`exam_dates`):** Fechas programadas para evaluaciones parciales u ordinarias por grupo y materia.
