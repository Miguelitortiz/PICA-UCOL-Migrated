## Limpiar Base de Datos

```bash
node scripts/clear-db.js
```

## Importar Datos

```bash
docker exec -i pica-postgres psql -U admin -d pica_db < scripts/import_horarios.sql

node scripts/generate-sql-from-csv.js
