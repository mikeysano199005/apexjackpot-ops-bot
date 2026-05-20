import { Client, EmbedBuilder, ColorResolvable, TextChannel } from "discord.js";
import { COLORS } from "./embeds";
import { getChannel } from "./channels";
import { getPinnedMessageId, savePinnedMessageId } from "../supabase";

// ─── Guide Embeds ─────────────────────────────────────────────────────────────

function makeEmbeds(): EmbedBuilder[] {
  return [
    // ── 1. Overview & Roles ──
    new EmbedBuilder()
      .setColor(COLORS.teal as ColorResolvable)
      .setTitle("📖 ApexJackpot Ops Bot — Commands Guide")
      .setDescription(
        "This bot is the central ops dashboard for the ApexJackpot platform. " +
        "It streams platform events into dedicated channels and gives staff full control via slash commands.\n\n" +
        "**Role Hierarchy** (higher roles inherit lower permissions)\n" +
        "```\n@BotAdmin  — Full control — setup, config, maintenance\n" +
        "@Finance   — Financial ops, ML panel, stats, AI insights\n" +
        "@Support   — User management, bans, watchlist, blacklist\n" +
        "@DevOps    — Health, incidents, shifts\n" +
        "@ReadOnly  — View-only stats and lookups\n```\n" +
        "**Personal alerts** (DM-based) are available to all staff — see the last section.\n" +
        "Run all commands in **#bot-commands**.",
      )
      .setFooter({ text: "ApexJackpot Ops · Commands Guide" }),

    // ── 2. Setup & Config ──
    new EmbedBuilder()
      .setColor(COLORS.info as ColorResolvable)
      .setTitle("⚙️ Setup & Config — @BotAdmin")
      .addFields(
        {
          name: "📦 /setup",
          value: [
            "`/setup run` — Create all channels and roles from scratch",
            "`/setup reset` — Wipe and recreate all bot channels",
            "`/setup status` — Check which channels exist vs. missing",
            "`/setup guide` — Re-post this commands guide to #commands-guide",
          ].join("\n"),
        },
        {
          name: "🔩 /config",
          value: [
            "`/config show` — View all current bot settings",
            "`/config alert <key> <value>` — Set alert thresholds:",
            "  · `Large Deposit (₹)` · `Large Withdrawal (₹)`",
            "  · `Big Win Multiplier` · `Velocity Window (min)`",
            "  · `Velocity Tx Count` · `Failed Login Threshold`",
            "  · `Fraud Sensitivity (1–10)` · `Dedup Window (sec)`",
            "`/config quiet_hours <start> <end>` — Suppress non-critical alerts during these IST hours",
            "`/config pending_alert <key> <value>` — Alert windows for stale pending items:",
            "  · `Pending Withdrawal Alert (min)` · `Pending KYC Alert (hours)`",
            "  · `Pending Topup Alert (min)`",
            "`/config reset` — Reset all settings to defaults",
          ].join("\n"),
        },
      )
      .setFooter({ text: "ApexJackpot Ops · Commands Guide" }),

    // ── 3. Maintenance & On-Call ──
    new EmbedBuilder()
      .setColor(COLORS.warning as ColorResolvable)
      .setTitle("🔧 Maintenance & On-Call — @BotAdmin")
      .addFields(
        {
          name: "🛠️ /maintenance",
          value: [
            "`/maintenance on <scope> [reason]` — Enable maintenance mode",
            "`/maintenance off <scope> [reason]` — Disable maintenance mode",
            "`/maintenance status` — View all scopes at a glance",
            "Scopes: `site` · `games` · `sports` · `deposits` · `withdrawals`",
            "Posts `@here` to #settings-changes when enabled.",
          ].join("\n"),
        },
        {
          name: "📟 /oncall",
          value: [
            "`/oncall set <role> <user>` — Assign on-call person for Finance / Support / DevOps",
            "`/oncall status` — View current on-call roster",
            "On-call staff are DM'd automatically for critical events (gateway down, deploy failed).",
          ].join("\n"),
        },
        {
          name: "🕐 /shift",
          value: [
            "`/shift start` — Clock in for your shift",
            "`/shift end [notes]` — Clock out with optional handoff notes",
            "`/shift report` — View your active shift status",
          ].join("\n"),
        },
      )
      .setFooter({ text: "ApexJackpot Ops · Commands Guide" }),

    // ── 4. Finance ──
    new EmbedBuilder()
      .setColor(COLORS.success as ColorResolvable)
      .setTitle("💰 Finance Commands — @Finance")
      .addFields(
        {
          name: "📊 /stats",
          value: [
            "`/stats today` — Deposits, withdrawals, net flow, failed deposits, new users for today",
            "`/stats week` — Same report for the last 7 days",
            "`/stats snapshot` — Live snapshot: total ML balances, pending withdrawal count, pending KYC count",
          ].join("\n"),
        },
        {
          name: "🔐 /ml",
          value: [
            "`/ml pending` — List all pending ML withdrawals with approve/reject buttons",
            "`/ml balance <email>` — Check an ML user's current balance",
            "`/ml limits <email>` — View daily/monthly withdrawal limits",
            "`/ml unlock <email>` — Unlock a frozen ML PIN",
            "`/ml topup` — List all pending ML top-up requests",
            "`/ml history <email>` — Last ML transactions for a user",
          ].join("\n"),
        },
        {
          name: "🤖 /ask",
          value: [
            "`/ask <question>` — Ask Claude AI a question about platform data",
            "Examples: 'What's the revenue trend this week?' / 'Are there any unusual withdrawal patterns?'",
          ].join("\n"),
        },
      )
      .setFooter({ text: "ApexJackpot Ops · Commands Guide" }),

    // ── 5. Support & Moderation ──
    new EmbedBuilder()
      .setColor(COLORS.orange as ColorResolvable)
      .setTitle("🛡️ Support & Moderation — @Support")
      .addFields(
        {
          name: "👤 /user",
          value: [
            "`/user lookup <email>` — Full profile: balance, role, lifetime deposits/withdrawals",
            "`/user tx <email>` — Last 10 transactions",
            "`/user risk <email>` — AI-generated risk assessment (powered by Claude)",
          ].join("\n"),
        },
        {
          name: "🚫 Bans",
          value: [
            "`/ban <email> <reason>` — Ban a user immediately",
            "`/unban <email>` — Unban a user",
          ].join("\n"),
        },
        {
          name: "👁️ /watch",
          value: [
            "`/watch add <email> <reason>` — Add a user to the watchlist — you'll be DM'd on their every action",
            "`/watch remove <email>` — Remove from watchlist",
            "`/watch list` — View all currently watched users",
          ].join("\n"),
        },
        {
          name: "🔒 /blacklist",
          value: [
            "`/blacklist add <type> <value> <reason>` — Blacklist an IP, email, phone, or bank account",
            "`/blacklist remove <type> <value>` — Remove from blacklist",
            "`/blacklist check <value>` — Check if a value is currently blacklisted",
          ].join("\n"),
        },
        {
          name: "🔍 /risk",
          value: "`/risk <email>` — Generate full Claude AI risk profile for a user",
        },
      )
      .setFooter({ text: "ApexJackpot Ops · Commands Guide" }),

    // ── 6. DevOps & Incidents ──
    new EmbedBuilder()
      .setColor(COLORS.error as ColorResolvable)
      .setTitle("🤖 DevOps & Incidents — @DevOps")
      .addFields(
        {
          name: "💚 /health",
          value: [
            "`/health` — Ping the app server and all payment gateways",
            "Returns live latency and up/down status for each service.",
          ].join("\n"),
        },
        {
          name: "🚨 /incident",
          value: [
            "`/incident open <title>` — Open an incident — pings @here in #incidents",
            "`/incident resolve <id> <summary>` — Resolve an incident (use first 8 chars of ID)",
            "`/incident list` — List all currently open incidents",
          ].join("\n"),
        },
      )
      .setFooter({ text: "ApexJackpot Ops · Commands Guide" }),

    // ── 7. Personal Alerts (all staff) ──
    new EmbedBuilder()
      .setColor(COLORS.purple as ColorResolvable)
      .setTitle("🔔 Personal DM Alerts — All Staff")
      .setDescription(
        "Subscribe to real-time DM alerts for specific event types. " +
        "You'll receive a direct message every time that event fires on the platform.",
      )
      .addFields(
        {
          name: "/subscribe <event>  /unsubscribe <event>",
          value: [
            "`All Withdrawals` — Every withdrawal request",
            "`Failed Deposits` — Every failed deposit",
            "`KYC Submissions` — New KYC documents submitted",
            "`Velocity Alerts` — High-frequency suspicious activity",
            "`Gateway Down` — Payment gateway outage",
            "`ML Pending Approvals` — New ML withdrawal waiting for approval",
            "`Big Wins` — Player wins above the configured multiplier",
          ].join("\n"),
        },
        {
          name: "Live User Channels",
          value: "Every registered user gets their own channel under **👥 USER ACTIVITY**. " +
            "All activity — deposits, withdrawals, KYC, bans, bonuses — is posted there in real-time.",
        },
      )
      .setFooter({ text: "ApexJackpot Ops · Commands Guide · Last updated by /setup guide" }),
  ];
}

// ─── Post / Update Guide ──────────────────────────────────────────────────────

export async function postCommandsGuide(client: Client): Promise<void> {
  const ch = await getChannel(client, "commands_guide");
  if (!ch) {
    console.warn("[Bot] commands_guide channel not found — skipping guide post");
    return;
  }

  const embeds = makeEmbeds();

  // Try to edit existing pinned messages first (idempotent re-posts)
  const savedIds = await Promise.all(
    embeds.map((_, i) => getPinnedMessageId(`commands_guide_${i}`)),
  );

  const allExist = savedIds.every(id => id !== null);

  if (allExist) {
    // Edit existing messages
    let allEdited = true;
    for (let i = 0; i < embeds.length; i++) {
      try {
        const msg = await ch.messages.fetch(savedIds[i]!);
        await msg.edit({ embeds: [embeds[i]] });
      } catch {
        allEdited = false;
        break;
      }
    }
    if (allEdited) {
      console.log("[Bot] Commands guide updated in place.");
      return;
    }
  }

  // Clear old messages and post fresh
  try {
    await (ch as TextChannel).bulkDelete(20, true);
  } catch {}

  for (let i = 0; i < embeds.length; i++) {
    const msg = await ch.send({ embeds: [embeds[i]] });
    await savePinnedMessageId(`commands_guide_${i}`, msg.id);
  }

  console.log("[Bot] Commands guide posted.");
}
