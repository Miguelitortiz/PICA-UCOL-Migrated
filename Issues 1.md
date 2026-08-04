Aquí tienes una crítica a la propuesta presentada, estructurada estrictamente bajo la perspectiva de un análisis técnico riguroso (revisión de hipótesis, falsación y detección de fallas o supuestos no fundamentados), seguida del desglose de los *issues* corregidos y realistas.

---

## 🔍 Crítica Técnica y Falsación del Análisis Previo

Antes de convertir las recomendaciones en tareas operativas (*issues*), es necesario desarmar varios supuestos débiles e inconsistencias detectadas en la propuesta original:

### 1. Supuestos injustificados sobre UX y comportamiento del usuario

* **Falsa premisa sobre la vista en tarjetas para el horario móvil:** El análisis asume que una vista de lista/tarjeta por día es superior a una tabla con scroll horizontal. **Falla de lógica:** En el contexto académico, los estudiantes no solo consultan "qué tengo hoy", sino que planifican su semana de forma visual (bloques libres entre materias, solapamientos, días con carga pesada). Un *card layout* destruye la visión espacial del tiempo semestral. La solución adecuada no es eliminar la matriz, sino optimizar la densidad de la tabla o permitir un conmutador de vista opcional, no forzado.
* **Sesgo de funcionalidad deseada (Falta de datos de uso):** Afirmar que el usuario entra "principalmente" a ver la clase activa es una inferencia no verificada. Asumir esa intención como la única válida conduce a sobrecargar la interfaz con *widgets* reactivos (relojes en vivo, badges "AHORA") en un sistema con diseño suizo cuya fortaleza es la estaticidad y la baja distracción.

### 2. Inconsistencias técnicas y soluciones incompletas

* **El problema de Leaflet y CDNs:** Argumentar que Leaflet fallará por conexión inestable cargándolo localmente es una verdad a medias. Si el campus no tiene internet, empaquetar los *assets* de JS/CSS localmente permitirá que la librería cargue, pero los *tiles* del mapa (OpenStreetMap o CartoDB) **seguirán fallando** porque se descargan vía red en tiempo real. Servir Leaflet localmente sin una estrategia de almacenamiento en caché (*service workers* / PWA) o vectores locales no resuelve el problema offline.
* **Propuesta de JWT vs. Sesiones:** Proponer JWTs para resolver la manipulación de cookies no es del todo correcto. Si un JWT se almacena en una cookie sin la marca `HttpOnly` y sin firma criptográfica del lado del servidor, sigue siendo vulnerable a lectura e inyección. La solución crítica no es cambiar el formato a JWT, sino **firmar la cookie HTTP-only** o usar una sesión opaca basada en un token en base de datos.

---

## 📋 Backlog de Issues / Tasks

A continuación se presentan las tareas resultantes, filtradas y corregidas tras desestimar las propuestas tildadas de incompletas o injustificadas.

---

### Issue #1: [Security] Cifrado y firma de cookies de sesión (`pica_session`)

* **Tipo:** Vulnerabilidad de Seguridad / Bug Crítico
* **Componente:** `src/pages/student-auth/login.js`, `src/middleware.js`

#### Descripción

Actualmente, las cookies de sesión almacenan el objeto JSON completo del estudiante en texto plano. Un usuario puede modificar el campo `enrollment_id` desde las herramientas de desarrollo del navegador para suplantar la identidad de cualquier otro estudiante sin validación del servidor.

#### Tareas

* [ ] Eliminar el almacenamiento de datos sensibles estructurados en texto plano dentro de la cookie.
* [ ] Implementar firma de cookies utilizando una clave secreta del entorno (`process.env.COOKIE_SECRET`).
* [ ] Configurar los atributos de la cookie con las flags de seguridad: `HttpOnly`, `Secure` y `SameSite=Lax`.
* [ ] Actualizar el middleware (`middleware.js`) para validar la integridad de la firma antes de autorizar el acceso a las rutas protegidas.

---

### Issue #2: [UX / UI] Optimización del Horario Semanal en Dispositivos Móviles

* **Tipo:** Mejora de Usabilidad
* **Componente:** `src/pages/index.astro`

#### Descripción

La tabla de horarios utiliza un contenedor con scroll bidimensional que dificulta la lectura en pantallas con anchos inferiores a 768px. Se requiere mantener la vista matricial (por su valor de planificación visual) pero ofreciendo una alternativa clara para consultas rápidas.

#### Tareas

* [ ] Implementar un selector de vista (Toggle) en la cabecera del módulo: **Vista Matriz** (por defecto en desktop) y **Vista Agendada/Día** (opcional/por defecto en móvil).
* [ ] Ajustar la densidad tipográfica y los paddings de las celdas en CSS para pantallas reducidas.
* [ ] Garantizar que el modal de detalles de la materia mantenga el foco accesible (`aria-modal`) al abrirse desde la vista móvil.

---

### Issue #3: [Feature] Indicador visual de contexto temporal en el Horario

* **Tipo:** Funcionalidad / UX
* **Componente:** `src/pages/index.astro`

#### Descripción

El horario carece de referencias respecto al tiempo actual del usuario, lo que obliga al estudiante a mapear mentalmente el día de la semana y la hora contra la matriz de clases.

#### Tareas

* [ ] Crear un script cliente ligero que obtenga el día y la hora actual (`Date.now()`).
* [ ] Resaltar la columna correspondiente al día en curso.
* [ ] Aplicar una clase CSS de acento (ej. `.is-current-class`) a la celda que coincida con el rango horario actual.
* [ ] Asegurar que el cálculo contemple la zona horaria local del campus.

---

### Issue #4: [Performance / Map] Desacoplamiento de CDNs externas e Búsqueda en Mapa

* **Tipo:** Mejora Técnica / Funcionalidad
* **Componente:** `src/pages/mapa.astro`

#### Descripción

El módulo del mapa consulta librerías desde `unpkg.com`, lo que genera puntos de falla externos. Además, la interacción es meramente exploratoria y carece de un mecanismo directo para localizar espacios específicos.

#### Tareas

* [ ] Instalar la librería Leaflet como dependencia del proyecto e importar sus *assets* estáticos directamente en el *build* de Astro.
* [ ] Añadir un campo de entrada (`<input type="search">`) sobre el visor del mapa.
* [ ] Implementar lógica en JS para filtrar la lista de polígonos/aulas y ejecutar un `map.flyTo()` o `map.fitBounds()` sobre el elemento seleccionado.
* [ ] Documentar que los *tiles* geográficos aún requieren conectividad a la red.

---

### Issue #5: [UX] Accesibilidad y usabilidad en formulario de autenticación

* **Tipo:** Usabilidad / Accesibilidad
* **Componente:** `src/components/LoginPanel.astro`

#### Descripción

El formulario de inicio de sesión no cuenta con utilidades básicas para la reducción de errores de entrada en teclados táctiles.

#### Tareas

* [ ] Añadir un botón conmutable para mostrar/ocultar el texto del campo de contraseña.
* [ ] Asegurar que los campos posean los atributos `autocomplete` correctos (`username` y `current-password`).
* [ ] Validar que los mensajes de error devueltos por `login.js` se anuncien correctamente a lectores de pantalla mediante la propiedad `aria-live="polite"`.