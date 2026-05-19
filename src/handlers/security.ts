import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable } from "discord.js";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt } from "../lib/embeds";

export async function handleVelocityAlert(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle("⚡ Velocity Alert")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Event", value: String(p.event_type ?? "—"), inline: true },
      { name: "Count", value: `${String(p.count ?? "?")} in ${String(p.window_minutes ?? "?")} min`, inline: true },
      { name: "Total Amount", value: p.total_cents ? fmt(Number(p.total_cents)) : "—", inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · Security" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ban_user:${p.user_id}:${p.email}`).setLabel("🚫 Ban User").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`watch_user:${p.user_id}:${p.email}`).setLabel("👁 Watch User").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dismiss_alert:${p.alert_id ?? "unknown"}`).setLabel("✅ Dismiss").setStyle(ButtonStyle.Success),
  );
  await sendToChannel(client, "velocity_alerts", { embeds: [embed], components: [row] });
}

export async function handleIpMultiAccount(client: Client, p: Record<string, unknown>) {
  const accounts = (p.accounts as string[]) ?? [];
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("🌐 Multi-Account IP Detected")
    .addFields(
      { name: "IP Address", value: `\`${String(p.ip ?? "—")}\``, inline: true },
      { name: "Account Count", value: String(accounts.length), inline: true },
      { name: "Accounts", value: accounts.slice(0, 10).join("\n") || "—", inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · Security" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`blacklist_ip:${p.ip}`).setLabel("🔒 Blacklist IP").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`dismiss_alert:ip_${p.ip}`).setLabel("✅ False Positive").setStyle(ButtonStyle.Success),
  );
  await sendToChannel(client, "ip_flags", { embeds: [embed], components: [row] });
}

export async function handleFraudPattern(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle(`🚨 Fraud Pattern: ${String(p.pattern ?? "Unknown")}`)
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Pattern", value: String(p.pattern ?? "—"), inline: true },
      { name: "Details", value: String(p.details ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · Security" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ban_user:${p.user_id}:${p.email}`).setLabel("🚫 Ban User").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`watch_user:${p.user_id}:${p.email}`).setLabel("👁 Watch User").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dismiss_alert:fraud_${p.user_id}`).setLabel("✅ Dismiss").setStyle(ButtonStyle.Success),
  );
  await sendToChannel(client, "fraud_flags", { embeds: [embed], components: [row] });
}

export async function handleBonusAbuse(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.orange as ColorResolvable)
    .setTitle("🎁 Bonus Abuse Detected")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Promo Code", value: String(p.promo_code ?? "—"), inline: true },
      { name: "Issue", value: String(p.reason ?? "—"), inline: false },
      { name: "Redemptions from IP", value: String(p.ip_count ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · Security" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ban_user:${p.user_id}:${p.email}`).setLabel("🚫 Ban User").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`watch_user:${p.user_id}:${p.email}`).setLabel("👁 Watch").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dismiss_alert:bonus_${p.user_id}`).setLabel("✅ Dismiss").setStyle(ButtonStyle.Success),
  );
  await sendToChannel(client, "fraud_flags", { embeds: [embed], components: [row] });
}

export async function handleBankAccountShared(client: Client, p: Record<string, unknown>) {
  const users = (p.users as string[]) ?? [];
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("🏦 Shared Bank Account Detected")
    .addFields(
      { name: "Account", value: `···${String(p.account_last4 ?? "—")} (${String(p.bank_name ?? "—")})`, inline: true },
      { name: "User Count", value: String(users.length), inline: true },
      { name: "Users", value: users.slice(0, 5).join("\n") || "—", inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · Security" });
  await sendToChannel(client, "fraud_flags", { embeds: [embed] });
}
