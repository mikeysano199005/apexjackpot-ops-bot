import { startBot } from "./bot";
import { startServer } from "./server";

async function main() {
  console.log("[main] Starting ApexJackpot Ops Bot...");

  const client = await startBot();
  startServer(client);

  process.on("unhandledRejection", (err) => {
    console.error("[main] Unhandled rejection:", err);
  });

  process.on("SIGTERM", () => {
    console.log("[main] SIGTERM received, shutting down...");
    client.destroy();
    process.exit(0);
  });
}

main().catch(err => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
