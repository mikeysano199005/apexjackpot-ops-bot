export const config = {
  botToken: process.env.DISCORD_BOT_TOKEN!,
  clientId: process.env.DISCORD_CLIENT_ID!,
  guildId: process.env.DISCORD_GUILD_ID!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  botSecret: process.env.BOT_SECRET!,
  appUrl: process.env.APP_URL!,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  environment: (process.env.ENVIRONMENT ?? "prod") as "prod" | "staging" | "dev",
  port: Number(process.env.PORT ?? 3001),
  aeropayHealthUrl: process.env.AEROPAY_HEALTH_URL,
  watchpayHealthUrl: process.env.WATCHPAY_HEALTH_URL,
} as const;

export const ENV_COLORS = {
  prod: 0xe74c3c,
  staging: 0xf39c12,
  dev: 0x95a5a6,
} as const;

export const ENV_LABEL = {
  prod: "PROD",
  staging: "STAGING",
  dev: "DEV",
} as const;
