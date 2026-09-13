CREATE TABLE IF NOT EXISTS players (
  vk_user_id BIGINT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  mmr INTEGER NOT NULL DEFAULT 1000 CHECK (mmr >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  rank_reward_date DATE,        -- дата последней ежедневной награды за ранг
  mmr_season TEXT DEFAULT '',   -- текущий сезон MMR (напр. '2026-09')
  season_best_mmr INTEGER DEFAULT 0, -- лучший MMR в текущем сезоне
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- миграция для существующих БД
ALTER TABLE players ADD COLUMN IF NOT EXISTS rank_reward_date DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS mmr_season TEXT DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS season_best_mmr INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS state_revision BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS reward_events (
  event_id UUID PRIMARY KEY,
  vk_user_id BIGINT NOT NULL REFERENCES players(vk_user_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('rewarded_ad', 'game_event')),
  reward JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS players_mmr_idx ON players (mmr DESC, updated_at ASC);
CREATE INDEX IF NOT EXISTS players_updated_idx ON players (updated_at DESC);
CREATE INDEX IF NOT EXISTS players_profile_level_idx
  ON players (((state->'profile'->>'level')::integer))
  WHERE (state->'profile'->>'level') ~ '^[0-9]+$';
CREATE INDEX IF NOT EXISTS reward_events_user_idx ON reward_events (vk_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_events_kind_idx ON reward_events (vk_user_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS custom_content (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('item', 'set')),
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  drop_chance REAL NOT NULL DEFAULT 0 CHECK (drop_chance >= 0 AND drop_chance <= 100),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbox (
  id SERIAL PRIMARY KEY,
  vk_user_id BIGINT NOT NULL REFERENCES players(vk_user_id) ON DELETE CASCADE,
  item JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS inbox_user_idx ON inbox (vk_user_id, created_at DESC) WHERE claimed = false;

-- Серверный конфиг баланса игры (редкость/статы/шансы дропа/пулы дропа).
-- Одна строка (id=1). Правится из админки, клиент качает при старте —
-- чтобы менять баланс без пересборки/передеплоя фронтенда.
CREATE TABLE IF NOT EXISTS game_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO game_config (id, config) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING;

-- Чат. Реальные сообщения игроков, хранимые на сервере.
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  vk_user_id BIGINT NOT NULL REFERENCES players(vk_user_id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (created_at DESC);

-- Гильдии (кланы).
CREATE TABLE IF NOT EXISTS guilds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES players(vk_user_id) ON DELETE CASCADE,
  xp BIGINT NOT NULL DEFAULT 0,                -- опыт гильдии
  goal_key TEXT NOT NULL DEFAULT 'kills',      -- метрика общей цели ('kills'|'gold')
  goal_value BIGINT NOT NULL DEFAULT 0,        -- накопленное значение цели (коллективное)
  goal_target BIGINT NOT NULL DEFAULT 0,       -- целевое значение (0 = цель не задана)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guilds_name_idx ON guilds (name);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  vk_user_id BIGINT NOT NULL REFERENCES players(vk_user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'officer', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_kills BIGINT NOT NULL DEFAULT 0,   -- для расчёта прироста вклада в общую цель
  last_gold BIGINT NOT NULL DEFAULT 0,
  goal_claimed BOOLEAN NOT NULL DEFAULT false, -- забрал ли награду за текущую цель
  PRIMARY KEY (guild_id, vk_user_id)
);
CREATE INDEX IF NOT EXISTS guild_members_user_idx ON guild_members (vk_user_id);

-- Гилдейский чат (сообщения только внутри гильдии).
CREATE TABLE IF NOT EXISTS guild_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  vk_user_id BIGINT NOT NULL REFERENCES players(vk_user_id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_chat_created_idx ON guild_chat_messages (guild_id, created_at DESC);

-- Баны в чате (модерация). Забаненный не может писать, пока не истечёт срок.
CREATE TABLE IF NOT EXISTS chat_bans (
  id BIGSERIAL PRIMARY KEY,
  vk_user_id BIGINT NOT NULL REFERENCES players(vk_user_id) ON DELETE CASCADE,
  banned_until TIMESTAMPTZ,                   -- когда бан истекает (NULL = вечный)
  reason TEXT NOT NULL DEFAULT '',
  admin_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_bans_user_idx ON chat_bans (vk_user_id);
CREATE INDEX IF NOT EXISTS chat_bans_until_idx ON chat_bans (banned_until);
ALTER TABLE chat_bans ALTER COLUMN banned_until DROP NOT NULL;
