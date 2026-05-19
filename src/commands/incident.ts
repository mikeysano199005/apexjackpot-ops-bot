import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { createIncident, resolveIncident, getOpenIncidents } from "../supabase";
import { COLORS, fmtDuration, fmtTime } from "../lib/embeds";

export const incidentCommand = {
  data: new SlashCommandBuilder()
    .setName("incident")
    .setDescription("Incident management")
    .addSubcommand(s => s
      .setName("open")
      .setDescription("Open a new incident")
      .addStringOption(o => o.setName("title").setDescription("Incident title").setRequired(true)))
    .addSubcommand(s => s
      .setName("resolve")
      .setDescription("Resolve an incident")
      .addStringOption(o => o.setName("id").setDescription("Incident ID (first 8 chars)").setRequired(true))
      .addStringOption(o => o.setName("summary").setDescription("Resolution summary").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List open incidents")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "DevOps")) {
      await interaction.reply({ content: "❌ You need @DevOps role.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: false });
    const sub = interaction.options.getSubcommand();

    if (sub === "open") {
      const title = interaction.options.getString("title", true);
      const incident = await createIncident({
        title,
        opened_by: interaction.user.tag,
        opened_at: new Date().toISOString(),
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.error as ColorResolvable)
        .setTitle(`🚨 INCIDENT OPENED`)
        .addFields(
          { name: "Title", value: title, inline: false },
          { name: "ID", value: `\`${incident?.id?.slice(0, 8).toUpperCase() ?? "—"}\``, inline: true },
          { name: "Opened By", value: interaction.user.tag, inline: true },
        )
        .setDescription("Resolve with `/incident resolve <id> <summary>`")
        .setTimestamp();

      await interaction.editReply({ content: "@here", embeds: [embed] });
    }

    if (sub === "resolve") {
      const id = interaction.options.getString("id", true);
      const summary = interaction.options.getString("summary", true);
      const incidents = await getOpenIncidents();
      const incident = incidents.find(i => i.id.startsWith(id.toLowerCase()));

      if (!incident) { await interaction.editReply("❌ Incident not found or already resolved."); return; }

      await resolveIncident(incident.id, summary);
      const duration = fmtDuration(Date.now() - new Date(incident.opened_at).getTime());

      const embed = new EmbedBuilder()
        .setColor(COLORS.success as ColorResolvable)
        .setTitle("✅ Incident Resolved")
        .addFields(
          { name: "Title", value: incident.title, inline: false },
          { name: "Duration", value: duration, inline: true },
          { name: "Resolved By", value: interaction.user.tag, inline: true },
          { name: "Summary", value: summary, inline: false },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "list") {
      const incidents = await getOpenIncidents();
      if (incidents.length === 0) { await interaction.editReply("✅ No open incidents."); return; }

      const embed = new EmbedBuilder()
        .setColor(COLORS.error as ColorResolvable)
        .setTitle(`🚨 Open Incidents (${incidents.length})`)
        .setDescription(incidents.map(i => {
          const age = fmtDuration(Date.now() - new Date(i.opened_at).getTime());
          return `**\`${i.id.slice(0, 8).toUpperCase()}\`** — ${i.title}\nOpened by ${i.opened_by} · ${age} ago`;
        }).join("\n\n"))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
