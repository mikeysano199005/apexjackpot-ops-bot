import { Client, TextChannel, EmbedBuilder, ColorResolvable } from "discord.js";
import { supabase, getBotConfig, getOncall } from "../supabase";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt, fmtTime } from "../lib/embeds";

export async function checkStaleWithdrawals(client: Client) {
  const cfg = await getBotConfig();
  const thresholdMinutes = cfg.pending_withdrawal_alert_minutes ?? 30;
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("transactions")
    .select("id, user_id, amount_cents, created_at")
    .eq("type", "withdraw").eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (!stale || stale.length === 0) return;

  type StaleRow = { user_id: string; amount_cents: number; created_at: string };
  const rows = stale as StaleRow[];
  const userIds = [...new Set(rows.map(t => t.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);
  const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle(`🚨 ${rows.length} Stale Withdrawal${rows.length !== 1 ? "s" : ""} (>${thresholdMinutes}m)`)
    .setDescription(rows.slice(0, 10).map((t: StaleRow) => {
      const age = Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000);
      return `• ${fmt(t.amount_cents)} · ${(pMap[t.user_id] as any)?.email ?? "—"} · ${age}m old`;
    }).join("\n") + (rows.length > 10 ? `\n…and ${rows.length - 10} more` : ""))
    .setTimestamp();

  await sendToChannel(client, "big_alerts", { content: "@here", embeds: [embed] });

  const oncall = await getOncall("Finance");
  if (oncall) {
    try {
      const dmUser = await client.users.fetch(oncall.discord_id);
      await dmUser.send({ content: `⚠️ **${stale.length} stale withdrawal(s)** pending for >${thresholdMinutes}m. Check <#alerts>.`, embeds: [embed] });
    } catch { /* user has DMs disabled */ }
  }
}

export async function checkStaleKyc(client: Client) {
  const cfg = await getBotConfig();
  const thresholdHours = cfg.pending_kyc_alert_hours ?? 24;
  const cutoff = new Date(Date.now() - thresholdHours * 3600 * 1000).toISOString();

  const { count } = await supabase
    .from("kyc_submissions")
    .select("id", { count: "exact" })
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (!count || count === 0) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle(`📋 ${count} KYC Submission${count !== 1 ? "s" : ""} Pending >${thresholdHours}h`)
    .setDescription(`There are **${count}** KYC submissions awaiting review for over ${thresholdHours} hours.`)
    .setTimestamp();

  await sendToChannel(client, "kyc_queue", { embeds: [embed] });

  const oncall = await getOncall("Support");
  if (oncall) {
    try {
      const dmUser = await client.users.fetch(oncall.discord_id);
      await dmUser.send({ content: `📋 **${count} KYC submission(s)** have been pending for >${thresholdHours}h.`, embeds: [embed] });
    } catch { /* user has DMs disabled */ }
  }
}

export async function checkStaleMlTopups(client: Client) {
  const cfg = await getBotConfig();
  const thresholdMinutes = cfg.pending_topup_alert_minutes ?? 60;
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("ml_topup_requests")
    .select("id", { count: "exact" })
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (!count || count === 0) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle(`💳 ${count} ML Top-Up Request${count !== 1 ? "s" : ""} Pending >${thresholdMinutes}m`)
    .setDescription(`**${count}** ML balance top-up request(s) are awaiting approval.`)
    .setTimestamp();

  await sendToChannel(client, "ml_audit", { embeds: [embed] });
}
