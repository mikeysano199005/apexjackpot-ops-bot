import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from "discord.js";
import { hasRole } from "../lib/permissions";
import { COLORS } from "../lib/embeds";
import { config } from "../config";

async function pingGateway(url: string): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export const healthCommand = {
  data: new SlashCommandBuilder()
    .setName("health")
    .setDescription("Platform and gateway health check"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!hasRole(interaction.member as any, "ReadOnly")) {
      await interaction.reply({ content: "❌ Insufficient permissions.", ephemeral: true }); return;
    }

    await interaction.deferReply({ ephemeral: true });

    const [app, aeropay, watchpay] = await Promise.all([
      pingGateway(`${config.appUrl}/api/health`),
      config.aeropayHealthUrl ? pingGateway(config.aeropayHealthUrl) : Promise.resolve(null),
      config.watchpayHealthUrl ? pingGateway(config.watchpayHealthUrl) : Promise.resolve(null),
    ]);

    const statusLine = (label: string, result: { ok: boolean; ms: number } | null) => {
      if (!result) return `⬜ ${label} — not configured`;
      return `${result.ok ? "🟢" : "🔴"} ${label} — ${result.ok ? "Online" : "DOWN"} (${result.ms}ms)`;
    };

    const allOk = app.ok && (aeropay?.ok ?? true) && (watchpay?.ok ?? true);

    const embed = new EmbedBuilder()
      .setColor((allOk ? COLORS.success : COLORS.error) as ColorResolvable)
      .setTitle(allOk ? "✅ All Systems Operational" : "🔴 Service Degraded")
      .setDescription([
        statusLine("App", app),
        statusLine("AeroPay", aeropay),
        statusLine("WatchPay", watchpay),
      ].join("\n"))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
