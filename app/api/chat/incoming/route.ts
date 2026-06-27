import { openai } from "@ai-sdk/openai";
import { ModelMessage, streamText } from "ai";
import { NextResponse } from "next/server";

import { detectEscalation } from "@/lib/escalation/detect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findRelevantKnowledge, isVolatileKnowledgeQuery } from "@/lib/vectorStore";

export const runtime = "nodejs";

type IncomingPayload = {
  orgId?: string;
  brandId?: string;
  content?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  conversationId?: string;
  customerEmail?: string | null;
  channel?: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    const payload = (await req.json()) as IncomingPayload;
    const { orgId, brandId: brandIdParam, content, messages: rawMessages, conversationId, customerEmail } = payload;
    const brandId = typeof brandIdParam === "string" ? brandIdParam : orgId;

    const messages: ModelMessage[] = Array.isArray(rawMessages)
      ? rawMessages.map((m) => ({ role: m.role, content: m.content }))
      : content
      ? [{ role: "user", content }]
      : [];

    if (!brandId || typeof brandId !== "string") {
      return NextResponse.json({ error: "brandId is required." }, { status: 400 });
    }

    if (!messages.length) {
      return NextResponse.json({ error: "Message content is required." }, { status: 400 });
    }

    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "user") {
      return NextResponse.json({ error: "Latest user message required." }, { status: 400 });
    }

    const latestContent = String(latest.content);
    const isVolatileQuery = isVolatileKnowledgeQuery(latestContent);
    const escalation = detectEscalation(latestContent);
    const supabase = createSupabaseAdminClient();
    let activeConversationId = typeof conversationId === "string" ? conversationId : "";

    if (!activeConversationId) {
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          brandId,
          customerEmail: typeof customerEmail === "string" ? customerEmail : null,
          status: escalation.shouldEscalate ? "Escalated" : "Open",
          sentimentScore: escalation.sentimentScore
        })
        .select("id")
        .single();

      if (conversationError || !conversation) {
        return NextResponse.json(
          { error: conversationError?.message ?? "Unable to create conversation." },
          { status: 500 }
        );
      }

      activeConversationId = conversation.id;
    } else {
      const { error: updateError } = await supabase
        .from("conversations")
        .update(
          escalation.shouldEscalate
            ? {
                status: "Escalated",
                sentimentScore: escalation.sentimentScore
              }
            : {
                sentimentScore: escalation.sentimentScore
              }
        )
        .eq("id", activeConversationId)
        .eq("brandId", brandId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const { error: userMessageError } = await supabase.from("messages").insert({
      conversationId: activeConversationId,
      role: "user",
      content: latestContent
    });

    if (userMessageError) {
      return NextResponse.json({ error: userMessageError.message }, { status: 500 });
    }

    const companyContext = await findRelevantKnowledge(latestContent, brandId);
    const context = companyContext || "No relevant uploaded brand documents were found.";

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: `You are NexusAI, a helpful customer support bot.
Answer using only the uploaded brand document context below.
For questions about prices, pricing, new cars, sales data, inventory, stock, offers, discounts, or availability, use only context marked "Document type: Latest-only pricing/inventory". Treat its "Uploaded/updated" timestamp as the freshness timestamp. Do not use older price/sales/inventory information, stable documents, or previous chat messages to answer those volatile fields.
Stable terms, warranty, service, policy, and FAQ information may be answered from context marked "Document type: Stable policy/service".
If the context does not contain the answer, say exactly: "Let me connect you with a human agent."
If the user asks for a human, a manager, or sounds angry, say exactly: "Let me connect you with a human agent."

Brand context:
${context}`,
      messages: isVolatileQuery ? [{ role: "user", content: latestContent }] : messages,
      onFinish: async ({ text }) => {
        if (!text) return;

        await supabase.from("messages").insert({
          conversationId: activeConversationId,
          role: "assistant",
          content: text
        });
      }
    });

    // Consume the text stream to build the final assistant content for non-web channels
    const streamResponse = await result.toTextStreamResponse();
    if (!streamResponse.body) {
      return NextResponse.json({ error: "No stream body from generator." }, { status: 500 });
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });
    }

    return NextResponse.json({
      assistantText,
      conversationId: activeConversationId,
      conversationStatus: escalation.shouldEscalate ? "Escalated" : "Open"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected incoming chat error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
