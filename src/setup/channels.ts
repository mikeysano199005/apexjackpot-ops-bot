import { Guild, ChannelType, PermissionFlagsBits, CategoryChannel, TextChannel, Role } from "discord.js";
import { ChannelKey } from "../types";
import { saveChannelMap } from "../supabase";
import { updateCache } from "../lib/channels";

export interface ChannelDef {
  key: ChannelKey;
  name: string;
  topic: string;
  roles: string[];
}

export interface CategoryDef {
  name: string;
  emoji: string;
  channels: ChannelDef[];
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    name: "OVERVIEW", emoji: "📊",
    channels: [
      { key: "live_feed", name: "live-feed", topic: "Real-time platform event ticker", roles: ["ReadOnly", "Finance", "Support", "DevOps", "BotAdmin"] },
      { key: "pinned_dashboard", name: "pinned-dashboard", topic: "Platform health snapshot — auto-updated", roles: ["ReadOnly", "Finance", "Support", "DevOps", "BotAdmin"] },
      { key: "daily_summary", name: "daily-summary", topic: "Daily digest — posted at 9am IST", roles: ["ReadOnly", "Finance", "Support", "DevOps", "BotAdmin"] },
      { key: "weekly_digest", name: "weekly-digest", topic: "Weekly analytics — posted Monday 9am IST", roles: ["ReadOnly", "Finance", "Support", "DevOps", "BotAdmin"] },
    ],
  },
  {
    name: "FINANCIAL", emoji: "💰",
    channels: [
      { key: "deposits", name: "deposits", topic: "All deposit events", roles: ["Finance", "BotAdmin"] },
      { key: "withdrawals", name: "withdrawals", topic: "All withdrawal events", roles: ["Finance", "BotAdmin"] },
      { key: "big_alerts", name: "big-alerts", topic: "Large transactions & big wins", roles: ["Finance", "BotAdmin"] },
      { key: "refunds", name: "refunds", topic: "Refunds issued", roles: ["Finance", "BotAdmin"] },
      { key: "bonus_tracking", name: "bonus-tracking", topic: "Bonuses, cashback, promo codes", roles: ["Finance", "BotAdmin"] },
      { key: "agent_commissions", name: "agent-commissions", topic: "Agent & influencer commissions", roles: ["Finance", "BotAdmin"] },
    ],
  },
  {
    name: "ML PANEL", emoji: "🔐",
    channels: [
      { key: "ml_pending_approvals", name: "ml-pending-approvals", topic: "Pending ML withdrawals — use buttons to approve/reject", roles: ["Finance", "BotAdmin"] },
      { key: "ml_topup_requests", name: "ml-topup-requests", topic: "ML balance top-up requests", roles: ["Finance", "BotAdmin"] },
      { key: "ml_security", name: "ml-security", topic: "ML PIN events and security alerts", roles: ["Finance", "BotAdmin"] },
      { key: "ml_audit", name: "ml-audit", topic: "ML balance adjustments and limit changes", roles: ["Finance", "BotAdmin"] },
    ],
  },
  {
    name: "USERS", emoji: "👤",
    channels: [
      { key: "registrations", name: "registrations", topic: "New user registrations and email verifications", roles: ["Support", "BotAdmin"] },
      { key: "kyc_queue", name: "kyc-queue", topic: "KYC submissions — use buttons to approve/reject", roles: ["Support", "BotAdmin"] },
      { key: "bans_suspensions", name: "bans-suspensions", topic: "User bans and suspensions", roles: ["Support", "BotAdmin"] },
      { key: "watchlist_alerts", name: "watchlist-alerts", topic: "Watched user activity alerts", roles: ["Support", "Finance", "BotAdmin"] },
      { key: "role_changes", name: "role-changes", topic: "User role changes", roles: ["Support", "BotAdmin"] },
    ],
  },
  {
    name: "SECURITY", emoji: "🛡️",
    channels: [
      { key: "login_alerts", name: "login-alerts", topic: "Failed logins and account lockouts", roles: ["Support", "BotAdmin"] },
      { key: "suspicious_activity", name: "suspicious-activity", topic: "General suspicious behaviour", roles: ["Support", "BotAdmin"] },
      { key: "velocity_alerts", name: "velocity-alerts", topic: "High-frequency event alerts", roles: ["Support", "Finance", "BotAdmin"] },
      { key: "fraud_flags", name: "fraud-flags", topic: "Fraud pattern detections", roles: ["Support", "Finance", "BotAdmin"] },
      { key: "ip_flags", name: "ip-flags", topic: "Multi-account IP detections", roles: ["Support", "BotAdmin"] },
    ],
  },
  {
    name: "ADMIN", emoji: "⚙️",
    channels: [
      { key: "admin_audit", name: "admin-audit", topic: "All admin panel actions", roles: ["BotAdmin"] },
      { key: "settings_changes", name: "settings-changes", topic: "Platform settings and maintenance changes", roles: ["BotAdmin"] },
      { key: "bulk_operations", name: "bulk-operations", topic: "Bulk admin operations", roles: ["BotAdmin"] },
    ],
  },
  {
    name: "GAMES", emoji: "🎮",
    channels: [
      { key: "big_wins", name: "big-wins", topic: "Big win alerts", roles: ["Finance", "Support", "BotAdmin"] },
      { key: "game_events", name: "game-events", topic: "Games added/toggled", roles: ["Support", "BotAdmin"] },
      { key: "bet_alerts", name: "bet-alerts", topic: "Suspicious betting patterns", roles: ["Support", "BotAdmin"] },
      { key: "voided_results", name: "voided-results", topic: "Voided game results", roles: ["Support", "BotAdmin"] },
    ],
  },
  {
    name: "SYSTEM", emoji: "🤖",
    channels: [
      { key: "health_monitor", name: "health-monitor", topic: "Platform health — auto-updated every 5m", roles: ["DevOps", "BotAdmin"] },
      { key: "gateway_status", name: "gateway-status", topic: "Payment gateway status changes", roles: ["DevOps", "Finance", "BotAdmin"] },
      { key: "deploy_logs", name: "deploy-logs", topic: "Railway deploy events", roles: ["DevOps", "BotAdmin"] },
      { key: "incidents", name: "incidents", topic: "Active incidents", roles: ["DevOps", "BotAdmin"] },
      { key: "errors", name: "errors", topic: "Application errors", roles: ["DevOps", "BotAdmin"] },
      { key: "bot_logs", name: "bot-logs", topic: "Bot internal logs", roles: ["BotAdmin"] },
    ],
  },
  {
    name: "CONFIG", emoji: "🔧",
    channels: [
      { key: "commands_guide", name: "commands-guide", topic: "Full slash command reference — auto-posted by the bot", roles: ["ReadOnly", "Finance", "Support", "DevOps", "BotAdmin"] },
      { key: "bot_commands", name: "bot-commands", topic: "Use slash commands here", roles: ["ReadOnly", "Finance", "Support", "DevOps", "BotAdmin"] },
    ],
  },
];

export async function setupChannels(
  guild: Guild,
  roleMap: Record<string, Role>,
): Promise<Partial<Record<ChannelKey, string>>> {
  const everyone = guild.roles.everyone;
  const channelMap: Partial<Record<ChannelKey, string>> = {};

  for (const catDef of CATEGORY_DEFS) {
    const catName = `${catDef.emoji} ${catDef.name}`;

    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === catName
    ) as CategoryChannel | undefined;

    if (!category) {
      category = await guild.channels.create({
        name: catName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ],
      });
    }

    for (const chDef of catDef.channels) {
      const existing = guild.channels.cache.find(
        c => c.parentId === category!.id && c.name === chDef.name
      ) as TextChannel | undefined;

      const permissionOverwrites = [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...chDef.roles.map(roleName => ({
          id: roleMap[roleName]?.id ?? everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        })),
      ];

      let ch: TextChannel;
      if (existing) {
        ch = existing;
        await ch.edit({ topic: chDef.topic, permissionOverwrites });
      } else {
        ch = await guild.channels.create({
          name: chDef.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: chDef.topic,
          permissionOverwrites,
        });
      }

      channelMap[chDef.key] = ch.id;
    }
  }

  await saveChannelMap(channelMap);
  updateCache(channelMap);
  return channelMap;
}

export async function repairChannel(
  guild: Guild,
  key: ChannelKey,
  roleMap: Record<string, Role>,
): Promise<string | null> {
  for (const catDef of CATEGORY_DEFS) {
    const chDef = catDef.channels.find(c => c.key === key);
    if (!chDef) continue;

    const catName = `${catDef.emoji} ${catDef.name}`;
    const category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === catName
    ) as CategoryChannel | undefined;

    if (!category) return null;

    const everyone = guild.roles.everyone;
    const ch = await guild.channels.create({
      name: chDef.name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: chDef.topic,
      permissionOverwrites: [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...chDef.roles.map(roleName => ({
          id: roleMap[roleName]?.id ?? everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        })),
      ],
    });

    const newMap = { [key]: ch.id } as Partial<Record<ChannelKey, string>>;
    await saveChannelMap(newMap);
    updateCache(newMap);
    return ch.id;
  }
  return null;
}
