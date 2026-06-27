import { ModelMessage, streamText } from "ai";
import { NextResponse } from "next/server";

import { bedrock } from "@/lib/bedrock";
import { detectEscalation } from "@/lib/escalation/detect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findRelevantKnowledge, isVolatileKnowledgeQuery } from "@/lib/vectorStore";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function normalizeMessages(messages: unknown): ModelMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const candidate = message as Partial<ChatMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

export async function POST(req: Request) {
  try {
    const { messages: rawMessages, orgId, brandId: brandIdParam, conversationId, customerEmail, customerName } = await req.json();
    const messages = normalizeMessages(rawMessages);
    const latestMessage = messages[messages.length - 1];
    const brandId = typeof brandIdParam === "string" ? brandIdParam : orgId;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!brandId || typeof brandId !== "string" || !uuidRegex.test(brandId)) {
      return NextResponse.json({ error: "A valid Brand UUID is required. Please register or log in with a valid brand account." }, { status: 400 });
    }

    if (!latestMessage || latestMessage.role !== "user") {
      return NextResponse.json({ error: "A latest user message is required." }, { status: 400 });
    }

    const latestContent = String(latestMessage.content);
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
      model: bedrock("apac.amazon.nova-pro-v1:0"),
      system: `You are NexusAI, a helpful customer support bot.
You may respond to basic conversational greetings (like "hi", "hello", "hey") politely.
For any questions or support queries, answer using only the uploaded company document context below and do not use outside knowledge.
For questions about prices, pricing, new cars, sales data, inventory, stock, offers, discounts, or availability, use only context marked "Document type: Latest-only pricing/inventory". Treat its "Uploaded/updated" timestamp as the freshness timestamp. Do not use older price/sales/inventory information, stable documents, or previous chat messages to answer those volatile fields.
Stable terms, warranty, service, policy, and FAQ information may be answered from context marked "Document type: Stable policy/service".
If the context contains a multi-step procedure (such as lodging a complaint, making a return, or troubleshooting), do not output all steps at once. Instead, guide the user interactively, step-by-step. Present only Step 1 first and ask the user if they have it ready or have completed it. Check the conversation history to see which steps are done, and guide them to the next step only when they indicate they are ready.
If the context does not contain the answer to a question, say exactly: "Let me connect you with a human agent."
If the user expresses anger, frustration, or requests a human agent or manager:
1. If they have not yet described a specific, detailed issue (e.g., they just said "I'm angry", "this is terrible", or "connect me to a person" without explaining the actual problem), do NOT offer to connect them to a human agent. Instead, apologize, acknowledge their frustration, and ask them to explain their specific issue or concern in detail so you can try to understand and help them first.
2. If they have already explained a specific concern and you have attempted to answer or resolve it using the Brand context, but they are still frustrated or explicitly insist on a human, say exactly: "Let me connect you with a human agent."

Brand context:
${context}`,
      messages: isVolatileQuery ? [{ role: "user", content: latestContent }] : messages,
      onFinish: async ({ text }) => {
        if (!text) {
          return;
        }

        await supabase.from("messages").insert({
          conversationId: activeConversationId,
          role: "assistant",
          content: text
        });
      }
    });

    return result.toTextStreamResponse({
      headers: {
        "X-Conversation-Id": activeConversationId,
        "X-Conversation-Status": escalation.shouldEscalate ? "Escalated" : "Open"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected chat error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
