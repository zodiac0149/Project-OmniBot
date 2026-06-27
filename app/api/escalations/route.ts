import { NextResponse } from "next/server";

import { getEscalationTerms, extractEscalationReason } from "@/lib/escalation/detect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConversationRow = {
  id: string;
  brandId: string;
  customerEmail: string | null;
  sentimentScore: number;
  createdAt: string;
  brands?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type MessageRow = {
  conversationId: string;
  content: string;
  createdAt: string;
};

function customerNameFromEmail(email: string | null) {
  if (!email) {
    return "Unknown customer";
  }

  return email.split("@")[0].replace(/[._-]+/g, " ");
}

function getBrandName(row: ConversationRow) {
  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
  return brand?.name ?? "Unknown brand";
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: conversations, error: conversationError } = await supabase
      .from("conversations")
      .select("id,brandId,customerEmail,sentimentScore,createdAt,brands(name)")
      .eq("status", "Escalated")
      .order("createdAt", { ascending: false })
      .limit(100);

    if (conversationError) {
      return NextResponse.json({ error: conversationError.message }, { status: 500 });
    }

    const rows = (conversations ?? []) as ConversationRow[];
    const conversationIds = rows.map((conversation) => conversation.id);

    if (conversationIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: messages, error: messageError } = await supabase
      .from("messages")
      .select("conversationId,content,createdAt")
      .in("conversationId", conversationIds)
      .eq("role", "user")
      .order("createdAt", { ascending: true });

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    const messagesByConversation = new Map<string, MessageRow[]>();
    ((messages ?? []) as MessageRow[]).forEach((message) => {
      const existing = messagesByConversation.get(message.conversationId) ?? [];
      existing.push(message);
      messagesByConversation.set(message.conversationId, existing);
    });

    return NextResponse.json(
      rows.map((conversation) => {
        const userMessages = messagesByConversation.get(conversation.id) ?? [];
        const triggerMessage =
          userMessages.find((message) => getEscalationTerms(message.content).length > 0) ??
          userMessages[userMessages.length - 1] ??
          null;
        const terms = triggerMessage ? getEscalationTerms(triggerMessage.content) : [];

        return {
          id: conversation.id,
          brandId: conversation.brandId,
          brandName: getBrandName(conversation),
          customerEmail: conversation.customerEmail,
          customerName: customerNameFromEmail(conversation.customerEmail),
          sentimentScore: conversation.sentimentScore,
          createdAt: conversation.createdAt,
          triggerText: triggerMessage?.content ?? "",
          triggerTerms: terms,
          reason: triggerMessage ? extractEscalationReason(triggerMessage.content) : "General dissatisfaction"
        };
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected escalation report error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
