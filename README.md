# PICA-UCOL - Plataforma Académica Integrada (Monorepo)

PICA-UCOL es una plataforma profesional, desacoplada y modular diseñada para la gestión y consulta de la actividad académica en la Universidad de Colima.

Esta solución está organizada en un **Monorepo** orquestado mediante **Docker Compose** y cuenta con una arquitectura de múltiples subproyectos para separar la interacción estudiantil, la administración docente y los planes futuros de colaboración científica.

---

## 📁 Estructura del Monorepo

```
PICA-UCOL/
├── data/
│   └── reference/
│       ├── delegations.yaml        # Lista inmutable de Delegaciones
│       ├── careers.yaml            # Lista inmutable de Carreras
│       └── faculties.yaml          # Lista inmutable de Facultades
├── scripts/
│   ├── init.sql                    # Inicialización DDL de PostgreSQL + Semillas extendidas
│   └── generate-static-data.js     # Script extractor de BD a JSONs locales
├── services/
│   ├── student-hub/                # StudentHUB: Horarios, materias y aulas (Astro SSR)
│   ├── admin-hub-frontend/         # AdminHUB: Panel administrativo y editor (Astro static)
│   ├── admin-hub-backend/          # AdminHUB: API REST (Express) + Python Extractor
│   ├── project-hub/                # ProjectHUB: Placeholder del módulo de investigación
│   └── proxy/                      # Nginx Reverse Proxy y ruteador
├── docker-compose.yml              # Orquestador del monorepo
├── .env.production                 # Variables de entorno
└── README.md                       # Esta guía
```

---

## ⚙️ Reglas de Enrutamiento del Proxy (Nginx)

El servicio `proxy` expone el puerto `80` y enruta el tráfico interno de la siguiente manera:
- **`/`** &rarr; Dirige a `student-hub` (StudentHUB - Horarios y materias).
- **`/admin`** &rarr; Dirige a `admin-hub-frontend` (AdminHUB - Panel administrativo y de docentes).
- **`/api`** &rarr; Dirige a `admin-hub-backend` (Endpoints REST, protegidos por Basic Auth).
- **`/project`** &rarr; Dirige a `project-hub` (ProjectHUB - Módulo científico).

---

## 🚀 Despliegue con Docker Compose (Recomendado)

Todo el ecosistema se levanta e inicializa con un único comando:

1. **Configurar el archivo `.env.production`**:
   Configura las credenciales deseadas para PostgreSQL y el Basic Auth de administración:
   ```env
   DB_USER=admin
   DB_PASSWORD=admin_pass
   ADMIN_USER=admin
   ADMIN_PASSWORD=admin_pass
   ```

2. **Iniciar la aplicación**:
   ```bash
   docker-compose up -d --build
   ```

3. **Verificar servicios**:
   - Accede al **StudentHUB**: **`http://localhost/`**
   - Accede al **AdminHUB**: **`http://localhost/admin`**
     *(Las credenciales por defecto son `admin` / `admin_pass`)*
   - Accede al **ProjectHUB**: **`http://localhost/project`**

---

## 🗄️ Modelo de Datos (PostgreSQL)

El archivo `scripts/init.sql` inicializa las tablas necesarias:
1. **`professors`**: Almacena identificador, slug, adscripción y el objeto estructurado JSONB `profile_data` del docente.
2. **`class_groups`**: Contiene los grupos dinámicos creados desde el panel (con referencia a la carrera y tutor académico).
3. **`schedules`**: Tabla con la grilla horaria semanal asignada a un grupo y materia (día, hora inicio/fin, aula o laboratorio).
4. **`exam_dates`**: Calendario de fechas de evaluaciones y exámenes programados por materia y grupo.
5. **`subject_syllabus`**: Contiene los programas de estudio, criterios de calificación y bibliografía didáctica.
