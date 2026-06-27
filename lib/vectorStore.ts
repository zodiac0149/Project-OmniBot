import { embed } from "ai";

import { bedrock } from "@/lib/bedrock";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type KnowledgeMatch = {
  id: string;
  content: string;
  sourceName: string | null;
  documentType?: "stable" | "latest_only";
  documentCategory?: "general" | "policy_terms_warranty" | "volatile";
  sourceUpdatedAt?: string | null;
  similarity: number;
};

const VOLATILE_QUERY_PATTERN = /\b(price|prices|pricing|cost|rate|inventory|stock|availability|available|new car|new cars|car sales|sales data|on road|ex showroom|ex-showroom|discount|offer)\b/i;

export function isVolatileKnowledgeQuery(question: string) {
  return VOLATILE_QUERY_PATTERN.test(question);
}

async function matchKnowledge(
  embedding: number[],
  orgId: string,
  documentType: "stable" | "latest_only",
  matchCount: number
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("match_brand_documents", {
    query_embedding: embedding,
    match_brand_id: orgId,
    match_count: matchCount,
    match_document_type: documentType
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as KnowledgeMatch[];
}

export async function findRelevantKnowledge(question: string, orgId: string) {
  const { embedding } = await embed({
    model: bedrock.embedding("amazon.titan-embed-text-v2:0"),
    value: question,
    providerOptions: {
      bedrock: {
        dimensions: 1024
      }
    }
  });

  const [latestOnlyMatches, stableMatches] = await Promise.all([
    matchKnowledge(embedding, orgId, "latest_only", 5),
    matchKnowledge(embedding, orgId, "stable", 5)
  ]);

  const matches = [...latestOnlyMatches, ...stableMatches]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  if (matches.length === 0) {
    return "";
  }

  return matches
    .map((match, index) => {
      const source = match.sourceName ? `Source: ${match.sourceName}` : "Source: uploaded document";
      const documentType = match.documentType === "latest_only" ? "Latest-only pricing/inventory" : "Stable policy/service";
      const documentCategory =
        match.documentCategory === "policy_terms_warranty" ? "Policy/terms/warranty" : "General";
      const timestamp = match.sourceUpdatedAt ? `Uploaded/updated: ${match.sourceUpdatedAt}` : "Uploaded/updated: unknown";
      return `[${index + 1}] ${source}\nDocument type: ${documentType}\nDocument category: ${documentCategory}\n${timestamp}\n${match.content}`;
    })
    .join("\n\n");
}
