import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config";
import { handleReady } from "./events/ready";
import { handleInteractionCreate } from "./events/interactionCreate";
import { handleChannelDelete } from "./events/guildChannelDelete";

export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once("ready", () => handleReady(client));
  client.on("interactionCreate", interaction => handleInteractionCreate(client, interaction));
  client.on("channelDelete", channel => {
    if ("guild" in channel && channel.guild) handleChannelDelete(client, channel as any);
  });

  client.on("error", err => console.error("[discord] Client error:", err));
  client.on("warn", msg => console.warn("[discord] Warning:", msg));

  return client;
}

export async function startBot(): Promise<Client> {
  const client = createClient();
  await client.login(config.botToken);
  return client;
}
