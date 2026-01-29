# GitHub Pages + Render Deployment

Бесплатное развертывание приложения:
- **Frontend** → GitHub Pages (бесплатно)
- **Backend** → Render (бесплатно)

---

## Шаг 1: Деплой Backend на Render

### 1.1 Создайте аккаунт на Render

Перейдите на [render.com](https://render.com) и зарегистрируйтесь через GitHub.

### 1.2 Создайте новый Web Service

1. Нажмите **"New +"** → **"Web Service"**
2. Подключите свой репозиторий `championship-scoring`
3. Заполните настройки:

```
Name: championship-scoring-api
Environment: Node
Root Directory: server
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

4. Нажмите **"Create Web Service"**

### 1.3 Скопируйте URL вашего API

После деплоя вы получите URL вида:
```
https://championship-scoring-api.onrender.com
```

**Сохраните этот URL!** Он понадобится для фронтенда.

⚠️ **Важно:** На бесплатном тарифе Render сервер "засыпает" через 15 минут неактивности. Первый запрос может занять ~30 секунд.

---

## Шаг 2: Настройка Frontend для GitHub Pages

### 2.1 Обновите API URL в коде

Откройте `client/src/utils/api.js` и измените первую строку:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://championship-scoring-api.onrender.com/api'
```

Замените `championship-scoring-api.onrender.com` на **ваш реальный URL с Render**.

### 2.2 Закоммитьте изменения

```bash
git add client/src/utils/api.js
git commit -m "Update API URL for production"
git push origin main
```

---

## Шаг 3: Включите GitHub Pages

### 3.1 В настройках репозитория

1. Перейдите в свой репозиторий: https://github.com/Truecroo/championship-scoring
2. Откройте **Settings** → **Pages**
3. В разделе **Build and deployment**:
   - Source: **GitHub Actions**

### 3.2 Запустите workflow

Workflow уже настроен (файл `.github/workflows/deploy.yml`).

После пуша в `main` ветку GitHub автоматически:
1. Соберёт React приложение
2. Задеплоит на GitHub Pages

Проверьте статус в разделе **Actions** вашего репозитория.

---

## Шаг 4: Откройте приложение

После успешного деплоя ваше приложение будет доступно по адресу:

```
https://truecroo.github.io/championship-scoring/
```

---

## Проверка работоспособности

1. **Откройте приложение** в браузере
2. **Перейдите в Админку** → создайте номинацию
3. **Если появилась ошибка подключения к API:**
   - Проверьте, что backend на Render работает
   - Откройте DevTools (F12) → Console и посмотрите ошибки
   - Убедитесь, что URL в `api.js` правильный

---

## Альтернатива: Environment Variables

Если хотите использовать переменные окружения (рекомендуется):

### В `client/src/utils/api.js`:

```javascript
const API_URL = import.meta.env.VITE_API_URL || '/api'
```

### В настройках GitHub Actions:

Добавьте в `.github/workflows/deploy.yml` перед шагом Build:

```yaml
- name: Build
  env:
    VITE_API_URL: https://championship-scoring-api.onrender.com/api
  run: |
    cd client
    npm run build
```

---

## Troubleshooting

### 🔴 CORS Errors

Если видите ошибки CORS в консоли браузера:

1. Откройте `server/index.js`
2. Обновите настройки CORS:

```javascript
app.use(cors({
  origin: [
    'https://truecroo.github.io',
    'http://localhost:3000'
  ],
  credentials: true
}))
```

3. Закоммитьте и запушьте:

```bash
git add server/index.js
git commit -m "Update CORS for GitHub Pages"
git push
```

Render автоматически передеплоится.

### 🔴 404 на маршрутах React Router

Если при обновлении страницы `/judge/1` появляется 404:

1. Создайте файл `client/public/404.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      // GitHub Pages SPA redirect
      sessionStorage.redirect = location.href;
    </script>
    <meta http-equiv="refresh" content="0;URL='/championship-scoring/'">
  </head>
</html>
```

2. В `client/index.html` добавьте в `<head>`:

```html
<script>
  (function(){
    var redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect && redirect != location.href) {
      history.replaceState(null, null, redirect);
    }
  })();
</script>
```

### 🔴 Backend "спит" на Render

На бесплатном тарифе Render усыпляет сервер после 15 минут неактивности.

**Решения:**
1. **UptimeRobot** - пингует ваш API каждые 5 минут (бесплатно)
2. **Перейти на платный план** Render ($7/месяц)

---

## Обновление приложения

После внесения изменений в код:

```bash
git add .
git commit -m "Описание изменений"
git push origin main
```

- **Frontend** обновится автоматически через GitHub Actions
- **Backend** обновится автоматически на Render

---

## Стоимость

- **GitHub Pages:** Бесплатно (100 GB bandwidth/месяц)
- **Render Free Tier:** Бесплатно (750 часов/месяц, засыпает при неактивности)

**Итого: 0 рублей! 🎉**

---

## Полезные ссылки

- Ваш репозиторий: https://github.com/Truecroo/championship-scoring
- GitHub Pages: https://truecroo.github.io/championship-scoring/
- Render Dashboard: https://dashboard.render.com/
- Render Docs: https://render.com/docs

---

## Следующие шаги

1. ✅ Деплой backend на Render
2. ✅ Обновить API URL в коде
3. ✅ Включить GitHub Pages
4. ✅ Открыть приложение и протестировать
5. 🎯 Пользоваться!
