import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { supabase } from "../supabase";
import { COLORS, fmt, fmtTime } from "../lib/embeds";
import { config } from "../config";

async function callApp(path: string, body: Record<string, unknown>): Promise<{ success: boolean; error?: string; [key: string]: unknown }> {
  const res = await fetch(`${config.appUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bot-secret": config.botSecret },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ success: boolean; error?: string; [key: string]: unknown }>;
}

export const mlCommand = {
  data: new SlashCommandBuilder()
    .setName("ml")
    .setDescription("ML panel commands")
    .addSubcommand(s => s.setName("pending").setDescription("List all pending ML withdrawals"))
    .addSubcommand(s => s.setName("balance").setDescription("Check ML balance").addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)))
    .addSubcommand(s => s.setName("limits").setDescription("View ML limits").addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)))
    .addSubcommand(s => s.setName("unlock").setDescription("Unlock ML PIN").addStringOption(o => o.setName("email").setDescription("User email").setRequired(true)))
    .addSubcommand(s => s.setName("topup").setDescription("List pending ML top-up requests"))
    .addSubcommand(s => s.setName("history").setDescription("ML transaction history").addStringOption(o => o.setName("email").setDescription("User email").setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "Finance")) {
      await interaction.reply({ content: "❌ You need @Finance role.", ephemeral: true }); return;
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (sub === "pending") {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, user_id, amount_cents, created_at, gateway_order_id, meta")
        .eq("type", "withdraw").eq("status", "pending")
        .filter("meta->>source", "eq", "ml")
        .order("created_at", { ascending: true });

      if (!txs || txs.length === 0) { await interaction.editReply("✅ No pending ML withdrawals."); return; }

      type PendingTx = { id: string; user_id: string; amount_cents: number; created_at: string; gateway_order_id?: string };
      const pending = txs as PendingTx[];
      const userIds = [...new Set(pending.map(t => t.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, email").in("id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      const embed = new EmbedBuilder()
        .setColor(COLORS.warning as ColorResolvable)
        .setTitle(`⏳ ${pending.length} Pending ML Withdrawal${pending.length !== 1 ? "s" : ""}`)
        .setDescription(pending.map((t, i) => {
          const p = profileMap[t.user_id] as any;
          const age = Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000);
          return `**${i + 1}.** ${fmt(t.amount_cents)} · ${p?.email ?? "—"} · ${age}m ago · \`${t.gateway_order_id?.slice(0, 12) ?? t.id.slice(0, 8)}\``;
        }).join("\n"))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "balance") {
      const email = interaction.options.getString("email", true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, email, ml_balance_cents, ml_blocked_cents, ml_pin, ml_pin_locked_until")
        .eq("email", email).single();

      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      const p = profile as Record<string, unknown>;
      const balance = Number(p.ml_balance_cents ?? 0);
      const blocked = Number(p.ml_blocked_cents ?? 0);
      const pinLocked = p.ml_pin_locked_until ? new Date(String(p.ml_pin_locked_until)) > new Date() : false;

      const embed = new EmbedBuilder()
        .setColor(COLORS.info as ColorResolvable)
        .setTitle(`💳 ML Balance — ${email}`)
        .addFields(
          { name: "Balance", value: fmt(balance), inline: true },
          { name: "Blocked", value: fmt(blocked), inline: true },
          { name: "Available", value: fmt(balance - blocked), inline: true },
          { name: "PIN Set", value: p.ml_pin ? "✅ Yes" : "❌ No", inline: true },
          { name: "PIN Status", value: pinLocked ? "🔒 Locked" : "✅ OK", inline: true },
        ).setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "limits") {
      const email = interaction.options.getString("email", true);
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      const res = await fetch(`${config.appUrl}/api/admin/ml/limits?userId=${profile.id}`, {
        headers: { "x-bot-secret": config.botSecret },
      });
      const data = await res.json() as Record<string, unknown>;
      const embed = new EmbedBuilder()
        .setColor(COLORS.info as ColorResolvable)
        .setTitle(`⚙️ ML Limits — ${email}`)
        .addFields(
          { name: "Daily Limit", value: data.ml_daily_limit_cents ? fmt(Number(data.ml_daily_limit_cents)) : "None", inline: true },
          { name: "Per-Tx Limit", value: data.ml_per_tx_limit_cents ? fmt(Number(data.ml_per_tx_limit_cents)) : "None", inline: true },
          { name: "Cooldown", value: Number(data.ml_approval_cooldown_minutes ?? 0) > 0 ? `${data.ml_approval_cooldown_minutes}m` : "None", inline: true },
          { name: "Window", value: data.ml_approval_window_start === 0 && data.ml_approval_window_end === 23 ? "Any time" : `${data.ml_approval_window_start}:00–${data.ml_approval_window_end}:59 IST`, inline: true },
          { name: "PIN Failed Attempts", value: String(data.pin_failed_attempts ?? 0), inline: true },
          { name: "PIN Locked", value: data.pin_locked ? "🔒 Yes" : "✅ No", inline: true },
        ).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "unlock") {
      const email = interaction.options.getString("email", true);
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      const result = await callApp("/api/admin/ml/limits", { userId: profile.id, action: "unlock_pin" });
      await interaction.editReply(result.success ? "✅ PIN unlocked." : `❌ ${result.error}`);
    }

    if (sub === "topup") {
      const { data: requests } = await supabase
        .from("ml_topup_requests")
        .select("id, user_id, amount_cents, reason, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!requests || requests.length === 0) { await interaction.editReply("✅ No pending top-up requests."); return; }

      type TopupReq = { id: string; user_id: string; amount_cents: number; reason: string };
      const reqs = requests as TopupReq[];
      const userIds = [...new Set(reqs.map(r => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      const lines = reqs.map((r, i) => {
        const p = profileMap[r.user_id] as any;
        return `**${i + 1}.** ${fmt(r.amount_cents)} · ${p?.email ?? "—"} — "${r.reason.slice(0, 40)}"`;
      });
      await interaction.editReply({ content: `**Pending ML Top-Up Requests (${requests.length}):**\n${lines.join("\n")}` });
    }

    if (sub === "history") {
      const email = interaction.options.getString("email", true);
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
      if (!profile) { await interaction.editReply("❌ User not found."); return; }
      const { data: txs } = await supabase
        .from("transactions")
        .select("type, amount_cents, status, created_at, gateway_order_id")
        .eq("user_id", profile.id)
        .filter("meta->>source", "eq", "ml")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!txs || txs.length === 0) { await interaction.editReply("No ML transactions found."); return; }
      type HistTx = { type: string; amount_cents: number; status: string; created_at: string };
      const lines = (txs as HistTx[]).map(t =>
        `${t.type === "deposit" ? "💵" : "📤"} **${fmt(t.amount_cents)}** · \`${t.status}\` · ${fmtTime(t.created_at)}`
      );
      await interaction.editReply({ content: `**ML History for ${email}:**\n${lines.join("\n")}` });
    }
  },
};
