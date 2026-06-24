# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copiar package definitions del subproyecto
COPY services/project-hub/package*.json ./services/project-hub/

# Instalar dependencias
RUN cd services/project-hub && npm install

# Copiar código fuente
COPY services/project-hub ./services/project-hub

# Compilar Astro
RUN cd services/project-hub && npm run build

# Stage 2: Runtime
FROM nginx:alpine
# Copiar al subpath /project para mapear la ruta del proxy
COPY --from=build /app/services/project-hub/dist /usr/share/nginx/html/project
COPY services/project-hub/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
