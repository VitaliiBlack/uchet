# Инструкция по деплою

## Переменные окружения для production

### Обязательные переменные:

```bash
# База данных (уже настроена)
DATABASE_URL="postgresql://neondb_owner:npg_3e6ENvJFtCSH@ep-flat-boat-agun6hjz-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# NextAuth Secret (ОБЯЗАТЕЛЬНО!)
NEXTAUTH_SECRET="DbN/wuRyCr1rc6faKOnaHY/HWx2eZXQhKPPKbEg+mKA="
```

### NEXTAUTH_URL — НЕ ОБЯЗАТЕЛЬНА! ✅

Благодаря настройке `trustHost: true` в `auth.config.ts`, NextAuth автоматически определит URL из заголовков запроса.

**Однако**, если хотите задать явно:

#### Для Vercel:
```bash
# Вариант 1: Не задавать вообще (рекомендуется)
# NextAuth автоматически использует VERCEL_URL

# Вариант 2: Задать после первого деплоя
NEXTAUTH_URL=https://your-project.vercel.app
```

#### Для других платформ (Railway, Render, DigitalOcean):
```bash
# Вариант 1: Использовать кастомный домен (если есть)
NEXTAUTH_URL=https://yourdomain.com

# Вариант 2: Задать после первого деплоя
NEXTAUTH_URL=https://your-app.railway.app
# или
NEXTAUTH_URL=https://your-app.onrender.com
```

## Процесс деплоя

### Шаг 1: Подготовка
1. Убедитесь, что все изменения закоммичены в git
2. Проверьте, что `.env` добавлен в `.gitignore` (секреты не должны попасть в репозиторий!)

### Шаг 2: Первый деплой
1. Создайте проект на платформе (Vercel/Railway/Render)
2. Подключите GitHub репозиторий
3. Задайте переменные окружения:
   - `DATABASE_URL` — ваша база данных Neon
   - `NEXTAUTH_SECRET` — секрет для NextAuth
   - `NEXTAUTH_URL` — **можно пропустить** благодаря `trustHost: true`

### Шаг 3: После деплоя (опционально)
Если NextAuth не работает корректно:
1. Получите URL вашего приложения
2. Добавьте переменную `NEXTAUTH_URL=https://your-actual-url.com`
3. Перезапустите приложение

## Генерация нового NEXTAUTH_SECRET (если нужно)

```bash
# В терминале выполните:
openssl rand -base64 32
```

Скопируйте результат и используйте как значение `NEXTAUTH_SECRET`.

## Проверка после деплоя

1. Откройте ваше приложение в браузере
2. Попробуйте войти через `/login`
3. Проверьте, что редиректы работают корректно
4. Убедитесь, что сессия сохраняется после перезагрузки страницы

## Troubleshooting

### Проблема: "Invalid callback URL"
**Решение**: Добавьте `NEXTAUTH_URL` явно в переменные окружения

### Проблема: "CSRF token mismatch"
**Решение**: Проверьте, что `NEXTAUTH_SECRET` одинаковый во всех окружениях

### Проблема: Редиректы не работают
**Решение**: Убедитесь, что `trustHost: true` добавлен в `auth.config.ts`
