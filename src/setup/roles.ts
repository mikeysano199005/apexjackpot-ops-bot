import { Guild, Role, PermissionFlagsBits } from "discord.js";

export type RoleDef = {
  name: string;
  color: number;
  hoist: boolean;
};

export const ROLE_DEFS: RoleDef[] = [
  { name: "BotAdmin",  color: 0xe74c3c, hoist: true },
  { name: "Finance",   color: 0x2ecc71, hoist: true },
  { name: "Support",   color: 0x3498db, hoist: true },
  { name: "DevOps",    color: 0x9b59b6, hoist: true },
  { name: "ReadOnly",  color: 0x95a5a6, hoist: false },
];

export async function setupRoles(guild: Guild): Promise<Record<string, Role>> {
  const roleMap: Record<string, Role> = {};

  for (const def of ROLE_DEFS) {
    let role = guild.roles.cache.find(r => r.name === def.name);
    if (!role) {
      role = await guild.roles.create({
        name: def.name,
        color: def.color,
        hoist: def.hoist,
        reason: "ApexJackpot Ops Bot setup",
      });
    }
    roleMap[def.name] = role;
  }

  return roleMap;
}

export async function getRoleMap(guild: Guild): Promise<Record<string, Role>> {
  const roleMap: Record<string, Role> = {};
  for (const def of ROLE_DEFS) {
    const role = guild.roles.cache.find(r => r.name === def.name);
    if (role) roleMap[def.name] = role;
  }
  return roleMap;
}
