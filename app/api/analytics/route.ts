import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId") ?? searchParams.get("orgId");

  const supabase = createSupabaseAdminClient();

  if (!brandId) {
    const { count: totalBrands, error: brandError } = await supabase
      .from("brands")
      .select("id", { count: "exact", head: true });

    const { count: totalCustomers, error: customerError } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true });

    const { count: totalDocuments, error: documentError } = await supabase
      .from("brand_documents")
      .select("id", { count: "exact", head: true });

    const { count: totalConversations, error: conversationError } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true });

    const { count: escalations, error: escalationError } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "Escalated");

    const { count: resolved, error: resolvedError } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "Resolved");

    const error = brandError ?? customerError ?? documentError ?? conversationError ?? escalationError ?? resolvedError;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const conversations = totalConversations ?? 0;

    return NextResponse.json({
      totalBrands: totalBrands ?? 0,
      totalCustomers: totalCustomers ?? 0,
      totalDocuments: totalDocuments ?? 0,
      totalConversations: conversations,
      escalations: escalations ?? 0,
      resolutionRate: conversations > 0 ? Math.round(((resolved ?? 0) / conversations) * 100) : 0
    });
  }

  const { count: totalChats, error: totalError } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("brandId", brandId);

  const { count: resolvedChats, error: resolvedError } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("brandId", brandId)
    .eq("status", "Resolved");

  const { count: escalationCount, error: escalationError } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("brandId", brandId)
    .eq("status", "Escalated");

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id,customerEmail,status,sentimentScore,createdAt")
    .eq("brandId", brandId)
    .order("createdAt", { ascending: false })
    .limit(5);

  const error = totalError ?? resolvedError ?? escalationError ?? conversationsError;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = totalChats ?? 0;
  const resolved = resolvedChats ?? 0;

  return NextResponse.json({
    totalChats: total,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    escalationCount: escalationCount ?? 0,
    conversations: conversations ?? []
  });
}
