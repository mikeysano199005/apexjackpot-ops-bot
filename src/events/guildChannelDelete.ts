import { Client, GuildChannel, TextChannel } from "discord.js";
import { getChannelMap } from "../supabase";
import { getChannel, updateCache } from "../lib/channels";
import { repairChannel } from "../setup/channels";
import { getRoleMap } from "../setup/roles";

export async function handleChannelDelete(client: Client, channel: GuildChannel) {
  try {
    const channelMap = await getChannelMap();
    const entry = Object.entries(channelMap).find(([, id]) => id === channel.id);
    if (!entry) return;

    const [key] = entry;
    console.warn(`[channel-repair] Detected deletion of managed channel: ${key} (${channel.name})`);

    const guild = channel.guild;
    const roleMap = await getRoleMap(guild);
    const newChannelId = await repairChannel(guild, key as any, roleMap);

    if (newChannelId) {
      const logChannel = await getChannel(client, "bot_logs");
      if (logChannel instanceof TextChannel) {
        await logChannel.send(
          `⚠️ **Channel auto-repaired:** \`#${channel.name}\` was deleted and has been recreated as <#${newChannelId}>.`,
        );
      }
    }
  } catch (err) {
    console.error("[channel-repair] Error repairing channel:", err);
  }
}
