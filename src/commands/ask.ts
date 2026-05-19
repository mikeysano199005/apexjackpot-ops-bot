import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { askClaude, generateUserRiskProfile } from "../lib/claude";
import { COLORS } from "../lib/embeds";

export const askCommand = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Claude an AI-powered question about the platform")
    .addStringOption(o => o.setName("question").setDescription("Your question").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "Finance")) {
      await interaction.reply({ content: "❌ You need @Finance or higher role.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: true });
    const question = interaction.options.getString("question", true);

    try {
      const answer = await askClaude(question);
      const chunks = splitMessage(answer, 1900);

      const embed = new EmbedBuilder()
        .setColor(COLORS.purple as ColorResolvable)
        .setTitle("🤖 AI Insight")
        .setDescription(chunks[0])
        .setFooter({ text: `Asked by ${interaction.user.tag} · Powered by Claude` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        const cont = new EmbedBuilder()
          .setColor(COLORS.purple as ColorResolvable)
          .setDescription(chunks[i]);
        await interaction.followUp({ embeds: [cont], ephemeral: true });
      }
    } catch (err) {
      await interaction.editReply(`❌ Claude error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

export const riskCommand = {
  data: new SlashCommandBuilder()
    .setName("risk")
    .setDescription("Generate AI risk profile for a user")
    .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "Support")) {
      await interaction.reply({ content: "❌ You need @Support or higher role.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: true });
    const email = interaction.options.getString("email", true);

    try {
      const { supabase } = await import("../supabase");
      const { data: profile } = await supabase.from("profiles").select("id, email").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }

      const report = await generateUserRiskProfile(profile.id, email);
      const chunks = splitMessage(report, 1900);

      const embed = new EmbedBuilder()
        .setColor(COLORS.warning as ColorResolvable)
        .setTitle(`🔍 Risk Profile — ${email}`)
        .setDescription(chunks[0])
        .setFooter({ text: `Requested by ${interaction.user.tag} · Powered by Claude` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        const cont = new EmbedBuilder()
          .setColor(COLORS.warning as ColorResolvable)
          .setDescription(chunks[i]);
        await interaction.followUp({ embeds: [cont], ephemeral: true });
      }
    } catch (err) {
      await interaction.editReply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let chunk = remaining.slice(0, maxLength);
    const lastNewline = chunk.lastIndexOf("\n");
    if (lastNewline > maxLength * 0.6) chunk = chunk.slice(0, lastNewline);
    chunks.push(chunk);
    remaining = remaining.slice(chunk.length).trimStart();
  }
  return chunks;
}
