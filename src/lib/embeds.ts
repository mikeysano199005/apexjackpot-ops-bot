import { EmbedBuilder, ColorResolvable } from "discord.js";
import { config, ENV_COLORS, ENV_LABEL } from "../config";

export const COLORS = {
  success: 0x2ecc71,
  error: 0xe74c3c,
  warning: 0xf39c12,
  info: 0x3498db,
  neutral: 0x95a5a6,
  purple: 0x9b59b6,
  teal: 0x1abc9c,
  orange: 0xe67e22,
} as const;

export function fmt(cents: number): string {
  return "₹" + (cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) + " IST";
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

export function baseEmbed(color: ColorResolvable = COLORS.info): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(ENV_COLORS[config.environment] as ColorResolvable)
    .setTimestamp()
    .setFooter({ text: `ApexJackpot Ops · ${ENV_LABEL[config.environment]}` });
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder()
    .setColor(COLORS.success as ColorResolvable)
    .setTitle(`✅ ${title}`)
    .setTimestamp()
    .setFooter({ text: `ApexJackpot Ops · ${ENV_LABEL[config.environment]}` });
  if (description) e.setDescription(description);
  return e;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder()
    .setColor(COLORS.error as ColorResolvable)
    .setTitle(`❌ ${title}`)
    .setTimestamp()
    .setFooter({ text: `ApexJackpot Ops · ${ENV_LABEL[config.environment]}` });
  if (description) e.setDescription(description);
  return e;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const e = new EmbedBuilder()
    .setColor(COLORS.warning as ColorResolvable)
    .setTitle(`⚠️ ${title}`)
    .setTimestamp()
    .setFooter({ text: `ApexJackpot Ops · ${ENV_LABEL[config.environment]}` });
  if (description) e.setDescription(description);
  return e;
}
