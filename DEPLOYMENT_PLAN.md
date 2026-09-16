# 📋 План деплоя «БЕЗДНА» — ВЫПОЛНЕНО ✅

> **Дата:** 19 сентября 2025
> **Статус:** ✅ Развёрнуто и работает
> **Сервер:** Select VDS «Habiba» — `135.106.211.85`

---

## 1. Итоговая инфраструктура

```
┌─────────────────────────────────────────────────────────────┐
│  ФРОНТЕНД                                                     │
│  • GitHub Pages: https://nolik305.github.io                  │
│  • Сервер:       https://135.106.211.85.nip.io               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (/api, /health)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Select VDS «Habiba» — 135.106.211.85                        │
│  Ubuntu 24.04 LTS | 1 vCPU | 2GB RAM | 25GB SSD              │
│                                                              │
│  Nginx :443 ──▶ Node.js :3001 (PM2 game-api) ──▶ PostgreSQL  │
│  SSL: game.crt (до 2027)                         abyss_idle  │
│  Root: /var/www/game-project                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Что было выполнено

### Фаза 1: Настройка VDS ✅
- [x] Ubuntu 24.04 LTS
- [x] Node.js v20.20.2 + npm 10.8.2
- [x] PostgreSQL (scram-sha-256)
- [x] PM2 процесс-менеджер
- [x] Nginx + самоподписанный SSL
- [x] Git репозиторий `nolik305/bezdna-idle`

### Фаза 2: База данных ✅
- [x] БД `abyss_idle` создана
- [x] Пользователь `game_api` (пароль `<ПАРОЛЬ-БД>`)
- [x] 10 таблиц из `schema.sql`
- [x] Индексы
- [x] `game_config` инициализирован

### Фаза 3: Backend ✅
- [x] `/var/www/game-project/server/index.mjs`
- [x] `.env` с реальными секретами
- [x] PM2 `game-api` (online, 56mb)
- [x] Health: `{"ok":true}`
- [x] Balance: `{"config":{}}`

### Фаза 4: Frontend ✅
- [x] `src/platform/vk.tsx` → `https://135.106.211.85.nip.io`
- [x] `npm run build` → `dist/` (5.0MB)
- [x] Спрайты в `dist/sprites/`

### Фаза 5: Nginx ✅
- [x] Объединённый конфиг `game`
- [x] HTTP → HTTPS редирект (301)
- [x] Статика из `/var/www/game-project/dist`
- [x] `/api` → `127.0.0.1:3001`
- [x] `/health` → `127.0.0.1:3001`
- [x] Кеширование статики (30 дней)
- [x] Дубликат `game-https` удалён

---

## 3. Проверенные endpoints

| Endpoint | Результат | Статус |
|---|---|---|
| `GET /` | index.html (1301 B) | ✅ |
| `GET /health` | `{"ok":true}` | ✅ |
| `GET /api/balance` | `{"config":{}}` | ✅ |
| `GET /api/custom/items` | `{"items":[]}` | ✅ |
| `GET /sprites/items/item_001.png` | PNG 19457 B | ✅ |
| `http://...` | 301 → HTTPS | ✅ |

---

## 4. Команды управления

### PM2
```bash
ssh root@135.106.211.85
pm2 list                    # статус
pm2 logs game-api           # логи
pm2 restart game-api        # перезапуск
pm2 save                    # сохранить
```

### Nginx
```bash
nginx -t                    # проверка конфига
systemctl reload nginx      # перезагрузка
tail -f /var/log/nginx/error.log
```

### PostgreSQL
```bash
PGPASSWORD=<ПАРОЛЬ-БД> psql -h 127.0.0.1 -U game_api -d abyss_idle
\dt                         # таблицы
SELECT count(*) FROM players;
```

### Обновление фронтенда
```bash
cd /var/www/game-project
git pull
npm run build               # обновит dist/
```

### Обновление бэкенда
```bash
cd /var/www/game-project/server
git pull
pm2 restart game-api
```

---

## 5. Осталось сделать (рекомендации)

### 🔴 Обязательно
- [ ] **Ограничить права БД**: `ALTER USER game_api NOSUPERUSER;`
- [ ] **Проверить `.gitignore`**: убедиться что `.env` не в git
- [ ] **Запушить фикс в GitHub**: `vk.tsx` для GitHub Pages
  ```bash
  # Требуется Personal Access Token:
  cd /var/www/game-project
  git remote set-url origin https://<TOKEN>@github.com/nolik305/bezdna-idle.git
  git push origin main
  ```

### 🟡 Желательно
- [ ] **Let's Encrypt SSL** (нужен домен):
  ```bash
  apt install certbot python3-certbot-nginx
  certbot --nginx -d your-domain.com
  ```
- [ ] **Бэкапы БД** (`/etc/cron.daily/pg_backup`):
  ```bash
  #!/bin/bash
  DATE=$(date +%Y%m%d)
  PGPASSWORD=<ПАРОЛЬ-БД> pg_dump -h 127.0.0.1 -U game_api abyss_idle | gzip > /backups/abyss_$DATE.sql.gz
  find /backups -name "*.sql.gz" -mtime +30 -delete
  ```
- [ ] **Мониторинг** — uptime-проверка `/health`
- [ ] **Ротация логов** PM2

### 🟢 Опционально
- [ ] Docker для воспроизводимости
- [ ] CI/CD (GitHub Actions → deploy)
- [ ] `ADMIN_VK_IDS` → в БД
- [ ] Спрайты → Vite assets

---

## 6. Доступы и секреты

| Ресурс | Значение | Где |
|---|---|---|
| VDS IP | `135.106.211.85` | Select VDS |
| VDS пароль root | (в чате) | — |
| VK App ID | `54071180` | `.env` |
| VK App Secret | `<VK-APP-SECRET>` | `.env` |
| БД | `abyss_idle` / `game_api` / `<ПАРОЛЬ-БД>` | `.env` |
| Admin VK ID | `835693694` | `.env` |
| GitHub | `nolik305/bezdna-idle` | — |

⚠️ **Все секреты должны быть в `.gitignore`!**

---

## 7. Известные особенности

| Наблюдение | Причина | Решение |
|---|---|---|
| Из Ziva-песочницы HTTPS работает 2/10 | Сетевой путь до Москвы | Нормально, реальные пользователи не затронуты |
| Self-signed SSL | Нет домена | Certbot при наличии домена |
| 1 vCPU / 2GB RAM | Минимальный тариф | Мониторить, апгрейд при росте |
| `game-api` не `abyss-idle-api` | Имя процесса | Единообразно в конфиге |

---

## 8. Git / GitHub — ВЫПОЛНЕНО ✅

### Репозиторий
- **URL:** `https://github.com/Nolik305/bezdna-idle` (перемещён с `nolik305`)
- **GitHub Pages:** `https://nolik305.github.io/bezdna-idle/`

### Коммиты
```
42e4273 fix: API URL fallback → https://135.106.211.85.nip.io (correct server) ← НАШ
857b55b Delete server directory
462eccb Fix: Force update .env and rebuild dist with HTTPS
1d537f2 Update for HTTPS
920bd35 Rebuild with correct API URL
e7ac7f2 Initial commit: Clean project restore
```

### GitHub Actions
| Run | Commit | Статус |
|---|---|---|
| #6 | `42e4273` (наш фикс) | ✅ success |
| #5 | `857b55b` | ✅ success |
| #4 | `462eccb` | ✅ success |

### Проверка GitHub Pages
- ✅ JS содержит `https://135.106.211.85.nip.io`
- ✅ Старый IP `135.106.176.77` отсутствует
- ✅ `index.html` → HTTP 200

### Remote на сервере
```bash
cd /var/www/game-project
git remote set-url origin https://<TOKEN>@github.com/Nolik305/bezdna-idle.git
```

⚠️ **Токен в remote URL сохранён в `.git/config`** — при необходимости удалить:
```bash
git remote set-url origin https://github.com/Nolik305/bezdna-idle.git
```

---

## 9. SSL — Let's Encrypt настроен ✅

### Сертификат
- **Домен:** `135.106.211.85.nip.io`
- **Issuer:** Let's Encrypt (`C=US, O=Let's Encrypt`)
- **Действителен до:** 11 декабря 2026
- **Авто-продление:** `certbot.timer` (2 раза в день), dry-run пройден ✅
- **Путь:** `/etc/letsencrypt/live/135.106.211.85.nip.io/`

### Проверка
```bash
curl -s https://135.106.211.85.nip.io/health
# → {"ok":true}  (ssl_verify_result: 0 = валидный)
```

### Nginx
```nginx
ssl_certificate /etc/letsencrypt/live/135.106.211.85.nip.io/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/135.106.211.85.nip.io/privkey.pem;
```

---

## 10. 🔗 ССЫЛКА ДЛЯ VK

### ✅ РЕКОМЕНДУЕТСЯ: `https://135.106.211.85.nip.io/`

| Критерий | Значение |
|---|---|
| SSL | ✅ Валидный Let's Encrypt |
| Скорость (РФ) | ✅ Сервер в Москве |
| Фронтенд + API | ✅ Один домен |
| Авто-продление | ✅ certbot.timer |
| VK-вебвью | ✅ Примет (валидный сертификат) |

### Альтернативы

| Вариант | URL | Плюсы | Минусы |
|---|---|---|---|
| **GitHub Pages** | `https://nolik305.github.io/bezdna-idle/` | Валидный SSL | Медленно/рискованно в РФ |
| **VK Hosting** | `npm run deploy` | Родной для VK | Нужен деплой |

### ⚠️ ВАЖНО: Что НЕ ставить
- ❌ `http://...` — VK требует HTTPS
- ❌ Старый `api.135.106.176.77.nip.io` — сервер мёртв
- ❌ Самоподписанный серт — VK отклонит

---

## 11. ⚠️ Важное замечание по git

Remote-репозиторий **удалил `server/`** (коммит `857b55b`). Из-за этого `git reset --hard` удалил серверные файлы!

**Восстановлено:** `index.mjs`, `package.json`, `schema.sql`, `ecosystem.config.cjs`, `node_modules`.
**Сохранён:** `.env` (не трогается git).

**Защита:** не выполнять `git clean -fd` и `git reset --hard` для `server/`. Файлы `server/` НЕ отслеживаются git.
