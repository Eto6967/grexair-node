# 1. Alap kép: egy stabil Node.js környezet
FROM node:18

# 2. Munkakönyvtár létrehozása a konténeren belül
WORKDIR /app

# 3. A függőségek listájának másolása (így gyorsabb a build)
COPY package*.json ./

# 4. Függőségek telepítése
RUN npm install

# 5. A teljes forráskód (server.js, views, public stb.) másolása
COPY . .

# 6. Jelzzük, hogy az app az 5000-es porton várja a forgalmat
EXPOSE 5000

# 7. Az alkalmazás indítása
CMD ["node", "server.js"]