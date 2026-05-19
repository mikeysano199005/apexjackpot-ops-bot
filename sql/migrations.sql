-- ============================================================
-- ApexJackpot Ops Bot — Supabase SQL Migrations
-- Run once in the Supabase SQL editor
-- ============================================================

-- ── Bot Config ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO bot_config (key, value) VALUES
  ('large_deposit_threshold_cents',    '500000'),
  ('large_withdrawal_threshold_cents', '1000000'),
  ('big_win_multiplier',               '10'),
  ('velocity_window_minutes',          '10'),
  ('velocity_tx_count',                '5'),
  ('failed_login_threshold',           '3'),
  ('fraud_sensitivity',                '7'),
  ('dedup_window_seconds',             '30'),
  ('quiet_hours_start',                '0'),
  ('quiet_hours_end',                  '7'),
  ('pending_withdrawal_alert_minutes', '30'),
  ('pending_kyc_alert_hours',          '24'),
  ('pending_topup_alert_minutes',      '60')
ON CONFLICT (key) DO NOTHING;

-- ── Bot Channels ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_channels (
  key        TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Bot Incidents ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_incidents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  opened_by   TEXT NOT NULL,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  summary     TEXT
);

CREATE INDEX IF NOT EXISTS bot_incidents_resolved_at ON bot_incidents (resolved_at);

-- ── Bot On-Call ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_oncall (
  role        TEXT PRIMARY KEY,
  discord_id  TEXT NOT NULL,
  discord_tag TEXT NOT NULL,
  set_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Bot Watchlist ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_watchlist (
  user_id    UUID PRIMARY KEY,
  user_email TEXT NOT NULL,
  reason     TEXT NOT NULL,
  added_by   TEXT NOT NULL,
  added_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Bot Subscriptions (DM alerts) ───────────────────────────
CREATE TABLE IF NOT EXISTS bot_subscriptions (
  discord_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  PRIMARY KEY (discord_id, event_type)
);

-- ── Bot Pinned Messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_pinned_messages (
  key        TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Bot Shifts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id  TEXT NOT NULL,
  discord_tag TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  notes       TEXT,
  duration_ms BIGINT
);

CREATE INDEX IF NOT EXISTS bot_shifts_discord_id ON bot_shifts (discord_id, ended_at);

-- ── Bot Blacklist ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_blacklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,   -- 'ip', 'email', 'phone', 'bank_account'
  value      TEXT NOT NULL,
  reason     TEXT NOT NULL,
  added_by   TEXT NOT NULL,
  added_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (type, value)
);

-- ============================================================
-- ML Profile Columns (add to existing profiles table)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ml_pin                         TEXT,
  ADD COLUMN IF NOT EXISTS ml_pin_failed_attempts         INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ml_pin_locked_until            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ml_balance_cents               BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ml_blocked_cents               BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ml_daily_limit_cents           BIGINT,
  ADD COLUMN IF NOT EXISTS ml_per_tx_limit_cents          BIGINT,
  ADD COLUMN IF NOT EXISTS ml_last_approval_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ml_approval_cooldown_minutes   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ml_approval_window_start       INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ml_approval_window_end         INT DEFAULT 23;

-- ============================================================
-- ML Top-Up Requests Table
-- ============================================================

CREATE TABLE IF NOT EXISTS ml_topup_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  amount_cents BIGINT NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  note        TEXT,
  reviewed_by TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ml_topup_requests_user_status ON ml_topup_requests (user_id, status);
CREATE INDEX IF NOT EXISTS ml_topup_requests_status ON ml_topup_requests (status);
