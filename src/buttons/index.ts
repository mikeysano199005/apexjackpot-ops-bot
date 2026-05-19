import {
  ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ModalActionRowComponentBuilder,
} from "discord.js";
import { config } from "../config";
import { hasRole } from "../lib/permissions";
import { addToWatchlist, addBlacklist } from "../supabase";

async function callAppApi(path: string, body: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${config.appUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bot-secret": config.botSecret,
      },
      body: JSON.stringify(body),
    });
    return await res.json() as { success: boolean; error?: string };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const [action, ...parts] = interaction.customId.split(":");
  const member = interaction.member as any;

  switch (action) {
    // ── ML Approve ──────────────────────────────────────────────────────────────
    case "ml_force_approve": {
      if (!hasRole(member, "Finance")) {
        await interaction.reply({ content: "❌ You need @Finance role.", ephemeral: true }); return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`ml_force_approve_modal:${parts[0]}`)
        .setTitle("Force Approve Withdrawal");
      const reasonInput = new TextInputBuilder()
        .setCustomId("reason").setLabel("Reason (optional)").setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput));
      await interaction.showModal(modal);
      break;
    }

    // ── ML Reject ───────────────────────────────────────────────────────────────
    case "ml_force_reject": {
      if (!hasRole(member, "Finance")) {
        await interaction.reply({ content: "❌ You need @Finance role.", ephemeral: true }); return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`ml_force_reject_modal:${parts[0]}`)
        .setTitle("Reject Withdrawal");
      const reasonInput = new TextInputBuilder()
        .setCustomId("reason").setLabel("Reason (required)").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput));
      await interaction.showModal(modal);
      break;
    }

    // ── ML Top-Up Approve ────────────────────────────────────────────────────────
    case "ml_topup_approve": {
      if (!hasRole(member, "Finance")) {
        await interaction.reply({ content: "❌ You need @Finance role.", ephemeral: true }); return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await callAppApi("/api/admin/ml/topup-requests", { requestId: parts[0], action: "approve" });
      await interaction.editReply(result.success ? "✅ Top-up approved." : `❌ ${result.error}`);
      break;
    }

    // ── ML Top-Up Reject ─────────────────────────────────────────────────────────
    case "ml_topup_reject": {
      if (!hasRole(member, "Finance")) {
        await interaction.reply({ content: "❌ You need @Finance role.", ephemeral: true }); return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`ml_topup_reject_modal:${parts[0]}`)
        .setTitle("Reject Top-Up Request");
      const noteInput = new TextInputBuilder()
        .setCustomId("note").setLabel("Admin note (optional)").setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(noteInput));
      await interaction.showModal(modal);
      break;
    }

    // ── ML Unlock PIN ────────────────────────────────────────────────────────────
    case "ml_unlock_pin": {
      if (!hasRole(member, "Finance")) {
        await interaction.reply({ content: "❌ You need @Finance role.", ephemeral: true }); return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await callAppApi("/api/admin/ml/limits", { userId: parts[0], action: "unlock_pin" });
      await interaction.editReply(result.success ? "✅ PIN unlocked." : `❌ ${result.error}`);
      break;
    }

    // ── KYC Approve ──────────────────────────────────────────────────────────────
    case "kyc_approve": {
      if (!hasRole(member, "Support")) {
        await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await callAppApi("/api/admin/kyc/approve", { userId: parts[0] });
      await interaction.editReply(result.success ? "✅ KYC approved." : `❌ ${result.error}`);
      break;
    }

    // ── KYC Reject ───────────────────────────────────────────────────────────────
    case "kyc_reject": {
      if (!hasRole(member, "Support")) {
        await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`kyc_reject_modal:${parts[0]}`)
        .setTitle("Reject KYC");
      const reasonInput = new TextInputBuilder()
        .setCustomId("reason").setLabel("Rejection reason").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput));
      await interaction.showModal(modal);
      break;
    }

    // ── KYC More Docs ─────────────────────────────────────────────────────────────
    case "kyc_moredocs": {
      if (!hasRole(member, "Support")) {
        await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`kyc_moredocs_modal:${parts[0]}`)
        .setTitle("Request More Documents");
      const docsInput = new TextInputBuilder()
        .setCustomId("docs").setLabel("What's missing?").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(docsInput));
      await interaction.showModal(modal);
      break;
    }

    // ── Ban User ──────────────────────────────────────────────────────────────────
    case "ban_user": {
      if (!hasRole(member, "Support")) {
        await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`ban_user_modal:${parts[0]}:${parts[1] ?? ""}`)
        .setTitle("Ban User");
      const reasonInput = new TextInputBuilder()
        .setCustomId("reason").setLabel("Ban reason").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput));
      await interaction.showModal(modal);
      break;
    }

    // ── Watch User ────────────────────────────────────────────────────────────────
    case "watch_user": {
      if (!hasRole(member, "Support")) {
        await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
      }
      await interaction.deferReply({ ephemeral: true });
      await addToWatchlist({
        user_id: parts[0],
        user_email: parts[1] ?? "—",
        reason: "Flagged via Discord alert",
        added_by: interaction.user.id,
        added_at: new Date().toISOString(),
      });
      await interaction.editReply(`✅ User added to watchlist. You'll be DM'd on their next action.`);
      break;
    }

    // ── Blacklist IP ──────────────────────────────────────────────────────────────
    case "blacklist_ip": {
      if (!hasRole(member, "Support")) {
        await interaction.reply({ content: "❌ You need @Support role.", ephemeral: true }); return;
      }
      await interaction.deferReply({ ephemeral: true });
      await addBlacklist("ip", parts[0], "Flagged via Discord alert", interaction.user.tag);
      await interaction.editReply(`✅ IP \`${parts[0]}\` blacklisted.`);
      break;
    }

    // ── Dismiss Alert ─────────────────────────────────────────────────────────────
    case "dismiss_alert": {
      await interaction.reply({ content: `✅ Alert dismissed by ${interaction.user.tag}.`, ephemeral: false });
      break;
    }

    // ── ML View User ──────────────────────────────────────────────────────────────
    case "ml_view_user": {
      await interaction.reply({ content: `Use \`/user\` command with the user ID or email to view full profile.`, ephemeral: true });
      break;
    }

    default:
      await interaction.reply({ content: "Unknown button action.", ephemeral: true });
  }
}

export async function handleModalSubmit(interaction: any): Promise<void> {
  const [action, ...parts] = interaction.customId.split(":");

  switch (action) {
    case "ml_force_approve_modal": {
      await interaction.deferReply({ ephemeral: true });
      const reason = interaction.fields.getTextInputValue("reason");
      const result = await callApi("/api/admin/ml/force-action", { transactionId: parts[0], action: "approve", reason: reason || undefined });
      await interaction.editReply(result.success ? "✅ Withdrawal force-approved and sent to AeroPay." : `❌ ${result.error}`);
      break;
    }
    case "ml_force_reject_modal": {
      await interaction.deferReply({ ephemeral: true });
      const reason = interaction.fields.getTextInputValue("reason");
      const result = await callApi("/api/admin/ml/force-action", { transactionId: parts[0], action: "reject", reason });
      await interaction.editReply(result.success ? "✅ Withdrawal rejected." : `❌ ${result.error}`);
      break;
    }
    case "ml_topup_reject_modal": {
      await interaction.deferReply({ ephemeral: true });
      const note = interaction.fields.getTextInputValue("note");
      const result = await callApi("/api/admin/ml/topup-requests", { requestId: parts[0], action: "reject", adminNote: note || undefined });
      await interaction.editReply(result.success ? "✅ Top-up rejected." : `❌ ${result.error}`);
      break;
    }
    case "kyc_reject_modal": {
      await interaction.deferReply({ ephemeral: true });
      const reason = interaction.fields.getTextInputValue("reason");
      const result = await callApi("/api/admin/kyc/reject", { userId: parts[0], reason });
      await interaction.editReply(result.success ? "✅ KYC rejected." : `❌ ${result.error}`);
      break;
    }
    case "ban_user_modal": {
      await interaction.deferReply({ ephemeral: true });
      const reason = interaction.fields.getTextInputValue("reason");
      const result = await callApi("/api/admin/users/ban", { userId: parts[0], reason });
      await interaction.editReply(result.success ? `✅ User banned.` : `❌ ${result.error}`);
      break;
    }
    default:
      await interaction.reply({ content: "Unknown modal action.", ephemeral: true });
  }
}

async function callApi(path: string, body: Record<string, unknown>) {
  return callAppApi(path, body);
}
