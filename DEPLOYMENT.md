# Deployment Guide

Инструкция по развертыванию Championship Scoring System на разных платформах.

## Содержание

- [Vercel (рекомендуется)](#vercel)
- [Render](#render)
- [Railway](#railway)
- [VPS/Dedicated Server](#vps)
- [Docker](#docker)

---

## Vercel

Самый простой способ для фронтенда + serverless API.

### Шаги:

1. **Форкните или клонируйте репозиторий**

2. **Создайте аккаунт на [Vercel](https://vercel.com)**

3. **Импортируйте проект:**
   - New Project → Import Git Repository
   - Выберите `championship-scoring`

4. **Настройте Build & Output:**
   ```
   Framework Preset: Vite
   Root Directory: ./
   Build Command: cd client && npm install && npm run build
   Output Directory: client/dist
   Install Command: npm install
   ```

5. **Настройте Environment Variables:**
   ```
   VITE_API_URL=https://your-app.vercel.app/api
   ```

6. **Деплой!**

### API Routes (Serverless Functions):

Создайте файл `api/[...path].js` в корне:

```javascript
import express from 'express'
import serverlessHttp from 'serverless-http'
// import your server logic
```

⚠️ **Примечание:** Vercel не поддерживает постоянное хранилище файлов. Нужно использовать внешнюю БД (MongoDB, Postgres) или Vercel KV.

---

## Render

Бесплатный хостинг с поддержкой Node.js и статики.

### Шаги:

1. **Создайте аккаунт на [Render](https://render.com)**

2. **Создайте Web Service для Backend:**
   - New → Web Service
   - Connect repository
   - Настройки:
     ```
     Name: championship-scoring-api
     Environment: Node
     Build Command: cd server && npm install
     Start Command: cd server && npm start
     ```

3. **Создайте Static Site для Frontend:**
   - New → Static Site
   - Настройки:
     ```
     Build Command: cd client && npm install && npm run build
     Publish Directory: client/dist
     ```

4. **Environment Variables для клиента:**
   ```
   VITE_API_URL=https://championship-scoring-api.onrender.com
   ```

5. **Обновите `client/src/utils/api.js`:**
   ```javascript
   const API_URL = import.meta.env.VITE_API_URL || '/api'
   ```

---

## Railway

Простой деплой с поддержкой monorepo.

### Шаги:

1. **Создайте аккаунт на [Railway](https://railway.app)**

2. **New Project → Deploy from GitHub**

3. **Добавьте два сервиса:**

   **Backend Service:**
   ```
   Root Directory: server
   Build Command: npm install
   Start Command: npm start
   ```

   **Frontend Service:**
   ```
   Root Directory: client
   Build Command: npm install && npm run build
   Start Command: npm install -g serve && serve -s dist -l 3000
   ```

4. **Environment Variables:**
   - Backend: `PORT=5001`
   - Frontend: `VITE_API_URL=https://your-backend.railway.app`

---

## VPS / Dedicated Server

Для полного контроля (Ubuntu/Debian).

### Требования:
- Node.js 18+
- npm 9+
- Git

### Установка:

```bash
# 1. Подключитесь к серверу
ssh user@your-server.com

# 2. Установите Node.js (если нет)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Клонируйте репозиторий
git clone https://github.com/yourusername/championship-scoring.git
cd championship-scoring

# 4. Установите зависимости
npm run install:all

# 5. Соберите клиент
cd client && npm run build && cd ..

# 6. Установите PM2 для управления процессами
sudo npm install -g pm2

# 7. Запустите сервер
cd server
pm2 start index.js --name championship-api

# 8. Настройте автозапуск
pm2 startup
pm2 save

# 9. Установите Nginx для фронтенда
sudo apt install nginx

# 10. Настройте Nginx
sudo nano /etc/nginx/sites-available/championship
```

**Конфиг Nginx:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /home/user/championship-scoring/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активируйте конфиг
sudo ln -s /etc/nginx/sites-available/championship /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL (опционально)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Docker

Для изолированного развертывания.

### Dockerfile

Создайте `Dockerfile` в корне:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy source
COPY . .

# Build client
RUN cd client && npm run build

EXPOSE 3000 5001

# Start both services
CMD ["npm", "run", "dev"]
```

### Docker Compose

Создайте `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "5001:5001"
    volumes:
      - ./database:/app/database
    environment:
      - NODE_ENV=production
```

### Запуск:

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Environment Variables

### Backend (.env в server/)

```env
PORT=5001
NODE_ENV=production
```

### Frontend (.env в client/)

```env
VITE_API_URL=http://localhost:5001
```

---

## После деплоя

1. **Откройте приложение в браузере**
2. **Перейдите в админку** и создайте номинации
3. **Добавьте команды**
4. **Готово к использованию!**

---

## Troubleshooting

### Ошибка подключения к API
- Проверьте `VITE_API_URL` в настройках клиента
- Убедитесь, что сервер запущен и доступен

### База данных пропадает после рестарта
- Vercel/Railway: используйте внешнюю БД (MongoDB Atlas, Supabase)
- VPS: проверьте, что папка `database/` имеет права на запись

### Порты заняты
- Измените порты в `server/index.js` и `client/vite.config.js`

---

## Обновление на сервере

```bash
cd championship-scoring
git pull
npm run install:all
cd client && npm run build && cd ..
pm2 restart championship-api
```

---

## Поддержка

Если возникли проблемы, создайте Issue на GitHub:
https://github.com/yourusername/championship-scoring/issues
