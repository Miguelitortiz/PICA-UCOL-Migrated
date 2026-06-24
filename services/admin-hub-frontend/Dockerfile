# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copiar package definitions del subproyecto
COPY services/admin-hub-frontend/package*.json ./services/admin-hub-frontend/

# Instalar dependencias
RUN cd services/admin-hub-frontend && npm install

# Copiar código fuente
COPY services/admin-hub-frontend ./services/admin-hub-frontend

# Compilar Astro
RUN cd services/admin-hub-frontend && npm run build

# Stage 2: Runtime
FROM nginx:alpine
# Copiar al subpath /admin para mapear la ruta del proxy
COPY --from=build /app/services/admin-hub-frontend/dist /usr/share/nginx/html/admin
COPY services/admin-hub-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
