import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { setupRoles, getRoleMap } from "../setup/roles";
import { setupChannels, CATEGORY_DEFS } from "../setup/channels";
import { getChannelMap } from "../supabase";
import { COLORS } from "../lib/embeds";

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Bot server setup")
    .addSubcommand(s => s.setName("run").setDescription("Run full server setup — creates all channels and roles"))
    .addSubcommand(s => s.setName("reset").setDescription("Tear down and recreate all channels and roles"))
    .addSubcommand(s => s.setName("status").setDescription("Check which channels exist vs missing")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "BotAdmin")) {
      await interaction.reply({ content: "❌ You need @BotAdmin role.", ephemeral: true }); return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "run" || sub === "reset") {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild!;

      if (sub === "reset") {
        // Delete all bot-managed channels
        const channelMap = await getChannelMap();
        for (const id of Object.values(channelMap)) {
          if (!id) continue;
          try {
            const ch = await guild.channels.fetch(id);
            await ch?.delete("Bot setup reset");
          } catch {}
        }
      }

      const roleMap = await setupRoles(guild);
      const channelMap = await setupChannels(guild, roleMap);
      const count = Object.keys(channelMap).length;

      const embed = new EmbedBuilder()
        .setColor(COLORS.success as ColorResolvable)
        .setTitle("✅ Bot Setup Complete")
        .setDescription(`Created **${count}** channels across **${CATEGORY_DEFS.length}** categories.\nRoles: ${Object.keys(roleMap).join(", ")}`)
        .addFields({ name: "Next Steps", value: "1. Assign @BotAdmin to yourself\n2. Set on-call staff with `/oncall set`\n3. Configure thresholds with `/config`" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "status") {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild!;
      const channelMap = await getChannelMap();
      const allKeys = CATEGORY_DEFS.flatMap(c => c.channels.map(ch => ch.key));
      const lines: string[] = [];

      for (const key of allKeys) {
        const id = channelMap[key];
        if (!id) { lines.push(`❌ \`${key}\` — missing`); continue; }
        try {
          await guild.channels.fetch(id);
          lines.push(`✅ \`${key}\``);
        } catch {
          lines.push(`⚠️ \`${key}\` — saved but not found`);
        }
      }

      await interaction.editReply({ content: lines.join("\n") });
    }
  },
};
