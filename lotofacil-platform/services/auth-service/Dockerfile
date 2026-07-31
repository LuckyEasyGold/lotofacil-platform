FROM node:20
WORKDIR /app



# Copiar dependências
COPY package*.json ./
RUN npm ci

# Copiar schema do Prisma
COPY prisma ./prisma/

# Gerar cliente Prisma ANTES de copiar todo o código
RUN npx prisma generate

# Copiar resto do código
COPY . .

# Build e execução
RUN npm run build
CMD ["npm", "run", "dev"]