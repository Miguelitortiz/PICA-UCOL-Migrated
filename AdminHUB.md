### AdminHUB
El AdminHUB es un servicio enfocado a la sección docente y administrativa de la institución, este servicio se divide en dos partes, la primera es para los docentes y la segunda para el personal administrativo que tendrá tres niveles de acceso 

#### Docentes
Al servicio docente, al iniciar sesión se le mostrará un panel con todos los grupos a su cargo y tendrá oportunidad de realizar las siguientes acciones:

- Carga y modificación de curriculum profesional académico
- Carga de plan de estudios de cada materia (incluye criterios de evaluación y programas de estudio)
- Asignación de laboratorios por materia que imparte y dia de la semana

#### Administrativos
Todos los niveles de acceso administrativo tendrán la capacidad de realizar las siguientes acciones además de las que cuentan los docentes:

- Cargar y modificar los horarios de clases por grupo y materia
- Asignar docentes como tutores de cada grupo
- Asignar Profesores a cada materia y grupo
- Asignar Fechas de evaluaciones y exámenes por materia y grupo

> Todas las acciones administrativas anteriores serán posteriormente automatizadas, similar al sistema de carga de CV, pero actualmente es necesario solo considerarlo en la arquitectura del sistema.

Los niveles de acceso administrativo son:
- **Jefe de Carrera** solo tendrá acceso a los grupos de su carrera y podrá realizar todas las acciones administrativas. 
- **Coordinador de Facultad** tendrá acceso a todos los grupos de la facultad y podrá realizar todas las acciones administrativas.
- **Administrador de Dirección** tendrá acceso a todos los grupos de varias facultades y podrá realizar todas las acciones administrativas.
- **Administrador General** tendrá acceso a todos los grupos de la institución y podrá realizar todas las acciones administrativas.
