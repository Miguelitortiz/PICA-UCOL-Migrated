# Guía de Siembra de Datos (Data Seeding)

Este documento detalla los pasos exactos y seguros requeridos para realizar la siembra de datos en los entornos locales y de producción, resolviendo posibles problemas de permisos.

## Requisitos Previos

### Dependencias del proyecto raíz
El script de siembra requiere que las dependencias del proyecto estén instaladas:
```bash
npm install
```
Esto incluye el paquete `xlsx`, necesario para leer el Excel de tutores y aulas.

### Archivo de tutores y aulas
El archivo `info para horarios.xlsx` debe estar en la **raíz del proyecto**. Contiene:
- **Hoja 1 (`tutores_aulas_matutino`)**: tutor asignado y aula fija por grupo del turno matutino.
- **Hoja 2 (`aulas vespertino`)**: aulas por día de la semana para grupos con aula variable (turno vespertino).

El paso 10 del seed lo lee automáticamente y actualiza `class_groups` con:
- `tutor_id` — enlazado al profesor por coincidencia de nombre (fuzzy match)
- `classroom` — aula fija (matutino)
- `classrooms_by_day` — JSON con aula por día `{Lunes: "A1", Martes: "P3", ...}` (vespertino)

---

## Requisitos Previos (Producción)

Si estás actualizando la base de datos de producción, asegúrate de acceder por SSH y posicionarte en la raíz del proyecto:
```bash
ssh ici@148.213.103.157
cd PICA-UCOL-Migrated
git pull origin main
npm install
```

---

## Pasos para la Siembra de Datos (Método Recomendado)

### 1. Ejecutar la Limpieza y Siembra Directa
Este script limpia todas las tablas de forma segura y carga el catálogo completo de profesores, clases, asignaturas y horarios directamente desde la carpeta `db_horarios/`. Al final, también lee el Excel de tutores y aulas:
```bash
node scripts/seed-from-csvs.js
```

El script ejecuta los siguientes pasos en orden:
1. Limpieza de todas las tablas
2. Inserción de profesores (`db_horarios/profesores.csv`)
3. Inserción de grupos/clases (`db_horarios/clases.csv`)
4. Inserción de asignaturas y syllabus (`db_horarios/asignaturas.csv`)
5. Carga de lecciones (`db_horarios/lecciones.csv`)
6. Carga de horarios detallados (`db_horarios/horarios_detalle.csv`)
7. Creación de estudiante de prueba
8. Creación de usuarios AdminHUB
9. (vacío)
10. **Asignación de tutores y aulas** → lee `info para horarios.xlsx` y actualiza `class_groups`

> **Nota:** Si el archivo `info para horarios.xlsx` no existe o el paquete `xlsx` no está instalado, el paso 10 se omite con una advertencia y el resto del seed continúa normalmente.

---

## Método Alternativo (Generación e Importación de SQL)

Si por alguna razón necesitas generar un archivo SQL estático e importarlo manualmente:

### 1. Limpiar la Base de Datos
```bash
node scripts/clear-db.js
```

### 2. Generar el Archivo SQL desde el CSV
Procesa los archivos CSV de horarios y regenera el script `import_horarios.sql` que contiene las sentencias `INSERT`.
```bash
node scripts/generate-sql-from-csv.js
```

### 3. Importar los Datos a PostgreSQL vía Node
```bash
node -e "
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://admin:admin_pass@localhost:5432/pica_db' });
const sql = fs.readFileSync('scripts/import_horarios.sql', 'utf8');

pool.query(sql)
  .then(() => { 
    console.log('✅ Importación SQL exitosa'); 
    process.exit(0); 
  })
  .catch(e => { 
    console.error('❌ Error en la importación SQL:', e); 
    process.exit(1); 
  });
"
```

> **Nota:** Alternativamente, si tienes permisos de Docker directos o acceso de superusuario pleno, puedes realizar la importación así:
> `docker exec -i pica-postgres psql -U admin -d pica_db < scripts/import_horarios.sql`

### 4. Asignar Tutores y Aulas (si se usó el método alternativo)
Después de importar el SQL, ejecuta el script de actualización de tutores y aulas por separado:
```bash
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://admin:admin_pass@localhost:5432/pica_db' });
// El paso seedTutoresAulas está integrado en seed-from-csvs.js.
// Para ejecutarlo de forma aislada, corre el script principal que ya incluye este paso.
console.log('Usa node scripts/seed-from-csvs.js para incluir este paso automáticamente.');
pool.end();
"
```
