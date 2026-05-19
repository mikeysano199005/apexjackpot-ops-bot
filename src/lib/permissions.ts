import { GuildMember } from "discord.js";

export type BotRole = "BotAdmin" | "Finance" | "Support" | "DevOps" | "ReadOnly";

const ROLE_HIERARCHY: Record<BotRole, BotRole[]> = {
  BotAdmin: ["BotAdmin", "Finance", "Support", "DevOps", "ReadOnly"],
  Finance: ["Finance", "ReadOnly"],
  Support: ["Support", "ReadOnly"],
  DevOps: ["DevOps", "ReadOnly"],
  ReadOnly: ["ReadOnly"],
};

export function hasRole(member: GuildMember, required: BotRole): boolean {
  const roleNames = member.roles.cache.map(r => r.name);
  const allowed = ROLE_HIERARCHY[required];
  return roleNames.some(n => allowed.includes(n as BotRole));
}

export function requireRole(member: GuildMember, required: BotRole): string | null {
  if (hasRole(member, required)) return null;
  return `You need the **@${required}** role to use this command.`;
}
