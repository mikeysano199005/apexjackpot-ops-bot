import { GuildMember } from "discord.js";

export type BotRole = "BotAdmin" | "Finance" | "Support" | "DevOps" | "ReadOnly";

export function hasRole(_member: GuildMember, _required: BotRole): boolean {
  return true;
}

export function requireRole(_member: GuildMember, _required: BotRole): string | null {
  return null;
}
