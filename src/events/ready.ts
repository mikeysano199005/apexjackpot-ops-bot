import { Client, ActivityType } from "discord.js";
import { loadChannels } from "../lib/channels";
import { startJobs } from "../jobs";

export async function handleReady(client: Client) {
  if (!client.user || !client.guilds.cache.size) {
    console.error("[ready] No guild found — run /setup first.");
    return;
  }

  const guild = client.guilds.cache.first()!;
  console.log(`[ready] Logged in as ${client.user.tag} in guild: ${guild.name}`);

  await loadChannels();
  console.log("[ready] Channel cache loaded.");

  client.user.setPresence({
    activities: [{ name: "ApexJackpot ops", type: ActivityType.Watching }],
    status: "online",
  });

  startJobs(client);
  console.log("[ready] Scheduled jobs started.");
}
