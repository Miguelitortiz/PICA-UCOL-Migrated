# Plan Técnico: Despliegue en Producción y Migración a Microservicios

## Despliegue Remoto en Servidor SSH (ici@148.213.103.157)

### Objetivo
Desplegar el proyecto PICA-UCOL-Migrated en el servidor proporcionado, probar su accesibilidad desde el exterior y establecer un flujo de trabajo local-remoto utilizando Git.

### Estado Actual del Servidor
Al revisar el servidor `ici@148.213.103.157`, se encontró que:
1. La conexión SSH funciona correctamente.
2. `git` está instalado (versión 2.53.0).
3. `docker` y `docker compose` **no están instalados** actualmente.

### Open Questions
> [!WARNING]
> ¿Deseas que instale automáticamente Docker y Docker Compose en el servidor remoto (`ici@148.213.103.157`) como parte de este despliegue, o prefieres instalarlo tú manualmente? (El plan asume que procederé con la instalación).

### Pasos de Despliegue (Proposed Changes)

1. **Instalación de Dependencias (Servidor Remoto)**
   - Instalar Docker Engine y Docker Compose en el servidor a través de SSH.
   - Habilitar el servicio de Docker.

2. **Clonado del Repositorio**
   - Ejecutar `git clone https://github.com/Miguelitortiz/PICA-UCOL-Migrated.git` en el home del usuario `ici`.

3. **Configuración y Puesta en Marcha**
   - Asegurar que exista un `.env.production` válido en el servidor.
   - Ejecutar `docker compose up -d --build` para levantar toda la infraestructura (Base de datos, Backend, Frontend, Nginx Proxy, etc.).

4. **Verificación de Accesibilidad (Verification Plan)**
   - Comprobar que los contenedores están corriendo con `docker ps`.
   - Realizar una prueba `curl` local en el servidor al puerto 80.
   - Validar el acceso externo conectándose a `http://148.213.103.157` desde el entorno local.

### Flujo de Trabajo Propuesto (Git Workflow)
Tal como lo solicitaste, cualquier cambio seguirá estrictamente este flujo:
1. **Desarrollo Local**: Modificar el código en la máquina local (`/var/home/Moi/Documents/Projects/PICA-UCOL-Migrated`).
2. **Push a GitHub**: Hacer `git add`, `git commit` y `git push` a `origin main`.
3. **Despliegue Remoto**: Conectarse al servidor vía SSH, ejecutar `git pull` en el directorio del proyecto y reconstruir los contenedores afectados con `docker compose up -d --build <servicio>`.

---

## Resumen Ejecutivo de la Migración

PICA-UCOL es una plataforma académica de la Universidad de Colima que actualmente opera como un **monorepo con 5 servicios Docker** (StudentHUB, AdminHUB Frontend, AdminHUB Backend, ProjectHUB, Proxy Nginx). A pesar de estar containerizada, la arquitectura presenta **acoplamiento fuerte** entre servicios, un **backend monolítico de 1052 líneas** que mezcla múltiples dominios, y **archivos .astro gigantes** (hasta 168KB / 3768 líneas en un solo archivo). Este plan describe la migración gradual hacia una arquitectura de microservicios genuina, orientada a la expansión, mantenibilidad y trabajo colaborativo.

---

## 1. Diagnóstico de la Arquitectura Actual

### 1.1 Mapa de Servicios Existentes

```mermaid
graph TB
    subgraph "Proxy Nginx :80"
        PROXY["Nginx Reverse Proxy"]
    end

    subgraph "Frontends"
        SH["StudentHUB<br/>Astro SSR + Node<br/>TailwindCSS v4"]
        AHF["AdminHUB Frontend<br/>Astro Static<br/>TailwindCSS v4"]
        PH["ProjectHUB<br/>Astro Static<br/>Placeholder"]
    end

    subgraph "Backend"
        AHB["AdminHUB Backend<br/>Express.js (server.js)<br/>1052 líneas monolíticas"]
        PY["cv_extractor<br/>Python Scripts<br/>pdfplumber"]
    end

    subgraph "Data Layer"
        PG["PostgreSQL 15<br/>8 tablas + seeds"]
        YAML["YAML Reference Files<br/>delegations, careers, faculties"]
    end

    PROXY --> |"/"| SH
    PROXY --> |"/admin"| AHF
    PROXY --> |"/api, /auth"| AHB
    PROXY --> |"/project"| PH

    SH --> |"Conexión directa pg"| PG
    SH --> |"fs.readFileSync"| YAML
    AHB --> |"pg Pool"| PG
    AHB --> |"fs.readFile"| YAML
    AHB --> |"spawn python3"| PY
```

### 1.2 Stack Tecnológico Actual

| Componente | Tecnología | Versión |
|---|---|---|
| Student Frontend | Astro SSR + @astrojs/node | 6.4.7 |
| Admin Frontend | Astro Static | 6.4.7 |
| Admin Backend | Express.js | 5.2.1 |
| CV Extractor | Python + pdfplumber | 3.11 |
| Base de Datos | PostgreSQL | 15-alpine |
| Proxy | Nginx | alpine |
| CSS Framework | TailwindCSS | 4.3.1 |
| Autenticación | JWT + bcrypt + cookies cifradas | - |
| Runtime | Node.js | 22 |

### 1.3 Modelo de Datos Actual (PostgreSQL)

```mermaid
erDiagram
    professors {
        SERIAL id PK
        VARCHAR slug UK
        VARCHAR full_name
        VARCHAR email
        INTEGER delegation_id
        JSONB profile_data
    }
    class_groups {
        SERIAL id PK
        VARCHAR slug UK
        INTEGER career_id
        VARCHAR name
        VARCHAR academic_period
        VARCHAR shift
        INTEGER tutor_id FK
        INTEGER semester
        VARCHAR group_letter
    }
    students {
        SERIAL id PK
        VARCHAR enrollment_id UK
        VARCHAR full_name
        VARCHAR email
        VARCHAR password_hash
        INTEGER class_group_id FK
    }
    professor_groups {
        SERIAL id PK
        INTEGER professor_id FK
        INTEGER class_group_id FK
        VARCHAR subject_taught
    }
    schedules {
        SERIAL id PK
        INTEGER class_group_id FK
        VARCHAR subject_name
        INTEGER professor_id FK
        VARCHAR classroom_name
        VARCHAR day_of_week
        TIME start_time
        TIME end_time
        BOOLEAN is_laboratory
    }
    exam_dates {
        SERIAL id PK
        INTEGER class_group_id FK
        VARCHAR subject_name
        VARCHAR exam_name
        DATE exam_date
        TIME exam_time
    }
    subject_syllabus {
        SERIAL id PK
        VARCHAR slug UK
        VARCHAR subject_name
        INTEGER career_id
        TEXT program_description
        JSONB evaluation_criteria
        JSONB resources
        INTEGER created_by FK
    }
    admin_users {
        SERIAL id PK
        VARCHAR username UK
        VARCHAR email UK
        VARCHAR password_hash
        admin_role role
        INTEGER professor_id FK
        INTEGER career_id
        INTEGER faculty_id
        INTEGER[] faculty_ids
        BOOLEAN is_active
    }

    professors ||--o{ professor_groups : "enseña en"
    class_groups ||--o{ professor_groups : "tiene profesores"
    class_groups ||--o{ schedules : "tiene horarios"
    class_groups ||--o{ exam_dates : "tiene exámenes"
    class_groups ||--o{ students : "tiene estudiantes"
    professors ||--o{ schedules : "imparte"
    professors ||--o{ subject_syllabus : "creó"
    professors ||--o{ admin_users : "vinculado a"
    professors ||--o| class_groups : "tutora"
```

### 1.4 Problemas Críticos Identificados

> [!CAUTION]
> **Deuda técnica acumulada que bloquea la expansión del proyecto.**

#### 🔴 Problemas de Arquitectura

| # | Problema | Archivo(s) Afectado(s) | Severidad |
|---|---|---|---|
| A1 | **Backend monolítico**: Un solo `server.js` de 1052 líneas contiene TODA la lógica: auth, profesores, grupos, horarios, exámenes, syllabus, cache purge, CV extraction, fuzzy matching de facultades. | [server.js](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/admin-hub-backend/server.js) | Crítica |
| A2 | **Archivos .astro gigantes**: El admin frontend concentra 3768 líneas en un solo `index.astro` con toda la UI del panel administrativo. El student `index.astro` tiene 41KB. | [admin/index.astro](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/admin-hub-frontend/src/pages/index.astro), [student/index.astro](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/pages/index.astro) | Crítica |
| A3 | **StudentHUB accede directamente a PostgreSQL**: El frontend SSR tiene su propia conexión `pg.Pool` y consulta tablas directamente, sin pasar por ninguna API. | [db.js](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/lib/db.js), [cargarDatos.js](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/lib/cargarDatos.js) | Crítica |
| A4 | **Datos de referencia duplicados**: Tanto StudentHUB como AdminHUB Backend leen archivos YAML directamente del filesystem. También existen copias JSON estáticas generadas por un script de build. | [cargarDatos.js](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/lib/cargarDatos.js), [server.js L237-271](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/admin-hub-backend/server.js#L237-L271) | Alta |
| A5 | **Acoplamiento backend-Python**: El backend Node.js invoca scripts Python via `child_process.spawn()` para extracción de CVs, creando dependencia de runtime mixto (Node+Python en un solo contenedor). | [server.js L92-124](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/admin-hub-backend/server.js#L92-L124), [Dockerfile](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/admin-hub-backend/Dockerfile) | Alta |
| A6 | **Sin API Gateway unificado**: El proxy Nginx solo hace path-routing básico sin rate limiting, circuit breaking, ni centralización de CORS/auth. | [default.conf](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/proxy/default.conf) | Media |
| A7 | **Sin testing automatizado**: No existen tests unitarios, de integración ni e2e en ninguno de los servicios. | Todo el repo | Alta |
| A8 | **Sin CI/CD**: No hay pipelines de integración continua ni despliegue automatizado. | Root | Alta |

#### 🟡 Problemas de Seguridad

| # | Problema | Severidad |
|---|---|---|
| S1 | JWT secret hardcodeado como fallback: `'pica-ucol-jwt-secret-2026'` | Alta |
| S2 | Cookie secret hardcodeado como fallback: `'pica_session_fallback_secret_key_12345!'` | Alta |
| S3 | Contraseña de estudiante en texto plano en seeds SQL: `'password'` | Media |
| S4 | CORS completamente abierto (`app.use(cors())`) sin restricción de origen | Media |
| S5 | `.env.production` con credenciales por defecto versionado en git | Crítica |

#### 🟠 Problemas de Mantenibilidad

| # | Problema |
|---|---|
| M1 | Nombres de paquetes inconsistentes (`eduvitae-admin-backend`, `agreeable-apogee`, `pica-student-hub`) |
| M2 | Archivos sueltos en la raíz del monorepo: `scratch.py`, `horarios_completos.csv`, `extracted_geojson.txt` |
| M3 | Archivos `cv_extracted.json` duplicados en `student-hub/` y `admin-hub-frontend/` (33-44KB cada uno) |
| M4 | Sin gestor de workspace (ni npm workspaces, ni Turborepo, ni Nx) |
| M5 | Documentación referencia nombre antiguo del proyecto ("EduVitae" / "Edu Vitae") |

---

## 2. Arquitectura Objetivo (Microservicios)

### 2.1 Visión de la Arquitectura Target

```mermaid
graph TB
    subgraph "API Gateway Layer"
        GW["API Gateway<br/>Nginx / Traefik<br/>Rate Limiting + Auth Forward<br/>SSL Termination"]
    end

    subgraph "Frontend Services"
        SH["student-hub<br/>Astro SSR<br/>Consume solo APIs"]
        AHF["admin-hub<br/>Astro SSR/Static<br/>Consume solo APIs"]
        PH["project-hub<br/>Astro SSR<br/>Placeholder"]
    end

    subgraph "Domain Microservices (APIs REST)"
        AUTH["auth-service<br/>Node.js<br/>JWT + Sessions<br/>Users CRUD"]
        PROF["professors-service<br/>Node.js<br/>Profiles + CRUD<br/>Search + Fuzzy Match"]
        ACAD["academic-service<br/>Node.js<br/>Groups, Schedules<br/>Exams, Syllabus"]
        REF["reference-service<br/>Node.js<br/>Delegations, Careers<br/>Faculties (read-only)"]
        CV["cv-extractor-service<br/>Python FastAPI<br/>PDF → JSON"]
    end

    subgraph "Shared Infrastructure"
        PG["PostgreSQL 15<br/>Con schemas separados"]
        REDIS["Redis<br/>Cache + Sessions<br/>Pub/Sub invalidación"]
        MQ["Message Queue<br/>(Opcional: BullMQ/Redis Streams)<br/>CV Processing Jobs"]
    end

    GW --> SH
    GW --> AHF
    GW --> PH
    GW --> AUTH
    GW --> PROF
    GW --> ACAD
    GW --> REF
    GW --> CV

    SH --> |"HTTP"| AUTH
    SH --> |"HTTP"| PROF
    SH --> |"HTTP"| ACAD
    SH --> |"HTTP"| REF
    AHF --> |"HTTP"| AUTH
    AHF --> |"HTTP"| PROF
    AHF --> |"HTTP"| ACAD
    AHF --> |"HTTP"| REF
    AHF --> |"HTTP"| CV

    AUTH --> PG
    AUTH --> REDIS
    PROF --> PG
    ACAD --> PG
    REF --> PG
    REF --> REDIS
    CV --> MQ
```

### 2.2 Principios de Diseño

1. **Bounded Contexts (DDD)**: Cada microservicio encapsula un dominio de negocio completo y posee sus propias tablas.
2. **API-First**: Los frontends NUNCA acceden a la base de datos directamente. Toda comunicación pasa por APIs REST.
3. **Single Responsibility**: Cada servicio tiene una sola razón para cambiar.
4. **Datos de Referencia Centralizados**: Un único `reference-service` sirve delegaciones, carreras y facultades con cache en Redis.
5. **Comunicación Asíncrona para tareas pesadas**: La extracción de CVs se procesa de forma asíncrona a través de una cola de mensajes.
6. **Independencia de Deploy**: Cada servicio puede ser construido, testeado y desplegado de forma independiente.

### 2.3 Estructura de Directorios Objetivo

```
PICA-UCOL/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + Test + Build en cada PR
│       └── deploy.yml                # Deploy a producción
├── gateway/
│   ├── Dockerfile
│   ├── nginx.conf                    # O traefik.yml
│   └── rate-limit.conf
├── services/
│   ├── auth-service/                 # Microservicio de Autenticación
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.js              # Entry point Express
│   │   │   ├── routes/
│   │   │   │   ├── login.js
│   │   │   │   ├── me.js
│   │   │   │   └── register.js
│   │   │   ├── middleware/
│   │   │   │   └── jwt.js
│   │   │   ├── models/
│   │   │   │   └── user.js
│   │   │   └── config/
│   │   │       └── db.js
│   │   └── tests/
│   │       ├── login.test.js
│   │       └── jwt.test.js
│   ├── professors-service/           # Microservicio de Profesores
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── professors.js
│   │   │   │   └── search.js
│   │   │   ├── services/
│   │   │   │   └── faculty-matcher.js  # Lógica Levenshtein extraída
│   │   │   └── models/
│   │   │       └── professor.js
│   │   └── tests/
│   ├── academic-service/             # Microservicio Académico
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── groups.js
│   │   │   │   ├── schedules.js
│   │   │   │   ├── exams.js
│   │   │   │   └── syllabus.js
│   │   │   └── models/
│   │   └── tests/
│   ├── reference-service/            # Microservicio de Datos Maestros
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── delegations.js
│   │   │   │   ├── careers.js
│   │   │   │   └── faculties.js
│   │   │   └── loaders/
│   │   │       └── yaml-loader.js
│   │   └── data/
│   │       ├── delegations.yaml
│   │       ├── careers.yaml
│   │       └── faculties.yaml
│   ├── cv-extractor-service/         # Microservicio Python
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/
│   │   │   ├── main.py               # FastAPI app
│   │   │   ├── scraper.py            # cv_scraper refactorizado
│   │   │   └── formatter.py          # format_cv refactorizado
│   │   └── tests/
│   ├── student-hub/                  # Frontend Estudiantes (Refactorizado)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── astro.config.mjs
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── schedule/         # Componentes de horario modularizados
│   │   │   │   ├── professors/       # Componentes de profesores
│   │   │   │   ├── auth/             # Componentes de autenticación
│   │   │   │   └── common/           # Componentes compartidos
│   │   │   ├── lib/
│   │   │   │   ├── api-client.js     # Cliente HTTP para consumir microservicios
│   │   │   │   └── session.js
│   │   │   ├── layouts/
│   │   │   ├── pages/
│   │   │   └── styles/
│   │   └── tests/
│   ├── admin-hub/                    # Frontend Admin (Refactorizado)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── astro.config.mjs
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── professors/       # Editor de CV, lista
│   │   │   │   ├── groups/           # CRUD de grupos
│   │   │   │   ├── schedules/        # Editor de horarios
│   │   │   │   ├── exams/            # Editor de exámenes
│   │   │   │   ├── syllabus/         # Editor de planes de estudio
│   │   │   │   └── common/           # Sidebar, Header, Modal
│   │   │   ├── lib/
│   │   │   │   └── api-client.js
│   │   │   ├── pages/
│   │   │   │   ├── index.astro       # Dashboard (compuesto de componentes)
│   │   │   │   ├── login.astro
│   │   │   │   ├── profesores/
│   │   │   │   ├── grupos/
│   │   │   │   ├── horarios/
│   │   │   │   └── examenes/
│   │   │   └── styles/
│   │   └── tests/
│   └── project-hub/                  # Placeholder (sin cambios)
├── packages/                         # Paquetes compartidos del monorepo
│   └── shared-types/                 # TypeScript types / interfaces compartidas
│       ├── package.json
│       └── src/
│           ├── professor.ts
│           ├── group.ts
│           └── schedule.ts
├── scripts/
│   ├── init.sql                      # Solo DDL, sin seeds
│   ├── seed-dev.js                   # Seeds para desarrollo
│   └── seed-fime-data.js
├── docker-compose.yml                # Orquestador completo
├── docker-compose.dev.yml            # Override para desarrollo local
├── package.json                      # Root workspace config
├── turbo.json                        # Turborepo config
├── .env.example                      # Template de variables de entorno
└── README.md
```

---

## 3. Fases de Implementación

> [!IMPORTANT]
> La migración se ejecuta en **5 fases incrementales**. Cada fase es desplegable de forma independiente y no rompe funcionalidad existente. No se avanza a la siguiente fase hasta que la anterior esté validada en producción.

---

### FASE 0: Preparación del Monorepo y Limpieza (Semana 1)

**Objetivo**: Establecer la infraestructura del workspace, limpieza de archivos, y configurar herramientas de desarrollo.

#### Acciones

1. **Inicializar Turborepo como gestor de workspace**
   - Crear `turbo.json` con pipelines de `build`, `dev`, `test` y `lint`
   - Configurar `package.json` raíz con `"workspaces"` apuntando a `services/*` y `packages/*`

2. **Limpieza de archivos sueltos**
   - Mover `scratch.py`, `scratch_remove_filters.py` a `/scripts/legacy/`
   - Mover `horarios_completos (1).csv`, `extracted_geojson.txt` a `/data/legacy/`
   - Eliminar `cv_extracted.json` duplicados de `student-hub/` y `admin-hub-frontend/`

3. **Normalizar nombres de paquetes**
   - `admin-hub-backend/package.json`: Renombrar `"name"` de `"eduvitae-admin-backend"` → `"@pica/admin-hub-backend"`
   - `admin-hub-frontend/package.json`: Renombrar de `"agreeable-apogee"` → `"@pica/admin-hub-frontend"`
   - `student-hub/package.json`: Renombrar de `"pica-student-hub"` → `"@pica/student-hub"`
   - `project-hub/package.json`: Renombrar de `"pica-project-hub"` → `"@pica/project-hub"`

4. **Segurizar variables de entorno**
   - Crear `.env.example` con placeholders sin valores reales
   - Agregar `.env.production` al `.gitignore` (verificar si ya está versionado y limpiar historial de git si es necesario)
   - Crear `JWT_SECRET` y `COOKIE_SECRET` como variables de entorno obligatorias (sin fallback hardcodeado)

5. **Configurar ESLint + Prettier compartidos**
   - Crear configuración raíz de ESLint y Prettier para consistencia de código

6. **Crear paquete `@pica/shared-types`**
   - Definir interfaces TypeScript compartidas para `Professor`, `Group`, `Schedule`, `ExamDate`, `Syllabus`, `AdminUser`
   - Compartido entre todos los servicios vía workspace dependency

#### Verificación
- [ ] `npm install` desde la raíz instala todas las dependencias de todos los servicios
- [ ] `npx turbo run build` compila exitosamente todos los servicios
- [ ] No existen archivos sueltos en la raíz que no pertenezcan a configuración del monorepo

---

### FASE 1: Extracción de Microservicios de Backend (Semanas 2-4)

**Objetivo**: Descomponer el archivo monolítico [server.js](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/admin-hub-backend/server.js) (1052 líneas) en 4 microservicios independientes.

#### 1.1 Crear `auth-service`

**Responsabilidades**: Login, emisión de JWT, validación de tokens, gestión de usuarios admin.

**Endpoints migrados desde `server.js`**:
- `POST /auth/login` (líneas 142-208)
- `GET /auth/me` (líneas 211-233)
- Middleware `jwtAuth` (líneas 56-84)

**Acciones**:
```
1. Crear services/auth-service/
2. Extraer lógica de autenticación de server.js
3. Implementar rutas: POST /login, GET /me, POST /register (nuevo)
4. Exportar middleware JWT como módulo reutilizable
5. Configurar su propio Dockerfile con Node 22 Alpine
6. Tablas que posee: admin_users, students (auth-related columns)
7. Puerto: 6770
```

**Dependencias**: `express`, `pg`, `bcryptjs`, `jsonwebtoken`, `cors`

#### 1.2 Crear `professors-service`

**Responsabilidades**: CRUD de profesores, búsqueda, fuzzy matching de facultades.

**Endpoints migrados desde `server.js`**:
- `GET /api/professors` (líneas 675-703)
- `POST /api/professors` (líneas 401-672) — incluye lógica de fuzzy matching
- `GET /api/professors/me/groups` (líneas 731-754)

**Acciones**:
```
1. Crear services/professors-service/
2. Extraer toda la lógica de profesores
3. Mover lógica de Levenshtein y matching de facultades a services/faculty-matcher.js
4. Eliminar la invocación directa a Python (format_cv.py)
   → En su lugar, llamar al cv-extractor-service vía HTTP
5. Tablas que posee: professors, professor_groups
6. Puerto: 6771
```

**Dependencias**: `express`, `pg`, `cors`, `js-yaml` (temporal hasta que reference-service exista)

#### 1.3 Crear `academic-service`

**Responsabilidades**: CRUD de grupos, horarios, exámenes y planes de estudio.

**Endpoints migrados desde `server.js`**:
- `GET/POST /api/groups` (líneas 706-780)
- `POST /api/groups/tutor` (líneas 1032-1047)
- `GET/POST/DELETE /api/schedules` (líneas 785-888)
- `GET/POST/DELETE /api/exams` (líneas 890-959)
- `GET/POST /api/syllabus` (líneas 961-1029)

**Acciones**:
```
1. Crear services/academic-service/
2. Extraer todos los endpoints académicos
3. Implementar validación de business rules en capa de servicio separada
4. Tablas que posee: class_groups, schedules, exam_dates, subject_syllabus
5. Puerto: 6772
```

#### 1.4 Crear `reference-service`

**Responsabilidades**: Servir datos de referencia inmutables (delegaciones, carreras, facultades) con cache.

**Endpoints migrados**:
- `GET /api/reference/delegations` (líneas 237-247)
- `GET /api/reference/careers` (líneas 249-259)
- `GET /api/reference/faculties` (líneas 261-271)

**Acciones**:
```
1. Crear services/reference-service/
2. Cargar YAMLs al arrancar y cachear en memoria (o Redis si disponible)
3. Exponer endpoints REST read-only
4. Mover los archivos YAML a este servicio: data/reference/ → services/reference-service/data/
5. Puerto: 6773
```

#### 1.5 Crear `cv-extractor-service` (Python)

**Responsabilidades**: Recibir PDFs, extraer datos con pdfplumber, formatear JSON.

**Acciones**:
```
1. Crear services/cv-extractor-service/
2. Implementar como FastAPI (reemplaza el spawn de Python)
3. Endpoint: POST /extract (multipart/form-data con PDF)
4. Endpoint: POST /format (JSON crudo → JSON formateado)
5. Refactorizar cv_scraper.py y format_cv.py como módulos importables
6. Dockerfile independiente basado en python:3.11-slim (sin Node.js)
7. Puerto: 6774
```

> [!TIP]
> **Beneficio inmediato**: El Dockerfile del backend actual instala TANTO Python como Node.js en una imagen de 800MB+. Al separar, cada imagen será < 200MB.

#### 1.6 Validación de JWT Inter-Servicio

Todos los microservicios que requieren autenticación deben poder validar tokens JWT sin depender del `auth-service` en runtime:

```
Estrategia: Shared Secret
- Todos los servicios comparten la misma variable JWT_SECRET
- Cada servicio valida el token localmente con jsonwebtoken.verify()
- Solo auth-service puede EMITIR tokens
- Los demás servicios solo VERIFICAN tokens
```

#### Verificación FASE 1
- [ ] Cada microservicio arranca de forma independiente con `npm start`
- [ ] Cada microservicio tiene su propio `Dockerfile` funcional
- [ ] El `docker-compose.yml` actualizado levanta los 4 microservicios + cv-extractor
- [ ] Las respuestas de API son idénticas a las del backend monolítico original
- [ ] Tests de integración validan todos los endpoints migrados

---

### FASE 2: Refactorización de Frontends (Semanas 4-6)

**Objetivo**: Desacoplar los frontends de la base de datos y modularizar los archivos gigantes.

#### 2.1 Crear `api-client.js` Compartido

Crear un cliente HTTP centralizado para cada frontend que consume los microservicios:

```javascript
// services/student-hub/src/lib/api-client.js
const BASE_URLS = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:6770',
  professors: process.env.PROFESSORS_SERVICE_URL || 'http://professors-service:6771',
  academic: process.env.ACADEMIC_SERVICE_URL || 'http://academic-service:6772',
  reference: process.env.REFERENCE_SERVICE_URL || 'http://reference-service:6773',
};

export async function fetchFromService(service, path, options = {}) {
  const url = `${BASE_URLS[service]}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Service ${service} error: ${response.status}`);
  return response.json();
}
```

#### 2.2 Migrar StudentHUB a API-First

**Estado actual**: StudentHUB tiene conexión directa a PostgreSQL via `pg.Pool` en [db.js](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/lib/db.js) y ejecuta queries SQL directas en [cargarDatos.js](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/lib/cargarDatos.js).

**Acciones**:
```
1. ELIMINAR: src/lib/db.js (conexión pg directa)
2. REESCRIBIR: src/lib/cargarDatos.js → Reemplazar TODAS las queries SQL por 
   llamadas HTTP al api-client.js que consume professors-service, academic-service, reference-service
3. ELIMINAR: dependencia "pg" del package.json de student-hub
4. ACTUALIZAR: Dockerfile para NO pasar DATABASE_URL como ARG ni ENV
5. ELIMINAR: Script generate-static-data.js del build (ya no es necesario,
   los datos se obtienen en runtime via APIs)
6. ELIMINAR: directorio src/content/ con JSONs estáticos pre-generados
```

**Mapeo de funciones actuales → llamadas API**:

| Función actual en `cargarDatos.js` | Microservicio Target | Endpoint |
|---|---|---|
| `cargarDelegaciones()` | reference-service | `GET /delegations` |
| `cargarCarreras()` | reference-service | `GET /careers` |
| `cargarFacultades()` | reference-service | `GET /faculties` |
| `cargarGruposDeCarrera(careerId)` | academic-service | `GET /groups?career_id={id}` |
| `cargarGrupoConProfesores(slug)` | academic-service | `GET /groups/{slug}/details` |
| `cargarHorarioDeGrupo(groupId)` | academic-service | `GET /schedules?group_id={id}` |
| `cargarExamenesDeGrupo(groupId)` | academic-service | `GET /exams?group_id={id}` |
| `cargarSyllabusPorSlug(slug)` | academic-service | `GET /syllabus/{slug}` |
| `cargarSyllabusDeCarrera(careerId)` | academic-service | `GET /syllabus?career_id={id}` |

#### 2.3 Modularizar Admin Frontend

**Estado actual**: [index.astro](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/admin-hub-frontend/src/pages/index.astro) tiene **3768 líneas** con TODO el panel administrativo.

**Acciones**:
```
1. Dividir index.astro en páginas separadas:
   - pages/index.astro        → Dashboard (resumen)
   - pages/profesores/         → Lista y editor de profesores
   - pages/grupos/             → CRUD de grupos
   - pages/horarios/           → Editor visual de horarios
   - pages/examenes/           → Programación de exámenes
   - pages/syllabus/           → Editor de planes de estudio

2. Extraer componentes reutilizables:
   - components/common/Sidebar.astro
   - components/common/Header.astro
   - components/common/Modal.astro
   - components/common/DataTable.astro
   - components/professors/ProfessorCard.astro
   - components/professors/CVEditor.astro
   - components/groups/GroupForm.astro
   - components/schedules/ScheduleGrid.astro
   - components/exams/ExamCalendar.astro
   - components/syllabus/SyllabusForm.astro

3. Cada página/componente no debe exceder 300 líneas
```

#### 2.4 Modularizar Student Frontend

**Estado actual**: [index.astro](file:///Users/miguel/Documents/Projects/PICA-UCOL/services/student-hub/src/pages/index.astro) tiene **41KB**.

**Acciones**:
```
1. Extraer secciones del index.astro en componentes:
   - components/schedule/WeeklyGrid.astro
   - components/schedule/DayView.astro
   - components/schedule/ClassCard.astro
   - components/common/NavigationBar.astro
   - components/common/SearchBar.astro

2. Cada componente debe ser auto-contenido y testeable
```

#### Verificación FASE 2
- [ ] StudentHUB NO tiene dependencia de `pg` en su `package.json`
- [ ] StudentHUB NO tiene ningún archivo que importe `pg` o ejecute queries SQL
- [ ] Ningún archivo `.astro` excede 400 líneas
- [ ] Toda la data se obtiene exclusivamente vía `api-client.js`
- [ ] La experiencia de usuario es idéntica a la anterior

---

### FASE 3: Infraestructura y Observabilidad (Semanas 6-8)

**Objetivo**: Establecer la infraestructura de soporte necesaria para operar microservicios en producción.

#### 3.1 API Gateway Mejorado

Reemplazar o mejorar la configuración de Nginx para actuar como un gateway verdadero:

```nginx
# Nuevas reglas del gateway

# Rate Limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

# Ruteo a microservicios
location /auth/ {
    limit_req zone=auth_limit burst=10 nodelay;
    proxy_pass http://auth-service:6770/;
}

location /api/professors {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://professors-service:6771/professors;
}

location /api/academic {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://academic-service:6772/;
}

location /api/reference {
    limit_req zone=api_limit burst=50 nodelay;
    proxy_pass http://reference-service:6773/;
    proxy_cache reference_cache;
    proxy_cache_valid 200 1h;
}

location /api/cv {
    client_max_body_size 50M;
    proxy_pass http://cv-extractor-service:6774/;
}
```

#### 3.2 Agregar Redis

```yaml
# docker-compose.yml addition
redis:
  image: redis:7-alpine
  container_name: pica-redis
  restart: always
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

**Usos**:
- Cache de datos de referencia (delegaciones, carreras, facultades)
- Almacenamiento de sesiones de estudiantes (reemplazar cookies cifradas)
- Pub/Sub para invalidación de cache entre servicios

#### 3.3 Health Checks

Cada microservicio debe implementar un endpoint `GET /health`:

```javascript
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'professors-service', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});
```

Integrar en `docker-compose.yml`:
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:6771/health"]
  interval: 10s
  timeout: 5s
  retries: 3
```

#### 3.4 Logging Estructurado

Implementar logging JSON consistente en todos los servicios usando `pino`:

```javascript
import pino from 'pino';
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});
```

#### 3.5 Docker Compose de Desarrollo

Crear `docker-compose.dev.yml` con hot-reload para desarrollo local:

```yaml
services:
  auth-service:
    build:
      context: ./services/auth-service
      target: development
    volumes:
      - ./services/auth-service/src:/app/src
    command: node --watch src/index.js
```

#### Verificación FASE 3
- [ ] Todos los servicios reportan `/health` correctamente
- [ ] Rate limiting bloquea solicitudes excesivas (test con `ab` o `wrk`)
- [ ] Redis está activo y cacheando datos de referencia
- [ ] Logs estructurados visibles con `docker compose logs -f`
- [ ] Desarrollo local funciona con hot-reload via `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

---

### FASE 4: Testing y CI/CD (Semanas 8-10)

**Objetivo**: Establecer una suite de testing automatizada y pipeline de CI/CD.

#### 4.1 Testing por Servicio

Cada microservicio debe tener al menos:

| Tipo | Framework | Mínimo por servicio |
|---|---|---|
| Unit Tests | Vitest | 80% cobertura de lógica de negocio |
| Integration Tests | Vitest + Supertest | Cada endpoint con happy path + error cases |
| E2E (Frontends) | Playwright | Flujos críticos: login, ver horario, editar profesor |

**Estructura de tests ejemplo (`auth-service`)**:
```
tests/
├── unit/
│   ├── jwt.test.js          # Generación y validación de tokens
│   └── password.test.js     # Hashing y comparación
├── integration/
│   ├── login.test.js        # POST /login con diferentes escenarios
│   └── me.test.js           # GET /me con token válido/inválido
└── fixtures/
    └── test-users.js        # Datos de prueba
```

#### 4.2 Pipeline de CI (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth-service, professors-service, academic-service, reference-service]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: cd services/${{ matrix.service }} && npm ci
      - run: cd services/${{ matrix.service }} && npm run lint
      - run: cd services/${{ matrix.service }} && npm test

  build:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build
```

#### 4.3 Pipeline de Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push images
        run: |
          docker compose build
          # Push to container registry
      - name: Deploy to server
        run: |
          # SSH deploy or docker stack deploy
```

#### Verificación FASE 4
- [ ] Todos los servicios tienen tests unitarios y de integración
- [ ] CI pipeline pasa en verde en cada PR
- [ ] Coverage reports son generados y publicados
- [ ] Deploy automático a producción funciona con merge a `main`

---

### FASE 5: Optimizaciones y Expansión (Semanas 10-12+)

**Objetivo**: Optimizaciones avanzadas y preparación para nuevos módulos.

#### 5.1 Migrar Datos de Referencia a PostgreSQL

Mover los YAMLs a tablas de base de datos para permitir edición administrativa sin redespliegue:

```sql
CREATE TABLE delegations (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE faculties (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    delegation_id INTEGER REFERENCES delegations(id),
    career_ids INTEGER[],
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE careers (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    delegation_id INTEGER,
    faculty_id INTEGER REFERENCES faculties(id),
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 5.2 Implementar Procesamiento Asíncrono de CVs

Usar BullMQ (Redis-based) para procesar extracciones de CV sin bloquear el request:

```mermaid
sequenceDiagram
    participant Admin as AdminHUB
    participant Prof as professors-service
    participant Queue as BullMQ (Redis)
    participant CV as cv-extractor-service
    participant DB as PostgreSQL

    Admin->>Prof: POST /professors/extract (PDF)
    Prof->>Queue: Encola job {pdfPath, professorSlug}
    Prof-->>Admin: 202 Accepted {jobId}
    Queue->>CV: Procesa PDF
    CV->>DB: Guarda perfil formateado
    CV->>Queue: Job completado
    Admin->>Prof: GET /professors/jobs/{jobId}
    Prof-->>Admin: {status: "completed", data: {...}}
```

#### 5.3 Preparar ProjectHUB

Con la arquitectura de microservicios establecida, ProjectHUB puede desarrollarse como un módulo independiente con su propio backend:

```
services/
├── project-service/          # Nuevo microservicio
│   ├── src/
│   │   ├── routes/
│   │   │   ├── projects.js
│   │   │   ├── publications.js
│   │   │   └── collaborators.js
│   │   └── models/
│   └── Dockerfile
└── project-hub/              # Frontend ya existente
    └── src/
```

#### 5.4 Separación de Esquemas PostgreSQL

Para mayor aislamiento sin múltiples instancias de PostgreSQL:

```sql
CREATE SCHEMA auth;        -- admin_users, students (auth data)
CREATE SCHEMA professors;  -- professors, professor_groups
CREATE SCHEMA academic;    -- class_groups, schedules, exam_dates, subject_syllabus
CREATE SCHEMA reference;   -- delegations, careers, faculties
```

Cada microservicio accede SOLO a su esquema asignado.

---

## 4. Docker Compose Objetivo (Post-Migración)

```yaml
version: '3.8'

services:
  # ── Infrastructure ──
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: pica_db
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  # ── API Gateway ──
  gateway:
    build: ./gateway
    ports:
      - "${GATEWAY_PORT:-80}:80"
    depends_on:
      - auth-service
      - professors-service
      - academic-service
      - reference-service
      - cv-extractor-service
      - student-hub
      - admin-hub

  # ── Domain Microservices ──
  auth-service:
    build: ./services/auth-service
    environment:
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/pica_db
      JWT_SECRET: ${JWT_SECRET}
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy

  professors-service:
    build: ./services/professors-service
    environment:
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/pica_db
      JWT_SECRET: ${JWT_SECRET}
      CV_EXTRACTOR_URL: http://cv-extractor-service:6774
    depends_on:
      postgres:
        condition: service_healthy

  academic-service:
    build: ./services/academic-service
    environment:
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/pica_db
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy

  reference-service:
    build: ./services/reference-service
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  cv-extractor-service:
    build: ./services/cv-extractor-service
    volumes:
      - temp_uploads:/app/temp_uploads

  # ── Frontend Services ──
  student-hub:
    build: ./services/student-hub
    environment:
      AUTH_SERVICE_URL: http://auth-service:6770
      PROFESSORS_SERVICE_URL: http://professors-service:6771
      ACADEMIC_SERVICE_URL: http://academic-service:6772
      REFERENCE_SERVICE_URL: http://reference-service:6773
      COOKIE_SECRET: ${COOKIE_SECRET}

  admin-hub:
    build: ./services/admin-hub

  project-hub:
    build: ./services/project-hub

volumes:
  postgres_data:
  redis_data:
  temp_uploads:
```

---

## 5. Variables de Entorno Requeridas (`.env.example`)

```env
# ── Base de Datos ──
DB_USER=admin
DB_PASSWORD=                    # OBLIGATORIO: Sin valor por defecto
DB_HOST=postgres
DB_PORT=5432
DB_NAME=pica_db

# ── Seguridad ──
JWT_SECRET=                     # OBLIGATORIO: Generar con `openssl rand -hex 32`
COOKIE_SECRET=                  # OBLIGATORIO: Generar con `openssl rand -hex 32`

# ── Gateway ──
GATEWAY_PORT=80

# ── Redis ──
REDIS_URL=redis://redis:6379

# ── Service URLs (solo para frontends) ──
AUTH_SERVICE_URL=http://auth-service:6770
PROFESSORS_SERVICE_URL=http://professors-service:6771
ACADEMIC_SERVICE_URL=http://academic-service:6772
REFERENCE_SERVICE_URL=http://reference-service:6773
CV_EXTRACTOR_URL=http://cv-extractor-service:6774
```

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Latencia por llamadas HTTP inter-servicio | Media | Medio | Cache agresivo en reference-service; conexiones keep-alive; pool de conexiones HTTP |
| Downtime durante migración | Alta | Alto | Migración gradual por fases; mantener backend monolítico funcional como fallback hasta completar Fase 2 |
| Complejidad de debugging distribuido | Media | Medio | Correlation IDs en headers (`X-Request-ID`); logging estructurado con pino |
| Inconsistencia de datos entre servicios | Baja | Alto | Transacciones dentro de cada servicio; eventual consistency aceptable para cache |
| Aumento de costos de infraestructura | Baja | Bajo | Todos los servicios corren en un solo servidor Docker Compose; no requiere Kubernetes |

---

## 7. Criterios de Éxito

> [!IMPORTANT]
> La migración se considera **exitosa** cuando se cumplan TODOS estos criterios:

- [ ] **Zero-downtime**: La plataforma no tuvo interrupciones visibles para usuarios durante la migración
- [ ] **Paridad funcional**: Toda la funcionalidad existente opera idénticamente
- [ ] **Ningún frontend accede a PostgreSQL directamente**: Toda la data fluye a través de APIs REST
- [ ] **Ningún archivo de código excede 400 líneas**: Componentes modularizados
- [ ] **Cada servicio tiene tests automatizados**: Mínimo 80% coverage en lógica de negocio
- [ ] **CI/CD funcional**: Cada push a `main` genera un deploy automático
- [ ] **Secrets no hardcodeados**: Todos los secrets vienen exclusivamente de variables de entorno
- [ ] **Build time < 5 minutos**: Cada servicio se construye en menos de 5 minutos
- [ ] **Nuevo módulo en < 1 día**: Un desarrollador puede crear un nuevo microservicio funcional (scaffold + routes + Docker) en menos de 1 día de trabajo

---

## Open Questions

> [!IMPORTANT]
> Las siguientes preguntas requieren definición antes de ejecutar:

1. **¿Se mantendrá el deploy en un solo servidor con Docker Compose o se planea migrar a Kubernetes/Docker Swarm?** Esto impacta las decisiones de service discovery y networking de la Fase 3.

2. **¿Existe un container registry (Docker Hub, GitHub Container Registry, etc.) donde publicar las imágenes?** Necesario para el pipeline de CI/CD de la Fase 4.

3. **¿Se desea migrar el CSS framework a una versión más reciente de TailwindCSS o cambiar a otro?** Actualmente se usa Tailwind v4 que tiene breaking changes significativos respecto a v3.

4. **¿Cuántos desarrolladores trabajarán simultáneamente en el proyecto?** Esto determina la prioridad de Turborepo y la estrategia de branching.

5. **¿Se quiere mantener el sistema de autenticación de estudiantes actual (cookies cifradas AES-256-CBC) o migrar a un sistema basado en JWT/Redis?**

6. **¿ProjectHUB tiene un alcance funcional definido?** El plan lo incluye como placeholder pero necesita requirements para dimensionar su microservicio backend.
