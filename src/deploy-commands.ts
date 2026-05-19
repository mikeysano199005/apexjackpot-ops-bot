import { registerCommands } from "./commands";

registerCommands()
  .then(() => {
    console.log("[deploy] Commands registered successfully.");
    process.exit(0);
  })
  .catch(err => {
    console.error("[deploy] Failed to register commands:", err);
    process.exit(1);
  });
