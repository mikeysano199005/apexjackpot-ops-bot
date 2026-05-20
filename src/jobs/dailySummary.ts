import { Client, EmbedBuilder, ColorResolvable } from "discord.js";
import { supabase } from "../supabase";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt } from "../lib/embeds";
import { generateNightlySummary } from "../lib/claude";

export async function runDailySummary(client: Client) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [
    { data: txs },
    { count: newUsers },
    { count: kycCount },
    { count: bannedCount },
    { count: fraudAlerts },
  ] = await Promise.all([
    supabase.from("transactions").select("type, amount_cents, status").gte("created_at", since),
    supabase.from("profiles").select("id", { count: "exact" }).gte("created_at", since),
    supabase.from("kyc_submissions").select("id", { count: "exact" }).gte("created_at", since),
    supabase.from("audit_logs").select("id", { count: "exact" }).eq("action", "ban_user").gte("created_at", since),
    supabase.from("audit_logs").select("id", { count: "exact" }).like("action", "fraud_%").gte("created_at", since),
  ]);

  type TxRow = { type: string; amount_cents: number; status: string };
  const allTxs = (txs ?? []) as TxRow[];
  const completed = allTxs.filter(t => t.status === "completed");
  const deps = completed.filter(t => t.type === "deposit");
  const wdrs = completed.filter(t => t.type === "withdraw");
  const totalDep = deps.reduce((s, t) => s + t.amount_cents, 0);
  const totalWdr = wdrs.reduce((s, t) => s + t.amount_cents, 0);
  const failed = allTxs.filter(t => t.status === "failed").length;

  let aiSummary = "";
  try {
    aiSummary = await generateNightlySummary();
  } catch (err) {
    aiSummary = "*AI summary unavailable.*";
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.info as ColorResolvable)
    .setTitle(`📅 Daily Summary — ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`)
    .addFields(
      { name: "💵 Deposits", value: `${fmt(totalDep)}\n${deps.length} transactions`, inline: true },
      { name: "📤 Withdrawals", value: `${fmt(totalWdr)}\n${wdrs.length} transactions`, inline: true },
      { name: "📈 Net Flow", value: fmt(totalDep - totalWdr), inline: true },
      { name: "👤 New Users", value: String(newUsers ?? 0), inline: true },
      { name: "📋 KYC Submitted", value: String(kycCount ?? 0), inline: true },
      { name: "❌ Failed Txs", value: String(failed), inline: true },
      { name: "🚫 Users Banned", value: String(bannedCount ?? 0), inline: true },
      { name: "⚠️ Fraud Alerts", value: String(fraudAlerts ?? 0), inline: true },
    )
    .addFields({ name: "🤖 AI Digest", value: aiSummary.slice(0, 1024) || "*No notable events.*" })
    .setTimestamp()
    .setFooter({ text: "Daily digest · Generated at 9:00 IST" });

  await sendToChannel(client, "daily_summary", { embeds: [embed] });
}
