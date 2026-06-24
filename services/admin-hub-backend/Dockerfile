FROM python:3.11-slim

# Instalar dependencias del sistema, Node.js v22 y npm
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Python
COPY services/admin-hub-backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Instalar dependencias de Node
COPY services/admin-hub-backend/package*.json ./
RUN npm install --only=production

# Copiar código del backend (incluyendo la carpeta cv_extractor)
COPY services/admin-hub-backend ./

# Copiar directorio de datos de referencia (el backend lee delegaciones y carreras de YAML)
COPY data /app/data

# Crear directorio temporal para subidas
RUN mkdir -p /app/temp_uploads && chmod 777 /app/temp_uploads

EXPOSE 6769
ENV PORT=6769
ENV NODE_ENV=production

CMD ["node", "server.js"]
