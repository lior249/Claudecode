FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
# Dossier de la base SQLite (monté sur un volume Docker persistant).
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=8080 FICHIER_BASE=/data/paiement.db
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
