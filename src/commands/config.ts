import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { getBotConfig, setBotConfigKey, getChannelMap, saveChannelMap } from "../supabase";
import { COLORS } from "../lib/embeds";

export const configCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Bot configuration")
    .addSubcommand(s => s.setName("show").setDescription("Show current config"))
    .addSubcommand(s => s.setName("reset").setDescription("Reset config to defaults"))
    .addSubcommand(s => s
      .setName("alert")
      .setDescription("Set alert thresholds")
      .addStringOption(o => o.setName("key").setDescription("Setting key").setRequired(true).addChoices(
        { name: "Large Deposit (₹)", value: "large_deposit_threshold_cents" },
        { name: "Large Withdrawal (₹)", value: "large_withdrawal_threshold_cents" },
        { name: "Big Win Multiplier", value: "big_win_multiplier" },
        { name: "Velocity Window (minutes)", value: "velocity_window_minutes" },
        { name: "Velocity Tx Count Threshold", value: "velocity_tx_count" },
        { name: "Failed Login Threshold", value: "failed_login_threshold" },
        { name: "Dedup Window (seconds)", value: "dedup_window_seconds" },
        { name: "Fraud Sensitivity (1-10)", value: "fraud_sensitivity" },
      ))
      .addStringOption(o => o.setName("value").setDescription("New value").setRequired(true)))
    .addSubcommand(s => s
      .setName("quiet_hours")
      .setDescription("Set quiet hours (IST) — non-critical events suppressed")
      .addIntegerOption(o => o.setName("start").setDescription("Start hour (0-23)").setRequired(true).setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName("end").setDescription("End hour (0-23)").setRequired(true).setMinValue(0).setMaxValue(23)))
    .addSubcommand(s => s
      .setName("pending_alert")
      .setDescription("Set pending item alert windows")
      .addStringOption(o => o.setName("key").setDescription("Window type").setRequired(true).addChoices(
        { name: "Pending Withdrawal Alert (minutes)", value: "pending_withdrawal_alert_minutes" },
        { name: "Pending KYC Alert (hours)", value: "pending_kyc_alert_hours" },
        { name: "Pending Topup Alert (minutes)", value: "pending_topup_alert_minutes" },
      ))
      .addIntegerOption(o => o.setName("value").setDescription("New value").setRequired(true).setMinValue(1))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "BotAdmin")) {
      await interaction.reply({ content: "❌ You need @BotAdmin role.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === "show") {
      const cfg = await getBotConfig();
      const embed = new EmbedBuilder()
        .setColor(COLORS.info as ColorResolvable)
        .setTitle("⚙️ Bot Configuration")
        .addFields(
          { name: "Alert Thresholds", value: [
            `Large Deposit: ₹${((cfg.large_deposit_threshold_cents ?? 500000) / 100).toLocaleString()}`,
            `Large Withdrawal: ₹${((cfg.large_withdrawal_threshold_cents ?? 1000000) / 100).toLocaleString()}`,
            `Big Win Multiplier: ${cfg.big_win_multiplier ?? 10}×`,
            `Velocity Window: ${cfg.velocity_window_minutes ?? 10}m`,
            `Velocity Tx Count: ${cfg.velocity_tx_count ?? 5}`,
            `Failed Login Threshold: ${cfg.failed_login_threshold ?? 3}`,
            `Fraud Sensitivity: ${cfg.fraud_sensitivity ?? 7}/10`,
            `Dedup Window: ${cfg.dedup_window_seconds ?? 30}s`,
          ].join("\n"), inline: false },
          { name: "Quiet Hours (IST)", value: `${cfg.quiet_hours_start ?? 0}:00 – ${cfg.quiet_hours_end ?? 7}:00`, inline: true },
          { name: "Pending Alerts", value: [
            `Withdrawal: ${cfg.pending_withdrawal_alert_minutes ?? 30}m`,
            `KYC: ${cfg.pending_kyc_alert_hours ?? 24}h`,
            `Top-up: ${cfg.pending_topup_alert_minutes ?? 60}m`,
          ].join("\n"), inline: true },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "alert") {
      const key = interaction.options.getString("key", true);
      const rawValue = interaction.options.getString("value", true);
      const value = Number(rawValue);
      if (isNaN(value)) { await interaction.editReply("❌ Value must be a number."); return; }
      await setBotConfigKey(key, value);
      await interaction.editReply(`✅ \`${key}\` set to \`${value}\`.`);
    }

    if (sub === "quiet_hours") {
      const start = interaction.options.getInteger("start", true);
      const end = interaction.options.getInteger("end", true);
      await setBotConfigKey("quiet_hours_start", start);
      await setBotConfigKey("quiet_hours_end", end);
      await interaction.editReply(`✅ Quiet hours set to ${start}:00–${end}:00 IST.`);
    }

    if (sub === "pending_alert") {
      const key = interaction.options.getString("key", true);
      const value = interaction.options.getInteger("value", true);
      await setBotConfigKey(key, value);
      await interaction.editReply(`✅ \`${key}\` set to \`${value}\`.`);
    }

    if (sub === "reset") {
      const defaults: Record<string, number> = {
        large_deposit_threshold_cents: 500000,
        large_withdrawal_threshold_cents: 1000000,
        big_win_multiplier: 10,
        velocity_window_minutes: 10,
        velocity_tx_count: 5,
        failed_login_threshold: 3,
        fraud_sensitivity: 7,
        dedup_window_seconds: 30,
        quiet_hours_start: 0,
        quiet_hours_end: 7,
        pending_withdrawal_alert_minutes: 30,
        pending_kyc_alert_hours: 24,
        pending_topup_alert_minutes: 60,
      };
      await Promise.all(Object.entries(defaults).map(([k, v]) => setBotConfigKey(k, v)));
      await interaction.editReply("✅ Config reset to defaults.");
    }
  },
};
