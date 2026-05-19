import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { supabase } from "../supabase";
import { COLORS, fmt } from "../lib/embeds";

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Platform statistics")
    .addSubcommand(s => s.setName("today").setDescription("Today's stats"))
    .addSubcommand(s => s.setName("week").setDescription("Last 7 days stats"))
    .addSubcommand(s => s.setName("snapshot").setDescription("Instant platform snapshot — balances, pending counts, gateway")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "ReadOnly")) {
      await interaction.reply({ content: "❌ Insufficient permissions.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const since = sub === "today" ? startOfToday : startOfWeek;

    if (sub === "today" || sub === "week") {
      const { data: txs } = await supabase
        .from("transactions")
        .select("type, amount_cents, status, created_at")
        .gte("created_at", since.toISOString());

      const { data: newUsers } = await supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .gte("created_at", since.toISOString());

      const rows = (txs ?? []) as Array<{ type: string; amount_cents: number; status: string }>;
      const completedDeps = rows.filter(t => t.type === "deposit" && t.status === "completed");
      const completedWdrs = rows.filter(t => t.type === "withdraw" && t.status === "completed");
      const pendingWdrs = rows.filter(t => t.type === "withdraw" && t.status === "pending");
      const failedDeps = rows.filter(t => t.type === "deposit" && t.status === "failed");

      const totalDep = completedDeps.reduce((s, t) => s + t.amount_cents, 0);
      const totalWdr = completedWdrs.reduce((s, t) => s + t.amount_cents, 0);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info as ColorResolvable)
        .setTitle(`📊 ${sub === "today" ? "Today's" : "Last 7 Days"} Stats`)
        .addFields(
          { name: "💵 Deposits", value: `${fmt(totalDep)}\n${completedDeps.length} transactions`, inline: true },
          { name: "📤 Withdrawals", value: `${fmt(totalWdr)}\n${completedWdrs.length} transactions`, inline: true },
          { name: "📈 Net Flow", value: fmt(totalDep - totalWdr), inline: true },
          { name: "⏳ Pending Withdrawals", value: `${pendingWdrs.length} requests\n${fmt(pendingWdrs.reduce((s, t) => s + t.amount_cents, 0))}`, inline: true },
          { name: "❌ Failed Deposits", value: String(failedDeps.length), inline: true },
          { name: "👤 New Users", value: String((newUsers as any)?.length ?? 0), inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "snapshot") {
      const [
        { data: balances },
        { count: pendingWdrCount },
        { count: pendingKycCount },
        { count: userCount },
      ] = await Promise.all([
        supabase.from("profiles").select("role, ml_balance_cents, ml_blocked_cents").eq("role", "ml"),
        supabase.from("transactions").select("id", { count: "exact" }).eq("type", "withdraw").eq("status", "pending"),
        supabase.from("kyc_submissions").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "user"),
      ]);

      const bals = (balances ?? []) as Array<{ ml_balance_cents: number; ml_blocked_cents: number }>;
      const totalMlBalance = bals.reduce((s, p) => s + (p.ml_balance_cents ?? 0), 0);
      const totalMlBlocked = bals.reduce((s, p) => s + (p.ml_blocked_cents ?? 0), 0);

      const embed = new EmbedBuilder()
        .setColor(COLORS.teal as ColorResolvable)
        .setTitle("📸 Platform Snapshot")
        .addFields(
          { name: "Total Users", value: String(userCount ?? 0), inline: true },
          { name: "Pending Withdrawals", value: String(pendingWdrCount ?? 0), inline: true },
          { name: "Pending KYC", value: String(pendingKycCount ?? 0), inline: true },
          { name: "Total ML Balance", value: fmt(totalMlBalance), inline: true },
          { name: "Total ML Blocked", value: fmt(totalMlBlocked), inline: true },
          { name: "ML Available", value: fmt(totalMlBalance - totalMlBlocked), inline: true },
        )
        .setTimestamp().setFooter({ text: "Live snapshot" });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
