
**Arquitectura de Información**  
La estructura se organiza en secciones orientadas a la acción diaria del estudiante:

- **Inicio (Home)**: Dashboard ligero con un solo widget :
  - Horario de la semana, además al hacer click sobre una clase en especifico, aparece un modal con información de la clase, docente, foto, aula y link a la materia.

- **Modal de información de la clase**: Al hacer click sobre una clase en el horario, se despliega un modal con:
  - Nombre de la materia
  - Descripción de la materia
  - Nombre del docente (link a perfil del docente)
  - Información de contacto del docente (correo, teléfono, cubículo, horario de atención)
  - Aula y laboratorio asignado (link a mapa de aulas)
  - Fechas de evaluaciones y exámenes
  - Más información (link a la sección de la materia)
- **Materias**: Grid de asignaturas matriculadas, también hará uso de los modales de información de la clase, al dar click,se mostrará una página con los detalles, (solo se mostrarán las materias que cursa el alumno ).
- **Materia detallada**: Página con información completa de la materia, incluyendo:
  
  - Fechas de evaluaciones y exámenes
  - Toda la información del programa de estudio
  - Metodos de evaluación y criterios de calificación
  - Recursos adicionales (archivos, enlaces, etc.)

- **Mapa de aulas y laboratorios**: Vista interactiva del campus con ubicación de aulas y laboratorios, accesible desde el horario y la sección de materias, al seleccionar un aula se mostrará un modal con información de la misma, incluyendo:
  - Nombre del aula/laboratorio
  - Materia con clases ahí (dentro de las asignadas al estudiante)
- **Profesores**: Listado de docentes con información de contacto y materias que imparten, al hacer click sobre un docente se mostrará una página con su perfil (ya elaborada en el antiguo EduVitae)

*Navegación principal*  
- **Móvil**: Barra de pestañas inferior con  accesos directos: Horario, Materias, Profesores, Mapa,Tutor, fechas de evaluación
- **Escritorio**: Barra superior con logo a la izquierda y menú horizontal con  Horario, Materias, Profesores, Mapa,Tutor, fechas de evaluación. El usuario puede acceder a su perfil y cerrar sesión desde un avatar en la esquina superior derecha. 


*Jerarquía de contenidos*  
La tipografía y el espaciado definen tres niveles: encabezado de sección, título de tarjeta/widget y cuerpo de texto. Ningún contenedor usa sombras; la separación se logra mediante bordes sutiles (#E0E0E0) y espaciado vertical de 16–24 px. Las acciones primarias (botones, enlaces) utilizan el color secundario teal y subrayado en texto, asegurando un contraste mínimo de 4.5:1.

---


**Principios UX Priorizados**  
1. Información crítica visible en menos de 3 segundos.  
2. Máximo 2 toques/clics para cualquier funcionalidad nuclear.  
3. Máximo 1 clic para conocer el próximo examen.  
4. Cada pantalla debe tener una sola acción principal evidente.  
5. El texto debe ser legible sin zoom adicional (tamaño base 16 px en móvil).  
6. Estados de carga controlados: skeleton + carga optimista.  
7. Retroalimentación inmediata en acciones destructivas o de envío.  
8. Navegación predecible: el usuario nunca debe preguntarse dónde está.  
9. Consistencia total entre vistas homólogas (listas, fichas, calendarios).  
10. Accesibilidad completa: enfoque de teclado, etiquetas ARIA, área de toque mínima 44x44 px.

---