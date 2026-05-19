import { REST, Routes } from "discord.js";
import { config } from "../config";
import { setupCommand } from "./setup";
import { userCommand } from "./user";
import { mlCommand } from "./ml";
import { statsCommand } from "./stats";
import { healthCommand } from "./health";
import { incidentCommand } from "./incident";
import { configCommand } from "./config";
import { moderationCommands } from "./moderation";
import { oncallCommand, shiftCommand, subscribeCommand, unsubscribeCommand } from "./oncall";
import { askCommand, riskCommand } from "./ask";

export const commands = [
  setupCommand,
  userCommand,
  mlCommand,
  statsCommand,
  healthCommand,
  incidentCommand,
  configCommand,
  ...moderationCommands,
  oncallCommand,
  shiftCommand,
  subscribeCommand,
  unsubscribeCommand,
  askCommand,
  riskCommand,
];

export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.botToken);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands.map(c => c.data.toJSON()),
  });
  console.log(`[commands] Registered ${commands.length} slash commands`);
}
