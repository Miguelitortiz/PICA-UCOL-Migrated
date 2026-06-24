# Errores Conocidos y Limitaciones

## 1. Discrepancia entre Documentación de Vitrina Estática (SSG) y Ejecución en Servidor (SSR)
- **Descripción:** El `README.md` describe la vitrina pública (`app-public`) como una aplicación "100% estática (SSG)" y el script `generate-static-data.js` sigue ejecutándose durante el proceso de build en Docker para inyectar JSONs estáticos en `src/content/`. Sin embargo, la configuración real de Astro en `astro.config.mjs` utiliza `output: 'server'` (modo Standalone con Node.js), y las funciones en `cargarProfesores.js` realizan consultas directas a PostgreSQL en tiempo de ejecución (runtime).
- **Impacto:** Los JSONs generados en `src/content/` no se usan en producción; las consultas se hacen directamente a la base de datos a través del pool de conexiones. Si la base de datos falla en runtime, la vitrina mostrará errores o redirigirá a 404, en lugar de servir el contenido estático de respaldo.
- **Solución/Workaround:** La caché del proxy Nginx (`proxy_cache` con TTL de 60m) mitiga esto actuando como una capa de persistencia estática frente al usuario.

## 2. El Fallback de Conexión en Compilación no Carga las Semillas
- **Descripción:** El script `generate-static-data.js` está diseñado para tolerar fallas de conexión a PostgreSQL durante el build de la imagen Docker. No obstante, en la captura del error (`catch`), el script inicializa los arreglos de profesores y grupos como vacíos (`professors = []; groups = [];`) en lugar de leer y cargar los perfiles desde la carpeta local de respaldo `data/reference/seed_professors/` (contrario a lo que describe el `README.md`).
- **Impacto:** La compilación de Docker nunca fallará por problemas de red, pero las compilaciones aisladas generarán JSONs vacíos en la imagen (aunque en runtime esto se subsana porque Astro consulta directamente a PostgreSQL).

## 3. Sensibilidad del Extractor a Cambios de Geometría en el PDF
- **Descripción:** El parser de Python `cv_scraper.py` utiliza una coordenada constante de división horizontal (`COL_SPLIT = 285`) para separar las etiquetas de la columna izquierda de los valores de la derecha en los PDFs de currículums de la Universidad de Colima.
- **Impacto:** Si la universidad realiza modificaciones en los márgenes de su sistema generador de CVs o en el diseño de plantilla del PDF, el parser puede comenzar a mezclar etiquetas con valores o ignorar secciones completas de forma silenciosa.
- **Solución/Workaround:** Se debe verificar visualmente el JSON resultante en el editor administrativo tras procesar archivos que utilicen plantillas de años distintos al estándar CV2026.

## 4. Fallas Silenciosas de Purga de Caché en Entornos de Desarrollo Local
- **Descripción:** La función `purgeCache` en el backend Express intenta realizar peticiones `fetch` a `http://proxy/` para limpiar la caché de Nginx de forma selectiva. Cuando el backend se ejecuta localmente fuera de los contenedores de Docker (por ejemplo, con `node server.js` en el host), el host `proxy` no puede resolverse.
- **Impacto:** El backend imprimirá una advertencia silenciosa en los logs (`Fallo al purgar http://proxy/...: getaddrinfo ENOTFOUND proxy`), y la caché no se invalidará automáticamente en el navegador a menos que se acceda directamente sin proxy o se reinicie el contenedor.
- **Solución/Workaround:** Se recomienda probar el flujo completo de edición y purga dentro de la red de contenedores orquestada por Docker Compose.
