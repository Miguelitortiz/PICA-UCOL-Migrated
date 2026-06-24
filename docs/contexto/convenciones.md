# Convenciones de Código

## Estilo y Formato
- **Formatos:**
  - Código Javascript/Astro: Formateado con Prettier (2 espacios de indentación).
  - Código Python: Formateado según PEP 8 (4 espacios de indentación).
  - Estructuras SQL: Palabras clave en MAYÚSCULAS (`SELECT`, `INSERT`, `CREATE TABLE`, etc.).
- **Naming:**
  - Archivos Javascript (scripts globales): kebab-case (ej. `generate-static-data.js`, `seed-large-dataset.js`).
  - Servidores Express: snake_case o camelCase según corresponda (`server.js`).
  - Archivos Python: snake_case (ej. `format_cv.py`, `cv_scraper.py`).
  - Rutas y archivos Astro: kebab-case (ej. `buscar-profesor.astro`). Slugs dinámicos entre corchetes (ej. `[slug].astro`, `[d_slug]`).
  - Base de datos (Tablas y Columnas): snake_case (ej. `class_groups`, `delegation_id`).
  - Variables y funciones Javascript: camelCase (ej. `basicAuth`, `runPythonScript`).

## Imports
- En la API Express (`server.js`): Se utiliza sintaxis ES Modules (`import ... from ...`).
- En scripts independientes (`scripts/`): Se utiliza CommonJS (`const ... = require(...)`) para permitir su ejecución directa mediante Node.js en tareas automatizadas sin necesidad de un cargador o transpilador ESM complejo.

## Patrones que SÍ usamos
- **Transacciones Manuales SQL:** Para inserciones múltiples o mutaciones que afectan relaciones (ej. guardar un profesor e insertar sus asignaciones de grupo en `professor_groups`), se solicita un cliente de la pool y se envuelven las consultas en bloques `BEGIN`, `COMMIT` y `ROLLBACK`.
- **Tolerancia en Build (Build-Safe Fallback):** Todos los scripts de compilación de datos estáticos deben envolver la conexión de BD en bloques `try/catch` para poder continuar de forma segura con datos simulados o vacíos si la base de datos no está disponible.
- **Normalización de Texto y Distancia Levenshtein:** Para emparejar dinámicamente texto libre de PDFs con catálogos de referencia (YAMLs), se normaliza el string (removiendo acentos/minúsculas) y se utiliza el cálculo de distancia Levenshtein o mapeo de abreviaturas conocidas de facultades (ej. "fime" -> "Facultad de Ingeniería Mecánica y Eléctrica").
- **Purga Selectiva de Caché:** Cada guardado exitoso de perfil invoca una función asíncrona en segundo plano que purga la caché de Nginx enviando una petición HTTP GET con `X-Purge: 1` a las URLs exactas que corresponden al profesor modificado (perfil individual, delegación, carrera y grupos asociados).

## Patrones PROHIBIDOS
- **Credenciales en Código Duro (Hardcoding):** Las credenciales de base de datos o claves de acceso del administrador nunca se guardan directamente en archivos de código. Deben leerse de variables de entorno (`process.env.DATABASE_URL`, `process.env.ADMIN_USER`, etc.) o en su defecto a través de valores fallback configurados en el orquestador Docker Compose.
- **Integridad Referencial Estricta de Base de Datos hacia YAMLs:** No se crean llaves foráneas (`FK`) en PostgreSQL hacia los catálogos estáticos de Delegaciones y Carreras, ya que estas residen únicamente como archivos YAML inmutables. Solo se almacena el ID numérico (`delegation_id`, `career_id`) para hacer el mapeo en memoria durante la compilación o consulta de APIs.
