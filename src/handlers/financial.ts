import { Client, EmbedBuilder, ColorResolvable } from "discord.js";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt, fmtTime } from "../lib/embeds";
import { getBotConfig } from "../supabase";

export async function handleDepositCompleted(client: Client, p: Record<string, unknown>) {
  const cfg = await getBotConfig();
  const amount = Number(p.amount_cents ?? 0);
  const isLarge = amount >= (cfg.large_deposit_threshold_cents as number);

  const embed = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle("💵 Deposit Completed")
    .addFields(
      { name: "Amount", value: fmt(amount), inline: true },
      { name: "Gateway", value: String(p.gateway ?? "—"), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Order No", value: String(p.order_id ?? "—"), inline: true },
      { name: "Time", value: fmtTime(String(p.timestamp ?? new Date().toISOString())), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });

  await sendToChannel(client, "deposits", { embeds: [embed] });
  await sendToChannel(client, "live_feed", { content: `💵 Deposit **${fmt(amount)}** via ${String(p.gateway ?? "—")} · ${String(p.email ?? "—")}` });

  if (isLarge) {
    const bigEmbed = new EmbedBuilder()
      .setColor(COLORS.orange as ColorResolvable)
      .setTitle("🚨 Large Deposit Alert")
      .addFields(
        { name: "Amount", value: fmt(amount), inline: true },
        { name: "User", value: String(p.email ?? "—"), inline: true },
        { name: "Gateway", value: String(p.gateway ?? "—"), inline: true },
      )
      .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
    await sendToChannel(client, "big_alerts", { content: "@here", embeds: [bigEmbed] });
  }
}

export async function handleDepositFailed(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("❌ Deposit Failed")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "Gateway", value: String(p.gateway ?? "—"), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Error", value: String(p.error ?? "Unknown"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "deposits", { embeds: [embed] });
}

export async function handleWithdrawalRequested(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle("📤 Withdrawal Requested")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Bank", value: `${String(p.bank_name ?? "—")} ···${String(p.account_last4 ?? "—")}`, inline: true },
      { name: "Order No", value: String(p.order_id ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "withdrawals", { embeds: [embed] });
}

export async function handleWithdrawalApproved(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle("✅ Withdrawal Approved")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Approved By", value: String(p.approved_by ?? "—"), inline: true },
      { name: "Time to Approve", value: String(p.time_to_approve ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "withdrawals", { embeds: [embed] });
  await sendToChannel(client, "live_feed", { content: `✅ Withdrawal **${fmt(Number(p.amount_cents ?? 0))}** approved for ${String(p.email ?? "—")}` });
}

export async function handleWithdrawalFailed(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("❌ Withdrawal Failed")
    .addFields(
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Order No", value: String(p.order_id ?? "—"), inline: true },
      { name: "Error", value: String(p.error ?? "AeroPay error"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "withdrawals", { embeds: [embed] });
  await sendToChannel(client, "gateway_status", { embeds: [embed] });
}

export async function handleBonusCredited(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.purple as ColorResolvable)
    .setTitle("🎁 Bonus Credited")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "Code", value: String(p.promo_code ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "bonus_tracking", { embeds: [embed] });
}

export async function handleCommissionPaid(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.teal as ColorResolvable)
    .setTitle("💰 Commission Paid")
    .addFields(
      { name: "Agent", value: String(p.agent_email ?? "—"), inline: true },
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "Referral Count", value: String(p.referral_count ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "agent_commissions", { embeds: [embed] });
}

export async function handleRefundIssued(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info as ColorResolvable)
    .setTitle("↩️ Refund Issued")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Amount", value: fmt(Number(p.amount_cents ?? 0)), inline: true },
      { name: "Issued By", value: String(p.issued_by ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "refunds", { embeds: [embed] });
}
