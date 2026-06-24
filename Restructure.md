# Reestructuración del proyecto Edu Vitae
El proyecto de Edu Vitae tendrá una renovación completa de su funcionamiento, ahora constará de 3 servicios:

- StudentHUB
- AdminHUB
- ProjectHUB

La visión del nuevo proyecto será el tener el docente como centro de la educación, en este caso está siendo usado para dos servicios distintos

### StudentHUB
El StudentHUB es una propuesta de servicio para los estudiantes, está enfocado en poder consultar de manera *rápida y sencilla* toda la información que el estudiante necesita sobre lo referente a las materias que están cursando, la informacion que se podrá consultar será:

- Mapa de aulas y laboratorios
- Horarios de clases
- Información sobre los docentes
- Información sobre las materias
- fechas de evaluaciones y exámenes
- Programas de estudio de cada materia
- Tutor de el grupo al que pertecene el estudiante

### AdminHUB
El AdminHUB es un servicio enfocado a la sección docente y administrativa de la institución, este servicio se divide en dos partes, la primera es para los docentes y la segunda para el personal administrativo que tendrá tres niveles de acceso 

#### Docentes
Al servicio docente, al iniciar sesión se le mostrará un paner con todos los grupos a su cargo y tendrá oportunidad de realizar las siguientes acciones:

- Carga y modificación de curriculum profesional académico
- Carga de plan de estudios de cada materia (incluye criterios de evaluación y programas de estudio)
- Asignación de laboratorios por materia  y dia de la semana

#### Administrativos
Todos los niveles de acceso administrativo tendrán la capacidad de realizar las siguientes acciones además de las que cuentan los docentes:

- Cargar y modificar los horarios de clases por grupo y materia
- Asignar docentes como tutores de cada grupo
- Asignar Profesores a cada materia y grupo
- Asignar Fechas de evaluaciones y exámenes por materia y grupo

Los niveles de acceso administrativo son:
- **Jefe de Carrera** solo tendrá acceso a los grupos de su carrera y podrá realizar todas las acciones administrativas. 
- **Coordinador de Facultad** tendrá acceso a todos los grupos de la facultad y podrá realizar todas las acciones administrativas.
- **Administrador de Dirección** tendrá acceso a todos los grupos de varias facultades y podrá realizar todas las acciones administrativas.
- **Administrador General** tendrá acceso a todos los grupos de la institución y podrá realizar todas las acciones administrativas.

### ProjectHUB
Es el proyecto en recién desarrollo y solo se le debe de considerar en la arquitectura, pero actualmente sin implementación 