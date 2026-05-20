import { Client, ChannelType, PermissionFlagsBits, TextChannel, CategoryChannel } from "discord.js";
import { config } from "../config";
import { supabase } from "../supabase";

const CATEGORY_NAME = "👥 USER ACTIVITY";

function toChannelName(displayName: string, email: string): string {
  const base = (displayName || email.split("@")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return base || "user";
}

export async function getOrCreateUserChannel(
  client: Client,
  userId: string,
  displayName: string,
  email: string,
): Promise<TextChannel | null> {
  const { data: existing } = await supabase
    .from("bot_user_channels")
    .select("channel_id")
    .eq("user_id", userId)
    .single();

  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) return null;

  if (existing?.channel_id) {
    try {
      const ch = await client.channels.fetch(existing.channel_id);
      if (ch instanceof TextChannel) return ch;
    } catch {}
    // Channel deleted — fall through and recreate
  }

  // Get or create the parent category
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME,
  ) as CategoryChannel | undefined;

  if (!category) {
    category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ],
    });
  }

  const allowedRoleNames = ["Finance", "Support", "BotAdmin"];
  const roleOverwrites = guild.roles.cache
    .filter(r => allowedRoleNames.includes(r.name))
    .map(r => ({
      id: r.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    }));

  // Ensure unique channel name within the category
  const baseName = toChannelName(displayName, email);
  let finalName = baseName;
  let suffix = 1;
  while (guild.channels.cache.find(c => c.parentId === category!.id && c.name === finalName)) {
    finalName = `${baseName}-${suffix++}`;
  }

  const ch = await guild.channels.create({
    name: finalName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Activity feed for ${email} · user_id: ${userId}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...roleOverwrites,
    ],
  });

  await supabase.from("bot_user_channels").upsert(
    { user_id: userId, channel_id: ch.id, display_name: displayName, email, created_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  return ch;
}

export async function sendToUserChannel(
  client: Client,
  userId: string,
  payload: Parameters<TextChannel["send"]>[0],
): Promise<void> {
  if (!userId) return;
  const { data } = await supabase
    .from("bot_user_channels")
    .select("channel_id")
    .eq("user_id", userId)
    .single();
  if (!data?.channel_id) return;
  try {
    const ch = await client.channels.fetch(data.channel_id);
    if (ch instanceof TextChannel) await ch.send(payload);
  } catch {}
}
