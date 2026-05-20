import { Client, TextChannel, EmbedBuilder, ColorResolvable } from "discord.js";
import { supabase, getBotConfig, getPinnedMessageId, savePinnedMessageId } from "../supabase";
import { getChannel } from "../lib/channels";
import { COLORS, fmt, fmtTime } from "../lib/embeds";

async function upsertPinnedMessage(channel: TextChannel, key: string, embed: EmbedBuilder) {
  const existingId = await getPinnedMessageId(key);
  try {
    if (existingId) {
      const msg = await channel.messages.fetch(existingId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
        return;
      }
    }
  } catch { /* message deleted, create new one */ }

  const newMsg = await channel.send({ embeds: [embed] });
  try { await newMsg.pin(); } catch { /* ignore pin errors */ }
  await savePinnedMessageId(key, newMsg.id);
}

export async function updatePlatformStatusBoard(client: Client) {
  const channel = await getChannel(client, "pinned_dashboard");
  if (!(channel instanceof TextChannel)) return;

  const [
    { count: userCount },
    { count: pendingWdr },
    { count: pendingKyc },
    { data: balances },
    { count: activeToday },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact" }).eq("role", "user"),
    supabase.from("transactions").select("id", { count: "exact" }).eq("status", "pending").eq("type", "withdraw"),
    supabase.from("kyc_submissions").select("id", { count: "exact" }).eq("status", "pending"),
    supabase.from("profiles").select("ml_balance_cents, ml_blocked_cents").eq("role", "ml"),
    supabase.from("profiles").select("id", { count: "exact" }).gte("last_seen_at", new Date(Date.now() - 86400000).toISOString()),
  ]);

  type Bal = { ml_balance_cents?: number; ml_blocked_cents?: number };
  const balRows = (balances ?? []) as Bal[];
  const totalMlBalance = balRows.reduce((s, p) => s + (p.ml_balance_cents ?? 0), 0);
  const totalMlBlocked = balRows.reduce((s, p) => s + (p.ml_blocked_cents ?? 0), 0);

  const allOk = (pendingWdr ?? 0) < 20 && (pendingKyc ?? 0) < 10;

  const embed = new EmbedBuilder()
    .setColor((allOk ? COLORS.success : COLORS.warning) as ColorResolvable)
    .setTitle("📊 Platform Status Board")
    .addFields(
      { name: "👤 Total Users", value: String(userCount ?? 0), inline: true },
      { name: "🌐 Active (24h)", value: String(activeToday ?? 0), inline: true },
      { name: "​", value: "​", inline: true },
      { name: "⏳ Pending Withdrawals", value: String(pendingWdr ?? 0), inline: true },
      { name: "📋 Pending KYC", value: String(pendingKyc ?? 0), inline: true },
      { name: "​", value: "​", inline: true },
      { name: "💳 ML Total Balance", value: fmt(totalMlBalance), inline: true },
      { name: "🔒 ML Blocked", value: fmt(totalMlBlocked), inline: true },
      { name: "✅ ML Available", value: fmt(totalMlBalance - totalMlBlocked), inline: true },
    )
    .setFooter({ text: `Auto-updated every 5 minutes · Last: ${fmtTime(new Date().toISOString())}` });

  await upsertPinnedMessage(channel, "platform-status-board", embed);
}

export async function updateMlQueueBoard(client: Client) {
  const channel = await getChannel(client, "ml_pending_approvals");
  if (!(channel instanceof TextChannel)) return;

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, user_id, amount_cents, created_at, gateway_order_id")
    .eq("type", "withdraw").eq("status", "pending")
    .filter("meta->>source", "eq", "ml")
    .order("created_at", { ascending: true })
    .limit(15);

  const count = txs?.length ?? 0;
  let desc = count === 0 ? "✅ No pending ML withdrawals." : "";

  if (count > 0) {
    type QTx = { id: string; user_id: string; amount_cents: number; created_at: string };
    const qTxs = (txs ?? []) as QTx[];
    const userIds = [...new Set(qTxs.map(t => t.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    desc = qTxs.map((t, i) => {
      const age = Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000);
      const email = (profileMap[t.user_id] as any)?.email ?? "—";
      const flag = age > 30 ? "🔴" : age > 15 ? "🟡" : "🟢";
      return `${flag} **${i + 1}.** ${fmt(t.amount_cents)} · ${email} · ${age}m · \`${t.id.slice(0, 8)}\``;
    }).join("\n");
  }

  const embed = new EmbedBuilder()
    .setColor((count === 0 ? COLORS.success : count > 10 ? COLORS.error : COLORS.warning) as ColorResolvable)
    .setTitle(`⏳ ML Queue (${count})`)
    .setDescription(desc)
    .setFooter({ text: `Auto-updated every 5 minutes · ${fmtTime(new Date().toISOString())}` });

  await upsertPinnedMessage(channel, "ml-queue-board", embed);
}

export async function updateChannelTopics(client: Client) {
  const updates: Array<{ key: string; topic: string }> = [
    { key: "withdrawals", topic: `Live withdrawal feed · ${fmtTime(new Date().toISOString())}` },
    { key: "deposits", topic: `Live deposit feed · ${fmtTime(new Date().toISOString())}` },
    { key: "ml_pending_approvals", topic: `ML withdrawal queue — check pinned board for counts` },
  ];

  await Promise.allSettled(updates.map(async ({ key, topic }) => {
    const ch = await getChannel(client, key as any);
    if (ch instanceof TextChannel) {
      await ch.setTopic(topic).catch(() => {});
    }
  }));
}
