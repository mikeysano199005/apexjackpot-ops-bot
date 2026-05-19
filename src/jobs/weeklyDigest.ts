import { Client, EmbedBuilder, ColorResolvable } from "discord.js";
import { supabase } from "../supabase";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt } from "../lib/embeds";
import { askClaude } from "../lib/claude";

export async function runWeeklyDigest(client: Client) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    { data: txs },
    { count: newUsers },
    { count: kycApproved },
    { count: kycRejected },
    { count: bannedCount },
    { data: topDepositors },
    { data: mlPending },
  ] = await Promise.all([
    supabase.from("transactions").select("type, amount_cents, status, created_at").gte("created_at", since),
    supabase.from("profiles").select("id", { count: "exact" }).gte("created_at", since),
    supabase.from("kyc_submissions").select("id", { count: "exact" }).eq("status", "approved").gte("updated_at", since),
    supabase.from("kyc_submissions").select("id", { count: "exact" }).eq("status", "rejected").gte("updated_at", since),
    supabase.from("audit_logs").select("id", { count: "exact" }).eq("action", "ban_user").gte("created_at", since),
    supabase.from("transactions")
      .select("user_id, amount_cents")
      .eq("type", "deposit").eq("status", "completed")
      .gte("created_at", since)
      .order("amount_cents", { ascending: false })
      .limit(5),
    supabase.from("transactions")
      .select("id", { count: "exact" })
      .eq("type", "withdraw").eq("status", "pending")
      .filter("meta->>source", "eq", "ml"),
  ]);

  type TxRow = { type: string; amount_cents: number; status: string };
  const allTxs = (txs ?? []) as TxRow[];
  const completed = allTxs.filter(t => t.status === "completed");
  const deps = completed.filter(t => t.type === "deposit");
  const wdrs = completed.filter(t => t.type === "withdraw");
  const totalDep = deps.reduce((s, t) => s + t.amount_cents, 0);
  const totalWdr = wdrs.reduce((s, t) => s + t.amount_cents, 0);
  const failed = allTxs.filter(t => t.status === "failed").length;

  type DepRow = { user_id: string; amount_cents: number };
  const topDeps = (topDepositors ?? []) as DepRow[];
  const topUserIds = [...new Set(topDeps.map(t => t.user_id))];
  const { data: topProfiles } = await supabase.from("profiles").select("id, email").in("id", topUserIds);
  const pMap = Object.fromEntries((topProfiles ?? []).map((p: any) => [p.id, p]));

  const topDepositorsText = topDeps.map((t, i) =>
    `${i + 1}. ${(pMap[t.user_id] as any)?.email ?? "—"} — ${fmt(t.amount_cents)}`
  ).join("\n") || "None";

  let aiInsight = "";
  try {
    const q = `Give a brief 3-point weekly business insight based on: ${deps.length} deposits totaling ${fmt(totalDep)}, ${wdrs.length} withdrawals, ${newUsers ?? 0} new users, ${bannedCount ?? 0} bans this week.`;
    aiInsight = await askClaude(q);
  } catch {
    aiInsight = "*AI insight unavailable.*";
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.purple as ColorResolvable)
    .setTitle(`📆 Weekly Digest — ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" })}`)
    .addFields(
      { name: "💵 Total Deposits", value: `${fmt(totalDep)}\n${deps.length} txs`, inline: true },
      { name: "📤 Total Withdrawals", value: `${fmt(totalWdr)}\n${wdrs.length} txs`, inline: true },
      { name: "📈 Net Flow", value: fmt(totalDep - totalWdr), inline: true },
      { name: "👤 New Signups", value: String(newUsers ?? 0), inline: true },
      { name: "✅ KYC Approved", value: String(kycApproved ?? 0), inline: true },
      { name: "❌ KYC Rejected", value: String(kycRejected ?? 0), inline: true },
      { name: "🚫 Bans", value: String(bannedCount ?? 0), inline: true },
      { name: "❌ Failed Txs", value: String(failed), inline: true },
      { name: "⏳ ML Pending Now", value: String(mlPending ?? 0), inline: true },
      { name: "🏆 Top 5 Depositors", value: topDepositorsText, inline: false },
      { name: "🤖 AI Insights", value: aiInsight.slice(0, 1024), inline: false },
    )
    .setTimestamp()
    .setFooter({ text: "Weekly digest · Every Monday 9:00 IST" });

  await sendToChannel(client, "daily_reports", { embeds: [embed] });
}
