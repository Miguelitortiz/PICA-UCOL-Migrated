# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copiar package definitions del subproyecto
COPY services/student-hub/package*.json ./services/student-hub/

# Instalar dependencias en el subproyecto
RUN cd services/student-hub && npm install --legacy-peer-deps

# Copiar el resto del código fuente del monorepo
COPY data ./data
COPY scripts ./scripts
COPY services/student-hub ./services/student-hub



# Compilar la aplicación estática Astro
RUN cd services/student-hub && npm run build

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

# Copiar package.json del subproyecto
COPY services/student-hub/package*.json ./services/student-hub/

# Instalar dependencias de producción
RUN cd services/student-hub && npm install --omit=dev --legacy-peer-deps

# Copiar el output compilado y los datos de referencia
COPY --from=build /app/services/student-hub/dist ./services/student-hub/dist
COPY --from=build /app/data ./data

# Exponer el puerto del servidor Astro
EXPOSE 80

# Definir variables de entorno de red y ejecutar el servidor standalone
ENV HOST=0.0.0.0
ENV PORT=80
CMD ["node", "services/student-hub/dist/server/entry.mjs"]
