import { Interaction } from "discord.js";
import { commands } from "../commands";
import { handleButtonInteraction, handleModalSubmit } from "../buttons";

export async function handleInteractionCreate(_client: unknown, interaction: Interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = commands.find(c => c.data.name === interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
      return;
    }
  } catch (err) {
    console.error("[interactionCreate] Unhandled error:", err);
    const msg = err instanceof Error ? `${err.message}` : "An unexpected error occurred.";
    try {
      if ("replied" in interaction && "deferred" in interaction) {
        const i = interaction as any;
        if (i.replied || i.deferred) {
          await i.editReply({ content: `❌ Error: ${msg}` });
        } else {
          await i.reply({ content: `❌ Error: ${msg}`, ephemeral: true });
        }
      }
    } catch (replyErr) {
      console.error("[interactionCreate] Failed to send error reply:", replyErr);
    }
  }
}
