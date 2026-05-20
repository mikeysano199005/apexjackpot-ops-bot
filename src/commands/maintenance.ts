import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { supabase } from "../supabase";
import { sendToChannel } from "../lib/channels";
import { COLORS } from "../lib/embeds";

const SCOPE_CHOICES = [
  { name: "Site (all traffic)", value: "site" },
  { name: "Games", value: "games" },
  { name: "Sports", value: "sports" },
  { name: "Deposits", value: "deposits" },
  { name: "Withdrawals", value: "withdrawals" },
] as const;

const DEFAULT_MESSAGES: Record<string, string> = {
  site: "Site is temporarily under maintenance. Please try again later.",
  games: "Casino games are temporarily unavailable. Please try again later.",
  sports: "Sports betting is temporarily unavailable. Please try again later.",
  deposits: "Deposits are temporarily disabled. Please try again later.",
  withdrawals: "Withdrawals are temporarily disabled. Please try again later.",
};

export const maintenanceCommand = {
  data: new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("Toggle platform maintenance mode")
    .addSubcommand(s => s
      .setName("on")
      .setDescription("Enable maintenance mode for a scope")
      .addStringOption(o => o
        .setName("scope")
        .setDescription("What to put into maintenance")
        .setRequired(true)
        .addChoices(...SCOPE_CHOICES))
      .addStringOption(o => o
        .setName("reason")
        .setDescription("Reason (shown in Discord audit)")
        .setRequired(false)))
    .addSubcommand(s => s
      .setName("off")
      .setDescription("Disable maintenance mode for a scope")
      .addStringOption(o => o
        .setName("scope")
        .setDescription("What to take out of maintenance")
        .setRequired(true)
        .addChoices(...SCOPE_CHOICES))
      .addStringOption(o => o
        .setName("reason")
        .setDescription("Reason (optional)")
        .setRequired(false)))
    .addSubcommand(s => s
      .setName("status")
      .setDescription("Show current maintenance status for all scopes")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "BotAdmin")) {
      await interaction.reply({ content: "❌ You need @BotAdmin role.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === "status") {
      const { data, error } = await supabase
        .from("maintenance_settings")
        .select("key, enabled, updated_at")
        .order("key");

      if (error || !data || data.length === 0) {
        await interaction.editReply("❌ No maintenance settings found. Run the SQL migration first.");
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.info as ColorResolvable)
        .setTitle("🔧 Maintenance Status")
        .addFields(
          data.map(row => ({
            name: String(row.key).charAt(0).toUpperCase() + String(row.key).slice(1),
            value: row.enabled ? "🔴 ON" : "🟢 OFF",
            inline: true,
          })),
        )
        .setTimestamp()
        .setFooter({ text: "ApexJackpot Ops" });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const scope = interaction.options.getString("scope", true);
    const reason = interaction.options.getString("reason") ?? "No reason given";
    const on = sub === "on";

    const updatePayload: Record<string, unknown> = {
      enabled: on,
      updated_by: null,
      updated_at: new Date().toISOString(),
    };
    if (on && DEFAULT_MESSAGES[scope]) {
      updatePayload.message = DEFAULT_MESSAGES[scope];
    }

    const { error } = await supabase
      .from("maintenance_settings")
      .update(updatePayload)
      .eq("key", scope);

    if (error) {
      await interaction.editReply(`❌ Failed to update maintenance: ${error.message}`);
      return;
    }

    const by = interaction.user.tag;

    const embed = new EmbedBuilder()
      .setColor(on ? COLORS.warning as ColorResolvable : COLORS.success as ColorResolvable)
      .setTitle(on ? `🔧 Maintenance ON — ${scope}` : `✅ Maintenance OFF — ${scope}`)
      .addFields(
        { name: "Scope", value: scope, inline: true },
        { name: "Changed By", value: by, inline: true },
        { name: "Reason", value: reason, inline: false },
      )
      .setTimestamp()
      .setFooter({ text: "ApexJackpot Ops · Admin" });

    await sendToChannel(interaction.client, "settings_changes", {
      content: on ? "@here" : undefined,
      embeds: [embed],
    });

    await interaction.editReply(
      `${on ? "🔧 Maintenance **ON**" : "✅ Maintenance **OFF**"} for \`${scope}\`. Posted to #settings-changes.`,
    );
  },
};
