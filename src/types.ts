// ─── Bot Event Types (sent from Next.js) ──────────────────────────────────────

export type BotEventType =
  // User
  | "user.registered"
  | "user.kyc_submitted"
  | "user.kyc_approved"
  | "user.kyc_rejected"
  | "user.email_verified"
  | "user.password_reset"
  | "user.banned"
  | "user.unbanned"
  | "user.role_changed"
  | "user.login_failed"
  | "user.account_locked"
  // Deposit
  | "deposit.initiated"
  | "deposit.completed"
  | "deposit.failed"
  | "deposit.large"
  // Withdrawal
  | "withdrawal.requested"
  | "withdrawal.approved"
  | "withdrawal.rejected"
  | "withdrawal.completed"
  | "withdrawal.failed"
  | "withdrawal.large"
  // Refund / Bonus
  | "refund.issued"
  | "bonus.credited"
  | "bonus.expired"
  | "cashback.applied"
  | "commission.paid"
  // ML
  | "ml.withdrawal_pending"
  | "ml.withdrawal_approved"
  | "ml.withdrawal_force_approved"
  | "ml.withdrawal_rejected"
  | "ml.topup_requested"
  | "ml.topup_approved"
  | "ml.topup_rejected"
  | "ml.pin_set"
  | "ml.pin_changed"
  | "ml.pin_failed"
  | "ml.pin_locked"
  | "ml.pin_unlocked_by_admin"
  | "ml.balance_adjusted"
  | "ml.limits_updated"
  | "ml.large_withdrawal"
  // Admin
  | "admin.action"
  | "admin.login"
  | "admin.maintenance_on"
  | "admin.maintenance_off"
  | "admin.settings_changed"
  | "admin.emergency_control"
  | "admin.bulk_operation"
  // Game
  | "game.big_win"
  | "game.result_voided"
  | "game.added"
  | "game.toggled"
  | "bet.suspicious"
  // Security
  | "security.velocity_alert"
  | "security.ip_multi_account"
  | "security.fraud_pattern"
  | "security.bonus_abuse"
  | "security.bank_account_shared"
  // System
  | "system.gateway_down"
  | "system.gateway_up"
  | "system.deploy_started"
  | "system.deploy_success"
  | "system.deploy_failed"
  | "system.error"
  | "system.health_check_failed";

export interface BotEvent {
  type: BotEventType;
  payload: Record<string, unknown>;
  timestamp?: string;
}

// ─── Channel Keys ─────────────────────────────────────────────────────────────

export type ChannelKey =
  | "live_feed"
  | "daily_reports"
  | "daily_summary"
  | "weekly_digest"
  | "platform_status"
  | "pinned_dashboard"
  | "deposits"
  | "withdrawals"
  | "big_alerts"
  | "refunds"
  | "bonus_tracking"
  | "agent_commissions"
  | "ml_pending_approvals"
  | "ml_topup_requests"
  | "ml_security"
  | "ml_audit"
  | "registrations"
  | "kyc_queue"
  | "bans_suspensions"
  | "watchlist_alerts"
  | "role_changes"
  | "login_alerts"
  | "suspicious_activity"
  | "velocity_alerts"
  | "fraud_alerts"
  | "fraud_flags"
  | "ip_flags"
  | "admin_audit"
  | "settings_changes"
  | "bulk_operations"
  | "big_wins"
  | "game_events"
  | "bet_alerts"
  | "voided_results"
  | "health_monitor"
  | "gateway_status"
  | "deploy_logs"
  | "incidents"
  | "errors"
  | "bot_logs"
  | "bot_commands";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface BotConfig {
  // Thresholds
  large_deposit_threshold_cents: number;
  large_withdrawal_threshold_cents: number;
  big_win_multiplier: number;
  // Quiet hours (IST)
  quiet_hours_start: number;
  quiet_hours_end: number;
  // Pending alerts
  pending_withdrawal_alert_minutes: number;
  pending_kyc_alert_hours: number;
  pending_topup_alert_minutes: number;
  // Fraud detection
  velocity_window_minutes: number;
  velocity_tx_count: number;
  failed_login_threshold: number;
  fraud_sensitivity: number;
  // Misc
  dedup_window_seconds: number;
  [key: string]: unknown;
}

export const DEFAULT_CONFIG: BotConfig = {
  large_deposit_threshold_cents: 500000,
  large_withdrawal_threshold_cents: 1000000,
  big_win_multiplier: 10,
  quiet_hours_start: 0,
  quiet_hours_end: 7,
  pending_withdrawal_alert_minutes: 30,
  pending_kyc_alert_hours: 24,
  pending_topup_alert_minutes: 60,
  velocity_window_minutes: 10,
  velocity_tx_count: 5,
  failed_login_threshold: 3,
  fraud_sensitivity: 7,
  dedup_window_seconds: 30,
};

// ─── Incident ─────────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  title: string;
  opened_by: string;
  opened_at: string;
  resolved_at?: string;
  resolution?: string;
  thread_id?: string;
  message_id?: string;
}

// ─── Oncall ───────────────────────────────────────────────────────────────────

export interface OncallEntry {
  role: string;
  discord_id: string;
  discord_tag: string;
  set_at: string;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export interface WatchlistEntry {
  user_id: string;
  user_email: string;
  reason: string;
  added_by: string;
  added_at: string;
}
