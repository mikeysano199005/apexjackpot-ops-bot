import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { supabase } from "../supabase";

const anthropic = config.anthropicKey ? new Anthropic({ apiKey: config.anthropicKey }) : null;

export async function askClaude(question: string): Promise<string> {
  if (!anthropic) return "AI features not configured (missing ANTHROPIC_API_KEY).";

  const { data: recentTxs } = await supabase
    .from("transactions")
    .select("type, amount_cents, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: recentAudit } = await supabase
    .from("audit_logs")
    .select("action_type, created_at, reason, amount_cents")
    .order("created_at", { ascending: false })
    .limit(50);

  const context = `
Platform: ApexJackpot (India-based gambling platform)
Currency: INR (amounts in paise/cents, divide by 100 for ₹)
Recent transactions (last 100): ${JSON.stringify(recentTxs?.slice(0, 30))}
Recent audit log (last 50): ${JSON.stringify(recentAudit?.slice(0, 20))}
Current time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
`;

  const message = await (anthropic.messages.create as any)({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    messages: [{
      role: "user",
      content: `You are an ops analyst for ApexJackpot platform. Answer concisely in plain English for Discord.\n\nContext:\n${context}\n\nQuestion: ${question}`,
    }],
  });

  const textBlock = message.content.find((b: any) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "No response.";
}

export async function generateUserRiskProfile(userId: string, email: string): Promise<string> {
  if (!anthropic) return "AI features not configured.";

  const [{ data: txs }, { data: audit }, { data: profile }] = await Promise.all([
    supabase.from("transactions").select("type, amount_cents, status, created_at, meta").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("audit_logs").select("action_type, created_at, reason").eq("target_user_id", userId).order("created_at", { ascending: false }).limit(30),
    supabase.from("profiles").select("role, created_at, ml_balance_cents, ml_blocked_cents").eq("id", userId).single(),
  ]);

  const message = await (anthropic.messages.create as any)({
    model: "claude-opus-4-7",
    max_tokens: 800,
    thinking: { type: "adaptive" },
    messages: [{
      role: "user",
      content: `Write a short risk profile for user ${email} in 3-4 bullet points for an ops Discord channel. Include: transaction patterns, any suspicious activity, risk level (Low/Medium/High), and recommendation.\n\nData:\nProfile: ${JSON.stringify(profile)}\nTransactions: ${JSON.stringify(txs?.slice(0, 20))}\nAudit: ${JSON.stringify(audit?.slice(0, 15))}`,
    }],
  });

  const textBlock = message.content.find((b: any) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "Could not generate profile.";
}

export async function generateNightlySummary(): Promise<string> {
  if (!anthropic) return "AI features not configured.";

  const since = new Date(Date.now() - 86400000).toISOString();

  const [{ data: txs }, { data: audit }] = await Promise.all([
    supabase.from("transactions").select("type, amount_cents, status, created_at").gte("created_at", since),
    supabase.from("audit_logs").select("action_type, created_at, reason, amount_cents").gte("created_at", since),
  ]);

  const deposits = txs?.filter(t => t.type === "deposit" && t.status === "completed") ?? [];
  const withdrawals = txs?.filter(t => t.type === "withdraw") ?? [];
  const totalDep = deposits.reduce((s, t) => s + t.amount_cents, 0);
  const totalWdr = withdrawals.filter(t => t.status === "completed").reduce((s, t) => s + t.amount_cents, 0);

  const message = await (anthropic.messages.create as any)({
    model: "claude-opus-4-7",
    max_tokens: 600,
    thinking: { type: "adaptive" },
    messages: [{
      role: "user",
      content: `Write a concise daily ops summary for ApexJackpot platform (for Discord). Keep it under 400 words. Highlight anomalies, risks, and key metrics.\n\nLast 24h:\nDeposits: ${deposits.length} transactions, ₹${(totalDep / 100).toFixed(2)} total\nWithdrawals: ${withdrawals.length} transactions, ₹${(totalWdr / 100).toFixed(2)} completed\nAudit events: ${JSON.stringify(audit?.slice(0, 20))}`,
    }],
  });

  const textBlock = message.content.find((b: any) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "Summary unavailable.";
}
