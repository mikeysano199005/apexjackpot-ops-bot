import { Client } from "discord.js";
import cron from "node-cron";
import { runHealthCheck } from "./healthCheck";
import { updatePlatformStatusBoard, updateMlQueueBoard, updateChannelTopics } from "./pinnedBoards";
import { checkStaleWithdrawals, checkStaleKyc, checkStaleMlTopups } from "./pendingMonitor";
import { runVelocityChecks, runIpMultiAccountCheck, runBonusAbuseCheck, runSharedBankCheck } from "./fraudDetection";
import { runDailySummary } from "./dailySummary";
import { runWeeklyDigest } from "./weeklyDigest";

export function startJobs(client: Client) {
  // Gateway health check every 2 minutes
  cron.schedule("*/2 * * * *", () => {
    runHealthCheck(client).catch(err => console.error("[job:healthCheck]", err));
  });

  // Pinned boards + channel topics every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    updatePlatformStatusBoard(client).catch(err => console.error("[job:statusBoard]", err));
    updateMlQueueBoard(client).catch(err => console.error("[job:mlQueue]", err));
    updateChannelTopics(client).catch(err => console.error("[job:topics]", err));
  });

  // Pending item alerts every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    checkStaleWithdrawals(client).catch(err => console.error("[job:staleWdr]", err));
    checkStaleKyc(client).catch(err => console.error("[job:staleKyc]", err));
    checkStaleMlTopups(client).catch(err => console.error("[job:staleTopup]", err));
  });

  // Fraud detection every 10 minutes
  cron.schedule("*/10 * * * *", () => {
    runVelocityChecks(client).catch(err => console.error("[job:velocity]", err));
    runIpMultiAccountCheck(client).catch(err => console.error("[job:multiAccount]", err));
    runBonusAbuseCheck(client).catch(err => console.error("[job:bonusAbuse]", err));
    runSharedBankCheck(client).catch(err => console.error("[job:sharedBank]", err));
  });

  // Daily digest at 9:00 IST = 3:30 UTC
  cron.schedule("30 3 * * *", () => {
    runDailySummary(client).catch(err => console.error("[job:dailySummary]", err));
  });

  // Weekly digest every Monday at 9:00 IST = 3:30 UTC
  cron.schedule("30 3 * * 1", () => {
    runWeeklyDigest(client).catch(err => console.error("[job:weeklyDigest]", err));
  });

  console.log("[jobs] All scheduled jobs started.");
}
