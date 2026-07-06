# Деплой Uchet

## Важное ограничение

Проект работает в production, а реальные данные существуют только в `PostgreSQL`.

Перед любым релизом:

- не выполнять destructive SQL;
- не запускать `lib/initDb.ts` против production;
- не делать schema/data changes без отдельного утверждённого плана;
- не хранить реальные секреты в репозитории.

## Production env

Укажите реальные значения только в настройках платформы деплоя.

```bash
DATABASE_URL="<set-in-deployment-platform-env-only>"
NEXTAUTH_SECRET="<set-secure-random-value-in-deployment-platform-env-only>"
```

Опционально:

```bash
NEXTAUTH_URL="https://your-domain.example"
```

## Деплой-чеклист

1. Убедиться, что `yarn lint` проходит.
2. Убедиться, что `yarn build` проходит.
3. Проверить, что в diff нет секретов, connection string и деструктивных SQL.
4. Проверить env на платформе деплоя.
5. Выполнить деплой.
6. После деплоя вручную проверить:
   - `/login`
   - `/`
   - `/day/[date]`
   - CRUD операций
   - мобильный month view

## Секреты

Если секреты или connection strings когда-либо попали в репозиторий, их нужно:

1. Считать скомпрометированными.
2. Ротировать вне кода.
3. Обновить значения на production-платформе.

## Генерация нового NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

## Troubleshooting

### Invalid callback URL

- Явно задайте `NEXTAUTH_URL`.

### CSRF token mismatch

- Проверьте, что `NEXTAUTH_SECRET` одинаковый на всех инстансах окружения.

### Проблемы с авторизацией после релиза

- Проверьте `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- Убедитесь, что не запускались сторонние init/migration-скрипты против production.
