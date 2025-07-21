FROM node:21-slim

# Installer ffmpeg et nettoyer les caches
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Créer le dossier de travail
WORKDIR /home/app

# Copier les fichiers package.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers de l’application
COPY . .

# Générer les fichiers Prisma
RUN npx prisma generate

# Exposer le port de l'application
EXPOSE 4000

# Lancer l’application
CMD ["npm", "run", "start:dev"]
