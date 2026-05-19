import { Client } from "discord.js";
import { BotEvent } from "../types";
import { getBotConfig, isDuplicate, getWatchlist } from "../supabase";
import { sendToChannel, isQuietHours } from "../lib/channels";
import * as user from "./user";
import * as financial from "./financial";
import * as ml from "./ml";
import * as security from "./security";
import * as system from "./system";

const NON_CRITICAL = new Set([
  "user.registered", "deposit.initiated", "deposit.completed", "game.added",
]);

export async function handleEvent(client: Client, event: BotEvent): Promise<void> {
  const cfg = await getBotConfig();

  // Quiet hours — suppress non-critical events
  if (NON_CRITICAL.has(event.type) && isQuietHours(cfg.quiet_hours_start, cfg.quiet_hours_end)) return;

  // Dedup
  const dedupKey = `${event.type}:${JSON.stringify(event.payload).slice(0, 100)}`;
  if (isDuplicate(dedupKey, cfg.dedup_window_seconds)) return;

  // Watchlist check — DM subscriber if watched user triggers event
  const userId = String(event.payload.user_id ?? "");
  if (userId) {
    const watchlist = await getWatchlist();
    const watched = watchlist.find(w => w.user_id === userId);
    if (watched) {
      try {
        const watcher = await client.users.fetch(watched.added_by);
        await watcher.send(`👁 **Watched user activity** — ${String(event.payload.email ?? userId)}\nEvent: \`${event.type}\`\nReason watched: ${watched.reason}`);
      } catch {}
    }
  }

  switch (event.type) {
    // User
    case "user.registered":        return user.handleUserRegistered(client, event.payload);
    case "user.kyc_submitted":     return user.handleKycSubmitted(client, event.payload);
    case "user.kyc_approved":      return user.handleKycApproved(client, event.payload);
    case "user.kyc_rejected":      return user.handleKycRejected(client, event.payload);
    case "user.banned":            return user.handleUserBanned(client, event.payload);
    case "user.unbanned":          return user.handleUserUnbanned(client, event.payload);
    case "user.role_changed":      return user.handleRoleChanged(client, event.payload);
    case "user.login_failed":      return user.handleLoginFailed(client, event.payload);
    case "user.account_locked":    return user.handleAccountLocked(client, event.payload);

    // Financial
    case "deposit.completed":      return financial.handleDepositCompleted(client, event.payload);
    case "deposit.failed":         return financial.handleDepositFailed(client, event.payload);
    case "withdrawal.requested":   return financial.handleWithdrawalRequested(client, event.payload);
    case "withdrawal.approved":    return financial.handleWithdrawalApproved(client, event.payload);
    case "withdrawal.failed":      return financial.handleWithdrawalFailed(client, event.payload);
    case "bonus.credited":         return financial.handleBonusCredited(client, event.payload);
    case "commission.paid":        return financial.handleCommissionPaid(client, event.payload);
    case "refund.issued":          return financial.handleRefundIssued(client, event.payload);

    // ML
    case "ml.withdrawal_pending":        return ml.handleMlWithdrawalPending(client, event.payload);
    case "ml.withdrawal_approved":       return ml.handleMlWithdrawalApproved(client, event.payload);
    case "ml.withdrawal_force_approved": return ml.handleMlWithdrawalForceApproved(client, event.payload);
    case "ml.withdrawal_rejected":       return ml.handleMlWithdrawalRejected(client, event.payload);
    case "ml.topup_requested":           return ml.handleMlTopupRequested(client, event.payload);
    case "ml.pin_locked":                return ml.handleMlPinLocked(client, event.payload);
    case "ml.balance_adjusted":          return ml.handleMlBalanceAdjusted(client, event.payload);
    case "ml.limits_updated":            return ml.handleMlLimitsUpdated(client, event.payload);
    case "ml.large_withdrawal":          return ml.handleMlLargeWithdrawal(client, event.payload);
    case "ml.pin_set":
    case "ml.pin_changed":
    case "ml.pin_failed":
    case "ml.pin_unlocked_by_admin":     return ml.handleMlPinEvent(client, event.payload, event.type);

    // Security
    case "security.velocity_alert":    return security.handleVelocityAlert(client, event.payload);
    case "security.ip_multi_account":  return security.handleIpMultiAccount(client, event.payload);
    case "security.fraud_pattern":     return security.handleFraudPattern(client, event.payload);
    case "security.bonus_abuse":       return security.handleBonusAbuse(client, event.payload);
    case "security.bank_account_shared": return security.handleBankAccountShared(client, event.payload);

    // System
    case "system.gateway_down":    return system.handleGatewayDown(client, event.payload);
    case "system.gateway_up":      return system.handleGatewayUp(client, event.payload);
    case "system.deploy_started":
    case "system.deploy_success":
    case "system.deploy_failed":   return system.handleDeployEvent(client, event.payload, event.type);
    case "system.error":           return system.handleSystemError(client, event.payload);
    case "admin.action":           return system.handleAdminAction(client, event.payload);
    case "admin.maintenance_on":   return system.handleMaintenanceToggle(client, event.payload, true);
    case "admin.maintenance_off":  return system.handleMaintenanceToggle(client, event.payload, false);
    case "game.big_win":           return system.handleBigWin(client, event.payload);

    default:
      console.log(`[Bot] Unhandled event type: ${event.type}`);
  }
}
