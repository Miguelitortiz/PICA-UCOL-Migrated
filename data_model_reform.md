# Reforma al Modelo de Datos (PostgreSQL)

Con el fin de aumentar la mantenibilidad del sistema y cumplir con las reglas de negocio especificadas para la transición de semestres y los niveles de acceso de usuarios administrativos, se proponen las siguientes reformas al esquema de base de datos.

---

## 1. Mantenibilidad en la Transición de Semestres (`class_groups`)

### Problema
Anteriormente, los grupos tenían nombres como `"4° B"` y slugs como `"4-b-191"` de forma estática en las columnas `name` y `slug`. Al cambiar de ciclo escolar, renombrar y actualizar manualmente los slugs de decenas de grupos era una tarea propensa a errores que comprometía la integridad referencial (por ejemplo, en `professor_groups`, `schedules` y `exam_dates`).

### Solución
Dividir el grado (semestre) y la letra identificadora en columnas separadas dentro de la tabla `class_groups`:
- **`semester`** (`INTEGER`): Almacena el número del semestre en curso (1, 2, 3, etc.).
- **`group_letter`** (`VARCHAR(10)`): Almacena el identificador del grupo ('A', 'B', 'C', etc.).

### SQL DDL
```sql
ALTER TABLE class_groups ADD COLUMN IF NOT EXISTS semester INTEGER;
ALTER TABLE class_groups ADD COLUMN IF NOT EXISTS group_letter VARCHAR(10);
```

### Proceso de Transición Automatizado
Cuando finaliza un semestre, promover todos los grupos al siguiente semestre es tan simple como ejecutar la siguiente consulta:

```sql
-- Incrementar el semestre, regenerar el nombre dinámico y reconstruir el slug
UPDATE class_groups 
SET 
  semester = semester + 1,
  name = (semester + 1) || '° ' || group_letter,
  slug = (semester + 1) || '-' || LOWER(group_letter) || '-' || career_id
WHERE semester < 10; -- Suponiendo una duración máxima de 10 semestres
```

Esta estructura elimina la necesidad de migrar registros individuales y mantiene todos los IDs de grupo (y por ende sus relaciones de llave foránea en horarios y exámenes) completamente intactos.

---

## 2. Soporte Multiacceso para Administrador de Dirección (`admin_users`)

### Problema
La tabla `admin_users` originalmente define una columna `faculty_id INTEGER` única para el rol `coordinador_facultad`. Sin embargo, el rol de **Administrador de Dirección** requiere tener acceso a los grupos de *varias* facultades (por ejemplo, FIME y Telemática concurrentemente).

### Solución
Reemplazar o complementar la columna `faculty_id` con una columna que admita múltiples IDs de facultad:
- **`faculty_ids`** (`INTEGER[]`): Un arreglo de enteros que almacena los IDs de las facultades bajo la dirección de este usuario.

### SQL DDL
```sql
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS faculty_ids INTEGER[];
```

### Lógica de Validación de Alcance (Scoping) en la API
Cuando el backend reciba una petición para listar o modificar información, la validación del scope para el rol `admin_direccion` se realizaría de la siguiente manera en `server.js`:

```javascript
// Si es Administrador de Dirección, verificar si el grupo consultado pertenece a sus facultades
if (req.user.role === 'admin_direccion') {
  // Ej: SELECT cg.* FROM class_groups cg 
  //     JOIN faculties f ON cg.career_id = ANY(f.career_ids)
  //     WHERE f.id = ANY($1) -- $1 es el arreglo req.user.faculty_ids
}
```

---

## 3. Resumen de DDL de Tablas Afectadas

A continuación se muestra el DDL actualizado para las dos tablas involucradas:

```sql
CREATE TABLE class_groups (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    career_id INTEGER, -- Referencia al ID del YAML (sin FK)
    name VARCHAR(50) NOT NULL,
    academic_period VARCHAR(50),
    shift VARCHAR(50),
    tutor_id INTEGER REFERENCES professors(id) ON DELETE SET NULL,
    semester INTEGER, -- [NUEVO]
    group_letter VARCHAR(10), -- [NUEVO]
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role admin_role NOT NULL DEFAULT 'docente',
    professor_id INTEGER REFERENCES professors(id) ON DELETE SET NULL,
    career_id INTEGER,       
    faculty_id INTEGER,      
    faculty_ids INTEGER[], -- [NUEVO]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```
