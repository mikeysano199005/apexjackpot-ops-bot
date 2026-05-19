import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable } from "discord.js";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt, fmtTime } from "../lib/embeds";
import { getOncallForRole } from "../supabase";

export async function handleMlWithdrawalPending(client: Client, p: Record<string, unknown>) {
  const amount = Number(p.amount_cents ?? 0);
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle("⏳ ML Withdrawal Pending Approval")
    .addFields(
      { name: "Amount", value: fmt(amount), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Order No", value: String(p.order_id ?? "—"), inline: true },
      { name: "Bank", value: `${String(p.bank_name ?? "—")} ···${String(p.account_last4 ?? "—")}`, inline: true },
      { name: "IFSC", value: String(p.ifsc ?? "—"), inline: true },
      { name: "Requested", value: fmtTime(String(p.timestamp ?? new Date().toISOString())), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Panel" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ml_force_approve:${p.transaction_id}`).setLabel("✅ Force Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ml_force_reject:${p.transaction_id}`).setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ml_view_user:${p.user_id}`).setLabel("👁 View User").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`watch_user:${p.user_id}:${p.email}`).setLabel("🚫 Watch User").setStyle(ButtonStyle.Secondary),
  );

  const msg = await (await (await client.channels.fetch("placeholder"))?.fetch?.() as any);
  await sendToChannel(client, "ml_pending_approvals", { embeds: [embed], components: [row] });
  await sendToChannel(client, "live_feed", { content: `⏳ ML withdrawal **${fmt(amount)}** pending — ${String(p.email ?? "—")}` });

  // DM on-call Finance
  const oncallId = await getOncallForRole("Finance");
  if (oncallId) {
    try {
      const user = await client.users.fetch(oncallId);
      await user.send({ content: `💰 New ML withdrawal pending: **${fmt(amount)}** from ${String(p.email ?? "—")} — Order: \`${String(p.order_id ?? "—")}\``, embeds: [embed] });
    } catch {}
  }
}

export async function handleMlWithdrawalApproved(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle("✅ ML Withdrawal Approved")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Approved By", value: String(p.approved_by ?? "—"), inline: true },
      { name: "Order No", value: String(p.order_id ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Panel" });
  await sendToChannel(client, "ml_pending_approvals", { embeds: [embed] });
  await sendToChannel(client, "live_feed", { content: `✅ ML withdrawal **${fmt(Number(p.amount_cents ?? 0))}** approved by ${String(p.approved_by ?? "—")}` });
}

export async function handleMlWithdrawalForceApproved(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.purple as ColorResolvable)
    .setTitle("⚡ ML Withdrawal Force-Approved by Admin")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Admin", value: String(p.admin ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Panel" });
  await sendToChannel(client, "ml_pending_approvals", { embeds: [embed] });
  await sendToChannel(client, "ml_audit", { embeds: [embed] });
}

export async function handleMlWithdrawalRejected(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("❌ ML Withdrawal Rejected")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Rejected By", value: String(p.rejected_by ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Panel" });
  await sendToChannel(client, "ml_pending_approvals", { embeds: [embed] });
}

export async function handleMlTopupRequested(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info as ColorResolvable)
    .setTitle("💳 ML Top-Up Request")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Amount Requested", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "Current Balance", value: fmt(Number(p.current_balance ?? 0)), inline: true },
      { name: "Reason", value: String(p.reason ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Panel" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ml_topup_approve:${p.request_id}`).setLabel("✅ Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ml_topup_reject:${p.request_id}`).setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
  );
  await sendToChannel(client, "ml_topup_requests", { embeds: [embed], components: [row] });
}

export async function handleMlPinLocked(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("🔒 ML PIN Locked")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Attempts", value: String(p.attempts ?? "3"), inline: true },
      { name: "Source", value: String(p.source ?? "—"), inline: true },
      { name: "Locked Until", value: p.locked_until ? fmtTime(String(p.locked_until)) : "15 minutes", inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Security" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ml_unlock_pin:${p.user_id}`).setLabel("🔓 Unlock PIN").setStyle(ButtonStyle.Success),
  );
  await sendToChannel(client, "ml_security", { embeds: [embed], components: [row] });
}

export async function handleMlPinEvent(client: Client, p: Record<string, unknown>, eventType: string) {
  const labels: Record<string, string> = {
    "ml.pin_set": "🔑 PIN Set",
    "ml.pin_changed": "🔄 PIN Changed",
    "ml.pin_failed": "⚠️ Wrong PIN Attempt",
    "ml.pin_unlocked_by_admin": "🔓 PIN Unlocked by Admin",
  };
  const colors: Record<string, number> = {
    "ml.pin_set": COLORS.success,
    "ml.pin_changed": COLORS.info,
    "ml.pin_failed": COLORS.warning,
    "ml.pin_unlocked_by_admin": COLORS.teal,
  };
  const embed = new EmbedBuilder()
    .setColor((colors[eventType] ?? COLORS.neutral) as ColorResolvable)
    .setTitle(labels[eventType] ?? eventType)
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Security" });
  await sendToChannel(client, "ml_security", { embeds: [embed] });
}

export async function handleMlBalanceAdjusted(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(p.direction === "add" ? COLORS.success as ColorResolvable : COLORS.error as ColorResolvable)
    .setTitle(`${p.direction === "add" ? "➕" : "➖"} ML Balance Adjusted`)
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Direction", value: String(p.direction ?? "—").toUpperCase(), inline: true },
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "New Balance", value: fmt(Number(p.new_balance ?? 0)), inline: true },
      { name: "Adjusted By", value: String(p.admin ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Audit" });
  await sendToChannel(client, "ml_audit", { embeds: [embed] });
}

export async function handleMlLimitsUpdated(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info as ColorResolvable)
    .setTitle("⚙️ ML Limits Updated")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Updated By", value: String(p.admin ?? "—"), inline: true },
      { name: "Changes", value: JSON.stringify(p.changes ?? {}, null, 2).slice(0, 1024), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Audit" });
  await sendToChannel(client, "ml_audit", { embeds: [embed] });
}

export async function handleMlLargeWithdrawal(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.orange as ColorResolvable)
    .setTitle("🚨 Large ML Withdrawal")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Bank", value: `${String(p.bank_name ?? "—")} ···${String(p.account_last4 ?? "—")}`, inline: true },
      { name: "Approved By", value: String(p.approved_by ?? "—"), inline: true },
      { name: "Order No", value: String(p.order_id ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · ML Panel" });
  await sendToChannel(client, "big_alerts", { content: "@here 🚨 Large ML withdrawal!", embeds: [embed] });
}
