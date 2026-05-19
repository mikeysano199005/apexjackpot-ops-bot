import { Client, EmbedBuilder, ColorResolvable } from "discord.js";
import { sendToChannel } from "../lib/channels";
import { COLORS, fmtDuration } from "../lib/embeds";
import { createIncident, resolveIncident, getOpenIncidents } from "../supabase";
import { getOncallForRole } from "../supabase";

const gatewayDownTimes: Record<string, number> = {};

export async function handleGatewayDown(client: Client, p: Record<string, unknown>) {
  const name = String(p.gateway ?? "Unknown");
  gatewayDownTimes[name] = Date.now();

  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle(`🔴 Gateway Down: ${name}`)
    .addFields(
      { name: "Gateway", value: name, inline: true },
      { name: "Error", value: String(p.error ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · System" });

  await sendToChannel(client, "gateway_status", { content: "@here", embeds: [embed] });

  // Auto-open incident
  const incident = await createIncident({
    title: `Gateway Down: ${name}`,
    opened_by: "bot",
    opened_at: new Date().toISOString(),
  });

  if (incident) {
    const incEmbed = new EmbedBuilder()
      .setColor(COLORS.error as ColorResolvable)
      .setTitle(`🚨 INCIDENT #${incident.id.slice(0, 8).toUpperCase()} — Gateway Down: ${name}`)
      .setDescription("Bot auto-opened this incident. Resolve with `/incident resolve <id> <summary>`")
      .setTimestamp().setFooter({ text: "ApexJackpot Ops · Incidents" });
    await sendToChannel(client, "incidents", { content: "@here", embeds: [incEmbed] });
  }

  // DM on-call DevOps and Finance
  for (const role of ["DevOps", "Finance"]) {
    const userId = await getOncallForRole(role);
    if (userId) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(`🔴 **Gateway Down**: ${name} is not responding. Check #gateway-status.`);
      } catch {}
    }
  }
}

export async function handleGatewayUp(client: Client, p: Record<string, unknown>) {
  const name = String(p.gateway ?? "Unknown");
  const downSince = gatewayDownTimes[name];
  const downtime = downSince ? fmtDuration(Date.now() - downSince) : "unknown";
  delete gatewayDownTimes[name];

  const embed = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle(`🟢 Gateway Restored: ${name}`)
    .addFields(
      { name: "Gateway", value: name, inline: true },
      { name: "Downtime", value: downtime, inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · System" });
  await sendToChannel(client, "gateway_status", { embeds: [embed] });
}

export async function handleDeployEvent(client: Client, p: Record<string, unknown>, eventType: string) {
  const labels: Record<string, { title: string; color: number }> = {
    "system.deploy_started": { title: "🚀 Deploy Started", color: COLORS.info },
    "system.deploy_success": { title: "✅ Deploy Succeeded", color: COLORS.success },
    "system.deploy_failed": { title: "❌ Deploy Failed", color: COLORS.error },
  };
  const def = labels[eventType] ?? { title: "Deploy Event", color: COLORS.neutral };

  const embed = new EmbedBuilder()
    .setColor(def.color as ColorResolvable)
    .setTitle(def.title)
    .addFields(
      { name: "Environment", value: String(p.environment ?? "—"), inline: true },
      { name: "Commit", value: `\`${String(p.commit ?? "—").slice(0, 8)}\``, inline: true },
      { name: "Author", value: String(p.author ?? "—"), inline: true },
      { name: "Message", value: String(p.commit_message ?? "—").slice(0, 256), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · System" });

  await sendToChannel(client, "deploy_logs", { embeds: [embed] });

  if (eventType === "system.deploy_failed") {
    const oncallId = await getOncallForRole("DevOps");
    if (oncallId) {
      try {
        const user = await client.users.fetch(oncallId);
        await user.send(`❌ **Deploy failed** in ${String(p.environment ?? "—")}. Check #deploy-logs.`);
      } catch {}
    }
  }
}

export async function handleSystemError(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle("💥 Application Error")
    .addFields(
      { name: "Endpoint", value: String(p.endpoint ?? "—"), inline: true },
      { name: "Error", value: String(p.error ?? "—").slice(0, 512), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · System" });
  await sendToChannel(client, "errors", { embeds: [embed] });
}

export async function handleAdminAction(client: Client, p: Record<string, unknown>) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.neutral as ColorResolvable)
    .setTitle("🛠️ Admin Action")
    .addFields(
      { name: "Action", value: String(p.action_type ?? "—"), inline: true },
      { name: "Admin", value: String(p.admin_email ?? p.admin_id ?? "—"), inline: true },
      { name: "Target", value: String(p.target_user_email ?? p.target_user_id ?? "—"), inline: true },
      ...(p.amount_cents ? [{ name: "Amount", value: `₹${(Number(p.amount_cents) / 100).toFixed(2)}`, inline: true }] : []),
      ...(p.reason ? [{ name: "Reason", value: String(p.reason).slice(0, 512), inline: false }] : []),
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · Admin Audit" });
  await sendToChannel(client, "admin_audit", { embeds: [embed] });
}

export async function handleMaintenanceToggle(client: Client, p: Record<string, unknown>, on: boolean) {
  const embed = new EmbedBuilder()
    .setColor(on ? COLORS.warning as ColorResolvable : COLORS.success as ColorResolvable)
    .setTitle(on ? "🔧 Maintenance Mode ON" : "✅ Maintenance Mode OFF")
    .addFields(
      { name: "By", value: String(p.by ?? "—"), inline: true },
      { name: "Reason", value: String(p.reason ?? "—"), inline: false },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · System" });
  await sendToChannel(client, "settings_changes", { content: "@here", embeds: [embed] });
}

export async function handleBigWin(client: Client, p: Record<string, unknown>) {
  const amount = Number(p.amount_cents ?? 0);
  const embed = new EmbedBuilder()
    .setColor(COLORS.teal as ColorResolvable)
    .setTitle("🏆 Big Win Alert")
    .addFields(
      { name: "Amount", value: `₹${(amount / 100).toFixed(2)}`, inline: true },
      { name: "User", value: String(p.email ?? "—"), inline: true },
      { name: "Game", value: String(p.game ?? "—"), inline: true },
    )
    .setTimestamp().setFooter({ text: "ApexJackpot Ops · Games" });
  await sendToChannel(client, "big_wins", { embeds: [embed] });
  await sendToChannel(client, "big_alerts", { embeds: [embed] });
  await sendToChannel(client, "live_feed", { content: `🏆 Big win **₹${(amount / 100).toFixed(2)}** · ${String(p.email ?? "—")} · ${String(p.game ?? "")}` });
}
