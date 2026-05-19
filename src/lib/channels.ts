import { Client, TextChannel } from "discord.js";
import { ChannelKey } from "../types";
import { getChannelMap } from "../supabase";
import { config } from "../config";

let channelCache: Partial<Record<ChannelKey, string>> = {};
let lastLoad = 0;

export async function loadChannels(): Promise<void> {
  channelCache = await getChannelMap();
  lastLoad = Date.now();
}

export async function getChannel(client: Client, key: ChannelKey): Promise<TextChannel | null> {
  if (Date.now() - lastLoad > 60000) await loadChannels();
  const id = channelCache[key];
  if (!id) return null;
  try {
    const ch = await client.channels.fetch(id);
    return ch instanceof TextChannel ? ch : null;
  } catch {
    return null;
  }
}

export async function sendToChannel(client: Client, key: ChannelKey, payload: Parameters<TextChannel["send"]>[0]): Promise<void> {
  const ch = await getChannel(client, key);
  if (!ch) {
    console.warn(`[Bot] Channel not found for key: ${key}`);
    return;
  }
  try {
    await ch.send(payload);
  } catch (err) {
    console.error(`[Bot] Failed to send to channel ${key}:`, err);
  }
}

export function updateCache(map: Partial<Record<ChannelKey, string>>): void {
  channelCache = { ...channelCache, ...map };
  lastLoad = Date.now();
}

export function isQuietHours(quietStart: number, quietEnd: number): boolean {
  const istHour = new Date(Date.now() + 5.5 * 3600000).getUTCHours();
  if (quietStart < quietEnd) return istHour >= quietStart && istHour < quietEnd;
  return istHour >= quietStart || istHour < quietEnd;
}
