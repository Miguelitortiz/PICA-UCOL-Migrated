# Flujo de Trabajo

## Antes de tocar nada
1. **Revisar Decisiones:** Familiarizarse con el esquema de base de datos (`scripts/init.sql`) y las decisiones de arquitectura (el uso de JSONB y SSG).
2. **Revisar Configuración de Entorno:** Verificar la existencia de las variables correctas en el archivo `.env.production` o entorno local.

## Para hacer un cambio
1. **Levantar Entorno Local:** Iniciar todo el ecosistema usando Docker Compose:
   ```bash
   docker-compose up -d --build
   ```
2. **Desarrollo Desacoplado:**
   - Si trabajas en el parseador o la API: Modifica los archivos en `services/admin-backend/` o `services/admin-backend/cv_extractor/`. Puedes depurar localmente o reiniciando el contenedor backend (`docker-compose restart admin-backend`).
   - Si trabajas en el portal público o de administración: Modifica el código Astro correspondiente en `services/app-public/` o `services/admin-frontend/`.
3. **Poblar Datos de Prueba:** Utiliza la guía en `gestion-pruebas.md` para inyectar datos de prueba masivos o limpiezas rápidas:
   ```bash
   # Insertar datos estáticos SQL
   docker exec -i eduvitae-postgres psql -U admin -d eduvitae < scripts/insert-test-data.sql
   
   # Generar 150 perfiles dinámicos aleatorios para pruebas de rendimiento
   docker exec -it eduvitae-admin-backend node scripts/seed-large-dataset.js 150
   ```

## Antes de dar algo por terminado
- [ ] **Validación de Compilación (Build):** Asegúrate de que el contenedor de la vitrina pública compila correctamente sin errores de TypeScript o rutas rotas:
  ```bash
  docker-compose exec app-public npm run build
  ```
- [ ] **Validación de Fallback (Build-Safe):** Verifica que al compilar `app-public` sin conexión a la base de datos (por ejemplo, simulando deteniendo el servicio postgres), el script de generación no aborte el proceso del build de Docker.
- [ ] **Limpieza de Código:** No dejar `console.log` o `print` de depuración en rutas de producción o parseadores repetitivos para evitar saturación de logs en Docker.
- [ ] **Verificación de Limpieza DB:** Correr el script `scripts/clean-db.sql` y asegurar que no hay errores de integridad referencial.

## Deploy / Publicación
Para publicar cambios en producción:
1. Asegura que las credenciales finales de base de datos y administración estén definidas en tu entorno o en el archivo `.env.production`.
2. Compila y levanta el entorno recreando los contenedores:
   ```bash
   docker-compose up -d --build
   ```
3. Verifica el estado de los servicios accediendo a la Vitrina Pública en `http://localhost/` y al Panel Administrativo en `http://localhost/admin`.
