# PICA-UCOL Migration Tasks

## FASE 0: Preparación del Monorepo y Limpieza
- [ ] Inicializar workspace con npm workspaces en root package.json
- [ ] Configurar Turborepo (turbo.json)
- [ ] Limpiar archivos sueltos en raíz (mover a scripts/legacy y data/legacy)
- [ ] Eliminar cv_extracted.json duplicados
- [ ] Normalizar nombres de paquetes (@pica/ scope)
- [ ] Securizar variables de entorno (.env.example, eliminar fallbacks hardcodeados)
- [ ] Agregar .env.production al .gitignore si no está
- [ ] Crear paquete @pica/shared-types
- [ ] Configurar ESLint + Prettier compartidos

## FASE 1: Extracción de Microservicios de Backend
- [ ] Crear auth-service (login, JWT, users)
- [ ] Crear professors-service (CRUD profesores, fuzzy match)
- [ ] Crear academic-service (groups, schedules, exams, syllabus)
- [ ] Crear reference-service (delegations, careers, faculties)
- [ ] Crear cv-extractor-service (Python FastAPI)
- [ ] Actualizar docker-compose.yml con nuevos servicios
- [ ] Validar paridad funcional con backend monolítico

## FASE 2: Refactorización de Frontends
- [ ] Crear api-client.js compartido para frontends
- [ ] Migrar StudentHUB a API-First (eliminar pg directo)
- [ ] Modularizar Admin Frontend (dividir index.astro de 3768 líneas)
- [ ] Modularizar Student Frontend (dividir index.astro de 41KB)
- [ ] Actualizar Dockerfiles de frontends

## FASE 3: Infraestructura y Observabilidad
- [ ] Mejorar API Gateway (rate limiting, health forwarding)
- [ ] Agregar Redis al stack
- [ ] Implementar health checks en todos los servicios
- [ ] Logging estructurado con pino
- [ ] Docker Compose de desarrollo (hot-reload)

## FASE 4: Testing y CI/CD
- [ ] Tests unitarios por microservicio
- [ ] Tests de integración por microservicio
- [ ] Pipeline CI (GitHub Actions)
- [ ] Pipeline Deploy

## FASE 5: Optimizaciones y Expansión
- [ ] Migrar datos de referencia a PostgreSQL
- [ ] Procesamiento asíncrono de CVs (BullMQ)
- [ ] Preparar ProjectHUB
- [ ] Separación de schemas PostgreSQL
