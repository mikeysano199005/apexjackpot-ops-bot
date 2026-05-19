import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { supabase } from "../supabase";
import { COLORS, fmt, fmtTime } from "../lib/embeds";
import { generateUserRiskProfile } from "../lib/claude";

export const userCommand = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("User lookup and management")
    .addSubcommand(s => s
      .setName("lookup")
      .setDescription("Look up a user by email")
      .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)))
    .addSubcommand(s => s
      .setName("risk")
      .setDescription("AI-generated risk profile for a user")
      .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)))
    .addSubcommand(s => s
      .setName("tx")
      .setDescription("Last 10 transactions for a user")
      .addStringOption(o => o.setName("email").setDescription("User email").setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "ReadOnly")) {
      await interaction.reply({ content: "❌ You need at least @ReadOnly role.", ephemeral: true }); return;
    }

    const sub = interaction.options.getSubcommand();
    const email = interaction.options.getString("email", true).toLowerCase().trim();
    await interaction.deferReply({ ephemeral: true });

    if (sub === "lookup") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, email, role, created_at, ml_balance_cents")
        .eq("email", email).single();

      if (!profile) { await interaction.editReply("❌ User not found."); return; }

      const { data: txSummary } = await supabase
        .from("transactions")
        .select("type, amount_cents, status")
        .eq("user_id", profile.id);

      const txRows = (txSummary ?? []) as Array<{ type: string; amount_cents: number; status: string }>;
      const deposited = txRows.filter(t => t.type === "deposit" && t.status === "completed").reduce((s, t) => s + t.amount_cents, 0);
      const withdrawn = txRows.filter(t => t.type === "withdraw" && t.status === "completed").reduce((s, t) => s + t.amount_cents, 0);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info as ColorResolvable)
        .setTitle(`👤 ${String(profile.display_name ?? "—")}`)
        .addFields(
          { name: "Email", value: String(profile.email), inline: true },
          { name: "Role", value: String(profile.role), inline: true },
          { name: "User ID", value: `\`${profile.id}\``, inline: false },
          { name: "Registered", value: fmtTime(profile.created_at), inline: true },
          { name: "Total Deposited", value: fmt(deposited), inline: true },
          { name: "Total Withdrawn", value: fmt(withdrawn), inline: true },
          { name: "Net", value: fmt(deposited - withdrawn), inline: true },
          ...(profile.ml_balance_cents ? [{ name: "ML Balance", value: fmt(profile.ml_balance_cents), inline: true }] : []),
        )
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ban_user:${profile.id}:${profile.email}`).setLabel("🚫 Ban").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`watch_user:${profile.id}:${profile.email}`).setLabel("👁 Watch").setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (sub === "risk") {
      const { data: profile } = await supabase.from("profiles").select("id, email").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      const profile_text = await generateUserRiskProfile(profile.id, profile.email);
      await interaction.editReply({ content: `**🤖 Risk Profile — ${email}**\n\n${profile_text}` });
    }

    if (sub === "tx") {
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      const { data: txs } = await supabase
        .from("transactions")
        .select("type, amount_cents, status, created_at, gateway_order_id")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!txs || txs.length === 0) { await interaction.editReply("No transactions found."); return; }
      const lines = txs.map(t =>
        `${t.type === "deposit" ? "💵" : "📤"} **${fmt(t.amount_cents)}** · \`${t.status}\` · ${fmtTime(t.created_at)}`
      );
      await interaction.editReply({ content: `**Last transactions for ${email}:**\n${lines.join("\n")}` });
    }
  },
};
