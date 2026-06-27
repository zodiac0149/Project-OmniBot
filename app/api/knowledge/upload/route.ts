import { embedMany } from "ai";
import { NextResponse } from "next/server";

import { bedrock } from "@/lib/bedrock";
import { chunkText } from "@/lib/knowledge/chunk";
import { extractTextFromFile } from "@/lib/knowledge/extract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const LATEST_ONLY_PATTERN = /\b(price|prices|pricing|inventory|stock|availability|available|new car|new cars|car sales|sales data|on road|ex showroom|ex-showroom|discount|offer)\b/i;

type DocumentType = "stable" | "latest_only";
type DocumentCategory = "general" | "policy_terms_warranty" | "volatile";
type StableUploadMode = "append" | "replace";

function getDocumentType(value: FormDataEntryValue | null, fileName: string, text: string): DocumentType {
  if (value === "latest_only") {
    return "latest_only";
  }

  if (value === "stable") {
    return "stable";
  }

  return LATEST_ONLY_PATTERN.test(`${fileName}\n${text.slice(0, 2000)}`) ? "latest_only" : "stable";
}

function getDocumentCategory(value: FormDataEntryValue | null, documentType: DocumentType): DocumentCategory {
  if (documentType === "latest_only") {
    return "volatile";
  }

  return value === "policy_terms_warranty" ? "policy_terms_warranty" : "general";
}

function getStableUploadMode(value: FormDataEntryValue | null): StableUploadMode {
  return value === "replace" ? "replace" : "append";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const brandId = formData.get("brandId") ?? formData.get("orgId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A PDF or text file is required." }, { status: 400 });
    }

    if (!brandId || typeof brandId !== "string") {
      return NextResponse.json({ error: "brandId is required." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be 8MB or smaller." }, { status: 400 });
    }

    const rawText = await extractTextFromFile(file);
    const chunks = chunkText(rawText);
    const documentType = getDocumentType(formData.get("documentType"), file.name, rawText);
    const documentCategory = getDocumentCategory(formData.get("documentCategory"), documentType);
    const stableUploadMode = getStableUploadMode(formData.get("stableUploadMode"));
    const uploadBatchId = crypto.randomUUID();
    const sourceUpdatedAt = new Date().toISOString();

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No readable text was found in the file." }, { status: 400 });
    }

    const { embeddings } = await embedMany({
      model: bedrock.embedding("amazon.titan-embed-text-v2:0"),
      values: chunks,
      providerOptions: {
        bedrock: {
          dimensions: 1024
        }
      }
    });

    const rows = chunks.map((content, index) => ({
      brandId,
      content,
      embedding: embeddings[index],
      sourceName: file.name,
      chunkIndex: index,
      documentType,
      documentCategory,
      uploadBatchId,
      sourceUpdatedAt
    }));

    const supabase = createSupabaseAdminClient();
    let replacedExistingChunks = 0;

    if (documentType === "latest_only") {
      const { count, error: deleteError } = await supabase
        .from("brand_documents")
        .delete({ count: "exact" })
        .eq("brandId", brandId)
        .eq("documentType", "latest_only");

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      replacedExistingChunks = count ?? 0;
    }

    if (documentType === "stable" && documentCategory === "policy_terms_warranty" && stableUploadMode === "replace") {
      const { count, error: deleteError } = await supabase
        .from("brand_documents")
        .delete({ count: "exact" })
        .eq("brandId", brandId)
        .eq("documentType", "stable")
        .eq("documentCategory", "policy_terms_warranty");

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      replacedExistingChunks = count ?? 0;
    }

    const { error } = await supabase.from("brand_documents").insert(rows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sourceName: file.name,
      chunksStored: rows.length,
      documentType,
      documentCategory,
      stableUploadMode,
      replacedExistingChunks,
      sourceUpdatedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected upload error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
