import { Client, EmbedBuilder, ColorResolvable } from "discord.js";
import { supabase, getBotConfig, isDuplicate } from "../supabase";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt } from "../lib/embeds";

export async function runVelocityChecks(client: Client) {
  const cfg = await getBotConfig();
  const windowMinutes = cfg.velocity_window_minutes ?? 10;
  const txCountThreshold = cfg.velocity_tx_count ?? 5;
  const windowMs = windowMinutes * 60 * 1000;
  const since = new Date(Date.now() - windowMs).toISOString();

  const { data: recentTxs } = await supabase
    .from("transactions")
    .select("user_id, type, amount_cents, created_at")
    .gte("created_at", since)
    .in("status", ["completed", "pending"]);

  if (!recentTxs) return;

  type TxRow = { user_id: string; type: string; amount_cents: number; created_at: string };
  const byUser = new Map<string, TxRow[]>();
  for (const tx of (recentTxs as TxRow[])) {
    if (!byUser.has(tx.user_id)) byUser.set(tx.user_id, []);
    byUser.get(tx.user_id)!.push(tx);
  }

  for (const [userId, txs] of byUser) {
    if (txs.length < txCountThreshold) continue;

    const dedupKey = `velocity:${userId}:${Math.floor(Date.now() / windowMs)}`;
    if (isDuplicate(dedupKey, windowMs / 1000)) continue;

    const { data: profile } = await supabase.from("profiles").select("email, display_name").eq("id", userId).single();
    const totalAmount = txs.reduce((s, t) => s + t.amount_cents, 0);

    const embed = new EmbedBuilder()
      .setColor(COLORS.error as ColorResolvable)
      .setTitle("⚡ Velocity Alert")
      .addFields(
        { name: "User", value: profile?.email ?? userId, inline: true },
        { name: "Transactions", value: `${txs.length} in ${windowMinutes}m`, inline: true },
        { name: "Total Amount", value: fmt(totalAmount), inline: true },
      )
      .setTimestamp();

    await sendToChannel(client, "fraud_alerts", { embeds: [embed] });
  }
}

export async function runIpMultiAccountCheck(client: Client) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: logins } = await supabase
    .from("audit_logs")
    .select("user_id, meta")
    .eq("action", "login")
    .gte("created_at", since);

  if (!logins) return;

  const ipMap = new Map<string, Set<string>>();
  for (const log of logins) {
    const ip = (log.meta as any)?.ip;
    if (!ip) continue;
    if (!ipMap.has(ip)) ipMap.set(ip, new Set());
    ipMap.get(ip)!.add(log.user_id);
  }

  for (const [ip, userIds] of ipMap) {
    if (userIds.size < 2) continue;

    const dedupKey = `multi-account:${ip}`;
    if (isDuplicate(dedupKey, 3600)) continue;

    const userList = [...userIds];
    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userList);
    const emails = (profiles ?? []).map((p: any) => p.email).join(", ");

    const embed = new EmbedBuilder()
      .setColor(COLORS.error as ColorResolvable)
      .setTitle("🔗 Multi-Account Detected")
      .addFields(
        { name: "IP Address", value: `\`${ip}\``, inline: true },
        { name: "Account Count", value: String(userIds.size), inline: true },
        { name: "Emails", value: emails.slice(0, 300), inline: false },
      )
      .setTimestamp();

    await sendToChannel(client, "fraud_alerts", { embeds: [embed] });
  }
}

export async function runBonusAbuseCheck(client: Client) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: bonuses } = await supabase
    .from("transactions")
    .select("user_id, amount_cents")
    .eq("type", "bonus")
    .gte("created_at", since);

  if (!bonuses) return;

  const byUser = new Map<string, number>();
  for (const b of bonuses) {
    byUser.set(b.user_id, (byUser.get(b.user_id) ?? 0) + b.amount_cents);
  }

  for (const [userId, total] of byUser) {
    if (total < 200000) continue; // ₹2000 threshold

    const dedupKey = `bonus-abuse:${userId}`;
    if (isDuplicate(dedupKey, 86400)) continue;

    const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();

    const embed = new EmbedBuilder()
      .setColor(COLORS.warning as ColorResolvable)
      .setTitle("🎁 Bonus Abuse Suspected")
      .addFields(
        { name: "User", value: profile?.email ?? userId, inline: true },
        { name: "Bonus (7d)", value: fmt(total), inline: true },
      )
      .setTimestamp();

    await sendToChannel(client, "fraud_alerts", { embeds: [embed] });
  }
}

export async function runSharedBankCheck(client: Client) {
  const { data: txs } = await supabase
    .from("transactions")
    .select("user_id, meta")
    .eq("type", "withdraw")
    .eq("status", "completed")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

  if (!txs) return;

  const bankMap = new Map<string, Set<string>>();
  for (const tx of txs) {
    const bankId = (tx.meta as any)?.bank_account_id;
    if (!bankId) continue;
    if (!bankMap.has(bankId)) bankMap.set(bankId, new Set());
    bankMap.get(bankId)!.add(tx.user_id);
  }

  for (const [bankId, userIds] of bankMap) {
    if (userIds.size < 2) continue;

    const dedupKey = `shared-bank:${bankId}`;
    if (isDuplicate(dedupKey, 86400)) continue;

    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", [...userIds]);
    const emails = (profiles ?? []).map((p: any) => p.email).join(", ");

    const embed = new EmbedBuilder()
      .setColor(COLORS.warning as ColorResolvable)
      .setTitle("🏦 Shared Bank Account Detected")
      .addFields(
        { name: "Bank Account", value: `\`${bankId.slice(0, 8)}…\``, inline: true },
        { name: "Users Sharing", value: String(userIds.size), inline: true },
        { name: "Emails", value: emails.slice(0, 300), inline: false },
      )
      .setTimestamp();

    await sendToChannel(client, "fraud_alerts", { embeds: [embed] });
  }
}
