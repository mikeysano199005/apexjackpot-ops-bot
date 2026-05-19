import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { setOncall, getOncall, getOncallAll, addSubscription, removeSubscription, startShift, endShift } from "../supabase";
import { COLORS, fmtTime, fmtDuration } from "../lib/embeds";

export const oncallCommand = {
  data: new SlashCommandBuilder()
    .setName("oncall")
    .setDescription("On-call management")
    .addSubcommand(s => s
      .setName("set")
      .setDescription("Set on-call person for a role")
      .addStringOption(o => o.setName("role").setDescription("Role").setRequired(true).addChoices(
        { name: "Finance", value: "Finance" },
        { name: "Support", value: "Support" },
        { name: "DevOps", value: "DevOps" },
      ))
      .addUserOption(o => o.setName("user").setDescription("User to set as on-call").setRequired(true)))
    .addSubcommand(s => s.setName("status").setDescription("Show current on-call roster")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "BotAdmin")) {
      await interaction.reply({ content: "❌ You need @BotAdmin role.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const role = interaction.options.getString("role", true);
      const user = interaction.options.getUser("user", true);
      await setOncall(role, user.id, user.tag);
      await interaction.editReply(`✅ **${user.tag}** is now on-call for **${role}**.`);
    }

    if (sub === "status") {
      const roles = ["Finance", "Support", "DevOps"];
      const entries = await Promise.all(roles.map(r => getOncall(r)));
      const embed = new EmbedBuilder()
        .setColor(COLORS.info as ColorResolvable)
        .setTitle("📟 On-Call Roster")
        .addFields(roles.map((r, i) => {
          const e = entries[i];
          return { name: r, value: e ? `<@${e.discord_id}> (${e.discord_tag})` : "— Not set", inline: true };
        }))
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export const shiftCommand = {
  data: new SlashCommandBuilder()
    .setName("shift")
    .setDescription("Shift tracking")
    .addSubcommand(s => s.setName("start").setDescription("Start your shift"))
    .addSubcommand(s => s
      .setName("end")
      .setDescription("End your shift")
      .addStringOption(o => o.setName("notes").setDescription("Shift handoff notes").setRequired(false)))
    .addSubcommand(s => s.setName("report").setDescription("Show your active shift info")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "ReadOnly")) {
      await interaction.reply({ content: "❌ Insufficient permissions.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === "start") {
      const shift = await startShift(interaction.user.id, interaction.user.tag);
      if (!shift) { await interaction.editReply("❌ You already have an active shift."); return; }
      await interaction.editReply(`✅ Shift started at ${fmtTime(shift.started_at)}.`);
    }

    if (sub === "end") {
      const notes = interaction.options.getString("notes") ?? "";
      const shift = await endShift(interaction.user.id, notes);
      if (!shift) { await interaction.editReply("❌ No active shift found."); return; }
      const duration = fmtDuration(Date.now() - new Date(shift.started_at).getTime());
      await interaction.editReply(`✅ Shift ended. Duration: **${duration}**.${notes ? `\nNotes: ${notes}` : ""}`);
    }

    if (sub === "report") {
      await interaction.editReply("ℹ️ Shift tracking is active. Use `/shift end` to close your shift.");
    }
  },
};

export const subscribeCommand = {
  data: new SlashCommandBuilder()
    .setName("subscribe")
    .setDescription("Subscribe to DM alerts for an event type")
    .addStringOption(o => o.setName("event").setDescription("Event type").setRequired(true).addChoices(
      { name: "All Withdrawals", value: "withdrawal_requested" },
      { name: "Failed Deposits", value: "deposit_failed" },
      { name: "KYC Submissions", value: "kyc_submitted" },
      { name: "Velocity Alerts", value: "velocity_alert" },
      { name: "Gateway Down", value: "gateway_down" },
      { name: "ML Pending Approvals", value: "ml_withdrawal_pending" },
      { name: "Big Wins", value: "big_win" },
    )),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const event = interaction.options.getString("event", true);
    await addSubscription(interaction.user.id, event);
    await interaction.editReply(`✅ Subscribed to **${event}** DM alerts.`);
  },
};

export const unsubscribeCommand = {
  data: new SlashCommandBuilder()
    .setName("unsubscribe")
    .setDescription("Unsubscribe from DM alerts for an event type")
    .addStringOption(o => o.setName("event").setDescription("Event type").setRequired(true).addChoices(
      { name: "All Withdrawals", value: "withdrawal_requested" },
      { name: "Failed Deposits", value: "deposit_failed" },
      { name: "KYC Submissions", value: "kyc_submitted" },
      { name: "Velocity Alerts", value: "velocity_alert" },
      { name: "Gateway Down", value: "gateway_down" },
      { name: "ML Pending Approvals", value: "ml_withdrawal_pending" },
      { name: "Big Wins", value: "big_win" },
    )),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const event = interaction.options.getString("event", true);
    await removeSubscription(interaction.user.id, event);
    await interaction.editReply(`✅ Unsubscribed from **${event}** DM alerts.`);
  },
};
