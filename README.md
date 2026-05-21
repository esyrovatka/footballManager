# Football Manager Simulator

Симулятор менеджера футбольной команды с мультиплеером и асинхронными матчами в реальном времени.

См. [PROJECT.md](./PROJECT.md) — полное описание концепции, архитектуры и схемы БД.
См. [ROADMAP.md](./ROADMAP.md) — пошаговый план реализации.

## Стек

- **Next.js 16** (App Router) + TypeScript
- **PostgreSQL** + Drizzle ORM
- **Auth.js v5** (Google/GitHub OAuth)
- **Tailwind CSS 4**
- **Server-Sent Events** для live-трансляции матчей
- Отдельный воркер-процесс для симуляции матчей

## Структура проекта

```
src/
├── app/          Next.js routes (App Router)
├── components/   React-компоненты UI
├── db/           Drizzle schema, миграции, клиент
├── engine/       Match Engine (детерминированная симуляция)
└── lib/          Утилиты, типы, общая логика
drizzle/          Сгенерированные миграции
```

## Локальный запуск

### Требования
- Node.js 22+
- pnpm 10+
- PostgreSQL (локально или облачный)

### Установка

```bash
# 1. Установить зависимости
pnpm install

# 2. Скопировать env-шаблон
cp .env.example .env.local

# 3. Заполнить .env.local:
#    - DATABASE_URL (твой Postgres)
#    - AUTH_SECRET (openssl rand -base64 32)
#    - AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
#    - AUTH_GITHUB_ID / AUTH_GITHUB_SECRET

# 4. Применить миграции БД (после фазы 1.1)
pnpm db:push

# 5. Запустить dev-сервер
pnpm dev
```

Открыть [http://localhost:3000](http://localhost:3000).

## Полезные команды

| Команда | Описание |
|---|---|
| `pnpm dev` | Dev-сервер |
| `pnpm build` | Продакшн-сборка |
| `pnpm start` | Запуск продакшн-сборки |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Сгенерировать миграцию из изменений в schema.ts |
| `pnpm db:migrate` | Применить миграции |
| `pnpm db:push` | Быстрый push схемы в БД (для dev) |
| `pnpm db:studio` | Открыть Drizzle Studio (GUI для БД) |
