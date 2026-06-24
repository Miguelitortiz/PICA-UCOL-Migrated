# Guía de Gestión de Registros de Prueba (EduVitae)

Esta guía explica cómo ejecutar de manera rápida los scripts de inserción de registros de prueba (tanto estáticos vía SQL como dinámicos vía Node.js) y cómo realizar la limpieza total de los datos.

---

## 1. Insertar Registros de Prueba Estáticos (SQL)

Para poblar las tablas con unos pocos registros de prueba predefinidos, ejecuta el siguiente comando en tu terminal (desde la raíz del proyecto):

```bash
docker exec -i eduvitae-postgres psql -U admin -d eduvitae < scripts/insert-test-data.sql
```

---

## 2. Generar Registros de Prueba Dinámicos e Ilimitados (JS)

Si deseas generar una cantidad personalizada de profesores y grupos de forma masiva con datos aleatorios (nombres, grados, artículos científicos, materias y asignaciones), puedes usar el script de Node.js.

### Opción A: Ejecutar localmente (desde tu máquina)
El script leerá las variables de tu archivo `.env` o usará la base de datos local por defecto:

```bash
# Sintaxis: node scripts/seed-large-dataset.js [cantidad_de_profesores]
node scripts/seed-large-dataset.js 150
```
*(Reemplaza `150` por la cantidad de profesores que quieras generar. Si no pasas ningún número, por defecto creará `100` profesores)*.

### Opción B: Ejecutar dentro del contenedor de Node (Docker)
Si no tienes Node.js instalado en tu máquina host, puedes ejecutarlo directamente dentro del contenedor del backend:

```bash
docker exec -it eduvitae-admin-backend node scripts/seed-large-dataset.js 150
```

---

## 3. Limpiar Base de Datos (Limpieza Total)

Si deseas borrar por completo todos los registros de profesores, grupos y asignaciones de materias para dejar la base de datos limpia de nuevo, ejecuta:

```bash
docker exec -i eduvitae-postgres psql -U admin -d eduvitae < scripts/clean-db.sql
```

*Este comando realiza un `TRUNCATE CASCADE` de las tablas implicadas, asegurando que se eliminen todas las dependencias y la base de datos quede totalmente vacía y lista para nuevas pruebas o extracciones.*

---

## 4. Opcional: Entrar de forma Interactiva a PostgreSQL

Si deseas entrar a la consola interactiva (`psql`) del contenedor para ejecutar consultas directamente, usa:

```bash
docker exec -it eduvitae-postgres psql -U admin -d eduvitae
```
