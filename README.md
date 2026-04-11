# Uchet

Веб-приложение для учёта финансов на `Next.js App Router` с авторизацией через `NextAuth` и хранением данных в `PostgreSQL`.

## Что внутри

- Месячный календарь с суммами по дням.
- Страница дня с CRUD-редактированием операций.
- Email/password аутентификация.
- Серверные API routes для чтения и изменения операций.

## Стек

- `Next.js 16`
- `React 19`
- `next-auth@5 beta`
- `pg`
- `TypeScript`
- `Tailwind CSS 4` + CSS modules

## Переменные окружения

Создайте `.env.local` на основе `.env.example`.

Обязательные переменные:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
NEXTAUTH_SECRET="replace-with-a-secure-random-value"
```

Опционально для локальной разработки:

```bash
NEXTAUTH_URL="http://localhost:3000"
```

## Локальный запуск

```bash
yarn install
yarn dev
```

Приложение будет доступно на [http://localhost:3000](http://localhost:3000).

## Основные маршруты

- `/` — календарь по месяцам
- `/day/[date]` — операции за конкретный день
- `/login` — вход и регистрация
- `/api/financial-data` — защищённый CRUD API для операций
- `/api/auth/[...nextauth]` — auth routes NextAuth

## Формат даты

В UI и навигации используется строковый формат `YYYY-MM-DD`.  
Это сделано намеренно, чтобы не допускать timezone-сдвигов при отображении `DATE` из PostgreSQL.

## Работа с базой

В production реальные данные существуют только в базе.

Критичные правила:

- не выполнять ручные schema/data changes без отдельного утверждённого плана;
- не использовать `lib/initDb.ts` как миграционный инструмент;
- не запускать `initDb` против production базы.

`lib/initDb.ts` оставлен только как безопасный additive bootstrap для локального/dev-окружения.  
Он не должен использоваться вместо нормальных миграций.

## Проверки перед релизом

```bash
yarn lint
yarn build
```

## Деплой

См. [DEPLOYMENT.md](/Users/vitalijgribinik/HomeProjects/uchet/DEPLOYMENT.md).
