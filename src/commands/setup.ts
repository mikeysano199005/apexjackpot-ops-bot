import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { setupRoles, getRoleMap } from "../setup/roles";
import { setupChannels, CATEGORY_DEFS } from "../setup/channels";
import { getChannelMap, supabase } from "../supabase";
import { COLORS } from "../lib/embeds";
import { postCommandsGuide } from "../lib/commands-guide";
import { getOrCreateUserChannel } from "../lib/user-channels";

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Bot server setup")
    .addSubcommand(s => s.setName("run").setDescription("Run full server setup — creates all channels and roles"))
    .addSubcommand(s => s.setName("reset").setDescription("Tear down and recreate all channels and roles"))
    .addSubcommand(s => s.setName("status").setDescription("Check which channels exist vs missing"))
    .addSubcommand(s => s.setName("guide").setDescription("Re-post the commands guide to #commands-guide"))
    .addSubcommand(s => s
      .setName("users")
      .setDescription("Create activity channels for all existing users")
      .addIntegerOption(o => o
        .setName("limit")
        .setDescription("Max users to process (default 100, max 400)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(400))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "BotAdmin")) {
      await interaction.reply({ content: "❌ You need @BotAdmin role.", ephemeral: true }); return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "run" || sub === "reset") {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild!;

      if (sub === "reset") {
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

      postCommandsGuide(interaction.client).catch(err => console.error("[Bot] Guide post failed:", err));

      const embed = new EmbedBuilder()
        .setColor(COLORS.success as ColorResolvable)
        .setTitle("✅ Bot Setup Complete")
        .setDescription(`Created **${count}** channels across **${CATEGORY_DEFS.length}** categories.\nRoles: ${Object.keys(roleMap).join(", ")}`)
        .addFields({ name: "Next Steps", value: "1. Assign @BotAdmin to yourself\n2. Set on-call staff with `/oncall set`\n3. Configure thresholds with `/config`\n4. Run `/setup users` to create activity channels for existing users" })
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

    if (sub === "guide") {
      await interaction.deferReply({ ephemeral: true });
      try {
        await postCommandsGuide(interaction.client);
        await interaction.editReply("✅ Commands guide posted to #commands-guide.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await interaction.editReply(`❌ Failed to post guide: ${msg}`);
      }
    }

    if (sub === "users") {
      await interaction.deferReply({ ephemeral: false });

      const limit = interaction.options.getInteger("limit") ?? 100;

      // Fetch users from profiles, ordered by registration date (oldest first so channels appear in order)
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error || !users) {
        await interaction.editReply(`❌ Failed to fetch users: ${error?.message ?? "Unknown error"}`);
        return;
      }

      if (users.length === 0) {
        await interaction.editReply("📋 No users found in the database.");
        return;
      }

      // Check which users already have a channel
      const { data: existing } = await supabase
        .from("bot_user_channels")
        .select("user_id");
      const alreadyHaveChannel = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id));

      const toProcess = users.filter(u => !alreadyHaveChannel.has(u.id));

      if (toProcess.length === 0) {
        await interaction.editReply(`✅ All **${users.length}** users already have activity channels.`);
        return;
      }

      await interaction.editReply(
        `⏳ Creating channels for **${toProcess.length}** users (${alreadyHaveChannel.size} already existed)…`,
      );

      let created = 0;
      let failed = 0;

      for (const user of toProcess) {
        try {
          await getOrCreateUserChannel(
            interaction.client,
            user.id,
            String(user.display_name ?? ""),
            String(user.email ?? `${user.id.slice(0, 8)}@unknown`),
          );
          created++;
        } catch {
          failed++;
        }
        // Small delay to avoid hitting Discord rate limits
        await new Promise(r => setTimeout(r, 600));
      }

      const embed = new EmbedBuilder()
        .setColor(failed === 0 ? COLORS.success as ColorResolvable : COLORS.warning as ColorResolvable)
        .setTitle("👥 User Channels Backfill Complete")
        .addFields(
          { name: "Created", value: String(created), inline: true },
          { name: "Already existed", value: String(alreadyHaveChannel.size), inline: true },
          { name: "Failed", value: String(failed), inline: true },
        )
        .setDescription("All channels are under the **👥 USER ACTIVITY** category.")
        .setTimestamp();

      await interaction.editReply({ content: "", embeds: [embed] });
    }
  },
};
