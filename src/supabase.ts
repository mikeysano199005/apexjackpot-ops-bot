import { createClient } from "@supabase/supabase-js";
import { config } from "./config";
import { BotConfig, DEFAULT_CONFIG, ChannelKey, OncallEntry, WatchlistEntry, Incident } from "./types";

export const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// ─── Bot Config ───────────────────────────────────────────────────────────────

export async function getBotConfig(): Promise<BotConfig> {
  const { data } = await supabase.from("bot_config").select("key, value");
  if (!data || data.length === 0) return { ...DEFAULT_CONFIG };
  const cfg = { ...DEFAULT_CONFIG };
  for (const row of data) {
    if (row.key in cfg) {
      (cfg as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return cfg;
}

export async function setBotConfigKey(key: string, value: unknown): Promise<void> {
  await supabase.from("bot_config").upsert({ key, value }, { onConflict: "key" });
}

// ─── Channel Map ──────────────────────────────────────────────────────────────

export async function getChannelMap(): Promise<Partial<Record<ChannelKey, string>>> {
  const { data } = await supabase.from("bot_channels").select("key, channel_id");
  if (!data) return {};
  return Object.fromEntries(data.map((r: { key: string; channel_id: string }) => [r.key, r.channel_id])) as Partial<Record<ChannelKey, string>>;
}

export async function saveChannelMap(map: Partial<Record<ChannelKey, string>>): Promise<void> {
  const rows = Object.entries(map).map(([key, channel_id]) => ({ key, channel_id }));
  await supabase.from("bot_channels").upsert(rows, { onConflict: "key" });
}

// ─── Incidents ────────────────────────────────────────────────────────────────

export async function createIncident(incident: Omit<Incident, "id">): Promise<Incident | null> {
  const { data } = await supabase.from("bot_incidents").insert(incident).select().single();
  return data;
}

export async function resolveIncident(id: string, resolution: string): Promise<void> {
  await supabase.from("bot_incidents").update({
    resolved_at: new Date().toISOString(),
    summary: resolution,
  }).eq("id", id);
}

export async function getOpenIncidents(): Promise<Incident[]> {
  const { data } = await supabase.from("bot_incidents")
    .select("*").is("resolved_at", null).order("opened_at", { ascending: false });
  return data ?? [];
}

// ─── Oncall ───────────────────────────────────────────────────────────────────

export async function setOncall(role: string, discordId: string, discordTag: string): Promise<void> {
  await supabase.from("bot_oncall").upsert(
    { role, discord_id: discordId, discord_tag: discordTag, set_at: new Date().toISOString() },
    { onConflict: "role" },
  );
}

export async function getOncall(role: string): Promise<OncallEntry | null> {
  const { data } = await supabase.from("bot_oncall").select("*").eq("role", role).single();
  return data ?? null;
}

export async function getOncallAll(): Promise<OncallEntry[]> {
  const { data } = await supabase.from("bot_oncall").select("*");
  return data ?? [];
}

export async function getOncallForRole(role: string): Promise<string | null> {
  const { data } = await supabase.from("bot_oncall").select("discord_id").eq("role", role).single();
  return (data as any)?.discord_id ?? null;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export async function addToWatchlist(entry: WatchlistEntry): Promise<void> {
  await supabase.from("bot_watchlist").upsert(entry, { onConflict: "user_id" });
}

export async function removeFromWatchlist(userId: string): Promise<void> {
  await supabase.from("bot_watchlist").delete().eq("user_id", userId);
}

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const { data } = await supabase.from("bot_watchlist").select("*").order("added_at", { ascending: false });
  return data ?? [];
}

export async function isWatched(userId: string): Promise<WatchlistEntry | null> {
  const { data } = await supabase.from("bot_watchlist").select("*").eq("user_id", userId).single();
  return data ?? null;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscribers(eventType: string): Promise<string[]> {
  const { data } = await supabase.from("bot_subscriptions")
    .select("discord_id").or(`event_type.eq.${eventType},event_type.eq.*`);
  return (data ?? []).map((r: { discord_id: string }) => r.discord_id);
}

export async function addSubscription(discordId: string, eventType: string): Promise<void> {
  await supabase.from("bot_subscriptions").upsert({ discord_id: discordId, event_type: eventType }, { onConflict: "discord_id,event_type" });
}

export async function removeSubscription(discordId: string, eventType: string): Promise<void> {
  await supabase.from("bot_subscriptions").delete().eq("discord_id", discordId).eq("event_type", eventType);
}

// ─── Blacklist ────────────────────────────────────────────────────────────────

export async function addBlacklist(type: string, value: string, reason: string, addedBy: string): Promise<void> {
  await supabase.from("bot_blacklist").upsert({
    type, value, reason, added_by: addedBy, created_at: new Date().toISOString(),
  }, { onConflict: "type,value" });
}

export async function removeBlacklist(type: string, value: string): Promise<void> {
  await supabase.from("bot_blacklist").delete().eq("type", type).eq("value", value);
}

export async function checkBlacklist(value: string): Promise<{ type: string; reason: string } | null> {
  const { data } = await supabase.from("bot_blacklist").select("type, reason").eq("value", value).maybeSingle();
  return data ?? null;
}

// ─── Pinned Message IDs ───────────────────────────────────────────────────────

export async function getPinnedMessageId(key: string): Promise<string | null> {
  const { data } = await supabase.from("bot_pinned_messages").select("message_id").eq("key", key).single();
  return data?.message_id ?? null;
}

export async function savePinnedMessageId(key: string, messageId: string): Promise<void> {
  await supabase.from("bot_pinned_messages").upsert({ key, message_id: messageId }, { onConflict: "key" });
}

// ─── Shift Tracking ───────────────────────────────────────────────────────────

export async function startShift(discordId: string, discordTag: string): Promise<{ started_at: string } | null> {
  const { data: existing } = await supabase.from("bot_shifts")
    .select("id").eq("discord_id", discordId).is("ended_at", null).maybeSingle();
  if (existing) return null;

  const started_at = new Date().toISOString();
  await supabase.from("bot_shifts").insert({ discord_id: discordId, discord_tag: discordTag, started_at });
  return { started_at };
}

export async function endShift(discordId: string, notes: string): Promise<{ started_at: string } | null> {
  const { data: active } = await supabase.from("bot_shifts")
    .select("id, started_at").eq("discord_id", discordId).is("ended_at", null).single();
  if (!active) return null;
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - new Date(active.started_at).getTime();
  await supabase.from("bot_shifts").update({
    ended_at: endedAt,
    notes: notes || null,
    duration_ms: durationMs,
  }).eq("id", active.id);
  return { started_at: active.started_at };
}

// ─── Dedup ────────────────────────────────────────────────────────────────────

const dedupCache = new Map<string, number>();

export function isDuplicate(key: string, windowSeconds: number): boolean {
  const last = dedupCache.get(key);
  const now = Date.now();
  if (last && now - last < windowSeconds * 1000) return true;
  dedupCache.set(key, now);
  return false;
}
