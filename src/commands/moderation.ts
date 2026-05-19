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
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
    if (!profile) { await interaction.editReply("❌ User not found."); return; }
    const result = await callApp("/api/admin/users/ban", { userId: profile.id, reason });
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
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
    if (!profile) { await interaction.editReply("❌ User not found."); return; }
    const result = await callApp("/api/admin/users/unban", { userId: profile.id });
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
      const email = interaction.options.getString("email", true);
      const reason = interaction.options.getString("reason", true);
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      await addToWatchlist({ user_id: profile.id, user_email: email, reason, added_by: interaction.user.id, added_at: new Date().toISOString() });
      await interaction.editReply(`✅ ${email} added to watchlist. You'll be DM'd on their next action.`);
    }
    if (sub === "remove") {
      const email = interaction.options.getString("email", true);
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      await removeFromWatchlist(profile.id);
      await interaction.editReply(`✅ ${email} removed from watchlist.`);
    }
    if (sub === "list") {
      const list = await getWatchlist();
      if (list.length === 0) { await interaction.editReply("📋 Watchlist is empty."); return; }
      const lines = list.map(w => `• **${w.user_email}** — ${w.reason} (added ${fmtTime(w.added_at)})`);
      await interaction.editReply({ content: `**Watchlist (${list.length}):**\n${lines.join("\n")}` });
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
