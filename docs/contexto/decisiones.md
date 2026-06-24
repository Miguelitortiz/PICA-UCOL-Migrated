# Decisiones Tomadas

## 2026-06-23 · Monorepo Orquestado con Docker Compose
- **Decisión:** Organizar el proyecto como un monorepo con Docker Compose, dividiendo responsabilidades en subproyectos independientes (`admin-backend`, `admin-frontend`, `app-public` y `proxy`).
- **Por qué:** Facilita el desarrollo local unificado con un único comando (`docker-compose up`) y permite aislar los ambientes de ejecución (Node para web y Python para extracción) comunicados a través de una red interna de Docker.
- **Descartado:** Despliegue en servidores separados o una arquitectura monolítica clásica, lo cual aumentaría la complejidad al gestionar dependencias mixtas (Node/Python) y el enrutamiento.
- **Estado:** Vigente.

## 2026-06-23 · Almacenamiento Curricular Híbrido mediante JSONB en PostgreSQL
- **Decisión:** Almacenar los datos maestros de identificación del profesor en columnas SQL tradicionales (`id`, `slug`, `full_name`, `email`, `delegation_id`) pero almacenar todo el contenido estructurado de su CV (grados, producción científica, docencia, certificaciones) en una columna JSONB única llamada `profile_data`.
- **Por qué:** Un currículum académico tiene una estructura compleja y altamente jerárquica. Normalizar esto en múltiples tablas SQL (una tabla para artículos, otra para libros, otra para grados, etc.) generaría más de 10 uniones en consultas habituales y complicaría drásticamente los scripts de guardado y mapeo del parseador. JSONB permite flexibilidad sin perder rendimiento ni la capacidad de realizar consultas indexadas sobre propiedades internas de los perfiles.
- **Descartado:** Base de datos relacional 100% normalizada (complejidad extrema de mantenimiento) o base de datos NoSQL pura como MongoDB (se prefiere PostgreSQL para mantener la integridad de grupos escolares y asignaciones de materias).
- **Estado:** Vigente.

## 2026-06-23 · Vitrina Pública Estática (SSG) con Inyección de Datos en Compilación
- **Decisión:** Compilar la vitrina pública (`app-public`) de forma 100% estática utilizando Astro (SSG). Durante el build, el script `generate-static-data.js` extrae los datos de la base de datos y los persiste como archivos JSON locales en `src/content/`.
- **Por qué:** Garantiza un rendimiento de carga óptimo (cero latencia de base de datos), alta disponibilidad, seguridad (la vitrina pública no interactúa con la BD en tiempo de ejecución) y una excelente indexación SEO para Google.
- **Descartado:** Renderizado en el Servidor (SSR) para el portal público, que expondría la base de datos a consultas constantes y ralentizaría la velocidad de respuesta.
- **Estado:** Vigente.

## 2026-06-23 · Proxy Nginx con Caché en Disco y Purgado mediante X-Purge
- **Decisión:** Utilizar un contenedor Nginx Proxy que cachea las respuestas de la vitrina pública por defecto durante 60 minutos, pero permite un bypass y purgado instantáneo ante cambios a través de cabeceras HTTP `X-Purge`.
- **Por qué:** Permite que los cambios realizados en el panel administrativo se vean reflejados en tiempo real en la vitrina pública sin necesidad de esperar a que la caché expire, y sin tener que recompilar toda la imagen de Docker de Astro.
- **Descartado:** Invalidación de caché basada puramente en tiempo (TTL largo sin posibilidad de purga manual) o no usar caché (carga pesada en el servidor público).
- **Estado:** Vigente.

## 2026-06-23 · Catálogos de Referencia en YAML e Integración Débil
- **Decisión:** Guardar la estructura corporativa de la universidad (Delegaciones, Carreras, Facultades) en archivos estáticos YAML en `data/reference/` en lugar de tablas con llaves foráneas rígidas en la base de datos.
- **Por qué:** La estructura organizacional de la Universidad de Colima es muy estable y no requiere edición dinámica desde la interfaz. Mantenerla en YAML simplifica las consultas y permite que tanto el backend Express como el generador estático carguen estos catálogos directamente en memoria sin impactar la base de datos.
- **Descartado:** Tablas relacionales estrictas para Delegaciones/Carreras/Facultades con restricciones de llave foránea (`FOREIGN KEY`), lo cual aumentaría los pasos de inicialización de la BD y la complejidad de las migraciones.
- **Estado:** Vigente.
