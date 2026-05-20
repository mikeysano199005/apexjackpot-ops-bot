import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { supabase, addToWatchlist, removeFromWatchlist, getWatchlist, addBlacklist, removeBlacklist, checkBlacklist } from "../supabase";
import { COLORS, fmtTime } from "../lib/embeds";
import { config } from "../config";

async function callApp(path: string, body: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${config.appUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bot-secret": config.botSecret },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ success: boolean; error?: string }>;
}

// Looks up user_id by email — tries profiles table first, falls back to auth.admin
async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id) return profile.id;

  // Fall back to auth admin API (works even if profiles has no email column)
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data) return null;
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    return found?.id ?? null;
  } catch {
    return null;
  }
}

const banCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Ban reason").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "Support")) {
      await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
    }
    await interaction.deferReply({ ephemeral: true });
    const email = interaction.options.getString("email", true);
    const reason = interaction.options.getString("reason", true);
    const userId = await getUserIdByEmail(email);
    if (!userId) { await interaction.editReply("❌ User not found."); return; }
    const result = await callApp("/api/admin/users/ban", { userId, reason });
    await interaction.editReply(result.success ? `✅ User ${email} banned.` : `❌ ${result.error}`);
  },
};

const unbanCommand = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "Support")) {
      await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
    }
    await interaction.deferReply({ ephemeral: true });
    const email = interaction.options.getString("email", true);
    const userId = await getUserIdByEmail(email);
    if (!userId) { await interaction.editReply("❌ User not found."); return; }
    const result = await callApp("/api/admin/users/unban", { userId });
    await interaction.editReply(result.success ? `✅ User ${email} unbanned.` : `❌ ${result.error}`);
  },
};

const watchCommand = {
  data: new SlashCommandBuilder()
    .setName("watch")
    .setDescription("Add user to watchlist")
    .addSubcommand(s => s
      .setName("add")
      .setDescription("Watch a user")
      .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)))
    .addSubcommand(s => s
      .setName("remove")
      .setDescription("Remove from watchlist")
      .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("View watchlist")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "Support")) {
      await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
    }
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const email = interaction.options.getString("email", true).toLowerCase().trim();
      const reason = interaction.options.getString("reason", true);
      const userId = await getUserIdByEmail(email);
      if (!userId) { await interaction.editReply("❌ User not found."); return; }
      await addToWatchlist({
        user_id: userId,
        user_email: email,
        reason,
        added_by: interaction.user.id,
        added_at: new Date().toISOString(),
      });
      await interaction.editReply(`✅ **${email}** added to watchlist.\nYou'll be alerted in #watchlist-alerts on their next action.`);
    }

    if (sub === "remove") {
      const email = interaction.options.getString("email", true).toLowerCase().trim();
      const userId = await getUserIdByEmail(email);
      if (!userId) { await interaction.editReply("❌ User not found."); return; }
      await removeFromWatchlist(userId);
      await interaction.editReply(`✅ **${email}** removed from watchlist.`);
    }

    if (sub === "list") {
      const list = await getWatchlist();
      if (list.length === 0) {
        await interaction.editReply("📋 Watchlist is empty.");
        return;
      }

      // Split into pages of 10 to stay within embed limits
      const page = list.slice(0, 20);
      const embed = new EmbedBuilder()
        .setColor(COLORS.warning as ColorResolvable)
        .setTitle(`👁️ Watchlist (${list.length} user${list.length !== 1 ? "s" : ""})`)
        .setDescription(
          page.map((w, i) =>
            `**${i + 1}.** \`${w.user_email}\`\n  Reason: ${w.reason}\n  Added: ${fmtTime(w.added_at)}`,
          ).join("\n\n"),
        )
        .setTimestamp()
        .setFooter({ text: list.length > 20 ? `Showing first 20 of ${list.length}` : "ApexJackpot Ops" });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

const blacklistCommand = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Manage blacklist")
    .addSubcommand(s => s
      .setName("add")
      .setDescription("Blacklist a value")
      .addStringOption(o => o.setName("type").setDescription("Type").setRequired(true).addChoices(
        { name: "IP", value: "ip" }, { name: "Email", value: "email" },
        { name: "Phone", value: "phone" }, { name: "Bank Account", value: "bank_account" },
      ))
      .addStringOption(o => o.setName("value").setDescription("Value to blacklist").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)))
    .addSubcommand(s => s
      .setName("remove")
      .setDescription("Remove from blacklist")
      .addStringOption(o => o.setName("type").setDescription("Type").setRequired(true).addChoices(
        { name: "IP", value: "ip" }, { name: "Email", value: "email" },
        { name: "Phone", value: "phone" }, { name: "Bank Account", value: "bank_account" },
      ))
      .addStringOption(o => o.setName("value").setDescription("Value").setRequired(true)))
    .addSubcommand(s => s
      .setName("check")
      .setDescription("Check if a value is blacklisted")
      .addStringOption(o => o.setName("value").setDescription("Value to check").setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "Support")) {
      await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
    }
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const type = interaction.options.getString("type", true);
      const value = interaction.options.getString("value", true);
      const reason = interaction.options.getString("reason", true);
      await addBlacklist(type, value, reason, interaction.user.tag);
      await interaction.editReply(`✅ \`${value}\` (${type}) blacklisted.`);
    }
    if (sub === "remove") {
      const type = interaction.options.getString("type", true);
      const value = interaction.options.getString("value", true);
      await removeBlacklist(type, value);
      await interaction.editReply(`✅ \`${value}\` removed from blacklist.`);
    }
    if (sub === "check") {
      const value = interaction.options.getString("value", true);
      const result = await checkBlacklist(value);
      if (result) await interaction.editReply(`🔴 **Blacklisted** (${result.type}): ${result.reason}`);
      else await interaction.editReply(`✅ \`${value}\` is not blacklisted.`);
    }
  },
};

export const moderationCommands = [banCommand, unbanCommand, watchCommand, blacklistCommand];
