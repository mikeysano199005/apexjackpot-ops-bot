import { Client, TextChannel } from "discord.js";
import { getChannel, sendToChannel } from "../lib/channels";
import { getBotConfig, createIncident, getOpenIncidents } from "../supabase";
import { COLORS, fmtDuration } from "../lib/embeds";
import { EmbedBuilder, ColorResolvable } from "discord.js";
import { config } from "../config";

const downSince: Record<string, number | null> = {
  app: null,
  aeropay: null,
  watchpay: null,
};

async function ping(url: string): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export async function runHealthCheck(client: Client) {
  const [app, aeropay, watchpay] = await Promise.all([
    ping(`${config.appUrl}/api/health`),
    config.aeropayHealthUrl ? ping(config.aeropayHealthUrl) : Promise.resolve(null),
    config.watchpayHealthUrl ? ping(config.watchpayHealthUrl) : Promise.resolve(null),
  ]);

  const checks: Array<{ key: string; label: string; result: { ok: boolean; ms: number } | null }> = [
    { key: "app", label: "App", result: app },
    { key: "aeropay", label: "AeroPay", result: aeropay },
    { key: "watchpay", label: "WatchPay", result: watchpay },
  ];

  for (const check of checks) {
    const { key, label, result } = check;
    if (!result) continue;

    if (!result.ok && downSince[key] === null) {
      downSince[key] = Date.now();

      const embed = new EmbedBuilder()
        .setColor(COLORS.error as ColorResolvable)
        .setTitle(`🔴 ${label} Gateway DOWN`)
        .setDescription(`**${label}** is not responding. Latency: ${result.ms}ms`)
        .setTimestamp();

      await sendToChannel(client, "gateway_status", { content: "@here", embeds: [embed] });

      const openIncidents = await getOpenIncidents();
      const alreadyOpen = openIncidents.some(i => i.title.includes(label));
      if (!alreadyOpen) {
        await createIncident({ title: `${label} Gateway Down`, opened_by: "bot", opened_at: new Date().toISOString() });
        await sendToChannel(client, "incidents", {
          content: "@here",
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.error as ColorResolvable)
              .setTitle("🚨 AUTO-INCIDENT OPENED")
              .setDescription(`**${label}** gateway is DOWN. An incident has been automatically created.`)
              .setTimestamp(),
          ],
        });
      }
    } else if (result.ok && downSince[key] !== null) {
      const duration = fmtDuration(Date.now() - downSince[key]!);
      downSince[key] = null;

      const embed = new EmbedBuilder()
        .setColor(COLORS.success as ColorResolvable)
        .setTitle(`🟢 ${label} Gateway Restored`)
        .addFields(
          { name: "Downtime", value: duration, inline: true },
          { name: "Latency", value: `${result.ms}ms`, inline: true },
        )
        .setTimestamp();

      await sendToChannel(client, "gateway_status", { embeds: [embed] });
    }
  }
}
