import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable } from "discord.js";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmt, fmtTime, baseEmbed } from "../lib/embeds";

export async function handleUserRegistered(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle("👤 New Registration")
    .addFields(
      { name: "Name", value: String(p.display_name ?? "—"), inline: true },
      { name: "Email", value: String(p.email ?? "—"), inline: true },
      { name: "Role", value: String(p.role ?? "user"), inline: true },
      { name: "IP", value: String(p.ip ?? "—"), inline: true },
      { name: "Referral", value: String(p.referral ?? "Organic"), inline: true },
      { name: "Time", value: fmtTime(String(p.timestamp ?? new Date().toISOString())), inline: true },
    )
    .setTimestamp()
    .setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "registrations", { embeds: [embed] });
  await sendToChannel(client, "live_feed", { content: `👤 **New user**: ${String(p.email ?? "—")}` });
}

export async function handleKycSubmitted(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle("📋 KYC Submitted")
    .addFields(
      { name: "User", value: `${String(p.display_name ?? "—")} (${String(p.email ?? "—")})`, inline: false },
      { name: "User ID", value: String(p.user_id ?? "—"), inline: true },
      { name: "Docs", value: String(p.doc_count ?? "?") + " documents", inline: true },
      { name: "Submitted", value: fmtTime(String(p.timestamp ?? new Date().toISOString())), inline: true },
    )
    .setTimestamp()
    .setFooter({ text: "ApexJackpot Ops" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`kyc_approve:${p.user_id}`).setLabel("✅ Approve KYC").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`kyc_reject:${p.user_id}`).setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`kyc_moredocs:${p.user_id}`).setLabel("📋 Request More Docs").setStyle(ButtonStyle.Secondary),
  );

  await sendToChannel(client, "kyc_queue", { embeds: [embed], components: [row] });
}

export async function handleKycApproved(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle("✅ KYC Approved")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Approved By", value: String(p.approved_by ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "kyc_queue", { embeds: [embed] });
}

export async function handleKycRejected(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("❌ KYC Rejected")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Rejected By", value: String(p.rejected_by ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "No reason given"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "kyc_queue", { embeds: [embed] });
}

export async function handleUserBanned(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("🚫 User Banned")
    .addFields(
      { name: "User", value: `${String(p.display_name ?? "—")} (${String(p.email ?? "—")})`, inline: false },
      { name: "Banned By", value: String(p.banned_by ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "bans_suspensions", { embeds: [embed] });
  await sendToChannel(client, "live_feed", { content: `🚫 **Banned**: ${String(p.email ?? "—")} — ${String(p.reason ?? "")}` });
}

export async function handleUserUnbanned(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle("✅ User Unbanned")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Unbanned By", value: String(p.unbanned_by ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "bans_suspensions", { embeds: [embed] });
}

export async function handleRoleChanged(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info as ColorResolvable)
    .setTitle("🔄 Role Changed")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Old Role", value: String(p.old_role ?? "—"), inline: true },
      { name: "New Role", value: String(p.new_role ?? "—"), inline: true },
      { name: "Changed By", value: String(p.changed_by ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "role_changes", { embeds: [embed] });
}

export async function handleLoginFailed(client: Client, p: Record<string, unknown>) {
  const attempts = Number(p.attempts ?? 1);
  if (attempts < 3) return;
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle(`⚠️ Failed Login Attempts (${attempts})`)
    .addFields(
      { name: "Email", value: String(p.email ?? "—"), inline: true },
      { name: "IP", value: String(p.ip ?? "—"), inline: true },
      { name: "Attempts", value: String(attempts), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "login_alerts", { embeds: [embed] });
}

export async function handleAccountLocked(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("🔒 Account Locked")
    .addFields(
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "IP", value: String(p.ip ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "Too many failed attempts"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops" });
  await sendToChannel(client, "login_alerts", { embeds: [embed] });
}
