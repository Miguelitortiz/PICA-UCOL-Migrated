# Guía de Siembra de Datos (Data Seeding)

Este documento detalla los pasos exactos y seguros requeridos para realizar la siembra de datos en los entornos locales y de producción, resolviendo posibles problemas de permisos.

## Requisitos Previos (Producción)

Si estás actualizando la base de datos de producción, asegúrate de acceder por SSH y posicionarte en la raíz del proyecto:
```bash
ssh ici@148.213.103.157
cd PICA-UCOL-Migrated
git pull origin main
```

---

## Pasos para la Siembra de Datos (Método Recomendado)

### 1. Ejecutar la Limpieza y Siembra Directa
Este script limpia todas las tablas de forma segura y carga el catálogo completo de profesores, clases, asignaturas y horarios directamente desde la carpeta `db_horarios/`:
```bash
node scripts/seed-from-csvs.js
```

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
