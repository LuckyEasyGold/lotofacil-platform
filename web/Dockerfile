FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema necessárias
RUN apk add --no-cache curl

# Copiar dependências primeiro (melhor cache de camadas Docker)
COPY package*.json ./
RUN npm install --only=production

# Copiar código da aplicação
COPY . .

# Diretório do banco de dados local (criar se não existir)
RUN mkdir -p /app/database

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Iniciar servidor
CMD ["node", "server.js"]
